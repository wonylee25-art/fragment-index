"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 연표/구술 목록/연구 동향 화면 공통 "메모" 기능. 원본 자료의 각주(notes)와는 다른,
// 이용자가 화면에서 직접 적는 개인 메모 — 테이블별로 독립된 user_memo 컬럼에 저장한다.
// 이름을 테이블 문자열 파라미터로 받지 않고 함수를 나누는 이유: Server Action은 클라이언트에서
// 직접 호출 가능한 공개 엔드포인트가 되므로, 어느 테이블에 쓸지를 코드로 고정해 두는 편이 안전하다.

export async function saveTimelineMemo(id: string, memo: string) {
  const { error } = await supabaseAdmin
    .from("timeline_events")
    .update({ user_memo: memo.trim() || null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/timeline");
}

export async function saveSegmentMemo(id: string, memo: string) {
  const { error } = await supabaseAdmin
    .from("segments")
    .update({ user_memo: memo.trim() || null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/");
}

export async function savePaperMemo(id: string, memo: string) {
  const { error } = await supabaseAdmin
    .from("papers")
    .update({ user_memo: memo.trim() || null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}
