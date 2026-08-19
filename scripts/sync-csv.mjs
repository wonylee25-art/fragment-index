// 논문 목록(data/riss-papers.csv, scripts/fetch-riss-papers.mjs가 만든다)을 Supabase에
// 반영한다. 실행: npm run sync
//
// 예전에는 구글 시트에서 내보낸 CSV 4개(chronicle, oral segments, persons_authority,
// sources_authority)도 여기서 밀어 넣었다. 2026-08-19에 걷어냈다 — 넣고 고치는 자리가
// /admin 화면으로 옮겨간 뒤로 CSV는 원본이 아니라 옛 사본이 되었는데, 그런데도 이 스크립트가
// 화면에서 고친 값을 시트의 옛 값으로 되돌리고 있었다. 특히 연구 동향의 "새로고침" 버튼이
// npm run sync를 함께 돌리는 탓에(research-sync-actions.ts), 논문만 받으려고 누른 버튼에
// 구술·인물·사건이 통째로 되감겼다.
//
// 이제 사람이 넣고 고치는 것의 원본은 Supabase 하나뿐이다. 걷어낸 CSV는 data/backup/에 있다.
//
// 행 단위로 검증해서, 문제 있는 행만 건너뛰고 사유를 출력한 뒤 나머지는 계속 진행한다
// (전체 차단 아님).

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./lib/csv.mjs";
import { RISS_PAPERS_CSV_PATH } from "./lib/riss-papers-csv.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

function readCsv(path) {
  return parseCsv(readFileSync(path, "utf-8"));
}

function splitMulti(value) {
  return String(value ?? "").split(";").map((v) => v.trim()).filter(Boolean);
}

// PostgREST가 응답 하나를 1000행에서 자른다. 논문은 이미 3천 건이 넘으므로 나눠 받는다 —
// 안 그러면 있는 행을 "새 행"으로 잘못 세어 신규/갱신 집계가 어긋난다.
const PAGE = 1000;

async function fetchExisting(table, columns) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data) map.set(row.id, row);
    if (data.length < PAGE) break;
  }
  return map;
}

const report = {};
function log(table, action) {
  report[table] ??= { new: 0, updated: 0, skipped: 0 };
  report[table][action]++;
}

// ---------- papers (data/riss-papers.csv, scripts/fetch-riss-papers.mjs가 생성) ----------
async function syncPapers() {
  if (!existsSync(RISS_PAPERS_CSV_PATH)) {
    console.warn(`[papers] ${RISS_PAPERS_CSV_PATH} 없음 — npm run fetch:riss 먼저 실행하세요. 건너뜀.`);
    return;
  }
  const rows = readCsv(RISS_PAPERS_CSV_PATH);
  const existing = await fetchExisting("papers", "id");
  const upserts = [];
  for (const r of rows) {
    if (!r.paper_id || !r.title) { log("papers", "skipped"); continue; }
    upserts.push({
      id: r.paper_id,
      paper_type: r.type,
      title: r.title,
      author: r.author || null,
      year: r.year ? parseInt(r.year, 10) : null,
      institution: r.institution || null,
      journal_name: r.journal || null,
      // "-"는 backfill-volume-issue.mjs가 "권호사항 필드 자체가 없음을 확인함"을 표시하는
      // 값이라 재시도 스킵용일 뿐, 실제 DB/화면에는 null로 들어가야 한다.
      volume_issue: r.volume_issue && r.volume_issue !== "-" ? r.volume_issue : null,
      degree_level: r.degree_level || null,
      keywords: splitMulti(r.keywords),
      riss_url: r.riss_url || null,
    });
    log("papers", existing.has(r.paper_id) ? "updated" : "new");
  }
  if (upserts.length) {
    const { error } = await supabase.from("papers").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }

  // "연구 동향" 화면에 "이 목록은 언제 기준인지" 보여주기 위한 타임스탬프.
  const { error: statusError } = await supabase
    .from("sync_status")
    .upsert({ id: "papers", last_synced_at: new Date().toISOString() }, { onConflict: "id" });
  if (statusError) throw statusError;
}

async function main() {
  await syncPapers();

  console.log("\n동기화 결과:");
  for (const [table, r] of Object.entries(report)) {
    console.log(`  ${table}: 신규 ${r.new} · 갱신 ${r.updated} · 건너뜀 ${r.skipped}`);
  }
}

main().catch((err) => {
  console.error("동기화 실패:", err);
  process.exit(1);
});
