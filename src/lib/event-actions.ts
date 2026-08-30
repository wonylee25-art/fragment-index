"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { bustEventOptions } from "./event-options-cache";
import { supabaseAdmin } from "./supabase-admin";
import { isCited } from "./citation";

// 연표 사건의 추가·수정·숨김. 지금까지 사건은 CSV 동기화(D001…)와 오늘의역사 저장(th_…)으로만
// 들어왔고 사람이 직접 만들 길이 없었다 — 여기서 그 길을 연다.
// 직접 만든 사건은 id에 ev_ 접두어를 붙여 출처를 구분한다. sync-csv는 upsert만 하고 삭제하지
// 않으므로 여기서 만든 사건이 동기화로 지워지는 일은 없다.
//
// 관리페이지에는 사건을 지우는 길이 없다 — 숨기기만 한다. 손으로 모은 연표를 되돌릴 수 없게
// 날리는 버튼은 두지 않는다는 결정.

export interface EventInput {
  eventName: string;
  dateValue: string; // EDTF — "1963", "1963-05", "1945~1948", "1960s" 등 (6-3 표기 규칙)
  summary: string;
  sourceReference: string;
  sourceUrl: string; // 출처 원문 주소 — 비워둘 수 있다
  // 책·학술지·간행물처럼 쪽을 넘겨 찾아가야 하는 출처는 제목만으로 되짚을 수 없다.
  // 유형이 그런 자료일 때만 저자·쪽수를 묻는다(EventEditor).
  sourceType: string;
  sourceAuthor: string;
  sourcePages: string;
  keywords: string[];
}

// 주소창에서 복사한 주소는 대개 http(s)로 시작하지만, "www.…"만 적어 넣는 경우가 흔하다 —
// 그대로 두면 상대경로 링크가 되어 사이트 안으로 잘못 이동한다. 붙여서 절대주소로 만든다.
function normalizeUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// 화면 폼(쉼표로 구분한 키워드 한 줄)을 DB에 넣을 모양으로 다듬는다.
function normalize(input: EventInput) {
  return {
    event_name: input.eventName.trim(),
    date_value: input.dateValue.trim() || null,
    summary: input.summary.trim() || null,
    source_reference: input.sourceReference.trim() || null,
    source_url: normalizeUrl(input.sourceUrl),
    source_type: input.sourceType.trim() || null,
    // 유형이 쪽을 갖지 않는 자료로 바뀌면 저자·쪽수는 지운다 — 화면에서 안 보이는 칸에
    // 옛 값이 남아 있으면, 뒤에 유형만 되돌렸을 때 엉뚱한 저자가 되살아난다.
    source_author: isCited(input.sourceType) ? input.sourceAuthor.trim() || null : null,
    source_pages: isCited(input.sourceType) ? input.sourcePages.trim() || null : null,
    keywords: input.keywords.map((k) => k.trim()).filter(Boolean),
  };
}

function assertValid(input: EventInput) {
  if (!input.eventName.trim()) throw new Error("사건명은 비워둘 수 없습니다.");
}

export async function createEvent(input: EventInput): Promise<string> {
  assertValid(input);

  const id = `ev_${randomUUID()}`;
  const { error } = await supabaseAdmin.from("timeline_events").insert({
    id,
    ...normalize(input),
    has_discrepancy: false,
    adopted_at: new Date().toISOString(), // 손으로 만든 사건은 만드는 즉시 연표에 오른다
  });
  if (error) throw error;

  bustEventOptions();
  revalidatePath("/");
  revalidatePath("/admin/timeline");
  return id;
}

export async function updateEvent(id: string, input: EventInput) {
  assertValid(input);

  const fields = normalize(input);

  // 내용에 그어 둔 형광펜은 문자 위치로 잡혀 있어(summary_highlights), 내용이 바뀌면
  // 엉뚱한 구절이 노랗게 남는다. 그래서 내용이 달라졌을 때만 함께 지운다 — 키워드나
  // 출처만 고친 경우까지 지우면 손대지 않은 것을 잃는다. 구술 발췌에서 정한 것과 같은
  // 방식이다(20260817_add_highlights_to_segments.sql).
  const { data: before } = await supabaseAdmin
    .from("timeline_events")
    .select("summary")
    .eq("id", id)
    .maybeSingle();
  const summaryChanged = (before?.summary ?? null) !== fields.summary;

  const { error } = await supabaseAdmin
    .from("timeline_events")
    .update(summaryChanged ? { ...fields, summary_highlights: null } : fields)
    .eq("id", id);
  if (error) throw error;

  bustEventOptions();
  revalidatePath("/");
  revalidatePath("/admin/timeline");
}

// 고른 사건을 화면에서만 내린다 — DB에서는 아무것도 지우지 않는다. 연결선(links)과 인물·장소
// 연결도 그대로 두기 때문에, 되살리면 붙어 있던 사료가 함께 돌아온다. 대신 숨은 사건에 매달린
// 사료가 보류함에도 안 뜨는 사각지대가 생기므로, 읽는 쪽(db.ts)에서 숨은 사건의 연결선을
// "붙어 있지 않은 것"으로 친다.
//
// 사건을 내리는 길은 이것 하나다 — 한 건만 내릴 때도 그 행만 골라 부른다. 200건 넘는 연표에서
// "1963년 이전만" 같은 정리를 하려면 한 건씩 요청해서는 너무 느리다.
export async function hideEvents(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from("timeline_events")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;

  bustEventOptions();
  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
  return ids.length;
}

export async function unhideEvent(id: string) {
  const { error } = await supabaseAdmin.from("timeline_events").update({ hidden_at: null }).eq("id", id);
  if (error) throw error;

  bustEventOptions();
  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
}

// ── 사건 찾기(연표 도구 줄의 검색과 짝을 이룬다) ────────────────────────────
//
// 국사편찬위원회 오늘의역사에서 들여온 6천여 건은 adopted_at이 비어 있어 연표에 안 나온다.
// 사료에 붙이면 저절로 올라오지만(link-actions.ts의 adoptEvent), 붙일 사료가 아직 없어도
// "이건 연표에 넣자" 하고 먼저 꺼낼 수 있어야 한다 — 이 검색이 그 길이다.
//
// 연표에 이미 오른 사건은 여기서 안 준다. 그것들은 같은 검색어로 아래 연표 표에 그대로
// 걸리므로, 여기까지 섞으면 같은 사건이 한 화면에 두 번 선다.
//
// 걸린 것을 쪽으로 끊어 준다. 넓은 낱말은 수백 건이 걸린다("서울" 516건) — 앞의 열몇 건만
// 보여주고 나머지를 "더 좁혀보라"고 미루면, 정작 찾는 사건이 그 뒤에 있을 때 닿을 길이 없다.
// 건수는 자른 목록이 아니라 DB가 직접 센 값이라 몇 쪽이 되든 정확하다.

export interface FoundEventRow {
  id: string;
  eventName: string;
  dateValue: string;
  hidden: boolean;
}

export interface OffTimelineSearchResult {
  rows: FoundEventRow[];
  total: number; // 걸린 것 전부 — 지금 쪽에 실린 수가 아니다
  pageSize: number;
}

const PAGE_SIZE = 12;

export async function searchOffTimelineEvents(
  query: string,
  page = 0,
): Promise<OffTimelineSearchResult> {
  const empty = { rows: [], total: 0, pageSize: PAGE_SIZE };

  const q = query.trim();
  if (!q) return empty;

  // PostgREST 필터 문법에서 쉼표·괄호는 조건을 가르는 글자다 — 검색어에 섞여 들어오면
  // 질의가 통째로 어그러지므로 지운다.
  const safe = q.replace(/[,()*]/g, " ").trim();
  if (!safe) return empty;

  const from = Math.max(0, page) * PAGE_SIZE;

  const { data, count, error } = await supabaseAdmin
    .from("timeline_events")
    .select("id, event_name, date_value, hidden_at", { count: "exact" })
    // 연표에 안 떠 있는 것 — 아직 안 꺼낸 것(adopted_at 없음)과 꺼냈다가 치운 것(hidden_at 있음)
    .or("adopted_at.is.null,hidden_at.not.is.null")
    .or(`event_name.ilike.%${safe}%,date_value.ilike.%${safe}%`)
    // 쪽을 넘겨도 순서가 흔들리지 않게 id로 한 번 더 묶는다 — 날짜가 같은 사건이 흔하다.
    .order("date_value", { ascending: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;

  type Row = { id: string; event_name: string; date_value: string | null; hidden_at: string | null };
  return {
    rows: ((data as Row[]) ?? []).map((e) => ({
      id: e.id,
      eventName: e.event_name,
      dateValue: e.date_value ?? "",
      hidden: e.hidden_at !== null,
    })),
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

// 연표에 없던 사건을 연표에 올린다. 사료를 붙이는 것과 같은 딱지를 붙이는 일이라,
// 올린 뒤에는 손으로 만든 사건과 구별 없이 다뤄진다(고치기·숨기기 모두 그대로 먹는다).
//
// 연표에 없는 사건에는 두 갈래가 있어 손보는 곳이 다르다: 아직 안 꺼낸 것은 채택 딱지를
// 붙이고, 꺼냈다가 치운 것은 숨김을 푼다. 버튼이 "연표에 등록"이라고 적혀 있는 이상 둘 다
// 눌렀을 때 연표에 나타나야 한다. 처음 채택한 때는 덮어쓰지 않는다.
export async function adoptEventById(id: string) {
  const { data: row, error: findError } = await supabaseAdmin
    .from("timeline_events")
    .select("adopted_at")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!row) throw new Error("사건을 찾지 못했습니다.");

  const { error } = await supabaseAdmin
    .from("timeline_events")
    .update({
      adopted_at: (row as { adopted_at: string | null }).adopted_at ?? new Date().toISOString(),
      hidden_at: null,
    })
    .eq("id", id);
  if (error) throw error;

  bustEventOptions();
  revalidatePath("/");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/review");
}
