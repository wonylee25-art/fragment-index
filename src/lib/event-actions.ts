"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 연표 사건의 추가·수정·숨김. 지금까지 사건은 CSV 동기화(D001…)와 오늘의역사 저장(th_…)으로만
// 들어왔고 사람이 직접 만들 길이 없었다 — 여기서 그 길을 연다.
// 직접 만든 사건은 id에 ev_ 접두어를 붙여 출처를 구분한다. sync-csv는 upsert만 하고 삭제하지
// 않으므로 여기서 만든 사건이 동기화로 지워지는 일은 없다.
//
// 관리페이지에는 사건을 지우는 길이 없다 — 숨기기만 한다. 손으로 모은 연표를 되돌릴 수 없게
// 날리는 버튼은 두지 않는다는 결정.

export interface EventInput {
  eventName: string;
  dateValue: string; // EDTF — "1963", "1963-05", "1945~1948", "1960s" 등 (6-3 표기 규칙)
  summary: string;
  sourceReference: string;
  keywords: string[];
}

export interface EventHideSummary {
  hiddenMaterials: number; // 사건과 함께 화면에서 빠지는 사료 수
  hiddenSegments: number; // 사건과 함께 화면에서 빠지는 구술 수
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

// 숨기기 전에 "무엇이 함께 안 보이게 되는지" 미리 보여주기 위한 집계. 확인 대화상자에서 쓴다.
export async function countEventAttachments(id: string): Promise<EventHideSummary> {
  const { data, error } = await supabaseAdmin
    .from("links")
    .select("target_type")
    .eq("event_id", id)
    .in("status", ["confirmed", "candidate"]);
  if (error) throw error;

  const rows = (data as { target_type: string }[]) ?? [];
  return {
    hiddenMaterials: rows.filter((r) => r.target_type === "archive_item").length,
    hiddenSegments: rows.filter((r) => r.target_type === "segment").length,
  };
}

// 사건을 화면에서만 내린다 — DB에서는 아무것도 지우지 않는다.
// 연결선(links)과 인물·장소 연결도 그대로 두기 때문에, 되살리면 붙어 있던 사료가 함께 돌아온다.
// 대신 숨은 사건에 매달린 사료가 보류함에도 안 뜨는 사각지대가 생기므로, 읽는 쪽(db.ts)에서
// 숨은 사건의 연결선을 "붙어 있지 않은 것"으로 친다.
export async function hideEvent(id: string): Promise<EventHideSummary> {
  const hidden = await countEventAttachments(id);

  const { error } = await supabaseAdmin
    .from("timeline_events")
    .update({ hidden_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
  return hidden;
}

export async function unhideEvent(id: string) {
  const { error } = await supabaseAdmin.from("timeline_events").update({ hidden_at: null }).eq("id", id);
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
}
