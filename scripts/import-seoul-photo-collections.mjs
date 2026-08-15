// 서울특별시_서울기록원 디지털아카이브 사진아카이브 컬렉션(data.go.kr, 15134917)을
// data/raw/에서 읽어 archive_items에 반영한다. 실행:
//   node --env-file=.env.local scripts/import-seoul-photo-collections.mjs
//
// CSV(ID/TITLE/DESC 3컬럼, EUC-KR 인코딩)에는 상세페이지 링크가 없다. 대신
// archives.seoul.go.kr/photo(서울사진 아카이브 목록)를 실시간으로 받아 컬렉션 제목으로
// 매칭해서 실제 상세페이지(/photo/collection/detail/<id>) URL을 찾는다 — CSV의 ID 컬럼은
// 이 사이트의 컬렉션 번호와 다르다(예: CSV ID=8 "서울 시내버스"가 실제로는 detail/11).
// 제목이 목록에 없는 컬렉션(CSV 발행 이후 사이트에서 없어졌거나 이름이 바뀐 경우)은
// 목록 페이지 URL로 대체한다.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./lib/csv.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

const CSV_PATH = "data/raw/서울특별시_서울기록원 디지털아카이브 사진아카이브 컬렉션_20240903.csv";
const LIST_URL = "https://archives.seoul.go.kr/photo";
const DETAIL_BASE = "https://archives.seoul.go.kr/photo/collection/detail";

function readCsvEucKr(path) {
  const buf = readFileSync(path);
  const text = new TextDecoder("euc-kr").decode(buf);
  return parseCsv(text);
}

async function fetchTitleToDetailIdMap() {
  const res = await fetch(LIST_URL);
  const html = await res.text();
  const pattern = /<a href="\/photo\/collection\/detail\/(\d+)">.*?<p class="title">([^<]*)<\/p>/gs;
  const map = new Map();
  for (const m of html.matchAll(pattern)) {
    map.set(m[2].trim(), m[1]);
  }
  return map;
}

// 원본 CSV의 DESC 필드에 줄바꿈이 실제 개행이 아니라 리터럴 문자열 "/r/n"(98건 중 86건)
// 또는 "/n"으로 들어있음 — 데이터 자체의 문제라 정리해서 저장한다.
function cleanText(text) {
  return String(text ?? "").replace(/\/r\/n|\/n/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text, max = 150) {
  const t = cleanText(text);
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function main() {
  const rows = readCsvEucKr(CSV_PATH);
  console.log(`CSV ${rows.length}행 로드`);

  const titleMap = await fetchTitleToDetailIdMap();
  console.log(`서울사진 아카이브 목록에서 컬렉션 ${titleMap.size}건 확인`);

  let matched = 0;
  let fallback = 0;
  const upserts = rows.map((r) => {
    const csvId = r["ID(컬렉션번호)"];
    const title = r["TITLE(컬렉션제목)"].trim();
    const desc = r["DESC(컬렉션내용)"];
    const detailId = titleMap.get(title);
    const sourceUrl = detailId ? `${DETAIL_BASE}/${detailId}` : LIST_URL;
    if (detailId) matched++; else fallback++;

    return {
      id: `seoul-photo-${csvId}`,
      event_id: null,
      item_type: "이미지",
      title,
      source_org: "서울기록원",
      source_url: sourceUrl,
      description: truncate(desc),
    };
  });

  const { error } = await supabase.from("archive_items").upsert(upserts, { onConflict: "id" });
  if (error) throw error;

  console.log(`\n반영 완료: ${upserts.length}건 (상세페이지 매칭 ${matched}건, 목록페이지로 대체 ${fallback}건)`);
  if (fallback > 0) {
    console.log("대체된 컬렉션(제목):");
    for (const r of rows) {
      const title = r["TITLE(컬렉션제목)"].trim();
      if (!titleMap.has(title)) console.log(`  - [${r["ID(컬렉션번호)"]}] ${title}`);
    }
  }
}

main().catch((err) => {
  console.error("가져오기 실패:", err);
  process.exit(1);
});
