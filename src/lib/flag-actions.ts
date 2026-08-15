"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 구술 목록/연구 동향 화면의 "중요"·"읽음" 토글 — 메모(자유 텍스트)와 달리 단순 boolean 플래그.
// 연표의 "저장됨"(user_saved)과 같은 성격이지만, 저기는 검토함에서 새로 편입할 때만 켜지는
// 반면 여기는 이미 있는 항목을 이용자가 언제든 직접 켜고 끌 수 있다는 점이 다르다.

export async function toggleSegmentImportant(id: string, value: boolean) {
  const { error } = await supabaseAdmin.from("segments").update({ is_important: value }).eq("id", id);
  if (error) throw error;
  revalidatePath("/segments");
}

export async function togglePaperImportant(id: string, value: boolean) {
  const { error } = await supabaseAdmin.from("papers").update({ is_important: value }).eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}

export async function togglePaperRead(id: string, value: boolean) {
  const { error } = await supabaseAdmin.from("papers").update({ is_read: value }).eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}
