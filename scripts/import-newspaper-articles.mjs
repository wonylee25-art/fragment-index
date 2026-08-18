// 직접 정리한 신문기사 시트(구글 시트)를 archive_items에 반영한다. 실행:
//   node --env-file=.env.local scripts/import-newspaper-articles.mjs
//
// 시트를 매번 링크에서 직접 받는다 — 손으로 내려받아 두는 단계를 없애기 위함이다. 대신 받은
// CSV를 data/에 그대로 덮어 저장한다: 시트에서 행이 잘못 지워지거나 고쳐져도 커밋 이력에
// 그때의 원본이 남는다. 시트 공유가 "링크가 있는 모든 사용자"인 동안만 작동한다.
//
// 기사 본문은 네이버 뉴스라이브러리에서 긁어온 것이 아니라 사람이 읽고 옮겨 적은 발췌다.
// (뉴스라이브러리는 robots.txt가 전면 금지라 자동 수집이 불가능하고, 해서도 안 된다.)
// 지면 이미지도 같은 이유로 가져오지 않는다 — image_url은 비워 둔다.
//
// 병합 정책은 sync-csv.mjs와 같다: 새 id는 insert, 이미 있는 id는 "시트 칸이 비어있지 않은
// 필드만" 덮어쓴다. 들여온 뒤 화면에서 다듬은 설명을 빈 칸으로 지워버리는 사고를 막는다.

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./lib/csv.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

const SHEET_ID = "1ydqwpb-Z8d-o1QYP509cXYsBecDQyt3Ay5YhoPYB-Ck";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const SNAPSHOT_PATH = "data/newspaper-articles.csv";

// "1961. 9. 20" → "1961-09-20". 연·월까지만 적힌 행도 EDTF로는 유효하므로 있는 만큼만 채운다.
function toEdtf(raw) {
  const parts = String(raw ?? "").split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const [y, m, d] = parts;
  if (!/^\d{4}$/.test(y)) return null;
  if (!m) return y;
  const mm = String(m).padStart(2, "0");
  if (!d) return `${y}-${mm}`;
  return `${y}-${mm}-${String(d).padStart(2, "0")}`;
}

// 시트 키워드 칸은 세미콜론으로 나뉘는데 표기가 고르지 않다 — "신발도깨비시장; 신발시장"처럼
// 뒤에 공백이 붙거나, 끝에 세미콜론만 남은 행이 있다. 나누고 다듬고 중복만 걷어낸다.
function splitKeywords(raw) {
  const list = String(raw ?? "").split(";").map((k) => k.trim()).filter(Boolean);
  return list.length > 0 ? [...new Set(list)] : null;
}

function cleanText(text) {
  return String(text ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// 목록 카드에 뜨는 짧은 설명. 전문은 full_text가 따로 들고 있다.
function summarize(text, max = 150) {
  const t = cleanText(text).replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// 네이버 뉴스라이브러리 주소에 든 기사 고유번호를 id로 쓴다 — 시트에서 행 순서가 바뀌거나
// 중간에 기사를 끼워 넣어도 같은 기사는 같은 id를 유지한다. 번호를 못 찾으면 날짜로 짓되,
// 같은 날짜가 여럿이면 뒤에 순번을 붙인다.
function makeId(link, edtf, seenDates) {
  const m = String(link ?? "").match(/(?:media)?[aA]rticleId=(\d+)/);
  if (m) return `news-${m[1]}`;
  const base = (edtf ?? "unknown").replace(/-/g, "");
  const n = (seenDates.get(base) ?? 0) + 1;
  seenDates.set(base, n);
  return `news-${base}-${String(n).padStart(2, "0")}`;
}

function mergeValue(existing, incoming) {
  if (incoming === null || incoming === undefined) return existing;
  if (typeof incoming === "string" && incoming.trim() === "") return existing;
  if (Array.isArray(incoming) && incoming.length === 0) return existing;
  return incoming;
}

async function main() {
  const res = await fetch(SHEET_CSV_URL, { redirect: "follow" });
  if (!res.ok) {
    console.error(`시트를 받지 못했습니다(HTTP ${res.status}). 공유 설정이 "링크가 있는 모든 사용자"인지 확인하세요.`);
    process.exit(1);
  }
  const csvText = await res.text();
  writeFileSync(SNAPSHOT_PATH, csvText);
  console.log(`시트 원본을 ${SNAPSHOT_PATH}에 저장했습니다.`);

  const rows = parseCsv(csvText);
  console.log(`시트 ${rows.length}행 로드`);

  const seenDates = new Map();
  const skipped = [];
  const items = [];
  for (const [i, r] of rows.entries()) {
    const title = (r["표제"] ?? "").trim();
    if (!title) {
      skipped.push(`${i + 2}행: 표제가 비어 있음`);
      continue;
    }
    const edtf = toEdtf(r["날짜"]);
    if (!edtf) skipped.push(`${i + 2}행: 날짜를 읽지 못함("${r["날짜"]}") — 날짜 없이 넣습니다`);
    const body = cleanText(r["내용"]);
    items.push({
      id: makeId(r["링크"], edtf, seenDates),
      item_type: "신문",
      title,
      date_value: edtf,
      source_org: (r["출처"] ?? "").trim() || null,
      source_url: (r["링크"] ?? "").trim() || null,
      keywords: splitKeywords(r["키워드"]),
      description: summarize(body) || null,
      full_text: body || null,
    });
  }

  // 같은 기사가 시트에 두 번 적힌 경우 — 뒤엣것으로 합친다(upsert가 같은 배치에서 충돌하면 실패한다).
  const byId = new Map();
  for (const it of items) {
    if (byId.has(it.id)) skipped.push(`중복 기사번호 ${it.id} — 나중 행으로 덮습니다("${it.title}")`);
    byId.set(it.id, it);
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("archive_items")
    .select("id, item_type, title, date_value, source_org, source_url, keywords, description, full_text")
    .in("id", [...byId.keys()]);
  if (fetchError) throw fetchError;
  const existing = new Map((existingRows ?? []).map((r) => [r.id, r]));

  const payload = [...byId.values()].map((it) => {
    const prev = existing.get(it.id);
    if (!prev) return it;
    const merged = { id: it.id };
    for (const [k, v] of Object.entries(it)) {
      if (k !== "id") merged[k] = mergeValue(prev[k], v);
    }
    return merged;
  });

  const { error } = await supabase.from("archive_items").upsert(payload, { onConflict: "id" });
  if (error) throw error;

  const added = payload.filter((p) => !existing.has(p.id)).length;
  console.log(`\n반영 완료: 새 사료 ${added}건, 기존 갱신 ${payload.length - added}건`);
  if (skipped.length > 0) {
    console.log(`\n확인이 필요한 행 ${skipped.length}건:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
  console.log("\n들여온 사료는 전부 보류함에 있습니다 — 어느 사건에 붙일지는 [사료 연결] 화면에서 정합니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
