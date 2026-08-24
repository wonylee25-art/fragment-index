"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { linkTargetToEvent } from "./link-actions";
import { ArchiveItemType } from "./types";

// 사료를 사람이 직접 등록한다. 지금까지 archive_items에 자료가 들어오는 길은 외부 검색
// (국가기록원·국립중앙박물관·여성사전시관) 결과를 저장하는 것뿐이라, 그 API에 안 잡히는 자료
// — 직접 찍은 사진, 종이 신문 스크랩, 개인 소장 문서 — 는 넣을 방법이 없었다.
// 직접 만든 자료는 id에 am_ 접두어를 붙여 출처를 구분한다(사건의 ev_와 같은 규칙).
//
// 보류함에서는 비활성으로 내리기만 하고, 지우는 것은 비활성 사료함 안에서만 한다 —
// 사건에 붙은 사료는 연표의 근거이고, 어디에도 안 붙은 채 쌓인 검색 부스러기는 내려두지
// 않으면 보류함이 못 쓰게 된다. 두 요구를 한 화면에서 맞추려면 단계를 나누는 수밖에 없다.

export interface MaterialInput {
  itemType: ArchiveItemType;
  title: string;
  sourceOrg: string; // 소장·생산 기관
  sourceUrl: string; // 원본 아카이브 주소 — 재호스팅하지 않고 링크만 건다(4번 IA 참고)
  description: string;
  imageUrl: string; // 썸네일도 원본 주소를 그대로 건다
}

// event-actions와 같은 규칙 — "www.…"만 적어 넣으면 상대경로가 되어 사이트 안으로 잘못 이동한다.
function normalizeUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// eventId가 있으면 저장과 동시에 연결선까지 확정한다. 비어 있으면 자료만 넣어 보류함으로 간다.
export async function createMaterial(
  input: MaterialInput,
  eventId: string | null,
): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("제목은 비워둘 수 없습니다.");

  const id = `am_${randomUUID()}`;
  const { error } = await supabaseAdmin.from("archive_items").insert({
    id,
    item_type: input.itemType,
    title,
    source_org: input.sourceOrg.trim() || null,
    source_url: normalizeUrl(input.sourceUrl),
    description: input.description.trim() || null,
    image_url: normalizeUrl(input.imageUrl),
  });
  if (error) throw error;

  // 검색어로 찾아 이은 것이 아니라 손으로 골라 이은 연결이라 근거(basis)는 비워 둔다.
  if (eventId) await linkTargetToEvent(eventId, "archive_item", id, null);

  revalidatePath("/admin/review");
  return id;
}

function revalidateMaterialViews() {
  revalidatePath("/"); // 연표(메인화면)
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
}

// 보류함에서 고른 사료를 비활성으로 내린다 — 사건 숨김(hideEvents)과 같은 규칙이다.
// 행도 연결선도 그대로 두므로, 되살리면 붙어 있던 사건에 그대로 돌아온다.
// 비활성 사료는 연표에서도 보류함에서도 빠지고, "비활성 사료함"에서만 보인다.
export async function deactivateMaterials(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from("archive_items")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;

  revalidateMaterialViews();
  return ids.length;
}

export async function reactivateMaterial(id: string) {
  const { error } = await supabaseAdmin
    .from("archive_items")
    .update({ hidden_at: null })
    .eq("id", id);
  if (error) throw error;

  revalidateMaterialViews();
}

// 정말로 지운다. 이 길은 "비활성 사료함" 안에서만 열린다 — 훑어보는 자리(보류함)에서
// 한 번의 손짓으로 닿을 수 있게 두지 않는다. 되돌릴 수 없으므로 화면에서 confirm을 한 번
// 더 거친 뒤에만 들어온다.
// 남아 있을 수 있는 연결선(반려된 것, 숨긴 사건에 매달린 것)을 먼저 끊고 자료를 지운다 —
// 순서를 바꾸면 대상이 없는 연결선만 DB에 남는다.
export async function deleteMaterials(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { error: linkError } = await supabaseAdmin
    .from("links")
    .delete()
    .eq("target_type", "archive_item")
    .in("target_id", ids);
  if (linkError) throw linkError;

  const { error } = await supabaseAdmin.from("archive_items").delete().in("id", ids);
  if (error) throw error;

  revalidateMaterialViews();
  return ids.length;
}

// 「붙이지 않기로 함」 표시를 켜고 끈다. 보류함 ↔ 미연결함을 오가는 유일한 길이다 —
// 잘못 누른 한 번으로 자료가 한 함에 갇히면, 다시 꺼내려고 DB를 열어야 한다.
async function setNoLink(ids: string[], at: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabaseAdmin
    .from("archive_items")
    .update({ no_link_at: at })
    .in("id", ids);
  if (error) throw error;
  revalidatePath("/admin/review");
  return ids.length;
}

export async function markMaterialsNoLink(ids: string[]): Promise<number> {
  return setNoLink(ids, new Date().toISOString());
}

export async function clearMaterialsNoLink(ids: string[]): Promise<number> {
  return setNoLink(ids, null);
}
