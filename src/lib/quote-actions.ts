"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 논문 하나에 여러 개 쌓이는 인용구 CRUD. 메모(user_memos)와 마찬가지로 개별 행으로
// 저장하되, 옮겨 온 남의 말이라 페이지 번호를 함께 들고 다닌다.

export async function addQuote(paperId: string, quoteText: string, page: string) {
  const text = quoteText.trim();
  if (!text) throw new Error("인용구 내용을 입력하세요.");

  const { error } = await supabaseAdmin.from("paper_quotes").insert({
    paper_id: paperId,
    quote_text: text,
    page: page.trim() || null,
  });
  if (error) throw error;
  revalidatePath("/research");
}

export async function updateQuote(id: string, quoteText: string, page: string) {
  const text = quoteText.trim();
  if (!text) throw new Error("인용구 내용을 입력하세요.");

  const { error } = await supabaseAdmin
    .from("paper_quotes")
    .update({ quote_text: text, page: page.trim() || null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}

export async function deleteQuote(id: string) {
  const { error } = await supabaseAdmin.from("paper_quotes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}
