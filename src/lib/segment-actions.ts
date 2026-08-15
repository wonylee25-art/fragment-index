"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { linkTargetToEvent } from "./link-actions";

// 구술 발췌를 사람이 직접 등록한다. 사료(archive_items)와 달리 구술은 "누가 묻고 누가
// 답했는가"와 "어느 책 몇 쪽에서 왔는가"가 자료의 일부라, 받는 것이 훨씬 많다.
//
// scripts/sync-csv.mjs가 CSV 동기화분에 쓰는 id는 CSV의 segment_id 그대로라,
// "manual-" 접두어를 쓰면 화면에서 직접 추가한 발췌가 그 upsert와 절대 충돌하지 않는다.

export type SpeakerRoleLabel = "구술자" | "면담자";

export interface SpeakerInput {
  personId: string;
  role: SpeakerRoleLabel;
}

// 출처는 sources 테이블 한 행이 된다. 같은 책에서 발췌를 여러 개 뜨는 게 보통이라,
// 이미 있는 출처를 고르면 sourceId로, 새로 적으면 sourceDraft로 온다.
export interface SourceDraft {
  title: string; // 책·자료 제목
  creator: string; // 저자·구술자 채록 주체
  publisher: string; // 발행기관
  url: string; // 원문 주소
}

export interface AddSegmentInput {
  dateValue: string; // EDTF (6-3 참고) — 화면 표시는 formatEdtfToKorean이 맡는다
  segmentText: string; // 줄머리에 화자 이름이 붙은 줄바꿈 텍스트 (segment-text.ts 참고)
  page: string;
  keywords: string[];
  speakers: SpeakerInput[];
  noteList: string[]; // 각주 — 번호는 순서가 정한다
  sourceId?: string | null; // 이미 있는 출처를 고른 경우
  sourceDraft?: SourceDraft | null; // 새 출처를 적은 경우
  eventId?: string | null; // 고르면 저장과 동시에 사건에 연결, 비우면 보류함으로
}

function normalizeUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function resolveSourceId(input: AddSegmentInput): Promise<string | null> {
  if (input.sourceId) return input.sourceId;

  const draft = input.sourceDraft;
  if (!draft || !draft.title.trim()) return null;

  const id = `src_${randomUUID()}`;
  const { error } = await supabaseAdmin.from("sources").insert({
    id,
    type: "구술",
    title: draft.title.trim(),
    creator: draft.creator.trim() || null,
    publisher: draft.publisher.trim() || null,
    identifier: normalizeUrl(draft.url),
  });
  if (error) throw error;
  return id;
}

export async function addSegment(input: AddSegmentInput): Promise<string> {
  const segmentText = input.segmentText.trim();
  if (!segmentText) throw new Error("구술 본문을 입력하세요.");

  const sourceId = await resolveSourceId(input);
  const id = `manual-${randomUUID()}`;

  // narrator_id/interviewer_id는 한 명씩만 담을 수 있는 자리다. 여럿일 때를 위해
  // segment_speakers에 전부 쌓되, 첫 사람은 이 칸에도 넣어 CSV 동기화분을 읽는
  // 기존 화면들이 그대로 돌게 한다.
  const narrators = input.speakers.filter((s) => s.role === "구술자");
  const interviewers = input.speakers.filter((s) => s.role === "면담자");

  const { error } = await supabaseAdmin.from("segments").insert({
    id,
    item_title: null, // 발췌에 따로 제목을 붙이지 않는다 — 출처와 화자가 그 자리를 대신한다
    date_value: input.dateValue.trim() || null,
    segment_text: segmentText,
    page: input.page.trim() || null,
    keywords: input.keywords,
    source_id: sourceId,
    narrator_id: narrators[0]?.personId ?? null,
    interviewer_id: interviewers[0]?.personId ?? null,
    review_status: "사람 확정", // 사람이 직접 입력한 발췌라 AI 제안 검토 대상이 아니다
  });
  if (error) throw error;

  if (input.speakers.length > 0) {
    const { error: speakerError } = await supabaseAdmin.from("segment_speakers").insert(
      input.speakers.map((s, i) => ({
        segment_id: id,
        person_id: s.personId,
        role: s.role,
        seq: i,
      })),
    );
    if (speakerError) throw speakerError;
  }

  const notes = input.noteList.map((n) => n.trim()).filter(Boolean);
  if (notes.length > 0) {
    const { error: noteError } = await supabaseAdmin
      .from("segment_notes")
      .insert(notes.map((note_text, i) => ({ segment_id: id, seq: i, note_text })));
    if (noteError) throw noteError;
  }

  // 사건을 고르지 않았으면 연결선을 만들지 않는다 — 사료 연결 아래 보류함에 쌓여서,
  // 나중에 같은 방식으로 사건에 붙일 수 있다.
  if (input.eventId) {
    await linkTargetToEvent(input.eventId, "segment", id, null);
  }

  revalidatePath("/segments");
  revalidatePath("/admin/oral");
  revalidatePath("/admin/review");
  return id;
}
