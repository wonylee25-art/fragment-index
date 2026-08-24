// 구술 목록(메인 피드) 화면 전용 타입.
// segments 테이블에 발화자 구분 필드가 없다는 미결정 사항(6-1-1)이 있어,
// 실제 DB 스키마 확정 전까지는 화면 목적에 맞춘 표시용(mock) 타입으로 둔다.

export type SpeakerRole = "interviewer" | "narrator" | "stage";

export interface Utterance {
  role: SpeakerRole; // 배색과 들여쓰기를 정한다 — 이름을 몰라도 대화의 흐름이 보이도록
  text: string;
  speaker?: string; // 말한 사람 이름. 구술자가 둘 이상인 면담에서 누구의 말인지 가른다
}

// 구술 본문에 그은 형광펜 한 줄기. 발췌 전체에 붙는 표시(isImportant)나 자유 메모와 달리
// 본문 안 특정 구절을 가리킨다 — 셋 다 "내가 얹은 것"이라 화면에서는 같은 노랑을 쓴다.
// line은 utterances 배열의 인덱스이고, start·end는 그 발화 text 안의 문자 위치다
// (줄머리를 떼어낸 뒤 기준이라 화면 글자와 그대로 대응한다).
export interface Highlight {
  line: number;
  start: number;
  end: number;
}

// 이용자가 화면에서 직접 적는 메모 한 덩어리. 사건·발췌·논문 어디에 적든 같은 것이라
// 한 표(user_memos)에 쌓이고, 어디에 적었는지는 주인 칸으로만 갈린다
// (20260823_add_user_memos.sql). 예전에는 행마다 컬럼 하나였는데, 그때는 둘째 메모를
// 첫째 아래에 이어 붙이는 수밖에 없어 따로 고치고 지울 수가 없었다.
export interface UserMemo {
  id: string;
  memoText: string;
  createdAt: string; // 적은 차례대로 세우는 데 쓴다
}

export type ArchiveItemType = "구술" | "신문" | "문서" | "이미지" | "학술" | "지도" | "박물" | "음원" | "영상";

export interface RelatedItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  sourceOrg: string;
  sourceUrl: string; // 외부 원본 아카이브 링크 (재호스팅하지 않음, 4번 IA 참고)
  dateValue?: string; // 자료 자체의 연대(EDTF) — 사건·구술과 같은 표기. 없는 자료도 많다.
  description?: string; // 호버 미리보기에 쓰는 짧은 설명 (자료 등록 시 오픈그래프 등으로 수집될 값의 mock)
  fullText?: string; // 자료 원문 — 신문기사처럼 본문을 옮겨 적어 둔 것. description은 이것의 앞머리다.
  keywords?: string[]; // 사건·구술과 같은 태그. 검색과, 날짜·키워드가 겹치는 사건 찾기에 쓴다.
  imageUrl?: string; // 원본 아카이브의 썸네일 (박물관 유물 등) — 재호스팅하지 않고 링크만 건다
  // 아래 셋은 이 자료가 사건 없이 연표에 서는 일에만 쓴다
  // (20260824_add_timeline_placement_to_archive_items.sql).
  onTimeline: boolean; // "연표에 올림" 딱지가 찍혀 있는지
  timelineDateValue: string; // 연표에서 설 날짜(EDTF). 위 dateValue(발행일)와 별개다
  highlighted: boolean; // 연표에서 내가 그은 표시
}

// 구술자·면담자를 화면에 보이기 위한 최소 정보. 신상기록부에 있는 현주소·연락처·종교·
// 직계가족 연락처는 DB에 두지 않는다 — persons는 anon 키로 공개 읽기가 열려 있어
// 넣는 순간 공개되기 때문이다. 사람을 가려낼 만큼(이름 + 소속)만 남긴다.
// 이름이 그 사람을 가리키는 방식(person-actions.ts에 각 값의 뜻을 적어 두었다).
// PersonBrief 쪽은 실명일 때 아예 비워 두므로 "실명"이 없다 — 붙일 표시가 없다는 뜻이다.
export type PersonKind = "실명" | "가명" | "익명" | "미상";

export interface PersonBrief {
  id: string;
  name: string;
  affiliation?: string; // 예: "ㅇㅇ대학교 문화인류학과 교수". 미상·익명이면 출처와 쪽
  // 가명·익명·미상 표시. subject 배열을 읽어 오는 질의(getPersons)에서만 채워진다.
  kind?: Exclude<PersonKind, "실명">;
}

export interface SegmentCardData {
  id: string;
  itemTitle: string;
  // 한 면담에 구술자가 둘 이상인 경우가 있어 배열로 받는다(면담자도 마찬가지).
  narrators: PersonBrief[];
  interviewers: PersonBrief[];
  dateValue: string; // EDTF 형식 (6-3 참고), 화면 표시는 formatEdtfToKorean으로 변환
  utterances: Utterance[];
  personPlaceTags: string[];
  keywordTags: string[];
  hasDiscrepancy: boolean;
  discrepancyNote?: string;
  // 원본 구술 자료에 이미 달려 있던 각주 — 엑셀은 각주를 못 담아서 별도 컬럼으로 옮겨온 것.
  // "이견"(6-4, 서로 다른 자료 간 사실 충돌)과는 다른 개념 — 채록·편집 과정의 보충 설명·정정.
  notes?: string;
  // 각주는 원본에 여러 개 달려 있는 게 보통이라 번호가 매겨진 목록으로 따로 쌓는다.
  // 위의 notes는 CSV 동기화분이 한 덩어리로 들고 온 각주라 당분간 둘 다 있다.
  noteList: string[];
  // 이 발췌가 나온 원본 구술 자료(sources_authority). url이 있으면 그리로 링크, 없으면 제목만 표시.
  sourceRef?: { title: string; url?: string };
  // 아래 둘은 그리는 값이 아니라 고치기 화면이 폼을 되채우는 데 쓰는 값이다.
  page?: string;
  sourceId?: string;
  relatedItems: RelatedItem[];
  // 이용자가 화면에서 직접 적는 개인 메모 — 원본 자료에 딸려온 notes(각주)와 달리 순수 개인 작업용.
  // 한 발췌에 여러 개 쌓인다(UserMemo 주석 참고).
  memos: UserMemo[];
  isImportant: boolean; // 이용자가 "중요"로 표시했는지 — 연표의 저장됨 배지와 같은 성격
  highlights: Highlight[]; // 본문에 그은 형광펜. 그은 것이 없으면 빈 배열.
}

// 장소 전거 — 좌표가 있으면 지도(OpenStreetMap)로 바로 연결할 수 있다.
export interface PlaceRef {
  name: string;
  lat: number;
  lng: number;
}

// "수록글"은 다른 넷과 갈래가 다르다 — 앞의 넷은 스스로 한 편이지만 수록글은 언제나
// 단행본 하나에 매달려 있다(PaperData.parentId). 그래서 논문 추가 폼의 유형 선택지에는
// 나오지 않고, 책 행의 「+ 수록글 추가」로만 생긴다.
export type PaperType = "학위논문" | "학술논문" | "단행본" | "보고서" | "수록글";

// 논문에서 발췌한 인용구 — 남의 말을 옮긴 것이라 페이지 번호를 함께 달고 다닌다.
// 내가 쓴 말(UserMemo)과는 화면에서 색으로 갈린다(노랑/회색).
export interface PaperQuote {
  id: string;
  quoteText: string;
  page?: string;
  createdAt: string;
}

// RISS에서 긁어온 국내 구술사/생애사 연구 메타데이터 — 연구동향 화면 전용.
// 원문은 재호스팅하지 않고 rissUrl로만 링크한다(RelatedItem.sourceUrl과 같은 원칙).
export interface PaperData {
  id: string;
  paperType: PaperType;
  title: string; // 보고서일 때는 연구 과제명
  author: string; // 보고서일 때는 연구책임자
  year: number | null; // 보고서일 때는 폼에서 직접 받지 않고 researchPeriod에서 파생(paper-actions.ts 참고)
  institution: string; // 학위수여기관·발행 학회, 출판사(단행본), 또는 수행기관(보고서)
  journalName?: string; // 학술논문일 때만
  volumeIssue?: string; // 학술논문일 때만 — 권(호), 예: "25(1)"
  degreeLevel?: string; // 학위논문일 때만 (국내석사/국내박사)
  // 단행본일 때만 — 한국문화인류학회 인용 형식(저자, 발행연도, 제목, 출판지: 출판사) 참고.
  // https://koanth.org/?page_id=1048
  publisherLocation?: string; // 출판지 (예: 서울)
  translator?: string; // 역서일 때 역자
  editor?: string; // 엮은이 — 논문집처럼 저자와 편자가 다를 때만. 수록글 인용의 "OOO 편"이 여기서 온다.
  researchPeriod?: string; // 보고서일 때만 — 연구기간, 예: "2023.03~2023.12"
  researchTeam?: string; // 보고서일 때만 — 연구진 (연구책임자 제외 공동연구원), 쉼표로 구분
  researchSummary?: string; // 보고서일 때만 — 연구 요약(초록에 해당)
  // 이 논문이 매달린 단행본의 id — 수록글일 때만 채워진다(20260823_add_chapters_to_papers.sql).
  // 목록에서는 부모 아래로 접혀 들어가고, 세는 자리와 주제어 클라우드에서는 빠진다.
  parentId: string | null;
  pages?: string; // 수록글일 때만 — 수록 쪽수, 예: "45-72"
  keywords: string[];
  rissUrl: string;
  memos: UserMemo[]; // 이용자가 이 논문에 대해 직접 적는 개인 메모 — 여러 개 쌓인다
  isImportant: boolean; // 이용자가 "중요"로 표시했는지
  isRead: boolean; // 이용자가 "읽음"으로 표시했는지
  // 이용자가 목록에서 쳐낸 논문 — 행은 남고 화면과 동기화에서만 빠진다. 원본이 CSV라서
  // 행을 지우면 매주 동기화 때 되살아나기 때문이다(20260819_add_hidden_at_to_papers.sql).
  hiddenAt: string | null;
  createdAt: string; // 이 DB에 처음 들어온 시각 — "등록순" 정렬용 (발행연도와는 무관)
  quotes: PaperQuote[];
}

// 보류함에 서는 자료·구술과, 각자가 붙어 있는 사건들(숨긴 사건 포함).
// links가 비어 있으면 어디에도 안 붙은 것이고, 숨긴 사건만 들어 있으면 붙긴 했는데 그
// 사건이 연표에 없는 것이다 — 화면에서는 둘 다 "안 붙은 것"으로 세지만, 배지로는 구별해
// 보여준다. 어느 쪽인지 모르면 같은 자료를 또 붙이게 된다.
export interface UnlinkedMaterials {
  materials: (RelatedItem & { links: LinkedEventRef[] })[];
  segments: { id: string; itemTitle: string; dateValue: string; links: LinkedEventRef[] }[];
}

export interface LinkedEventRef {
  id: string;
  eventName: string;
  dateValue: string;
  hidden: boolean;
}

export interface TimelineEventData {
  id: string;
  eventName: string;
  dateValue: string; // EDTF 형식 (6-3 참고)
  summary: string; // 내용 컬럼 — 사건에 대한 한두 문장 설명
  // 출처는 적힌 그대로(sourceReference)와 화면에 내보일 모양(sourceLabel)을 함께 들고 다닌다.
  // 대장 번호(SRC007)로만 적힌 사건이 많은데, 번호는 고칠 때 지켜야 할 원본이고 읽는 자리에서는
  // 서지로 풀려야 한다 — 하나로 합치면 수정 폼이 풀린 글을 원본 자리에 다시 써넣어 번호가 사라진다.
  sourceReference: string; // DB에 적힌 그대로 — 수정 폼이 쓰는 값
  sourceLabel: string; // 번호를 대장(sources)에서 풀어낸 서지 — 화면이 쓰는 값
  sourceUrl: string; // 출처 원문 주소 — 있으면 출처 문헌에 링크를 건다 (없으면 "")
  // 출처가 책·학술지·간행물이면 제목만으로는 다시 찾아갈 수 없어 저자와 쪽수를 함께 받는다.
  // 유형은 그 두 칸을 언제 물을지 정하고, 출처 표기를 어떤 서지 형식으로 조립할지의 근거다.
  sourceType: string; // "" | 도서 | 학술지 | 간행물 | 웹 | 영상 | 구술자료 …
  sourceAuthor: string;
  sourcePages: string; // "112" · "112-118" 처럼 자유롭게 — 권·호 표기가 섞여 들어오기도 한다
  places: PlaceRef[]; // 인물·장소 태그 중 장소 — 좌표를 가지며 지도로 링크
  keywordTags: string[]; // 지리적 키워드(행정구역 등)도 여기에 포함해 필터·검색에 걸리게 한다
  linkedSegmentIds: string[]; // 그물망 연결(links, link_basis=인물/장소/사건)로 이어진 구술 발췌
  linkedMaterials: RelatedItem[]; // 같은 연결에서 딸려오는 사료(이미지/신문/지도 등) — 교차 블록에 이미지로 노출
  savedByUser: boolean; // 사료 연결 "사료 검색"에서 사람이 직접 저장했거나 직접 만든 사건인지 — 연표에서 강조 표시
  memos: UserMemo[]; // 이용자가 이 사건에 대해 직접 적는 개인 메모 — 여러 개 쌓인다
  // 이용자가 이 사건에 그은 밑줄 — 사건명 아래 노란 실선으로 그려진다. 구술의 isImportant와
  // 같은 성격(발췌/사건 하나를 통째로 표시)이고, 본문 안 구절을 가리키는 Highlight와는 다르다.
  highlighted: boolean;
  // 내용 칸(summary) 안에 그은 형광펜. 사건 하나를 통째로 짚는 위의 highlighted와 달리
  // 어느 구절이 걸렸는지를 가리킨다 — 구술 본문의 highlights와 같은 갈래다.
  // 글이 한 덩이라 line은 늘 0이다.
  summaryHighlights: Highlight[];
}

// 연표 한 행. 사건만 서던 자리에 사료도 제 이름으로 선다.
//
// 갈래를 나눈 것은 칸의 뜻을 지키기 위해서다. 사료를 사건인 척 빚어 사건명 칸에 제목을
// 넣는 길도 있었지만(그러면 화면 코드를 하나도 안 고쳐도 된다), 그러면 표를 훑을 때
// 사건명 칸에 선 것이 사건인지 자료인지 알 수 없게 된다. 사료는 사료 칸에 서고 사건명
// 칸은 비운다 — 비어 있다는 것 자체가 "아직 사건으로 묶이지 않았다"는 정보이고, 나중에
// 묶이면 그 칸이 채워진다.
//
// 사료 중에서도 옮겨 적어 둔 본문이 있는 것만 선다(지금은 신문기사 90건이 그렇다).
// 본문이 없으면 내용 칸이 비어, 날짜 하나만 놓인 빈 행이 된다 — 사진·유물은 사건에 붙어
// 그 행의 사료 칸에 설 때 제 몫을 한다.
//
// dateValue는 두 갈래 모두 "연표에서 이 행이 서는 날짜"다. 사료에서는 자료 자신의
// 날짜(발행일)가 아니라 사람이 따로 지정한 날짜가 여기 온다 — 신문 발행일은 기사가
// 실린 날이지 그 일이 일어난 날이 아니라서다
// (20260824_add_timeline_placement_to_archive_items.sql).
export type TimelineRow =
  | { kind: "event"; id: string; dateValue: string; event: TimelineEventData }
  | {
      kind: "material";
      id: string;
      dateValue: string;
      material: RelatedItem; // 제목·유형·소장기관·원본 링크·발행일 — 사료 칸이 쓰는 값
      body: string; // 내용 칸에 싣는 본문. 옮겨 적어 둔 원문이 있으면 그것, 없으면 요약
      highlighted: boolean;
      memos: UserMemo[];
      // 이 자료가 붙어 있는 사건 이름들. 붙었다고 독립 행이 사라지지는 않는다 — 올리는 것과
      // 붙이는 것은 별개의 판단이라서다. 다만 같은 자료가 연표에 두 자리(이 행과 그 사건 행의
      // 사료 칸)에 뜨게 되므로, 어느 사건과 겹치는지를 행에 적어 내릴지 말지를 판단하게 한다.
      linkedEventNames: string[];
    };

export type TimelineRowKind = TimelineRow["kind"];

// 사료가 연표에 제 행으로 설 수 있는가 — 옮겨 적어 둔 본문이 있어야 한다.
// 화면(보류함 버튼)과 서버(올리기 액션)와 질의(연표 조립)가 같은 잣대를 써야 해서 한곳에 둔다.
export function hasTimelineBody(item: { fullText?: string | null; description?: string | null }): boolean {
  return Boolean((item.fullText ?? "").trim() || (item.description ?? "").trim());
}
