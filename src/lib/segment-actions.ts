"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { linkTargetToEvent } from "./link-actions";

// 구술 발췌를 사람이 직접 등록한다. 사료(archive_items)와 달리 구술은 "누가 묻고 누가
// 답했는가"와 "어느 책 몇 쪽에서 왔는가"가 자료의 일부라, 받는 것이 훨씬 많다.
//
// 원본은 Supabase 하나뿐이다. 예전에는 구글 시트에서 내보낸 CSV가 segments를 덮어써서
// 화면에서 고치고 지우는 문을 "manual-" 접두어로 막아 두었는데(2026-08-19에 sync-csv.mjs가
// 구술을 놓았다), 되감을 것이 없어진 뒤로 그 빗장은 손댈 수 없는 행만 남기고 있었다. 걷어냈다.

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

// 화면에서 넣은 발췌를 다시 고친다. 쪽수를 잘못 봤거나 화자를 뒤바꿔 넣은 것은 저장한
// 다음에야 눈에 띄는 종류의 실수라, 지우고 다시 넣게 두면 사건 연결까지 다시 하게 된다.
//
// 사건 연결은 여기서 건드리지 않는다 — 붙이고 떼는 일은 구술 연결 화면이 맡고 있고,
// 이 폼에서 한 번 더 다루면 어느 쪽이 최종인지 알 수 없어진다.
export interface UpdateSegmentInput extends Omit<AddSegmentInput, "eventId"> {
  id: string;
}

export async function updateSegment(input: UpdateSegmentInput): Promise<void> {
  const segmentText = input.segmentText.trim();
  if (!segmentText) throw new Error("구술 본문을 입력하세요.");

  const sourceId = await resolveSourceId(input);
  const narrators = input.speakers.filter((s) => s.role === "구술자");
  const interviewers = input.speakers.filter((s) => s.role === "면담자");

  const { error } = await supabaseAdmin
    .from("segments")
    .update({
      date_value: input.dateValue.trim() || null,
      segment_text: segmentText,
      page: input.page.trim() || null,
      keywords: input.keywords,
      source_id: sourceId,
      narrator_id: narrators[0]?.personId ?? null,
      interviewer_id: interviewers[0]?.personId ?? null,
    })
    .eq("id", input.id);
  if (error) throw error;

  // 화자와 각주는 순서가 뜻을 갖는 목록이라(seq가 각주 번호다) 한 줄씩 맞춰 고치는 대신
  // 통째로 새로 깐다. 세 번째 각주를 지웠을 때 네 번째가 세 번째로 당겨져야 한다.
  const { error: speakerDeleteError } = await supabaseAdmin
    .from("segment_speakers")
    .delete()
    .eq("segment_id", input.id);
  if (speakerDeleteError) throw speakerDeleteError;

  if (input.speakers.length > 0) {
    const { error: speakerError } = await supabaseAdmin.from("segment_speakers").insert(
      input.speakers.map((s, i) => ({
        segment_id: input.id,
        person_id: s.personId,
        role: s.role,
        seq: i,
      })),
    );
    if (speakerError) throw speakerError;
  }

  const { error: noteDeleteError } = await supabaseAdmin
    .from("segment_notes")
    .delete()
    .eq("segment_id", input.id);
  if (noteDeleteError) throw noteDeleteError;

  const notes = input.noteList.map((n) => n.trim()).filter(Boolean);
  if (notes.length > 0) {
    const { error: noteError } = await supabaseAdmin
      .from("segment_notes")
      .insert(notes.map((note_text, i) => ({ segment_id: input.id, seq: i, note_text })));
    if (noteError) throw noteError;
  }

  revalidatePath("/segments");
  revalidatePath("/admin/oral");
  revalidatePath("/admin/review");
}

function revalidateSegmentViews() {
  revalidatePath("/segments");
  revalidatePath("/admin/oral");
  revalidatePath("/admin/review");
  revalidatePath("/"); // 연표에 걸린 구술 인용
  revalidatePath("/admin/timeline");
}

// 보류함에서 고른 구술을 비활성으로 내린다 — 사료(deactivateMaterials)와 같은 규칙이다.
// 행도 연결선도 그대로 두므로, 되돌리면 붙어 있던 사건으로 함께 돌아온다.
// 비활성 구술은 구술 목록·연표·연결 화면 어디에도 뜨지 않고 "비활성 구술함"에서만 보인다.
export async function deactivateSegments(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from("segments")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;

  revalidateSegmentViews();
  return ids.length;
}

export async function reactivateSegment(id: string) {
  const { error } = await supabaseAdmin.from("segments").update({ hidden_at: null }).eq("id", id);
  if (error) throw error;

  revalidateSegmentViews();
}

// 발췌를 지운다. 되돌리는 길은 없다 — 그래서 이 문은 비활성 구술함 안에서만 열린다.
// 목록에서 안 보이게만 하고 DB에 남겨 두는 것은 비활성이 맡고, 여기서는 정말로 없앤다:
// 잘못 넣은 발췌를 영영 남겨 두면 나중에 같은 구술을 다시 넣었을 때 어느 쪽이 진짜인지
// 가릴 수 없다.
//
// 딸린 것들(segment_speakers·segment_notes·segment_persons·segment_places)은 FK가
// on delete cascade라 함께 사라진다. links만 손으로 지운다 — 사건-자료 연결선은
// 사료와 구술을 함께 담느라 target_id가 FK가 아니어서(polymorphic) 남아 버린다.
export async function deleteSegment(id: string): Promise<void> {
  const { error: linkError } = await supabaseAdmin
    .from("links")
    .delete()
    .eq("target_type", "segment")
    .eq("target_id", id);
  if (linkError) throw linkError;

  const { error } = await supabaseAdmin.from("segments").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/segments");
  revalidatePath("/admin/oral");
  revalidatePath("/admin/review");
}
