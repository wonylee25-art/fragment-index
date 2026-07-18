import { XMLParser } from "fast-xml-parser";

// 국가기록원 "나라기록물정보 서비스" (data.go.kr, 서비스 ID 15158780) 클라이언트.
// 서버 전용 — NATIONAL_ARCHIVES_API_KEY는 .env.local에만 두고 클라이언트로 내려가지 않는다.
// 6-5 정책: 이 API는 기록물 메타데이터+링크만 주므로, 원문을 저장하지 않고 그대로만 쓴다.

const BASE_URL = "https://apis.data.go.kr/1741050/openapi/searcharc";

export interface ArchiveRecord {
  id: string; // rc_code+rc_rfile_no+rc_ritem_no 조합 — archive_items 저장 시 안정적인 키로 쓴다
  title: string;
  producer: string; // prod_name — 생산기관
  productionYear: string; // prod_year
  isOpen: boolean; // is_open === "1"
  detailUrl: string; // link — 기록물 상세정보페이지
}

const parser = new XMLParser();

export async function searchArchiveRecords(query: string, display = 5): Promise<ArchiveRecord[]> {
  const key = process.env.NATIONAL_ARCHIVES_API_KEY;
  if (!key) throw new Error("NATIONAL_ARCHIVES_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

  const url = `${BASE_URL}?serviceKey=${key}&query=${encodeURIComponent(query)}&pageNo=1&display=${display}`;
  const res = await fetch(url);
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const rawItems = parsed?.rss?.channel?.item;
  if (!rawItems) return [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.map((item) => ({
    id: `arch-${item.rc_code ?? ""}-${item.rc_rfile_no ?? ""}-${item.rc_ritem_no ?? ""}`,
    title: String(item.title ?? ""),
    producer: String(item.prod_name ?? ""),
    productionYear: String(item.prod_year ?? ""),
    isOpen: String(item.is_open) === "1",
    detailUrl: String(item.link ?? ""),
  }));
}
