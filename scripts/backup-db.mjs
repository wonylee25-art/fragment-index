// 사람이 만든 것만 골라 파일 하나로 떠낸다. 실행: npm run backup
//
// 왜 필요한가 — Supabase 무료 플랜에는 자동 백업이 없다(일 단위 백업·PITR은 Pro부터). 지금
// 이 프로젝트에서 실수로 지우거나 덮어쓴 것을 되돌릴 수단은 이 스냅샷 말고 없다. 삭제 시점에
// 자동으로 남기는 방식(그림자 테이블)을 택하지 않은 것은, 실수가 삭제보다 수정에서 더 자주
// 나기 때문이다 — 잘못 고쳐 쓴 발췌는 삭제 기록으로 되돌릴 수 없지만 스냅샷으로는 된다.
//
// 무엇을 담는가 —
//   통째로: 화면에서 손으로 만든 것 전부(합쳐 200행 남짓이라 나눌 이유가 없다).
//   골라서: timeline_events·papers는 기계가 긁어온 재고라 다시 받으면 그만이지만, 그 위에
//           얹힌 사람의 판단은 다시 받으면 사라진다. 연표로 꺼낸 딱지(adopted_at), 저장·메모·
//           강조, 쳐낸 표시(hidden_at), 그리고 화면에서 직접 만든 행(ev_/manual- 접두어)만 뜬다.
//           6,430건 본문을 매번 뜨는 것은 파일만 무겁게 한다.
//   제외:   sync_status(타임스탬프 한 줄, 다시 동기화하면 채워진다).
//
// 되돌릴 때는 이 파일을 손에 들고 사람이 판단해서 넣는다 — 자동 복원 스크립트는 없다.
// 스냅샷이 최신이라는 보장이 없는데 통째로 밀어 넣으면 그 뒤에 한 일까지 되감기 때문이다.

import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rotateBackups } from "./lib/rotate-backups.mjs";

const OUT_DIR = "data/backup";
const PAGE = 1000; // PostgREST가 응답 하나를 이 행 수에서 자른다

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

// 통째로 뜨는 테이블 — 전부 화면에서 사람이 넣고 고친 것이다.
// 값은 페이지를 나눠 받을 때 쓸 정렬 기준 열이다. 발췌에 딸린 화자·주석 표처럼 id가 없고
// (segment_id, seq)로 한 행이 정해지는 표가 있어 테이블마다 적어 둔다.
const FULL_TABLES = {
  segments: "id",
  segment_speakers: "segment_id",
  segment_notes: "segment_id",
  segment_persons: "segment_id",
  persons: "id",
  sources: "id",
  archive_items: "id",
  paper_quotes: "id",
  user_memos: "id",
  links: "id",
};

// 사람 흔적만 뜨는 테이블 — 필터는 PostgREST or() 문법이고, like의 와일드카드는 *다.
const PARTIAL_TABLES = [
  {
    table: "timeline_events",
    // ev_ = 화면에서 직접 만든 사건. 나머지는 오늘의역사에서 들여온 재고 중 사람이 손댄 것.
    // 메모는 2026-08-23부터 user_memos 표에 따로 쌓인다 — 여기서는 걸리지 않고,
    // 메모만 적어 둔 사건은 아래 fetchMemoOwners가 마저 떠 온다.
    filter: "id.like.ev_*,adopted_at.not.is.null,highlighted.eq.true,hidden_at.not.is.null",
  },
  {
    table: "papers",
    // manual- = 화면에서 직접 추가한 논문. hidden_at = 목록에서 쳐낸 판단(paper-actions.hidePaper).
    filter: "id.like.manual-*,hidden_at.not.is.null",
  },
];

async function fetchAll(table, { orderBy = "id", filter } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select("*").order(orderBy).range(from, from + PAGE - 1);
    if (filter) q = q.or(filter);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// 위 그물에 안 걸린 부모를 마저 떠 온다. RISS로 들어온 책(riss-)에 수록글을 매달면 자식만
// manual-이라 부모는 백업에서 빠지는데, 그러면 복원할 때 갈 곳 없는 장이 된다
// (papers.parent_id는 papers를 참조한다 — 20260823_add_chapters_to_papers.sql).
// or() 필터로는 "자식이 있는 행"을 물을 수 없어서, 뜬 자식들의 parent_id를 모아 한 번 더 받는다.
async function fetchMissingParents(rows) {
  const have = new Set(rows.map((r) => r.id));
  const missing = [...new Set(rows.map((r) => r.parent_id).filter(Boolean))].filter((id) => !have.has(id));
  if (missing.length === 0) return [];
  const { data, error } = await supabase.from("papers").select("*").in("id", missing);
  if (error) throw new Error(`papers(부모): ${error.message}`);
  return data;
}

// 메모가 걸린 주인 행을 마저 떠 온다. user_memos는 통째로 뜨는데(위 FULL_TABLES) 그 주인인
// 사건·논문은 "사람이 손댄 것만" 뜨는 표라, 메모 하나만 적어 둔 행은 그 그물에 안 걸린다 —
// 그대로 두면 복원할 때 갈 곳 없는 메모가 된다(user_memos의 외래키). 부모 없는 수록글을
// 되찾아 오는 fetchMissingParents와 같은 이치다.
async function fetchMemoOwners(memos, table, column, have) {
  const missing = [...new Set(memos.map((m) => m[column]).filter(Boolean))].filter((id) => !have.has(id));
  if (missing.length === 0) return [];
  const { data, error } = await supabase.from(table).select("*").in("id", missing);
  if (error) throw new Error(`${table}(메모 주인): ${error.message}`);
  return data;
}

async function main() {
  const tables = {};
  const counts = {};

  for (const [table, orderBy] of Object.entries(FULL_TABLES)) {
    const rows = await fetchAll(table, { orderBy });
    tables[table] = rows;
    counts[table] = rows.length;
    console.log(`  ${table.padEnd(18)} ${rows.length}행`);
  }

  for (const { table, filter } of PARTIAL_TABLES) {
    const rows = await fetchAll(table, { filter });
    const memoColumn = table === "papers" ? "paper_id" : "timeline_event_id";
    rows.push(...(await fetchMemoOwners(tables.user_memos, table, memoColumn, new Set(rows.map((r) => r.id)))));
    // 부모 찾기는 메모 주인까지 담은 뒤에 돈다 — 메모만 적어 둔 수록글의 부모도 함께 떠야 한다.
    if (table === "papers") rows.push(...(await fetchMissingParents(rows)));
    tables[table] = rows;
    counts[table] = rows.length;
    console.log(`  ${table.padEnd(18)} ${rows.length}행 (사람이 손댄 것만)`);
  }

  const savedAt = new Date().toISOString();
  const snapshot = {
    savedAt,
    note: "사람이 만든 것만 떠낸 스냅샷 (npm run backup). timeline_events·papers는 사람이 손댄 행만 담겨 있다.",
    counts,
    tables,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  // 날짜까지만 쓴다 — 하루에 여러 번 돌리면 그날 파일을 덮어써서, 큰 작업 전에 습관처럼 눌러도
  // 폴더가 불어나지 않는다.
  const path = `${OUT_DIR}/snapshot-${savedAt.slice(0, 10)}.json`;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const kb = Math.round(Buffer.byteLength(JSON.stringify(snapshot)) / 1024);

  // 매일 자동으로 도는 이상(launchd), 아무것도 안 고친 날까지 파일을 남기면 폴더가 뜻 없이
  // 불어난다. 직전 스냅샷과 알맹이가 같으면 쓰지 않는다 — savedAt은 돌린 시각이라 늘 다르므로
  // 비교에서 뺀다. 오늘 파일을 이미 쓴 뒤라면 그 파일이 곧 직전 스냅샷이라 자연히 걸린다.
  if (unchangedFrom(latestSnapshotPath(path), snapshot)) {
    console.log(`\n직전 스냅샷과 같아 새 파일을 만들지 않았습니다 (합계 ${total}행).`);
  } else {
    writeFileSync(path, JSON.stringify(snapshot, null, 2));
    console.log(`\n${path} — 합계 ${total}행, ${kb}KB`);
  }

  for (const { archive, count } of rotateBackups(OUT_DIR)) {
    console.log(`  ${OUT_DIR}/${archive} — 7일 지난 ${count}장을 묶었습니다`);
  }
}

// 오늘 쓸 파일을 뺀, 가장 최근 스냅샷의 경로. 없으면 null.
function latestSnapshotPath(exclude) {
  if (!existsSync(OUT_DIR)) return null;
  const files = readdirSync(OUT_DIR)
    .filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => `${OUT_DIR}/${f}`)
    .filter((f) => f !== exclude)
    .sort();
  return files.at(-1) ?? null;
}

// 알맹이(counts·tables)만 견준다. 읽다가 깨진 파일을 만나면 같지 않은 것으로 보고 새로 쓴다 —
// 백업에서 애매하면 남기는 쪽이 맞다.
function unchangedFrom(path, snapshot) {
  if (!path) return false;
  try {
    const prev = JSON.parse(readFileSync(path, "utf-8"));
    return JSON.stringify({ counts: prev.counts, tables: prev.tables })
      === JSON.stringify({ counts: snapshot.counts, tables: snapshot.tables });
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error("백업 실패:", err);
  process.exit(1);
});
