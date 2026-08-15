import { XMLParser } from "fast-xml-parser";
import { asArray } from "./xml";

// 성평등가족부_여성사전시관 구술자료 정보 서비스 (data.go.kr, 서비스 ID 15078220) 클라이언트.
// 서버 전용 — WOMENS_HISTORY_ORAL_API_KEY는 .env.local에만 두고 클라이언트로 내려가지 않는다.
//
// **API 문서의 필드 설명이 실제 응답 내용과 다르다** (2026-08-06 실제 호출로 확인, archives.md 참고):
// - dctnDataNm("구술자료명"이라 표기) → 실제로는 시리즈/카테고리명 (예: "여성과 교육", "여성과 노동")
// - vdoUrlAddr("동영상URL주소"라 표기) → 실제로는 URL이 아니라 인터뷰 제목(구술자 한 줄 소개)
// - vdoSbttlIfmtn("동영상자막정보"라 표기) → 실제로는 <iframe src="유튜브 URL">과
//   <textarea>구술 요약 텍스트</textarea>를 담은 HTML 조각. 진짜 영상 링크와 구술 요약은 여기서 뽑아야 한다.
// 그래서 아래 매핑은 문서 필드명이 아니라 실제 값의 의미를 기준으로 이름을 붙였다.
//
// dctnDataNm 파라미터가 정확검색인지 불확실하고 전체 64건(2026-08-06 기준 totalCount)뿐이라,
// th-timeline.ts처럼 전체를 한 번 받아 캐시해두고 로컬에서 필터링한다.
// 6-5 정책: 추출한 동영상 URL만 링크로 쓰고 원문(영상)을 재호스팅하지 않는다.

const BASE_URL = "https://apis.data.go.kr/1383000/eyis/oralDataService/getOralDataList";

export interface WomensOralArchiveItem {
  id: string;
  title: string; // vdoUrlAddr — 실제로는 인터뷰 제목(구술자 한 줄 소개)
  category: string; // dctnDataNm — 실제로는 시리즈/카테고리명
  videoUrl: string; // vdoSbttlIfmtn 안 <iframe src="...">에서 추출한 실제 유튜브 URL
  excerpt: string; // vdoSbttlIfmtn 안 <textarea>에서 추출한 구술 요약 텍스트
  registeredDate: string; // regYmd
}

const parser = new XMLParser();

function extractVideoUrl(html: string): string {
  return html.match(/<iframe[^>]*\ssrc="([^"]+)"/)?.[1] ?? "";
}

// 원문이 HTML 조각이라 본문에 &lsquo; &#39; 같은 엔티티가 그대로 섞여 있다.
// 화면에 문자 그대로 노출되므로 여기서 실제 문자로 되돌린다.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // &amp;가 다른 엔티티를 감싸는 경우가 있어 맨 마지막에 푼다
}

function extractExcerpt(html: string): string {
  const raw = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1]?.trim() ?? "";
  return decodeHtmlEntities(raw);
}

let cachedItems: WomensOralArchiveItem[] | null = null;

async function loadAllItems(): Promise<WomensOralArchiveItem[]> {
  if (cachedItems) return cachedItems;

  const key = process.env.WOMENS_HISTORY_ORAL_API_KEY;
  if (!key) throw new Error("WOMENS_HISTORY_ORAL_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

  // totalCount가 2026-08-06 기준 64건이라 한 페이지(numOfRows=100)로 전체를 받는다.
  // 이후 실제로 100건을 넘어서면 pageNo를 늘려 순회하도록 고쳐야 한다.
  const url = `${BASE_URL}?ServiceKey=${key}&type=xml&pageNo=1&numOfRows=100`;
  const res = await fetch(url);
  const xml = await res.text();
  const parsed = parser.parse(xml);

  // 서비스키가 아직 승인 대기이거나 잘못된 경우 data.go.kr 공통 오류 포맷(OpenAPI_ServiceResponse)으로 온다.
  const errorHeader = parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (errorHeader) {
    throw new Error(
      `여성사전시관 구술자료 API 오류: ${errorHeader.errMsg ?? errorHeader.returnAuthMsg ?? "알 수 없는 오류"}`,
    );
  }

  // 정상 응답의 resultCode는 "00"이 아니라 "0"(숫자로 파싱됨)으로 온다 — 실제 호출로 확인.
  const resultCode = String(parsed?.response?.header?.resultCode ?? "0");
  if (resultCode !== "0" && resultCode !== "00") {
    throw new Error(`여성사전시관 구술자료 API 오류: ${parsed?.response?.header?.resultMsg ?? resultCode}`);
  }

  const rawItems = asArray(parsed?.response?.body?.items?.item) as Array<Record<string, unknown>>;
  cachedItems = rawItems.map((item, index) => {
    const html = String(item.vdoSbttlIfmtn ?? "");
    return {
      id: `wos-${String(item.regYmd ?? "unknown")}-${index}`,
      title: String(item.vdoUrlAddr ?? "").trim(),
      category: String(item.dctnDataNm ?? "").trim(),
      videoUrl: extractVideoUrl(html),
      excerpt: extractExcerpt(html),
      registeredDate: String(item.regYmd ?? ""),
    };
  });
  return cachedItems;
}

export async function searchWomensOralArchive(query: string, limit = 6): Promise<WomensOralArchiveItem[]> {
  const q = query.trim();
  if (!q) return [];
  const items = await loadAllItems();
  return items
    .filter((item) => item.title.includes(q) || item.category.includes(q) || item.excerpt.includes(q))
    .slice(0, limit);
}
