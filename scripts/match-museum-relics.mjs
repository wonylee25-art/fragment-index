// 국립중앙박물관 유물정보 API로 chronicleEvents 키워드를 검색해, 매칭 후보를 콘솔에 출력한다.
// 실행: node --env-file=.env.local scripts/match-museum-relics.mjs [검색어]
// 결과는 자동으로 real-data.ts에 반영되지 않는다 — 사람이 눈으로 확인하고 골라서 직접 옮겨 적는다
// (6-4/6-5 원칙: 신뢰할 만한 매칭이 아니면 억지로 붙이지 않는다).
//
// curl을 쓰는 이유: Node의 fetch/https(undici)로 이 게이트웨이(1371027)를 호출하면
// 매번 "웹 보안 정책 위반" 차단 페이지(HTTP 200 + HTML)가 돌아온다 — TLS 클라이언트 지문
// 기반 WAF로 보인다. curl은 같은 요청에 정상 XML로 응답한다.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { XMLParser } from "fast-xml-parser";

const execFileAsync = promisify(execFile);
const BASE_URL = "https://apis.data.go.kr/1371027/openapi";
const key = process.env.NATIONAL_MUSEUM_API_KEY;
if (!key) {
  console.error("NATIONAL_MUSEUM_API_KEY가 없습니다. .env.local을 확인하거나 --env-file로 로드하세요.");
  process.exit(1);
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function flattenDataEntry(entry) {
  const items = asArray(entry.item);
  const record = {};
  for (const item of items) {
    if (item["@_key"]) record[item["@_key"]] = item["@_value"] ?? "";
  }
  return record;
}

async function search(query, numOfRows = 8) {
  const params = new URLSearchParams({ serviceKey: key, numOfRows: String(numOfRows), pageNo: "1", name: query });
  const url = `${BASE_URL}/list?${params.toString()}`;
  const { stdout } = await execFileAsync("curl", ["-s", url]);
  const parsed = parser.parse(stdout);
  const result = parsed?.result;
  const entries = asArray(result?.list?.data).map(flattenDataEntry);
  return { totalCount: result?.totalCount, entries };
}

const query = process.argv[2] ?? "라디오";
const { totalCount, entries } = await search(query);

console.log(`--- 검색어: "${query}" (총 ${totalCount}건 중 상위 ${entries.length}건) ---\n`);
for (const e of entries) {
  console.log(`[${e.id}] ${e.name}`);
  console.log(`  소장기관: ${e.museumName2 ?? e.museumName1 ?? "-"}`);
  console.log(`  상세: https://emuseum.go.kr/detail?relicId=${e.id}`);
  console.log(`  썸네일: ${e.imgThumUriM ?? e.imgUri ?? "(없음)"}`);
  console.log();
}
