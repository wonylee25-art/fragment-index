import { LinkedEventRef } from "./types";

// 사료가 서는 세 함. 사료 연결 화면이 검색과 이 셋으로 갈렸다 — 한 화면에 다 세워두면
// 아래 함까지 내려가는 데만 스크롤이 한참이었다.
//   linked  붙은 것 — 잘못 붙였으면 여기서 끊는다
//   hold    아직 안 정한 것 — 할 일이 남은 더미
//   nolink  붙이지 않기로 정한 것 — 판단이 끝나 다시 안 봐도 되는 더미
//
// 화면(클라이언트)과 페이지(서버)가 함께 쓰는 셈이라 여기 둔다 — 컴포넌트 쪽에 두었더니
// 서버에서 부를 수 없었다("use client" 모듈의 함수는 서버에서 호출되지 않는다).
export type MaterialBox = "linked" | "hold" | "nolink";

export const BOX_TEXT: Record<MaterialBox, { title: string; label: string; hint: string }> = {
  linked: { title: "연결함", label: "사건에 붙은 사료", hint: "잘못 붙였으면 여기서 끊는다" },
  hold: { title: "보류함", label: "아직 안 정한 사료", hint: "할 일이 남은 것" },
  nolink: { title: "미연결함", label: "붙이지 않기로 한 사료", hint: "판단이 끝난 것" },
};

// 어느 함에 서는지는 두 가지가 정한다: 붙었느냐(links), 그리고 안 붙이기로 했느냐(noLink).
// 붙어 있으면 무조건 연결함이다 — 안 붙이기로 표시해 둔 것이라도 실제로 붙어 있으면
// 그 사실이 먼저다(표시는 판단이고 연결선은 사실이다).
export function boxOf(entry: { links?: LinkedEventRef[]; noLink?: boolean }): MaterialBox {
  if ((entry.links ?? []).length > 0) return "linked";
  return entry.noLink ? "nolink" : "hold";
}
