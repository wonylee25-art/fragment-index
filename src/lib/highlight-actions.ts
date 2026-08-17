"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { Highlight } from "./types";

// 구술 본문에 그은 형광펜. 메모(saveSegmentMemo)·중요(toggleSegmentImportant)와 같은
// "내가 얹은 것"이지만, 발췌 전체가 아니라 본문 안 특정 구절을 가리킨다.
//
// 화면이 이미 겹침을 정리해서 보내지만 여기서 한 번 더 한다 — Server Action은 클라이언트에서
// 직접 부를 수 있는 공개 엔드포인트라, 화면이 지킨 규칙을 서버가 믿어서는 안 된다.
// 겹치거나 맞닿은 범위를 합쳐 두지 않으면 같은 구절에 <mark>가 겹겹이 쌓이고, 지울 때
// 한 겹만 벗겨져 "지웠는데 아직 노랗다"가 된다.
function normalize(highlights: Highlight[]): Highlight[] {
  const clean = highlights.filter(
    (h) =>
      Number.isInteger(h.line) &&
      Number.isInteger(h.start) &&
      Number.isInteger(h.end) &&
      h.line >= 0 &&
      h.start >= 0 &&
      h.end > h.start,
  );

  const byLine = new Map<number, Highlight[]>();
  for (const h of clean) {
    const list = byLine.get(h.line) ?? [];
    list.push(h);
    byLine.set(h.line, list);
  }

  const merged: Highlight[] = [];
  for (const [line, list] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.start - b.start);
    let current = { ...list[0] };
    for (const next of list.slice(1)) {
      // 맞닿기만 해도(next.start === current.end) 합친다 — 두 번에 나눠 그은 한 구절은
      // 사용자에게 한 줄기이므로, 지울 때도 한 번에 지워져야 한다.
      if (next.start <= current.end) current.end = Math.max(current.end, next.end);
      else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
    void line;
  }
  return merged;
}

export async function saveSegmentHighlights(id: string, highlights: Highlight[]) {
  const normalized = normalize(highlights);
  const { error } = await supabaseAdmin
    .from("segments")
    // 빈 배열은 null로 눕힌다 — "그은 적 없음"과 "다 지웠음"을 DB에서 구분할 이유가 없다.
    .update({ highlights: normalized.length > 0 ? normalized : null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/segments");
}
