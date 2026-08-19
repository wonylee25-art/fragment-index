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
  researchPeriod: string;
  researchTeam: string;
  researchSummary: string;
  keywords: string[];
  rissUrl: string;
}

// AddPaperForm은 유형(단행본/학술논문/학위논문)별로 입력칸을 다르게 보여줄 뿐 폼 상태 자체는 안 지워서,
// 예를 들어 학술지명을 적어놨다가 유형을 학위논문으로 바꿔 제출하면 그 값이 그대로 journal_name에 남는다.
// ResearchTrends 목록은 `paper.journalName ?? paper.institution`로 기관명을 표시하는데, 이 남은 값이
// null이 아니라 실제 문자열이라 institution을 가려버려("석" 같은 엉뚱한 값이 기관명 자리에 뜸) —
// 그래서 여기서 저장 직전에 paperType과 무관한 필드는 항상 비워 DB에 아예 안 남게 한다.
// 보고서는 연도를 따로 입력받지 않고 연구기간에서 파생한다 — 정렬(getPapers)과 인용 형식이 모두
// year 컬럼에 기대기 때문에, 기간 문자열에서 마지막에 등장하는 4자리 연도(보통 종료 시점)를 취한다.
function extractYearFromPeriod(period: string): number | null {
  const matches = period.match(/(19|20)\d{2}/g);
  if (!matches) return null;
  return parseInt(matches[matches.length - 1], 10);
}

function toPaperRow(input: AddPaperInput) {
  const isJournal = input.paperType === "학술논문";
  const isThesis = input.paperType === "학위논문";
  const isBook = input.paperType === "단행본";
  const isReport = input.paperType === "보고서";
  return {
    paper_type: input.paperType,
    author: input.author.trim() || null,
    year: isReport ? extractYearFromPeriod(input.researchPeriod) : input.year,
    institution: input.institution.trim() || null,
    journal_name: isJournal ? input.journalName.trim() || null : null,
    volume_issue: isJournal ? input.volumeIssue.trim() || null : null,
    degree_level: isThesis ? input.degreeLevel.trim() || null : null,
    publisher_location: isBook ? input.publisherLocation.trim() || null : null,
    translator: isBook ? input.translator.trim() || null : null,
    research_period: isReport ? input.researchPeriod.trim() || null : null,
    research_team: isReport ? input.researchTeam.trim() || null : null,
    research_summary: isReport ? input.researchSummary.trim() || null : null,
    keywords: input.keywords,
    riss_url: input.rissUrl.trim() || null,
  };
}

// scripts/sync-csv.mjs가 RISS 동기화분에 쓰는 id는 "riss-<control_no>" 형식이라(scripts/fetch-riss-papers.mjs 참고),
// "manual-" 접두사를 쓰면 이용자가 화면에서 직접 추가한 논문이 그 upsert와 절대 충돌하지 않는다.
export async function addPaper(input: AddPaperInput) {
  const title = input.title.trim();
  if (!title) throw new Error("제목을 입력하세요.");

  const { error } = await supabaseAdmin.from("papers").insert({
    id: `manual-${randomUUID()}`,
    title,
    ...toPaperRow(input),
  });
  if (error) throw error;
  revalidatePath("/research");
}

// AddPaperForm은 수기 입력이라 오탈자(예: "인류학과"를 "인류학화"로, 기관명을 한 글자만 입력)가
// 나기 쉽다 — 삭제 후 재입력이 아니라 그 자리에서 고칠 수 있도록 하는 수정 경로.
export async function updatePaper(id: string, input: AddPaperInput) {
  const title = input.title.trim();
  if (!title) throw new Error("제목을 입력하세요.");

  const { error } = await supabaseAdmin
    .from("papers")
    .update({ title, ...toPaperRow(input) })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}

// 화면의 "삭제"가 하는 일 — 행을 지우지 않고 쳐낸 시각만 적는다. 원본이 data/riss-papers.csv라
// 행을 지우면 매주 동기화가 그대로 되살려 놓기 때문이다(syncPapers가 이 칸을 보고 건너뛴다).
// 주제어·메모·인용구가 그대로 남으므로 restorePaper로 되돌리면 쳐내기 전 상태로 돌아온다.
export async function hidePaper(id: string) {
  const { error } = await supabaseAdmin
    .from("papers")
    .update({ hidden_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}

export async function restorePaper(id: string) {
  const { error } = await supabaseAdmin.from("papers").update({ hidden_at: null }).eq("id", id);
  if (error) throw error;
  revalidatePath("/research");
}
