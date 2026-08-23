"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 연표/구술 목록/연구 동향 화면 공통 "메모" 기능. 원본 자료의 각주(notes)와는 다른,
// 이용자가 화면에서 직접 적는 개인 메모 — 한 주인(사건·발췌·논문)에 여러 개 쌓이며
// user_memos 테이블에 개별 행으로 저장한다(20260823_add_user_memos.sql).
//
// 주인 종류를 문자열 파라미터로 받지 않고 추가 함수를 셋으로 나누는 이유: Server Action은
// 클라이언트에서 직접 호출 가능한 공개 엔드포인트가 되므로, 어느 칸에 쓸지를 코드로 고정해
// 두는 편이 안전하다. 반대로 수정·삭제는 이미 있는 메모의 id 하나로 끝나는 일이라 하나면 된다.

export async function addTimelineMemo(eventId: string, memo: string) {
  await insertMemo({ timeline_event_id: eventId }, memo);
  revalidatePath("/"); // 연표가 메인화면
  revalidatePath("/admin/timeline"); // 편집 화면의 접힌 행도 적어 둔 메모를 그대로 보여야 한다
}

export async function addSegmentMemo(segmentId: string, memo: string) {
  await insertMemo({ segment_id: segmentId }, memo);
  revalidatePath("/segments");
}

export async function addPaperMemo(paperId: string, memo: string) {
  await insertMemo({ paper_id: paperId }, memo);
  revalidatePath("/research");
}

// 고치기·지우기는 메모 id 하나로 자리가 정해진다. 어느 화면에서 부른 것인지는 모르므로
// 세 길을 다 새로 그린다 — 메모가 걸린 화면은 셋뿐이고, 하나 고칠 때마다 세 번 도는 것이
// 어느 화면에서 왔는지를 클라이언트가 말하게 두는 것보다 낫다.
export async function updateMemo(id: string, memo: string) {
  const text = memo.trim();
  if (!text) throw new Error("메모 내용을 입력하세요.");

  const { error } = await supabaseAdmin.from("user_memos").update({ memo_text: text }).eq("id", id);
  if (error) throw error;
  revalidateMemoPaths();
}

export async function deleteMemo(id: string) {
  const { error } = await supabaseAdmin.from("user_memos").delete().eq("id", id);
  if (error) throw error;
  revalidateMemoPaths();
}

async function insertMemo(owner: Record<string, string>, memo: string) {
  const text = memo.trim();
  if (!text) throw new Error("메모 내용을 입력하세요.");

  const { error } = await supabaseAdmin.from("user_memos").insert({ ...owner, memo_text: text });
  if (error) throw error;
}

function revalidateMemoPaths() {
  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/segments");
  revalidatePath("/research");
}
