"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { PaperType } from "./types";

export interface AddPaperInput {
  paperType: PaperType;
  title: string;
  author: string;
  year: number | null;
  institution: string;
  journalName: string;
  volumeIssue: string;
  degreeLevel: string;
  publisherLocation: string;
  translator: string;
  keywords: string[];
  rissUrl: string;
}

// scripts/sync-csv.mjs가 RISS 동기화분에 쓰는 id는 "riss-<control_no>" 형식이라(scripts/fetch-riss-papers.mjs 참고),
// "manual-" 접두사를 쓰면 이용자가 화면에서 직접 추가한 논문이 그 upsert와 절대 충돌하지 않는다.
export async function addPaper(input: AddPaperInput) {
  const title = input.title.trim();
  if (!title) throw new Error("제목을 입력하세요.");

  const { error } = await supabaseAdmin.from("papers").insert({
    id: `manual-${randomUUID()}`,
    paper_type: input.paperType,
    title,
    author: input.author.trim() || null,
    year: input.year,
    institution: input.institution.trim() || null,
    journal_name: input.journalName.trim() || null,
    volume_issue: input.volumeIssue.trim() || null,
    degree_level: input.degreeLevel.trim() || null,
    publisher_location: input.publisherLocation.trim() || null,
    translator: input.translator.trim() || null,
    keywords: input.keywords,
    riss_url: input.rissUrl.trim() || null,
  });
  if (error) throw error;
  revalidatePath("/research");
}

export async function deletePaper(id: string) {
  const { error } = await supabaseAdmin.from("papers").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}
