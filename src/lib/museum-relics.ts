import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { XMLParser } from "fast-xml-parser";
import { asArray } from "./xml";
import { dataGoKrKey } from "./data-go-kr";

// 문화체육관광부 국립중앙박물관_전국 박물관 유물정보_GW (data.go.kr, 서비스 ID 15159017) 클라이언트.
// 400여 개 협력 박물관·약 280만 건의 소장품 메타데이터. 서버 전용 —
// 인증키(DATA_GO_KR_API_KEY)는 .env.local에만 두고 클라이언트로 내려가지 않는다.
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
  imageUrl: string; // imgThumUriL — 큰 썸네일 (없으면 M, 그것도 없으면 원본)
  detailUrl: string; // e뮤지엄 상세페이지
  // 아래 셋은 목록 API에 없고 상세 API(/detail)에만 있다 — 검토 화면에서 원문을 열지 않고
  // 판단할 수 있게 하려고 유물마다 한 번 더 부른다.
  description?: string; // desc — 유물 설명
  sizeInfo?: string; // sizeInfo — "가로 7.9cm, 세로 5.7cm"
  materialName?: string; // materialName1 — "종이"
  purposeName?: string; // purposeName3 — "사진기록"
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

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
  const key = dataGoKrKey("NATIONAL_MUSEUM_API_KEY");
  if (!key) throw new Error("DATA_GO_KR_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

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
      imageUrl: f.imgThumUriL ?? f.imgThumUriM ?? f.imgUri ?? "",
      detailUrl: `https://emuseum.go.kr/detail?relicId=${f.id ?? ""}`,
    };
  });
}

// 유물 한 건의 상세. 목록 API가 설명을 주지 않아, 검토 화면에서 내용을 보려면 이걸 따로 불러야 한다.
async function fetchRelicDetail(id: string): Promise<Partial<MuseumRelic>> {
  const xml = await callApi("/detail", { id });
  const parsed = parser.parse(xml);
  const entries = asArray(parsed?.result?.list?.data ?? parsed?.result?.data) as Array<{ item?: unknown }>;
  if (entries.length === 0) return {};

  const f = flattenDataEntry(entries[0]);
  return {
    description: f.desc || undefined,
    sizeInfo: f.sizeInfo || undefined,
    materialName: f.materialName1 || undefined,
    purposeName: f.purposeName3 || f.purposeName2 || f.purposeName1 || undefined,
  };
}

// 목록 + 각 건의 상세를 한 번에. 상세는 병렬로 부르고, 실패한 건은 목록 정보만 남긴다
// (한 건이 실패해도 검색 전체가 깨지지 않게).
export async function searchMuseumRelicsDetailed(query: string, numOfRows = 5): Promise<MuseumRelic[]> {
  const relics = await searchMuseumRelics(query, numOfRows);
  const details = await Promise.allSettled(relics.map((r) => fetchRelicDetail(r.id)));

  return relics.map((relic, i) => {
    const detail = details[i];
    return detail.status === "fulfilled" ? { ...relic, ...detail.value } : relic;
  });
}
