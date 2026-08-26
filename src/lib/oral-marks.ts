import { supabase } from "./supabase";

// 구술 사업 라벨의 노란 획을 읽는 쪽. 쓰기는 oral-mark-actions.ts가 진다 —
// 이 저장소가 quotes.ts/quote-actions.ts처럼 읽기와 쓰기를 나눠 두는 것과 같다.
// 읽기를 "use server" 파일에 두면 조회 함수까지 공개 POST 엔드포인트가 된다.

export type MarkAxis = "overview" | "policy";

// 주인은 참조코드가 아니라 기관명+사업명이다 — 참조코드는 문서에 기관이 나오는 순서로
// 매겨져서, 가운데에 하나가 끼면 뒤엣것이 전부 밀리고 표시가 엉뚱한 사업에 붙는다.
export interface CellMark {
  institution: string;
  projectName: string;
  axis: MarkAxis;
  cellKey: string;
}

// 화면이 한 번에 다 읽는다 — 52건 x 15칸이고 켠 것만 담기므로 많아야 몇백 행이다.
export async function loadCellMarks(): Promise<CellMark[]> {
  const { data, error } = await supabase
    .from("oral_series_cell_marks")
    .select("institution, project_name, axis, cell_key");
  // 표가 아직 없는 환경(마이그레이션 전)에서도 화면은 떠야 한다 — 켠 것이 없는 상태로 둔다.
  if (error) return [];
  return (data ?? []).map((row) => ({
    institution: row.institution as string,
    projectName: row.project_name as string,
    axis: row.axis as MarkAxis,
    cellKey: row.cell_key as string,
  }));
}
