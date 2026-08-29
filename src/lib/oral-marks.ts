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

// 기술 축의 칸 키가 육하원칙에서 "군-번호"로 바뀌었다(docs/oral_description_schema.md).
// 이미 켜 둔 표시가 새 칸에 그대로 얹히도록 읽을 때 옮겨 준다 — 표를 고치지 않는 것은
// 이 값이 사람이 손으로 켠 작업 기록이라 되돌릴 수 있게 두는 편이 낫기 때문이다.
// 옛 여섯 칸에 대응이 없던 새 칸(규모·행정연혁·활용 아홉 등)은 꺼진 채로 시작한다.
const LEGACY_DESCRIPTION_KEYS: Record<string, string> = {
  언제: "사업-1",
  어디서: "주체-1",
  왜: "주체-4",
  무엇을: "내용-1",
  누구를: "내용-2",
  어떻게: "내용-3",
};

// 화면이 한 번에 다 읽는다 — 117건 x 32칸이고 켠 것만 담기므로 많아야 몇백 행이다.
export async function loadCellMarks(): Promise<CellMark[]> {
  const { data, error } = await supabase
    .from("oral_series_cell_marks")
    .select("institution, project_name, axis, cell_key");
  // 표가 아직 없는 환경(마이그레이션 전)에서도 화면은 떠야 한다 — 켠 것이 없는 상태로 둔다.
  if (error) return [];
  return (data ?? []).map((row) => {
    const axis = row.axis as MarkAxis;
    const cellKey = row.cell_key as string;
    return {
      institution: row.institution as string,
      projectName: row.project_name as string,
      axis,
      cellKey: axis === "overview" ? LEGACY_DESCRIPTION_KEYS[cellKey] ?? cellKey : cellKey,
    };
  });
}
