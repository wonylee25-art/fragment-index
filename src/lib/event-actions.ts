"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 연표 사건의 추가·수정·삭제. 지금까지 사건은 CSV 동기화(D001…)와 오늘의역사 저장(th_…)으로만
// 들어왔고 사람이 직접 만들 길이 없었다 — 여기서 그 길을 연다.
// 직접 만든 사건은 id에 ev_ 접두어를 붙여 출처를 구분한다. sync-csv는 upsert만 하고 삭제하지
// 않으므로 여기서 만든 사건이 동기화로 지워지는 일은 없다.

export interface EventInput {
  eventName: string;
  dateValue: string; // EDTF — "1963", "1963-05", "1945~1948", "1960s" 등 (6-3 표기 규칙)
  summary: string;
  sourceReference: string;
  keywords: string[];
}

export interface EventDeletionSummary {
  releasedMaterials: number; // 보류함으로 되돌아간 사료 수
  releasedSegments: number; // 연결이 끊긴 구술 수
}

// 화면 폼(쉼표로 구분한 키워드 한 줄)을 DB에 넣을 모양으로 다듬는다.
function normalize(input: EventInput) {
  return {
    event_name: input.eventName.trim(),
    date_value: input.dateValue.trim() || null,
    summary: input.summary.trim() || null,
    source_reference: input.sourceReference.trim() || null,
    keywords: input.keywords.map((k) => k.trim()).filter(Boolean),
  };
}

function assertValid(input: EventInput) {
  if (!input.eventName.trim()) throw new Error("사건명은 비워둘 수 없습니다.");
}

export async function createEvent(input: EventInput): Promise<string> {
  assertValid(input);

  const id = `ev_${randomUUID()}`;
  const { error } = await supabaseAdmin.from("timeline_events").insert({
    id,
    ...normalize(input),
    has_discrepancy: false,
    user_saved: true, // 사람이 직접 만든 사건 — 연표에서 "저장됨"으로 구분된다
  });
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/admin/timeline");
  return id;
}

export async function updateEvent(id: string, input: EventInput) {
  assertValid(input);

  const { error } = await supabaseAdmin.from("timeline_events").update(normalize(input)).eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/admin/timeline");
}

// 삭제 전에 "무엇이 딸려 사라지는지" 미리 보여주기 위한 집계. 확인 대화상자에서 쓴다.
export async function countEventAttachments(id: string): Promise<EventDeletionSummary> {
  const { data, error } = await supabaseAdmin
    .from("links")
    .select("target_type")
    .eq("event_id", id)
    .in("status", ["confirmed", "candidate"]);
  if (error) throw error;

  const rows = (data as { target_type: string }[]) ?? [];
  return {
    releasedMaterials: rows.filter((r) => r.target_type === "archive_item").length,
    releasedSegments: rows.filter((r) => r.target_type === "segment").length,
  };
}

// 사건만 지우고 붙어 있던 자료·구술은 지우지 않는다 — 연결선만 끊어서 보류함으로 되돌린다.
// 사건 하나 지웠다고 어렵게 모은 사료가 같이 사라지면 안 된다.
export async function deleteEvent(id: string): Promise<EventDeletionSummary> {
  const released = await countEventAttachments(id);

  // links.event_id → timeline_events.id 외래키가 걸려 있어 연결선을 먼저 지워야 한다.
  const { error: linksError } = await supabaseAdmin.from("links").delete().eq("event_id", id);
  if (linksError) throw linksError;

  const { error: personsError } = await supabaseAdmin.from("event_persons").delete().eq("event_id", id);
  if (personsError) throw personsError;

  const { error: placesError } = await supabaseAdmin.from("event_places").delete().eq("event_id", id);
  if (placesError) throw placesError;

  const { error } = await supabaseAdmin.from("timeline_events").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
  return released;
}
