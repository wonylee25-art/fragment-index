"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ThTimelineEntry } from "@/lib/th-timeline";
import { ArchiveRecord } from "@/lib/national-archives";
import { MuseumRelic } from "@/lib/museum-relics";
import { WomensOralArchiveItem } from "@/lib/womens-oral-archive";

// 검색 화면의 "저장" 버튼. 외부 검색 결과를 DB에 확정 반영한다.
// - th.xml 사건 → timeline_events (사건 자체)
// - 국가기록원/박물관 자료 → archive_items. 연결선(links)은 만들지 않으므로 미연결 상태로
//   들어가고, 검토함의 "연결선 없는 자료"에 쌓인다. 어느 사건에 붙일지는 사람이 나중에 정한다.

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
    item_type: "사진",
    title: relic.name,
    source_org: relic.museumName,
    source_url: relic.detailUrl,
  });
  if (error && error.code !== "23505") throw error;
  revalidatePath("/search");
}

export async function saveWomensOralArchiveItem(item: WomensOralArchiveItem) {
  const { error } = await supabaseAdmin.from("archive_items").insert({
    id: item.id,
    item_type: "구술",
    title: item.title,
    source_org: `여성사전시관 (${item.category})`,
    source_url: item.videoUrl,
    description: item.excerpt.length > 150 ? `${item.excerpt.slice(0, 150)}…` : item.excerpt || null,
  });
  if (error && error.code !== "23505") throw error;
  revalidatePath("/search");
}
