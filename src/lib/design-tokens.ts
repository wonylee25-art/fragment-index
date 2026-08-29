// 기획 정리노트 7-2 "확정된 디자인 언어(색상 규칙)"를 코드로 고정한 것.
// 이후 다른 화면(연표 목록, 발견 화면 등)에서도 이 규칙을 그대로 재사용한다.

import { ArchiveItemType, SpeakerRole } from "./types";
import { CellState } from "./oral-history-projects";

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

// 면담자(연구자)의 말은 초록이다. 한때 회색으로 내렸다가 되돌렸다 — 채록문에서
// 연구자의 목소리는 자료에 원래 있던 소리가 아니라 사람이 들어가 만든 소리이므로,
// "색은 사람이 손댄 흔적"이라는 이 팔레트의 규칙에 오히려 정확히 들어맞는다.
// 물음이 어디서 들어왔는지가 보여야 구술자의 답을 제대로 읽을 수 있다.
//
// 링크도 같은 --green-text를 쓰지만 섞이지 않는다 — 링크에는 점선 밑줄이 붙고
// 면담자 발화에는 이탤릭이 붙는다. 지문(stage)만 회색으로 남는 것은, 지문이
// 누구의 말도 아닌 채록자의 관찰 표기라서다(대괄호가 한 번 더 가른다).
//
// #35632a는 이 화면에 깔리는 다섯 바탕 어디서나 본문 기준을 넘는다 — 흰 바탕 7.07:1,
// 얼룩말 행 6.42:1, 확정 연결 행 6.20:1, 이견 행 5.79:1, 형광펜 위 5.59:1.
export const SPEAKER_CLASSNAME: Record<SpeakerRole, string> = {
  interviewer: "text-green-text italic", // 면담자: 연구자의 목소리
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

// 내가 표시한 행(연표의 "강조", 구술 목록의 "중요") — 행 전체를 물들인다. 글자 하나에만
// 표시를 얹으면 여러 칸을 옆으로 훑는 눈에 걸리지 않는다. 넓은 면이라 가장 옅은 단(tint)을
// 쓴다 — mark·fill로 깔면 표시한 행이 표가 아니라 노란 덩어리로 먼저 읽힌다.
export const MINE_ROW_CLASSNAME = "bg-yellow-tint";
export const DISCREPANCY_LABEL_CLASSNAME = "text-red-text";

// 다른 화면(연표 등)에서 링크를 타고 들어왔을 때 대상 행을 잠깐 강조 — "지금 고른 것"이라
// 초록이다. 예전에는 노랑이었는데, 노랑은 내가 얹은 것(메모·중요·하이라이트)이 되었다.
export const FOCUS_HIGHLIGHT_CLASSNAME = "bg-green-tint ring-1 ring-inset ring-green-fill";

// 사료 썸네일 바탕. 연표(그러데이션 9종)와 구술 목록(단색 9종)이 같은 자료 유형에 서로
// 다른 색을 들고 있었다 — 이미지가 한쪽에선 회색, 한쪽에선 파랑이었다. 유형은 자료가
// 스스로 말하는 것이므로 색을 빼고, 위의 ARCHIVE_ITEM_ICON이 가른다.
export const MATERIAL_THUMB_CLASSNAME = "bg-surface";

// 기록 카드의 칸 여백. 선이 카드 끝까지 닿아야 칸으로 읽히므로, 좌우 여백은 카드가 아니라
// 칸이 가진다. 이 값이 RecordCard가 아니라 여기 있는 것은 서버 컴포넌트(사료 검색 화면)도
// 같은 칸을 그리기 때문이다 — "use client" 모듈에서 값을 가져가면 서버 쪽에서는 그 값이
// 클라이언트 참조(함수 프록시)로 바뀌어, 문자열에 끼워 넣는 순간 클래스가 통째로 깨진다.
export const RECORD_CELL_CLASSNAME = "px-2.5 py-1.5";

// 카드 안의 가는 선. --line은 흰 종이 위에서만 선으로 읽힌다 — 유형 색이 20%만 섞여도
// 종이 색에 묻혀 사라져서, 짙은 카드에서는 날짜 칸을 가르는 세로선이 아예 안 보였다.
// 먹의 옅은 단으로 그으면 흰 종이에서는 --line과 거의 같고, 진한 종이 위에서도 남는다.
export const RECORD_LINE_CLASSNAME = "border-ink/15";

// ── 자료 유형의 색 ──────────────────────────────────────────────────────────
// "자료가 스스로 말하는 것은 색을 갖지 않는다"는 이 팔레트의 규칙에서 편집 「사료」만
// 뺀다. 그 화면은 읽는 화면이 아니라 고르는 화면이다 — 수십 장이 격자로 깔리고, 무엇을
// 열어 볼지 고르는 데 걸리는 시간이 곧 일의 속도가 된다. 유형과 걸린 정도를 글자로만
// 가르면 카드마다 글을 읽어야 한다.
//
// 예전에 색표가 갈라졌던 것은 색을 쓴 탓이 아니라 화면마다 제 색을 들고 있었던 탓이므로,
// 색은 여기 한 곳에서만 정한다. 다른 화면이 유형에 색을 쓰게 되면 반드시 이 표를 쓴다.
//
// 값은 섞을 바탕색이다 — 그대로 칠하지 않고 흰 바탕에 6~30%만 섞어(color-mix) 옅은
// 종이처럼 쓴다. 그래서 아홉 색 모두 위에 --ink 글씨가 그대로 올라간다(흰 글씨를 올리지
// 않는다는 규칙은 여기서도 지킨다). 짙기는 색이 아니라 양이 맡는다 — 사건에 많이 걸린
// 자료일수록 진하게, 아직 안 걸린 것은 거의 흰 종이다.
export const ARCHIVE_ITEM_HUE: Record<ArchiveItemType, string> = {
  신문: "#5b7c99", // 잉크 푸름
  문서: "#7d8b53", // 서류 올리브
  박물: "#b4744e", // 토기 주황
  구술: "#8a5f86", // 목소리 자주
  이미지: "#4f8a80", // 청록
  영상: "#6a6ba8", // 남보라
  음원: "#b08a2e", // 황
  학술: "#a85f66", // 장미
  지도: "#5f8a5f", // 초록
};

// 걸린 정도 → 바탕에 섞는 양(%). 0은 아직 아무 데도 안 걸린 것 — 거의 흰 종이로 두어야
// "손대야 할 것"이 옅은 쪽에 모여 보인다. 4단을 넘기지 않는 것은, 눈이 옅은 색의 단계를
// 그보다 잘게는 못 가르기 때문이다.
export const ARCHIVE_TINT_STEPS = [5, 13, 22, 32] as const;

export function archiveTintStyle(hue: string, strength: number): { background: string } {
  const step = ARCHIVE_TINT_STEPS[Math.min(strength, ARCHIVE_TINT_STEPS.length - 1)];
  return { background: `color-mix(in oklab, ${hue} ${step}%, var(--background))` };
}

// ── 기술 칸의 네 상태 ────────────────────────────────────────────────────────
// 구술 사업 라벨의 왼쪽 칸이다. 이 넷은 자료가 스스로 말하는 것 — 문서에 무엇이 적혀
// 있느냐 — 이므로 색을 갖지 않는다. 모양과 진하기로만 가른다.
//
// "못찾음"과 "안봄"을 가르는 것이 이 화면의 핵심이다. 앞은 봤는데 기관이 공개하지
// 않는다는 발견이고(그 자체가 조사 결과다), 뒤는 아직 손대지 않은 다음 조사 대상이다.
// 둘을 한 칸으로 뭉개면 무엇을 더 조사해야 하는지가 사라진다.
export const CELL_GLYPH: Record<CellState, string> = {
  확인: "●",
  일부: "◐",
  못찾음: "╱",
  안봄: "·",
};

// 진하기 네 단. 확인이 가장 진하고 안봄이 가장 옅다 — 옅은 쪽에 손대야 할 것이 모인다.
export const CELL_TEXT_CLASSNAME: Record<CellState, string> = {
  확인: "text-ink",
  일부: "text-ink/75",
  못찾음: "text-grey",
  안봄: "text-ink/25",
};

// 라벨에서 내가 켜는 자리. 붓으로 그은 노란 획 하나 — 뜻은 "여기는 더 볼 일 없다"이고,
// 켜고 끄는 한 가지 상태만 있다. 색을 가지는 것은 이쪽뿐이다(색은 사람이 손댄 흔적).
// 노랑을 획 색으로 쓰면 흰 바탕에 1.66:1이라, 켠 획을 굵게(3.6) 두고 꺼진 획은 가늘고
// 옅게(2.6) 두어 굵기가 색을 거들게 한다.
export const TICK_ON_CLASSNAME = "stroke-yellow-fill [stroke-width:3.6]";
export const TICK_OFF_CLASSNAME = "stroke-line [stroke-width:2.6]";
