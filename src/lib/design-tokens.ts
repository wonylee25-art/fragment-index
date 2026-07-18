// 기획 정리노트 7-2 "확정된 디자인 언어(색상 규칙)"를 코드로 고정한 것.
// 이후 다른 화면(연표 목록, 발견 화면 등)에서도 이 규칙을 그대로 재사용한다.

import { SpeakerRole } from "./types";

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

export const DISCREPANCY_ROW_CLASSNAME = "bg-red-50/70";
export const DISCREPANCY_LABEL_CLASSNAME = "text-red-600";

// 다른 화면(연표 등)에서 링크를 타고 들어왔을 때 대상 행을 잠깐 강조.
// 7-2의 "노란 하이라이트"(발견 화면 호버) 톤을 그대로 재사용.
export const FOCUS_HIGHLIGHT_CLASSNAME = "bg-yellow-100 ring-1 ring-inset ring-yellow-300";
