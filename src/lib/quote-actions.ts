"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 논문 하나에 여러 개 쌓이는 인용구 CRUD. userMemo(paper당 자유 메모 한 덩어리)와 달리
// paper_quotes 테이블에 개별 행으로 저장해 페이지 번호와 함께 낱개로 관리한다.

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
