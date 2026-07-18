// 구술 목록(메인 피드) 화면 전용 타입.
// segments 테이블에 발화자 구분 필드가 없다는 미결정 사항(6-1-1)이 있어,
// 실제 DB 스키마 확정 전까지는 화면 목적에 맞춘 표시용(mock) 타입으로 둔다.

export type SpeakerRole = "interviewer" | "narrator" | "stage";

export interface Utterance {
  role: SpeakerRole;
  text: string;
}

export type ArchiveItemType = "구술" | "신문" | "문서" | "사진" | "논문" | "지도";

export interface RelatedItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  sourceOrg: string;
  sourceUrl: string; // 외부 원본 아카이브 링크 (재호스팅하지 않음, 4번 IA 참고)
  description?: string; // 호버 미리보기에 쓰는 짧은 설명 (자료 등록 시 오픈그래프 등으로 수집될 값의 mock)
}

export interface SegmentCardData {
  id: string;
  itemTitle: string;
  dateValue: string; // EDTF 형식 (6-3 참고), 화면 표시는 formatEdtfToKorean으로 변환
  utterances: Utterance[];
  personPlaceTags: string[];
  keywordTags: string[];
  hasDiscrepancy: boolean;
  discrepancyNote?: string;
  // 원본 구술 자료에 이미 달려 있던 각주 — 엑셀은 각주를 못 담아서 별도 컬럼으로 옮겨온 것.
  // "이견"(6-4, 서로 다른 자료 간 사실 충돌)과는 다른 개념 — 채록·편집 과정의 보충 설명·정정.
  notes?: string;
  // 이 발췌가 나온 원본 구술 자료(sources_authority). url이 있으면 그리로 링크, 없으면 제목만 표시.
  sourceRef?: { title: string; url?: string };
  relatedItems: RelatedItem[];
}

// 장소 전거 — 좌표가 있으면 지도(OpenStreetMap)로 바로 연결할 수 있다.
export interface PlaceRef {
  name: string;
  lat: number;
  lng: number;
}

export interface TimelineEventData {
  id: string;
  eventName: string;
  dateValue: string; // EDTF 형식 (6-3 참고)
  summary: string; // 내용 컬럼 — 사건에 대한 한두 문장 설명
  sourceReference: string; // 출처 문헌
  places: PlaceRef[]; // 인물·장소 태그 중 장소 — 좌표를 가지며 지도로 링크
  keywordTags: string[]; // 지리적 키워드(행정구역 등)도 여기에 포함해 필터·검색에 걸리게 한다
  linkedSegmentIds: string[]; // 그물망 연결(links, link_basis=인물/장소/사건)로 이어진 구술 발췌 — mock에서는 mockSegments.id 참조
  linkedMaterials: RelatedItem[]; // 같은 연결에서 딸려오는 사료(사진/신문/지도 등) — 교차 블록에 이미지로 노출
}
