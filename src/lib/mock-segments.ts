import { SegmentCardData } from "./types";

// 화면 검증용 예시 데이터. 실제 자료 등록 화면(5-2)이 만들어지기 전까지
// "구술 목록" 화면의 레이아웃/색상 규칙을 확인하기 위한 가상의 구술 발췌 구간.

export const mockSegments: SegmentCardData[] = [
  {
    id: "seg-001",
    itemTitle: "이OO 구술 — 시장통에서 보낸 스무 해",
    dateValue: "1978",
    utterances: [
      { role: "narrator", text: "그때는 새벽 다섯 시면 벌써 시장에 사람이 찼어요." },
      {
        role: "stage",
        text: "잠시 웃으며 손을 내젓는다",
      },
      {
        role: "interviewer",
        text: "그 시간에 다들 뭘 하고 계셨던 거예요?",
      },
      {
        role: "narrator",
        text: "포목전 앞에 리어카 대놓고 자리부터 잡아야 장사가 됐거든. 자리싸움이 진짜 전쟁이었지.",
      },
    ],
    personPlaceTags: ["이OO", "중앙시장"],
    keywordTags: ["시장", "생활사", "1970년대", "OO시"],
    hasDiscrepancy: false,
    relatedItems: [
      {
        id: "rel-001",
        type: "사진",
        title: "중앙시장 새벽 풍경",
        sourceOrg: "지역문화원 사진자료실",
        sourceUrl: "https://example.org/archive/photo/rel-001",
        description: "1970년대 후반 중앙시장 개장 직전 풍경을 담은 흑백 사진. 리어카와 좌판이 줄지어 늘어서 있다.",
      },
      {
        id: "rel-002",
        type: "신문",
        title: "「재래시장 자릿세 분쟁」",
        sourceOrg: "OO일보 縮刷版",
        sourceUrl: "https://example.org/archive/newspaper/rel-002",
        description: "자릿세를 둘러싼 상인 간 다툼을 다룬 사회면 기사. 구술 내용과 같은 시장을 배경으로 한다.",
      },
    ],
  },
  {
    id: "seg-002",
    itemTitle: "박OO 구술 — 공단 시절의 기억",
    dateValue: "1983-03",
    utterances: [
      {
        role: "interviewer",
        text: "공단에 처음 들어가셨을 때가 몇 년도셨어요?",
      },
      {
        role: "narrator",
        text: "정확히는 기억이 잘 안 나는데, 아마 국민학교 졸업하고 바로였으니까 82년이었을걸.",
      },
      { role: "stage", text: "잠시 생각하다가" },
      {
        role: "narrator",
        text: "아니다, 83년 봄이었어요. 그해 벚꽃이 늦게 폈던 게 기억나거든.",
      },
    ],
    personPlaceTags: ["박OO", "OO공단"],
    keywordTags: ["노동사", "산업화", "OO시"],
    hasDiscrepancy: true,
    discrepancyNote: "동일 구술자의 다른 발췌 구간(seg-014)에서는 입사 시점을 1982년으로 진술 — 문헌 기록(공단 입주기업 명부)은 1983년 3월로 표기.",
    relatedItems: [
      {
        id: "rel-003",
        type: "논문",
        title: "「1980년대 지방 공단 노동력 이동 연구」",
        sourceOrg: "OO대학교 논문 저장소",
        sourceUrl: "https://example.org/archive/paper/rel-003",
        description: "지방 산업단지 초기 노동력 유입 경로를 다룬 연구 논문. 입사 연도 관련 통계가 포함되어 있다.",
      },
      {
        id: "rel-004",
        type: "구술",
        title: "박OO 구술 — 기숙사 생활",
        sourceOrg: "구술 아카이브(자체 등록)",
        sourceUrl: "https://example.org/archive/oral/rel-004",
        description: "같은 구술자의 다른 발췌 구간. 공단 기숙사에서의 생활을 이어서 증언한다.",
      },
      {
        id: "rel-005",
        type: "사진",
        title: "OO공단 입주기업 명부 표지",
        sourceOrg: "국가기록원",
        sourceUrl: "https://example.org/archive/photo/rel-005",
        description: "1983년 3월 작성된 입주기업 명부 표지. 구술 속 진술과 날짜가 어긋나는 근거 문헌이다.",
      },
    ],
  },
  {
    id: "seg-003",
    itemTitle: "최OO 구술 — 피난 이후",
    dateValue: "1951?",
    utterances: [
      {
        role: "narrator",
        text: "정확한 날짜는 몰라요, 그냥 겨울이 다 갈 무렵이라고만 기억해.",
      },
      {
        role: "interviewer",
        text: "그럼 그 마을에는 얼마나 계셨던 거예요?",
      },
      {
        role: "narrator",
        text: "한 반 년쯤? 거기서 큰집 식구들이랑 같이 지냈지.",
      },
    ],
    personPlaceTags: ["최OO", "OO면 피난촌"],
    keywordTags: ["한국전쟁", "피난", "생애사", "OO군"],
    hasDiscrepancy: false,
    relatedItems: [
      {
        id: "rel-006",
        type: "지도",
        title: "1951년 OO면 행정구역도",
        sourceOrg: "한국학자료센터",
        sourceUrl: "https://example.org/archive/map/rel-006",
        description: "전쟁 직후 OO면 일대의 행정구역을 표시한 고지도. 구술에서 언급된 피난촌 위치를 가늠할 수 있다.",
      },
    ],
  },
];
