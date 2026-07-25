import { supabase } from "./supabase";
import { parseSegmentText } from "./segment-text";
import { ArchiveItemType, PaperData, RelatedItem, SegmentCardData, TimelineEventData } from "./types";

// Supabase 테이블에서 화면이 쓰는 TimelineEventData/SegmentCardData 모양으로 조립한다.
// 데이터 규모(수백 행)가 작아서, 각 테이블을 통째로 가져와 메모리에서 조인한다 —
// PostgREST 임베드 문법(특히 narrator_id/interviewer_id처럼 같은 테이블을 두 번 참조하는
// 애매한 FK)에 기대는 것보다 이쪽이 훨씬 단순하고 안전하다.

interface DbPerson {
  id: string;
  title: string;
}

interface DbSource {
  id: string;
  title: string;
  identifier: string | null;
}

interface DbTimelineEvent {
  id: string;
  event_name: string;
  date_value: string | null;
  summary: string | null;
  source_reference: string | null;
  has_discrepancy: boolean;
  keywords: string[];
  user_saved: boolean;
  user_memo: string | null;
}

interface DbArchiveItem {
  id: string;
  event_id: string | null;
  item_type: string;
  title: string;
  source_org: string | null;
  source_url: string | null;
  description: string | null;
}

interface DbSegment {
  id: string;
  item_title: string | null;
  date_value: string | null;
  source_id: string | null;
  narrator_id: string | null;
  interviewer_id: string | null;
  event_id: string | null;
  segment_text: string;
  has_discrepancy: boolean;
  discrepancy_note: string | null;
  notes: string | null;
  keywords: string[];
  user_memo: string | null;
  is_important: boolean;
}

interface DbSegmentPerson {
  segment_id: string;
  person_id: string;
}

function toRelatedItem(item: DbArchiveItem): RelatedItem {
  return {
    id: item.id,
    type: item.item_type as ArchiveItemType,
    title: item.title,
    sourceOrg: item.source_org ?? "",
    sourceUrl: item.source_url ?? "",
    description: item.description ?? undefined,
  };
}

export async function getChronicleEvents(): Promise<TimelineEventData[]> {
  const [{ data: events, error: eventsError }, { data: materials, error: materialsError }, { data: segments, error: segmentsError }] =
    await Promise.all([
      supabase.from("timeline_events").select("id, event_name, date_value, summary, source_reference, has_discrepancy, keywords, user_saved, user_memo").order("id"),
      supabase.from("archive_items").select("id, event_id, item_type, title, source_org, source_url, description"),
      supabase.from("segments").select("id, event_id"),
    ]);
  if (eventsError) throw eventsError;
  if (materialsError) throw materialsError;
  if (segmentsError) throw segmentsError;

  const materialsByEvent = new Map<string, RelatedItem[]>();
  for (const m of (materials as DbArchiveItem[]) ?? []) {
    if (!m.event_id) continue;
    const list = materialsByEvent.get(m.event_id) ?? [];
    list.push(toRelatedItem(m));
    materialsByEvent.set(m.event_id, list);
  }

  const segmentIdsByEvent = new Map<string, string[]>();
  for (const s of (segments as { id: string; event_id: string | null }[]) ?? []) {
    if (!s.event_id) continue;
    const list = segmentIdsByEvent.get(s.event_id) ?? [];
    list.push(s.id);
    segmentIdsByEvent.set(s.event_id, list);
  }

  return ((events as DbTimelineEvent[]) ?? []).map((e) => ({
    id: e.id,
    eventName: e.event_name,
    dateValue: e.date_value ?? "",
    summary: e.summary ?? "",
    sourceReference: e.source_reference ?? "",
    places: [], // places/event_places 아직 데이터 없음 (좌표 미확보)
    keywordTags: e.keywords ?? [],
    linkedSegmentIds: segmentIdsByEvent.get(e.id) ?? [],
    linkedMaterials: materialsByEvent.get(e.id) ?? [],
    savedByUser: e.user_saved,
    userMemo: e.user_memo ?? undefined,
  }));
}

export async function getSavedIds(): Promise<{ eventIds: Set<string>; archiveItemIds: Set<string> }> {
  const [{ data: events, error: eventsError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("timeline_events").select("id"),
    supabase.from("archive_items").select("id"),
  ]);
  if (eventsError) throw eventsError;
  if (itemsError) throw itemsError;

  return {
    eventIds: new Set(((events as { id: string }[]) ?? []).map((e) => e.id)),
    archiveItemIds: new Set(((items as { id: string }[]) ?? []).map((i) => i.id)),
  };
}

// "자료 찾기" 화면의 빈 상태(검색어 입력 전)에 보여줄 제안 키워드 — DB(사건·구술)에
// 실제로 붙어 있는 키워드 태그 중 등장 빈도가 높은 순.
export async function getSuggestedKeywords(limit = 24): Promise<string[]> {
  const [events, segments] = await Promise.all([getChronicleEvents(), getOralSegments()]);

  const frequency = new Map<string, number>();
  for (const e of events) for (const k of e.keywordTags) frequency.set(k, (frequency.get(k) ?? 0) + 1);
  for (const s of segments) for (const k of s.keywordTags) frequency.set(k, (frequency.get(k) ?? 0) + 1);

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

export async function searchLocal(query: string): Promise<{ events: TimelineEventData[]; segments: SegmentCardData[] }> {
  const q = query.trim();
  if (!q) return { events: [], segments: [] };

  const [events, segments] = await Promise.all([getChronicleEvents(), getOralSegments()]);

  return {
    events: events.filter(
      (e) => e.eventName.includes(q) || e.summary.includes(q) || e.keywordTags.some((k) => k.includes(q)),
    ),
    segments: segments.filter(
      (s) =>
        s.itemTitle.includes(q) ||
        s.utterances.some((u) => u.text.includes(q)) ||
        s.keywordTags.some((k) => k.includes(q)) ||
        s.personPlaceTags.some((t) => t.includes(q)),
    ),
  };
}

interface DbPaper {
  id: string;
  paper_type: string;
  title: string;
  author: string | null;
  year: number | null;
  institution: string | null;
  journal_name: string | null;
  degree_level: string | null;
  keywords: string[];
  riss_url: string | null;
  user_memo: string | null;
  is_important: boolean;
  is_read: boolean;
}

// "연구 동향" 화면 상단에 "이 목록은 언제 기준인지" 보여주는 값 — scripts/sync-csv.mjs가
// papers 동기화를 마칠 때마다 갱신한다.
export async function getResearchSyncedAt(): Promise<string | null> {
  const { data, error } = await supabase.from("sync_status").select("last_synced_at").eq("id", "papers").maybeSingle();
  if (error) throw error;
  return data?.last_synced_at ?? null;
}

export async function getPapers(): Promise<PaperData[]> {
  const { data, error } = await supabase
    .from("papers")
    .select(
      "id, paper_type, title, author, year, institution, journal_name, degree_level, keywords, riss_url, user_memo, is_important, is_read",
    )
    .order("year", { ascending: false })
    .order("id", { ascending: true }); // 동일 연도 내 순서를 고정 — 없으면 새로고침(메모/중요/읽음 저장 등)마다 목록이 흔들림
  if (error) throw error;

  return ((data as DbPaper[]) ?? []).map((p) => ({
    id: p.id,
    paperType: p.paper_type as PaperData["paperType"],
    title: p.title,
    author: p.author ?? "",
    year: p.year,
    institution: p.institution ?? "",
    journalName: p.journal_name ?? undefined,
    degreeLevel: p.degree_level ?? undefined,
    keywords: p.keywords ?? [],
    rissUrl: p.riss_url ?? "",
    userMemo: p.user_memo ?? undefined,
    isImportant: p.is_important,
    isRead: p.is_read,
  }));
}

export async function getOralSegments(): Promise<SegmentCardData[]> {
  const [
    { data: segments, error: segmentsError },
    { data: persons, error: personsError },
    { data: sources, error: sourcesError },
    { data: segmentPersons, error: segmentPersonsError },
  ] = await Promise.all([
    supabase
      .from("segments")
      .select(
        "id, item_title, date_value, source_id, narrator_id, interviewer_id, event_id, segment_text, has_discrepancy, discrepancy_note, notes, keywords, user_memo, is_important",
      )
      .order("id"),
    supabase.from("persons").select("id, title"),
    supabase.from("sources").select("id, title, identifier"),
    supabase.from("segment_persons").select("segment_id, person_id"),
  ]);
  if (segmentsError) throw segmentsError;
  if (personsError) throw personsError;
  if (sourcesError) throw sourcesError;
  if (segmentPersonsError) throw segmentPersonsError;

  const personById = new Map(((persons as DbPerson[]) ?? []).map((p) => [p.id, p.title]));
  const sourceById = new Map(((sources as DbSource[]) ?? []).map((s) => [s.id, s]));

  const personTagsBySegment = new Map<string, string[]>();
  for (const sp of (segmentPersons as DbSegmentPerson[]) ?? []) {
    const name = personById.get(sp.person_id);
    if (!name) continue;
    const list = personTagsBySegment.get(sp.segment_id) ?? [];
    list.push(name);
    personTagsBySegment.set(sp.segment_id, list);
  }

  return ((segments as DbSegment[]) ?? []).map((s) => {
    const source = s.source_id ? sourceById.get(s.source_id) : undefined;
    return {
      id: s.id,
      itemTitle: s.item_title ?? "",
      dateValue: s.date_value ?? "",
      utterances: parseSegmentText(s.segment_text),
      personPlaceTags: personTagsBySegment.get(s.id) ?? [],
      keywordTags: s.keywords ?? [],
      hasDiscrepancy: s.has_discrepancy,
      discrepancyNote: s.discrepancy_note ?? undefined,
      notes: s.notes ?? undefined,
      sourceRef: source ? { title: source.title, url: source.identifier ?? undefined } : undefined,
      relatedItems: [], // 발췌구간 단위 관련자료는 아직 없음 — 사건(linkedMaterials) 쪽에만 있음
      userMemo: s.user_memo ?? undefined,
      isImportant: s.is_important,
    };
  });
}
