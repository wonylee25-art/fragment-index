import { supabase } from "./supabase";
import { parseSegmentText } from "./segment-text";
import { ArchiveItemType, RelatedItem, SegmentCardData, TimelineEventData } from "./types";

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
      supabase.from("timeline_events").select("id, event_name, date_value, summary, source_reference, has_discrepancy, keywords").order("id"),
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
        "id, item_title, date_value, source_id, narrator_id, interviewer_id, event_id, segment_text, has_discrepancy, discrepancy_note, notes, keywords",
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
    };
  });
}
