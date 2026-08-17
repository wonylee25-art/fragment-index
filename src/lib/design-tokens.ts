// 기획 정리노트 7-2 "확정된 디자인 언어(색상 규칙)"를 코드로 고정한 것.
// 이후 다른 화면(연표 목록, 발견 화면 등)에서도 이 규칙을 그대로 재사용한다.

import { ArchiveItemType, SpeakerRole } from "./types";

// ── 글씨 크기 ────────────────────────────────────────────────────────────────
// 화면마다 따로 정하다 보니 같은 자리가 12·13·15·16·17px으로 흩어져 있었고, 연표에서
// 구술 목록으로 넘어가면 본문 글씨가 한 단 커졌다 작아졌다 했다. 세 단으로 고정한다.
//
//   소제목 13px  목록에서 한 항목을 부르는 이름 — 연표 사건명, 논문 제목, 사업 기관명.
//   본문   13px  읽는 글 — 사건 요약, 구술 발화, 사업 항목 설명.
//   메타   11px  글이 아니라 꼬리표 — 날짜·출처·역할·개수. 늘 font-mono와 함께 쓴다.
//                더 눌러야 하는 자리(칩 안, 배지)는 10px까지 내려가도 된다.
//
// 소제목과 본문이 같은 13px인 것은 실수가 아니다. 둘은 굵기(font-semibold)와 색으로
// 가른다 — 크기로 벌려 두면 목록을 훑을 때 제목이 먼저 읽히는 게 아니라 제목만 읽히고,
// 이 아카이브에서 정작 읽어야 하는 것은 구술 발화와 사건 요약 쪽이다. 그래서 읽는 글은
// 어느 화면에서든 같은 크기로 두고, 꼬리표만 한 단 내려 물러나게 한다.
//
// 행간은 여기서 정하지 않는다 — 같은 12px이라도 한 줄짜리 설명(leading-5)과 여러 줄을
// 이어 읽는 구술(leading-6)은 다르게 두는 편이 낫고, 그 판단은 쓰는 자리에 있다.
// 새 화면을 만들 때 이 셋 밖의 크기가 필요하다고 느끼면, 대개는 자리를 잘못 고른 것이다.
export const TEXT_SUBHEAD_CLASSNAME = "text-[13px]";
export const TEXT_BODY_CLASSNAME = "text-[13px]";
export const TEXT_META_CLASSNAME = "text-[11px]";

// 한 단 조밀한 자리. 구술 사업 도표처럼 한 화면에 카드 수십 장을 늘어놓아, 한 장을
// 읽는 것보다 전체가 한눈에 들어오는 것이 먼저인 곳에만 쓴다. 읽는 글(본문)을 여기로
// 내리지 말 것 — 이건 크기를 줄여도 되는 글이라는 뜻이 아니라, 글이 아니라 지도에
// 가까운 자리라는 뜻이다.
export const TEXT_DENSE_CLASSNAME = "text-[12px]";

// 자료 유형별 아이콘 — 구술 목록(SegmentRow)과 연표(TimelineExperience)가 함께 쓴다.
export const ARCHIVE_ITEM_ICON: Record<ArchiveItemType, string> = {
  구술: "🎙️",
  신문: "📰",
  문서: "🗂️",
  이미지: "🖼️",
  학술: "📄",
  지도: "🗺️",
  박물: "🏺",
  음원: "🎧",
  영상: "🎬",
};

// 면담자를 초록으로 두었었는데, 초록이 "확인된 것"을 뜻하게 되면서 면담자 발화만
// 검증된 말처럼 읽혔다. 셋 다 회색조로 두고 이탤릭과 대괄호로 가른다 — 이 화면에서
// 읽어야 하는 것은 구술자 쪽이라고 아래 TEXT_* 주석에 이미 적어 두었다.
export const SPEAKER_CLASSNAME: Record<SpeakerRole, string> = {
  interviewer: "text-grey italic", // 면담자: 물러난 회색 + 이탤릭
  narrator: "text-ink", // 구술자: 기본색(중심 콘텐츠)
  stage: "text-grey italic", // 지문: 회색 + 대괄호 + 이탤릭
};

// SLV LAB의 플랫 칩(테두리·그림자 없는 단색 배경 블록)을 참고한 스타일.
// 인물·장소가 파란 태그였던 것을 회색으로 내렸다 — 자료가 스스로 말하는 것에는 색을
// 주지 않는다는 규칙 때문이다. 대신 글씨 진하기로 가른다: 인물·장소는 고유명사라
// 본문색(--ink), 키워드는 갈래를 부르는 말이라 한 단 물러난 --grey.
export const TAG_CLASSNAME = {
  personPlace: "bg-surface text-ink",
  keyword: "bg-surface text-grey",
};

// ── 뜻을 지는 색 ─────────────────────────────────────────────────────────────
// 색 이름(--green-fill 등)은 globals.css가 갖고, 그 색이 무엇을 뜻하는지는 여기서만
// 정한다. 화면 코드에는 아래 상수 이름만 나오므로, 나중에 "내가 얹은 것"을 다른 색으로
// 옮기고 싶으면 이 파일 한 줄만 고치면 된다.
//
// 색면은 늘 글자나 아이콘과 함께 둔다 — 초록과 빨강은 적록색약에서 서로 무너지므로
// 색 하나만으로 뜻이 갈리게 두면 안 된다.
const CHIP_BASE = "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] text-ink";
const CHIP_DOT = "inline-block h-2 w-2 shrink-0 rounded-[2px]";

export const CHIP_CLASSNAME = CHIP_BASE;
export const CHIP_DOT_CLASSNAME = CHIP_DOT;

// 확인된 것 — 확정 연결, 읽음, 저장됨, 확인 수준 ●●●
export const DOT_CONFIRMED = `${CHIP_DOT} bg-green-fill`;
// 내가 얹은 것 — 메모, 인용구, ★ 중요, 구술 하이라이트
export const DOT_MINE = `${CHIP_DOT} bg-yellow-fill`;
// 아직 확정 안 됨 — 후보 연결선, 검토 대기 (관리 화면에만)
export const DOT_PENDING = `${CHIP_DOT} bg-orange-fill`;
// 걸리는 것 — 이견 발견, 삭제, 저장 실패
export const DOT_SNAG = `${CHIP_DOT} bg-red-fill`;
// 아무 표시도 없는 자리 — 확인 수준 ●○○ 처럼 "비어 있음"을 그려야 할 때
export const DOT_NONE = `${CHIP_DOT} bg-line`;

// 구술 목록·연구 동향·관리(연표)의 "+ ○○ 추가" 입구는 모양을 공유한다 — 새 화면에 추가 입구를
// 만들 때도 이 상수를 쓴다. 자리는 목록 위 오른쪽 끝(구술 목록·연구 동향, 감싸는 줄에 justify-end)이
// 기본이지만, 연표만 목록 아래 왼쪽에 둔다 — 200건이 넘어 "없네" 싶어질 때가 표 끝이라서다.
export const ADD_BUTTON_CLASSNAME =
  "shrink-0 rounded-sm bg-ink px-2.5 py-1 font-mono text-[11px] text-white hover:opacity-80";

// 정렬·필터 버튼. 연표·구술 목록·연구 동향이 각자 같은 문자열을 복붙해 두고 있었다.
// 누른 것은 검정으로 눌러 둔다 — 채도 높은 색 위에는 흰 글씨가 안 올라가고(대비 1.66~4.37),
// 색은 상태 표시에만 남겨야 하기 때문이다.
export const TOGGLE_BUTTON_CLASSNAME = "rounded-sm px-2 py-1";
export const TOGGLE_ON_CLASSNAME = "bg-ink text-white";
export const TOGGLE_OFF_CLASSNAME = "text-grey hover:bg-surface hover:text-ink";

// 검색·연도 입력칸. 세 화면이 테두리 색과 폭을 제각각 두고 있었고, 포커스 색도
// 오렌지와 회색으로 갈려 있었다. 면(--surface)으로 입력칸임을 알리고 테두리는 한 단만
// 쓴다 — 그래서 진한 선(--line-strong)이 따로 필요 없어졌다.
export const INPUT_CLASSNAME =
  "rounded-sm border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink placeholder:text-grey focus:border-green-text focus:outline-none";

export const DISCREPANCY_ROW_CLASSNAME = "bg-red-tint";
export const DISCREPANCY_LABEL_CLASSNAME = "text-red-text";

// 다른 화면(연표 등)에서 링크를 타고 들어왔을 때 대상 행을 잠깐 강조 — "지금 고른 것"이라
// 초록이다. 예전에는 노랑이었는데, 노랑은 내가 얹은 것(메모·중요·하이라이트)이 되었다.
export const FOCUS_HIGHLIGHT_CLASSNAME = "bg-green-tint ring-1 ring-inset ring-green-fill";

// 사료 썸네일 바탕. 연표(그러데이션 9종)와 구술 목록(단색 9종)이 같은 자료 유형에 서로
// 다른 색을 들고 있었다 — 이미지가 한쪽에선 회색, 한쪽에선 파랑이었다. 유형은 자료가
// 스스로 말하는 것이므로 색을 빼고, 위의 ARCHIVE_ITEM_ICON이 가른다.
export const MATERIAL_THUMB_CLASSNAME = "bg-surface";
