"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 사건 ↔ 사료·구술을 잇는 연결선(links)을 사람이 직접 만들고 끊는다.
// 지금까지 연결선은 CSV 동기화로만 들어왔고 화면에서 만들 방법이 없었다.
//
// status 사용 규칙:
//   confirmed — 사람이 직접 고른 연결. 여기서 만드는 건 전부 이것이다.
//   candidate — 나중에 자동 매칭이 붙었을 때 "기계가 제안한 연결"을 담을 자리. 여기선 안 만든다.
//   rejected  — 후보를 사람이 반려한 것. 반려된 자료는 다시 미연결(보류)로 돌아간다.

export type LinkTargetType = "archive_item" | "segment";

// basis는 "무엇을 근거로 이었나" — 검색어로 찾아 이었으면 keyword.
export type LinkBasis = "event_name" | "keyword" | "person" | "place";

function revalidateLinkViews() {
  revalidatePath("/"); // 연표(메인화면)
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
  revalidatePath("/segments");
}

// 같은 사건-대상 쌍이 이미 있으면 새로 만들지 않고 확정으로 끌어올린다.
// (반려했던 것을 다시 잇는 경우, 후보를 확정하는 경우 모두 여기로 들어온다)
export async function linkTargetToEvent(
  eventId: string,
  targetType: LinkTargetType,
  targetId: string,
  basis: LinkBasis | null = null,
) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("links")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (findError) throw findError;

  const confirmed = {
    status: "confirmed" as const,
    confirmed_by: "user",
    confirmed_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabaseAdmin.from("links").update(confirmed).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("links").insert({
      event_id: eventId,
      target_type: targetType,
      target_id: targetId,
      origin: "manual",
      basis,
      ...confirmed,
    });
    if (error) throw error;
  }

  revalidateLinkViews();
}

// 연결선만 지운다 — 자료·구술 자체는 남고 보류함(연결선 없는 자료)으로 돌아간다.
export async function unlinkTargetFromEvent(
  eventId: string,
  targetType: LinkTargetType,
  targetId: string,
) {
  const { error } = await supabaseAdmin
    .from("links")
    .delete()
    .eq("event_id", eventId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) throw error;

  revalidateLinkViews();
}
