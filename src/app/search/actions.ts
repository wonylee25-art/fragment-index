"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ThTimelineEntry } from "@/lib/th-timeline";
import { ArchiveRecord } from "@/lib/national-archives";
import { MuseumRelic } from "@/lib/museum-relics";

// 검색 화면의 "저장" 버튼. 외부 검색 결과를 DB에 확정 반영한다.
// - th.xml 사건 → timeline_events (사건 자체)
// - 국가기록원/박물관 자료 → archive_items, event_id는 null(미연결) — 기획서 4번의
//   "미연결 자료 모아보기" 개념과 같다. 어느 사건에 붙일지는 사람이 나중에 정한다.

export async function saveThEvent(entry: ThTimelineEntry) {
  const { error } = await supabaseAdmin.from("timeline_events").insert({
    id: entry.id,
    event_name: entry.title,
    date_value: entry.dateValue,
    summary: entry.title,
    source_reference: "오늘의역사(국사편찬위원회)",
    has_discrepancy: false,
    keywords: [],
    user_saved: true, // "자료 찾기"에서 사람이 직접 골라 저장한 사건 — 연표에서 별도 표시
  });
  if (error && error.code !== "23505") throw error; // 23505 = 중복(이미 저장됨) — 조용히 무시
  revalidatePath("/search");
  revalidatePath("/timeline");
}

export async function saveArchiveRecord(record: ArchiveRecord) {
  const { error } = await supabaseAdmin.from("archive_items").insert({
    id: record.id,
    event_id: null,
    item_type: "문서",
    title: record.title,
    source_org: record.producer,
    source_url: record.detailUrl,
  });
  if (error && error.code !== "23505") throw error;
  revalidatePath("/search");
}

export async function saveMuseumRelic(relic: MuseumRelic) {
  const { error } = await supabaseAdmin.from("archive_items").insert({
    id: relic.id,
    event_id: null,
    item_type: "사진",
    title: relic.name,
    source_org: relic.museumName,
    source_url: relic.detailUrl,
  });
  if (error && error.code !== "23505") throw error;
  revalidatePath("/search");
}
