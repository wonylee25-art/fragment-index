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
// 사건 삭제와 마찬가지로 여기에도 지우는 길은 두지 않는다 — 붙일 사건을 못 정했으면
// 연결 없이 저장해 보류함에 쌓아두는 것으로 갈음한다.

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
