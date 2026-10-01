"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 일상 조각의 수정·삭제와 각주. 사진 조각에 글을 채워 넣을 때도, 글 조각의 오타를 고칠 때도,
// 조각에 각주를 달 때도 이 파일을 지난다.
//
// Server Action은 클라이언트에서 직접 부를 수 있는 공개 엔드포인트라, 화면이 지킨 규칙을 서버가
// 믿어서는 안 된다 — 아이디 모양, 빈 글, 너무 긴 글을 여기서 다시 거른다. 호출 자체는 이 사이트 전체에
// 걸린 Basic Auth(src/proxy.ts)를 지나야 하므로 로그인 없이는 닿지 않는다.
//
// 본문을 고치면 나중에 조각에 붙일 강조(글자 위치로 저장)의 자리가 밀린다. 강조 칸을 만들 때
// updateGrain이 강조도 함께 정리해야 한다.

const MAX_BODY = 20_000;
const MAX_CAPTION = 300;
const MAX_NOTE = 2_000;
const PHOTO_BUCKET = "grains";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const grains = () => supabaseAdmin.schema("grains");

function badId(id: unknown) {
  return typeof id !== "string" || !UUID.test(id);
}

// 조각의 본문과 사진 설명(캡션)을 고친다. 캡션은 비우면 지운다.
export async function updateGrain(
  id: string,
  body: string,
  caption: string | null,
): Promise<ActionResult> {
  if (badId(id)) return fail("잘못된 조각입니다.");
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return fail("내용이 비어 있습니다.");
  if (text.length > MAX_BODY) return fail(`${MAX_BODY.toLocaleString()}자를 넘을 수 없습니다.`);
  const cap = typeof caption === "string" ? caption.trim() : "";
  if (cap.length > MAX_CAPTION) return fail(`사진 설명은 ${MAX_CAPTION}자를 넘을 수 없습니다.`);

  const { data, error } = await grains()
    .from("fragments")
    .update({ body: text, photo_caption: cap || null, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("updateGrain", error.message);
    return fail("저장하지 못했습니다.");
  }
  if (!data || data.length === 0) return fail("조각을 찾지 못했습니다.");

  revalidatePath("/grains");
  return { ok: true };
}

// 조각을 통째로 지운다 — 글, 사진, 달아 둔 각주 모두. 각주는 표의 연쇄 삭제로 함께 사라진다.
// 사진 파일은 행을 지운 뒤에 지운다. 순서가 반대면 파일만 없어진 채 행이 남아 화면에 깨진 사진이 뜬다.
// 파일 삭제가 실패해도 행은 이미 사라졌으니 오류로 돌려주지 않고 기록만 남긴다(주인 없는 파일이 하나 남을 뿐이다).
export async function deleteGrain(id: string): Promise<ActionResult> {
  if (badId(id)) return fail("잘못된 조각입니다.");

  const { data: row, error: readError } = await grains()
    .from("fragments")
    .select("image_path, thread_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("deleteGrain read", readError.message);
    return fail("지우지 못했습니다.");
  }
  if (!row) return fail("조각을 찾지 못했습니다.");

  const { error } = await grains().from("fragments").delete().eq("id", id);
  if (error) {
    console.error("deleteGrain", error.message);
    return fail("지우지 못했습니다.");
  }

  const path = row.image_path as string | null;
  if (path && path.startsWith("photos/")) {
    const { error: removeError } = await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([path]);
    if (removeError) console.error("deleteGrain photo", path, removeError.message);
  }

  // 그 덩어리에 조각이 하나도 안 남았으면 덩어리도 치운다. /new로 일부러 만든 빈 덩어리는
  // 다른 조각이 지워진 것과 상관이 없으니 건드리지 않는다.
  const threadId = row.thread_id as string | null;
  if (threadId) {
    const { count } = await grains()
      .from("fragments")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId);
    if (count === 0) await grains().from("threads").delete().eq("id", threadId);
  }

  revalidatePath("/grains");
  return { ok: true };
}

// 덩어리를 이 조각 앞에서 둘로 나눈다. 이 조각과 그 뒤에 이어진 조각이 새 덩어리가 된다.
// 제목·요약은 앞쪽(원래) 덩어리에 남는다. 덩어리의 첫 조각에서는 나눌 것이 없다.
// 나눈 덩어리는 합치기로 되돌릴 수 있고, 새 덩어리가 가장 마지막이면 봇이 이어서 쌓는다.
export async function splitThread(fragmentId: string): Promise<ActionResult> {
  if (badId(fragmentId)) return fail("잘못된 조각입니다.");

  const { data: frag, error: readError } = await grains()
    .from("fragments")
    .select("id, thread_id, created_at")
    .eq("id", fragmentId)
    .maybeSingle();
  if (readError) {
    console.error("splitThread read", readError.message);
    return fail("나누지 못했습니다.");
  }
  if (!frag || !frag.thread_id) return fail("조각을 찾지 못했습니다.");

  // 이 조각보다 앞선 조각이 같은 덩어리에 있어야 나눌 수 있다.
  const { count: before, error: countError } = await grains()
    .from("fragments")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", frag.thread_id)
    .lt("created_at", frag.created_at);
  if (countError) {
    console.error("splitThread count", countError.message);
    return fail("나누지 못했습니다.");
  }
  if (!before) return fail("덩어리의 첫 조각이라 나눌 수 없습니다.");

  const { data: created, error: insertError } = await grains()
    .from("threads")
    .insert({ created_at: frag.created_at })
    .select("id")
    .single();
  if (insertError || !created) {
    console.error("splitThread insert", insertError?.message);
    return fail("나누지 못했습니다.");
  }

  const { error: moveError } = await grains()
    .from("fragments")
    .update({ thread_id: created.id })
    .eq("thread_id", frag.thread_id)
    .gte("created_at", frag.created_at);
  if (moveError) {
    console.error("splitThread move", moveError.message);
    await grains().from("threads").delete().eq("id", created.id);
    return fail("나누지 못했습니다.");
  }

  revalidatePath("/grains");
  return { ok: true };
}

// 두 덩어리를 하나로 합친다. 시간상 앞선 덩어리(첫 조각이 더 이른 쪽)가 남고, 다른 쪽의 조각이 모두 그리로 옮겨 간 뒤
// 그 덩어리는 사라진다. 남는 덩어리에 제목·요약이 없으면 사라지는 덩어리의 것을 이어받는다.
export async function mergeThreads(aId: string, bId: string): Promise<ActionResult> {
  if (badId(aId) || badId(bId) || aId === bId) return fail("잘못된 덩어리입니다.");

  const firstAt = async (id: string) => {
    const { data, error } = await grains()
      .from("fragments")
      .select("created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? (data.created_at as string) : null;
  };

  let aAt: string | null;
  let bAt: string | null;
  try {
    [aAt, bAt] = await Promise.all([firstAt(aId), firstAt(bId)]);
  } catch (e) {
    console.error("mergeThreads first", e);
    return fail("합치지 못했습니다.");
  }
  if (!aAt || !bAt) return fail("덩어리를 찾지 못했습니다.");
  const [keepId, dropId] = aAt <= bAt ? [aId, bId] : [bId, aId];

  const { data: pair } = await grains()
    .from("threads")
    .select("id, title, summary")
    .in("id", [keepId, dropId]);
  const keep = pair?.find((t) => t.id === keepId);
  const drop = pair?.find((t) => t.id === dropId);

  const { error: moveError } = await grains()
    .from("fragments")
    .update({ thread_id: keepId })
    .eq("thread_id", dropId);
  if (moveError) {
    console.error("mergeThreads move", moveError.message);
    return fail("합치지 못했습니다.");
  }

  const carry: { title?: string; summary?: string } = {};
  if (!keep?.title && drop?.title) carry.title = drop.title;
  if (!keep?.summary && drop?.summary) carry.summary = drop.summary;
  if (Object.keys(carry).length > 0) await grains().from("threads").update(carry).eq("id", keepId);

  const { error: dropError } = await grains().from("threads").delete().eq("id", dropId);
  if (dropError) console.error("mergeThreads drop", dropError.message);

  revalidatePath("/grains");
  return { ok: true };
}

// 각주 달기 — 조각 하나에 딸린 짧은 메모. 조각의 어느 글자에 붙는 것이 아니라 조각 전체에 붙는다.
export async function addNote(fragmentId: string, body: string): Promise<ActionResult> {
  if (badId(fragmentId)) return fail("잘못된 조각입니다.");
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return fail("내용이 비어 있습니다.");
  if (text.length > MAX_NOTE) return fail(`${MAX_NOTE.toLocaleString()}자를 넘을 수 없습니다.`);

  const { error } = await grains().from("notes").insert({ fragment_id: fragmentId, body: text });
  if (error) {
    // 조각이 그새 지워졌다면 외래키 오류(23503)가 난다.
    console.error("addNote", error.message);
    return fail(error.code === "23503" ? "조각을 찾지 못했습니다." : "저장하지 못했습니다.");
  }
  revalidatePath("/grains");
  return { ok: true };
}

export async function updateNote(id: string, body: string): Promise<ActionResult> {
  if (badId(id)) return fail("잘못된 각주입니다.");
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return fail("내용이 비어 있습니다.");
  if (text.length > MAX_NOTE) return fail(`${MAX_NOTE.toLocaleString()}자를 넘을 수 없습니다.`);

  const { data, error } = await grains()
    .from("notes")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("updateNote", error.message);
    return fail("저장하지 못했습니다.");
  }
  if (!data || data.length === 0) return fail("각주를 찾지 못했습니다.");
  revalidatePath("/grains");
  return { ok: true };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  if (badId(id)) return fail("잘못된 각주입니다.");
  const { error } = await grains().from("notes").delete().eq("id", id);
  if (error) {
    console.error("deleteNote", error.message);
    return fail("지우지 못했습니다.");
  }
  revalidatePath("/grains");
  return { ok: true };
}
