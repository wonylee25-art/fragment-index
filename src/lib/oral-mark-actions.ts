"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import type { CellMark } from "./oral-marks";

// 구술 사업 라벨의 노란 획 — "여기는 더 볼 일 없다". 켠 것만 행으로 남기고, 끄면 지운다.
//
// 왼쪽 글리프(문서에서 파생되는 네 상태)는 여기 오지 않는다. 그건 문서 내용의 중복이라
// 두 곳에 두면 갈리지만, 이 표시는 문서에 없던 조사자의 작업 상태라 겹칠 것이 없다.
// is_important·highlighted와 같은 갈래다.

export async function setCellMark(mark: CellMark, on: boolean) {
  const row = {
    institution: mark.institution,
    project_name: mark.projectName,
    axis: mark.axis,
    cell_key: mark.cellKey,
  };
  const { error } = on
    ? await supabaseAdmin.from("oral_series_cell_marks").upsert(row)
    : await supabaseAdmin.from("oral_series_cell_marks").delete().match(row);
  if (error) throw error;
  revalidatePath("/oral-history-projects");
}
