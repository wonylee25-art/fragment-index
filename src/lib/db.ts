import { supabase } from "./supabase";
import { parseSegmentText } from "./segment-text";
import { ArchiveItemType, PaperData, PaperQuote, RelatedItem, SegmentCardData, TimelineEventData, UnlinkedMaterials } from "./types";

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
  source_url: string | null;
  has_discrepancy: boolean;
  keywords: string[];
  user_saved: boolean;
  user_memo: string | null;
}

interface DbArchiveItem {
  id: string;
  item_type: string;
  title: string;
  source_org: string | null;
  source_url: string | null;
  description: string | null;
  image_url: string | null;
}

interface DbSegment {
  id: string;
  item_title: string | null;
  date_value: string | null;
  source_id: string | null;
  narrator_id: string | null;
  interviewer_id: string | null;
  segment_text: string;
  has_discrepancy: boolean;
  discrepancy_note: string | null;
  notes: string | null;
  keywords: string[];
  user_memo: string | null;
  is_important: boolean;
}

// 사건과 자료(사료·구술)를 잇는 "연결선". 사건 자체는 항상 확정이고,
// 확정/후보 구분은 이 연결선에만 있다 — 사용자뷰는 confirmed만 본다.
interface DbLink {
  event_id: string;
  target_type: "archive_item" | "segment";
  target_id: string;
  status: "confirmed" | "candidate" | "rejected";
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
    imageUrl: item.image_url ?? undefined,
  };
}

export interface ChronicleOptions {
  // 관리페이지용 — 후보 연결선까지 함께 가져온다. 기본값(false)은 사용자뷰용으로 확정만 본다.
  // 반려(rejected)는 어느 쪽에도 나오지 않는다.
  includeCandidates?: boolean;
}

// 관리페이지에서 숨긴 사건(hidden_at != null)의 id — 연표에서 빼고, 그 사건에 매달린
// 연결선도 "없는 것"으로 치기 위해 여러 곳에서 쓴다.
async function fetchHiddenEventIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("timeline_events").select("id").not("hidden_at", "is", null);
  if (error) throw error;
  return new Set(((data as { id: string }[]) ?? []).map((e) => e.id));
}

export async function getChronicleEvents({ includeCandidates = false }: ChronicleOptions = {}): Promise<TimelineEventData[]> {
  const visibleStatuses = includeCandidates ? ["confirmed", "candidate"] : ["confirmed"];

  const [{ data: events, error: eventsError }, { data: materials, error: materialsError }, { data: links, error: linksError }] =
    await Promise.all([
      supabase.from("timeline_events").select("id, event_name, date_value, summary, source_reference, source_url, has_discrepancy, keywords, user_saved, user_memo").is("hidden_at", null).order("id"),
      supabase.from("archive_items").select("id, item_type, title, source_org, source_url, description, image_url"),
      supabase.from("links").select("event_id, target_type, target_id, status").in("status", visibleStatuses),
    ]);
  if (eventsError) throw eventsError;
  if (materialsError) throw materialsError;
  if (linksError) throw linksError;

  const materialById = new Map(((materials as DbArchiveItem[]) ?? []).map((m) => [m.id, m]));

  const materialsByEvent = new Map<string, RelatedItem[]>();
  const segmentIdsByEvent = new Map<string, string[]>();
  for (const link of (links as DbLink[]) ?? []) {
    if (link.target_type === "archive_item") {
      const material = materialById.get(link.target_id);
      if (!material) continue; // 자료가 지워졌는데 연결선이 남은 경우 — 화면에선 무시
      const list = materialsByEvent.get(link.event_id) ?? [];
      list.push(toRelatedItem(material));
      materialsByEvent.set(link.event_id, list);
    } else {
      const list = segmentIdsByEvent.get(link.event_id) ?? [];
      list.push(link.target_id);
      segmentIdsByEvent.set(link.event_id, list);
    }
  }

  return ((events as DbTimelineEvent[]) ?? []).map((e) => ({
    id: e.id,
    eventName: e.event_name,
    dateValue: e.date_value ?? "",
    summary: e.summary ?? "",
    sourceReference: e.source_reference ?? "",
    sourceUrl: e.source_url ?? "",
    places: [], // places/event_places 아직 데이터 없음 (좌표 미확보)
    keywordTags: e.keywords ?? [],
    linkedSegmentIds: segmentIdsByEvent.get(e.id) ?? [],
    linkedMaterials: materialsByEvent.get(e.id) ?? [],
    savedByUser: e.user_saved,
    userMemo: e.user_memo ?? undefined,
  }));
}

export interface HiddenEventSummary {
  id: string;
  eventName: string;
  dateValue: string;
}

// 관리페이지 아래쪽 "숨긴 사건" 목록용. 되살리는 길이 없으면 숨김은 삭제와 다를 바 없다.
export async function getHiddenEvents(): Promise<HiddenEventSummary[]> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("id, event_name, date_value, hidden_at")
    .not("hidden_at", "is", null)
    .order("hidden_at", { ascending: false }); // 최근에 숨긴 것부터 — 실수로 숨겼을 때 바로 보인다
  if (error) throw error;

  return ((data as { id: string; event_name: string; date_value: string | null }[]) ?? []).map((e) => ({
    id: e.id,
    eventName: e.event_name,
    dateValue: e.date_value ?? "",
  }));
}

// 사료 연결 ②번 칸 — 연결선이 하나도 안 붙은 자료·구술.
// 사건이 정해지지 않은 상태를 "사건 칸이 빈 연결선"으로 만들지 않고, 연결선의 부재로 표현한다.
// 나중에 사건 뼈대를 채울 때 여기 쌓인 것을 재료로 쓴다.
export async function getUnlinkedMaterials(): Promise<UnlinkedMaterials> {
  const [{ data: items, error: itemsError }, { data: segments, error: segmentsError }, { data: links, error: linksError }, hiddenEventIds] =
    await Promise.all([
      supabase.from("archive_items").select("id, item_type, title, source_org, source_url, description, image_url").order("id"),
      supabase.from("segments").select("id, item_title, date_value").order("id"),
      // 반려된 연결선은 "붙어 있다"고 보지 않는다 — 반려당한 자료는 다시 미연결로 돌아온다.
      supabase.from("links").select("event_id, target_type, target_id").in("status", ["confirmed", "candidate"]),
      fetchHiddenEventIds(),
    ]);
  if (itemsError) throw itemsError;
  if (segmentsError) throw segmentsError;
  if (linksError) throw linksError;

  const linkedItemIds = new Set<string>();
  const linkedSegmentIds = new Set<string>();
  for (const link of (links as Pick<DbLink, "event_id" | "target_type" | "target_id">[]) ?? []) {
    // 숨긴 사건에만 붙어 있는 자료는 미연결로 친다 — 그러지 않으면 연표에도 안 보이고
    // 보류함에도 안 뜨는 사각지대에 갇힌다.
    if (hiddenEventIds.has(link.event_id)) continue;
    (link.target_type === "archive_item" ? linkedItemIds : linkedSegmentIds).add(link.target_id);
  }

  return {
    materials: ((items as DbArchiveItem[]) ?? []).filter((m) => !linkedItemIds.has(m.id)).map(toRelatedItem),
    segments: ((segments as { id: string; item_title: string | null; date_value: string | null }[]) ?? [])
      .filter((s) => !linkedSegmentIds.has(s.id))
      .map((s) => ({ id: s.id, itemTitle: s.item_title ?? "", dateValue: s.date_value ?? "" })),
  };
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

// 사료 연결 "사료 검색"의 빈 상태(검색어 입력 전)에 보여줄 제안 키워드 — DB(사건·구술)에
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
  publisher_location: string | null;
  translator: string | null;
  volume_issue: string | null;
  research_period: string | null;
  research_team: string | null;
  research_summary: string | null;
  created_at: string;
}

interface DbPaperQuote {
  id: string;
  paper_id: string;
  quote_text: string;
  page: string | null;
  created_at: string;
}

// "연구 동향" 화면 상단에 "이 목록은 언제 기준인지" 보여주는 값 — scripts/sync-csv.mjs가
// papers 동기화를 마칠 때마다 갱신한다.
export async function getResearchSyncedAt(): Promise<string | null> {
  const { data, error } = await supabase.from("sync_status").select("last_synced_at").eq("id", "papers").maybeSingle();
  if (error) throw error;
  return data?.last_synced_at ?? null;
}

export async function getPapers(): Promise<PaperData[]> {
  const [
    { data, error },
    { data: quotes, error: quotesError },
  ] = await Promise.all([
    supabase
      .from("papers")
      .select(
        "id, paper_type, title, author, year, institution, journal_name, degree_level, keywords, riss_url, user_memo, is_important, is_read, publisher_location, translator, volume_issue, research_period, research_team, research_summary, created_at",
      )
      .order("year", { ascending: false })
      .order("id", { ascending: true }), // 동일 연도 내 순서를 고정 — 없으면 새로고침(메모/중요/읽음 저장 등)마다 목록이 흔들림
    supabase.from("paper_quotes").select("id, paper_id, quote_text, page, created_at").order("created_at", { ascending: true }),
  ]);
  if (error) throw error;
  if (quotesError) throw quotesError;

  const quotesByPaper = new Map<string, PaperQuote[]>();
  for (const q of (quotes as DbPaperQuote[]) ?? []) {
    const list = quotesByPaper.get(q.paper_id) ?? [];
    list.push({ id: q.id, quoteText: q.quote_text, page: q.page ?? undefined, createdAt: q.created_at });
    quotesByPaper.set(q.paper_id, list);
  }

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
    publisherLocation: p.publisher_location ?? undefined,
    translator: p.translator ?? undefined,
    volumeIssue: p.volume_issue ?? undefined,
    researchPeriod: p.research_period ?? undefined,
    researchTeam: p.research_team ?? undefined,
    researchSummary: p.research_summary ?? undefined,
    createdAt: p.created_at,
    quotes: quotesByPaper.get(p.id) ?? [],
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
        "id, item_title, date_value, source_id, narrator_id, interviewer_id, segment_text, has_discrepancy, discrepancy_note, notes, keywords, user_memo, is_important",
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
