"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { linkTargetToEvent } from "@/lib/link-actions";
import { adoptMaterialsToTimeline } from "@/lib/timeline-placement-actions";
import { ArchiveItemType } from "@/lib/types";
import { ThTimelineEntry } from "@/lib/th-timeline";

// 사료 연결 "사료 검색"의 저장 버튼. 외부 검색 결과를 DB에 확정 반영한다.
// - th.xml 사건 → timeline_events (사건 자체)
// - 국가기록원/박물관/여성사 자료 → archive_items. 이때 어느 사건에 붙일지도 함께 정한다:
//   [연결하고 저장] 이면 links까지 confirmed로 만들고, [보류] 면 연결 없이 자료만 넣어
//   사료 연결 아래 "연결선 없는 자료"에 쌓인다.

// 소스마다 응답 모양이 달라, 저장 직전에 이 공통 모양으로 맞춰서 넘긴다.
export interface MaterialDraft {
  id: string;
  itemType: ArchiveItemType;
  title: string;
  sourceOrg: string;
  sourceUrl: string;
  // 자료 자신의 연대(EDTF). 국가기록원 기록물의 생산연도가 여기 실린다 — 예전에는 이 칸이
  // 없어서 화면 메타 줄에 글자로만 보이고 DB에는 안 들어갔고, 그래서 담아 놓고 연표에
  // 올리면 날짜 없는 행이 됐다.
  dateValue?: string;
  description?: string;
  imageUrl?: string;
}

export async function saveThEvent(entry: ThTimelineEntry) {
  const { error } = await supabaseAdmin.from("timeline_events").insert({
    id: entry.id,
    event_name: entry.title,
    date_value: entry.dateValue,
    summary: entry.title,
    source_reference: "오늘의역사(국사편찬위원회)",
    has_discrepancy: false,
    keywords: [],
    adopted_at: new Date().toISOString(), // 골라서 저장한 것이므로 곧바로 연표에 오른다
  });
  if (error && error.code !== "23505") throw error; // 23505 = 중복(이미 저장됨) — 조용히 무시
  revalidatePath("/admin/review");
  revalidatePath("/"); // 골라서 저장한 것이므로 연표(메인화면)에 바로 뜬다
}

// 자료를 DB에 넣고, 폼에서 고른 사건이 있으면 연결선까지 한 번에 만든다.
// eventId는 <select name="eventId">에서 오고, 비어 있으면 보류(연결 없음)다.
export async function saveMaterial(draft: MaterialDraft, formData: FormData) {
  const { error } = await supabaseAdmin.from("archive_items").insert({
    id: draft.id,
    item_type: draft.itemType,
    title: draft.title,
    source_org: draft.sourceOrg,
    source_url: draft.sourceUrl || null,
    date_value: draft.dateValue || null,
    description: draft.description || null,
    image_url: draft.imageUrl || null,
  });
  if (error && error.code !== "23505") throw error; // 이미 저장된 자료면 연결만 이어서 진행

  // 검색 결과 앞에서 하는 판단은 셋이다.
  //   link   사건을 골라 붙인다
  //   hold   판단을 미루고 담아만 둔다 → 보류함
  //   nolink 보고서 붙이지 않기로 한다 → 미연결함
  //   adopt  붙일 사건 없이 자료 자신을 연표에 한 행으로 세운다 (담기까지 함께)
  // 뒤의 둘은 둘 다 "연결선을 만들지 않는다"는 점이 같지만, 다시 볼 필요가 있느냐가 다르다 —
  // 그 차이를 자료에 적어 두지 않으면 안 본 것과 보고 넘긴 것이 한 더미에 섞인다.
  const intent = formData.get("intent");
  const noLink = intent === "nolink";
  const adopt = intent === "adopt";
  const held = intent === "hold" || noLink || adopt;
  if (noLink) {
    await supabaseAdmin
      .from("archive_items")
      .update({ no_link_at: new Date().toISOString() })
      .eq("id", draft.id);
  }
  // 담는 것과 연표에 세우는 것은 별개의 판단이라, 사건에 붙이지 않고도 올릴 수 있다.
  // 올릴 수 있는 자료인지(옮겨 적어 둔 본문이 있는지)는 그쪽에서 다시 본다.
  if (adopt) await adoptMaterialsToTimeline([draft.id]);

  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!held && eventId) {
    // 검색어로 찾아 이은 것이므로 근거는 keyword로 남긴다.
    await linkTargetToEvent(eventId, "archive_item", draft.id, "keyword");
  }

  revalidatePath("/admin/review");
}
