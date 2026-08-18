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

// 고른 여러 건을 한 사건에 한꺼번에 잇는다. 한 건씩 잇는 것과 결과가 같고(같은 함수를 돈다),
// 다른 점은 "무엇에 붙는지"를 고른 것으로 먼저 정해두고 사건을 나중에 고른다는 것뿐이다.
// 예전의 공용 사건 목록과 헷갈리지 않게, 이 길은 체크로 고른 것에만 먹는다 — 화면 전체에
// 조용히 먹던 그 방식이 문제였다.
export async function linkTargetsToEvent(
  eventId: string,
  targetType: LinkTargetType,
  targetIds: string[],
  basis: LinkBasis | null = null,
): Promise<number> {
  for (const targetId of targetIds) {
    await linkTargetToEvent(eventId, targetType, targetId, basis);
  }
  return targetIds.length;
}

// 고른 여러 건의 연결선을 한꺼번에 끊는다. 자료·구술 자체는 남고 보류함으로 돌아간다.
//
// 숨긴 사건에 걸린 것도 끊는다. 한동안은 그것만 남겨뒀는데 — 붙일 수 있는 사건 목록에
// 숨긴 사건이 없어서 한 번 끊으면 화면에서 되붙일 길이 없기 때문에 — 숨긴 사건에만
// 붙은 사료를 골라 끊으면 아무 일도 일어나지 않는 것처럼 보였다. 되붙이는 길이 아주
// 없지도 않다(연표 관리에서 사건을 되살리면 된다). 항목 하나짜리 끊기(EventAttach)도
// 한 번 더 물어보고 끊는 쪽을 골랐으니, 여기서도 같게 한다.
export async function unlinkTargetsFromEvents(
  targetType: LinkTargetType,
  targetIds: string[],
): Promise<number> {
  if (targetIds.length === 0) return 0;

  const { data, error } = await supabaseAdmin
    .from("links")
    .delete()
    .eq("target_type", targetType)
    .in("target_id", targetIds)
    .select("id");
  if (error) throw error;

  revalidateLinkViews();
  return ((data as { id: string }[]) ?? []).length;
}
