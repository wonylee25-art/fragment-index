"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

export interface AddSegmentInput {
  itemTitle: string;
  dateValue: string; // EDTF (6-3 참고) — 화면 표시는 formatEdtfToKorean이 맡는다
  segmentText: string; // "면담자:"/"구술자:" 접두사가 붙은 줄바꿈 텍스트 (segment-text.ts 참고)
  page: string;
  notes: string;
  keywords: string[];
}

// scripts/sync-csv.mjs가 CSV 동기화분에 쓰는 id는 CSV의 segment_id 그대로라,
// "manual-" 접두사를 쓰면 이용자가 화면에서 직접 추가한 발췌가 그 upsert와 절대 충돌하지 않는다
// (paper-actions.ts의 addPaper와 같은 규칙).
export async function addSegment(input: AddSegmentInput) {
  const segmentText = input.segmentText.trim();
  if (!segmentText) throw new Error("구술 본문을 입력하세요.");

  const { error } = await supabaseAdmin.from("segments").insert({
    id: `manual-${randomUUID()}`,
    item_title: input.itemTitle.trim() || null,
    date_value: input.dateValue.trim() || null,
    segment_text: segmentText,
    page: input.page.trim() || null,
    notes: input.notes.trim() || null,
    keywords: input.keywords,
    review_status: "사람 확정", // 사람이 직접 입력한 발췌라 AI 제안 검토 대상이 아니다
  });
  if (error) throw error;
  revalidatePath("/segments");
}
