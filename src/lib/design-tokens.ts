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

export const SPEAKER_CLASSNAME: Record<SpeakerRole, string> = {
  interviewer: "text-emerald-600 italic", // 면담자: 형광초록 + 이탤릭
  narrator: "text-zinc-900", // 구술자: 기본색(중심 콘텐츠)
  stage: "text-zinc-400 italic", // 지문: 회색 + 대괄호 + 이탤릭
};

// SLV LAB의 플랫 칩(테두리·그림자 없는 단색 배경 블록)을 참고한 스타일.
export const TAG_CLASSNAME = {
  personPlace: "bg-blue-100 text-blue-800", // 인물·장소: 파란 태그
  keyword: "bg-zinc-100 text-zinc-500", // 키워드: 회색 태그
};

// 구술 목록·연구 동향·관리(연표)의 "+ ○○ 추가" 입구는 모양을 공유한다 — 새 화면에 추가 입구를
// 만들 때도 이 상수를 쓴다. 자리는 목록 위 오른쪽 끝(구술 목록·연구 동향, 감싸는 줄에 justify-end)이
// 기본이지만, 연표만 목록 아래 왼쪽에 둔다 — 200건이 넘어 "없네" 싶어질 때가 표 끝이라서다.
export const ADD_BUTTON_CLASSNAME =
  "shrink-0 rounded-sm bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-white hover:bg-zinc-700";

export const DISCREPANCY_ROW_CLASSNAME = "bg-red-50/70";
export const DISCREPANCY_LABEL_CLASSNAME = "text-red-600";

// 다른 화면(연표 등)에서 링크를 타고 들어왔을 때 대상 행을 잠깐 강조.
// 7-2의 "노란 하이라이트"(발견 화면 호버) 톤을 그대로 재사용.
export const FOCUS_HIGHLIGHT_CLASSNAME = "bg-yellow-100 ring-1 ring-inset ring-yellow-300";
