"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

// 사료를 사건 없이 연표에 세우고, 세운 날짜를 조정한다.
//
// 사건에는 이미 같은 딱지가 있다(timeline_events.adopted_at) — 창고에 있는 것과 연표로
// 꺼낸 것을 가르는 그 표시다. 자료 쪽도 같은 어휘를 쓴다: 딱지가 있으면 연표에 서고,
// 떼면 보류함에만 남는다. 날짜가 있다고 저절로 올라가지는 않는다.
//
// 연표에 설 날짜를 자료 자신의 날짜와 따로 두는 것이 여기서 가장 중요한 일이다. 신문의
// 발행일은 기사가 실린 날이지 그 일이 일어난 날이 아니다 — 1961-09-20자 추석 대목 기사가
// 증언하는 것은 나흘 뒤의 장바닥이다. 그래서 올릴 때 발행일로 채워만 두고(빈 채로 두면
// 연표 어디에 세울지 알 수 없다), 어긋난 것은 연표에서 보며 고친다.
// 발행일(date_value)에는 손대지 않는다 — 그것은 자료의 사실이다.

function revalidateTimelineViews() {
  revalidatePath("/"); // 연표(메인화면)
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
}

// 딱지를 찍는다. 연표 날짜가 아직 비어 있는 것만 자료 날짜로 채운다 — 이미 조정해 둔 값이
// 있으면 그대로 둔다. 내렸다가 다시 올릴 때 손으로 맞춘 날짜가 되돌아가면 안 된다.
//
// 본문이 없어도 올린다. 예전에는 옮겨 적어 둔 본문이 있는 자료만 받았는데, 그러면 표제와
// 출처만 오는 자료(국가기록원 기록물)가 통째로 막혔다 — 그런 자료도 "언제 어디의 무엇"은
// 말하고, 연표의 내용 칸은 표제로 채운다(timelineBodyOf).
export async function adoptMaterialsToTimeline(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { data, error } = await supabaseAdmin
    .from("archive_items")
    .select("id, date_value, timeline_date_value")
    .in("id", ids);
  if (error) throw error;

  const rows = (data as DbRow[]) ?? [];
  const now = new Date().toISOString();

  // 연표 날짜를 각자 다르게 채워야 해서 한 번에 못 밀어 넣는다. 한 번에 올리는 건수가
  // 백 단위라 요청이 그만큼 늘지만, 손으로 고른 것을 올리는 일이라 그 정도는 감당한다.
  await Promise.all(
    rows.map(async (row) => {
      const { error: updateError } = await supabaseAdmin
        .from("archive_items")
        .update({
          adopted_at: now,
          timeline_date_value: row.timeline_date_value || row.date_value || null,
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
    }),
  );

  revalidateTimelineViews();
  return rows.length;
}

interface DbRow {
  id: string;
  date_value: string | null;
  timeline_date_value: string | null;
}

// 딱지를 뗀다. 연표에서만 내리는 일이라 조정해 둔 날짜는 지우지 않는다 — 다시 올릴 때
// 그 판단이 그대로 살아 있어야 한다.
export async function dropMaterialsFromTimeline(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { error } = await supabaseAdmin.from("archive_items").update({ adopted_at: null }).in("id", ids);
  if (error) throw error;

  revalidateTimelineViews();
  return ids.length;
}

// 연표에서 이 자료가 설 날짜. 발행일(date_value)에는 손대지 않는다.
export async function setMaterialTimelineDate(id: string, dateValue: string) {
  const value = dateValue.trim();
  const { error } = await supabaseAdmin
    .from("archive_items")
    .update({ timeline_date_value: value || null })
    .eq("id", id);
  if (error) throw error;

  revalidateTimelineViews();
}
