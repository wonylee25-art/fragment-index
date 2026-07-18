import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { XMLParser } from "fast-xml-parser";

// 문화체육관광부 국립중앙박물관_전국 박물관 유물정보_GW (data.go.kr, 서비스 ID 15159017) 클라이언트.
// 400여 개 협력 박물관·약 280만 건의 소장품 메타데이터. 서버 전용 —
// NATIONAL_MUSEUM_API_KEY는 .env.local에만 두고 클라이언트로 내려가지 않는다.
// 6-5 정책: 메타데이터+이미지 링크만 쓰고 원문(실물)을 재호스팅하지 않는다.
//
// Node의 fetch/https(undici)로 이 게이트웨이를 호출하면 매번 "웹 보안 정책 위반"
// 차단 페이지(HTTP 200 + HTML)가 돌아온다 — TLS 클라이언트 지문 기반 WAF로 보이며,
// curl로는 정상 응답이 온다. 그래서 fetch 대신 curl을 자식 프로세스로 호출한다.

const execFileAsync = promisify(execFile);
const BASE_URL = "https://apis.data.go.kr/1371027/openapi";

export interface MuseumRelic {
  id: string;
  name: string;
  museumName: string; // museumName2 — 소장 기관
  imageUrl: string; // imgThumUriM — 중간크기 썸네일 (없으면 imgUri)
  detailUrl: string; // e뮤지엄 상세페이지
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// 응답의 <data><item key="k" value="v"/>...</data> 한 건을 평범한 {k: v} 객체로 바꾼다.
function flattenDataEntry(entry: { item?: unknown }): Record<string, string> {
  const items = asArray(entry.item) as Array<{ "@_key"?: string; "@_value"?: string }>;
  const record: Record<string, string> = {};
  for (const item of items) {
    if (item["@_key"]) record[item["@_key"]] = item["@_value"] ?? "";
  }
  return record;
}

async function callApi(path: string, params: Record<string, string | number>): Promise<string> {
  const key = process.env.NATIONAL_MUSEUM_API_KEY;
  if (!key) throw new Error("NATIONAL_MUSEUM_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

  const query = new URLSearchParams({ serviceKey: key, ...Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ) });
  const url = `${BASE_URL}${path}?${query.toString()}`;
  const { stdout } = await execFileAsync("curl", ["-s", url]);
  return stdout;
}

export async function searchMuseumRelics(query: string, numOfRows = 5): Promise<MuseumRelic[]> {
  const xml = await callApi("/list", { numOfRows, pageNo: 1, name: query });
  const parsed = parser.parse(xml);

  const result = parsed?.result;
  if (result?.resultCode && result.resultCode !== "0000") {
    throw new Error(`국립중앙박물관 유물정보 API 오류: ${result.resultMsg ?? result.resultCode}`);
  }

  const rawEntries = asArray(result?.list?.data) as Array<{ item?: unknown }>;
  return rawEntries.map((entry) => {
    const f = flattenDataEntry(entry);
    return {
      id: f.id ?? "",
      name: f.name ?? f.nameKr ?? "",
      museumName: f.museumName2 ?? f.museumName1 ?? "",
      imageUrl: f.imgThumUriM ?? f.imgUri ?? "",
      detailUrl: `https://emuseum.go.kr/detail?relicId=${f.id ?? ""}`,
    };
  });
}
