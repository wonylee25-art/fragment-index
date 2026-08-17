import { supabase } from "./supabase";
import { parseSegmentText } from "./segment-text";
import { ArchiveItemType, Highlight, PaperData, PaperQuote, PersonBrief, RelatedItem, SegmentCardData, SpeakerRole, TimelineEventData, UnlinkedMaterials } from "./types";

// Supabase 테이블에서 화면이 쓰는 TimelineEventData/SegmentCardData 모양으로 조립한다.
// 데이터 규모(수백 행)가 작아서, 각 테이블을 통째로 가져와 메모리에서 조인한다 —
// PostgREST 임베드 문법(특히 narrator_id/interviewer_id처럼 같은 테이블을 두 번 참조하는
// 애매한 FK)에 기대는 것보다 이쪽이 훨씬 단순하고 안전하다.

interface DbPerson {
  id: string;
  title: string;
  affiliation?: string | null; // 소속(직위) — 동명이인을 가려내고 면담자를 알아보기 위한 최소 신상
  // 역할과 속성이 함께 들어간다: ["구술자"], ["구술자", "배우"], ["구술자", "미상"] 등.
  // 뽑아 쓰는 질의에서만 select에 넣으므로 없을 수 있다.
  subject?: string[] | null;
}

const PERSON_KINDS = ["가명", "익명", "미상"] as const;

function personKindOf(person: DbPerson): PersonBrief["kind"] {
  return PERSON_KINDS.find((k) => person.subject?.includes(k));
}

interface DbSource {
  id: string;
  title: string;
  identifier: string | null;
  type?: string | null;
  creator?: string | null;
  publisher?: string | null;
  date_value?: string | null;
}

// 연표의 출처 칸에는 CSV 시절의 출처 대장 번호(SRC007)가 그대로 적혀 있는 사건이 많다.
// 번호만 보고 무슨 자료인지 아는 사람은 이 표를 만든 사람뿐이라, 읽는 자리에서는 대장
// (sources)을 찾아 실제 서지로 바꿔 보여준다. DB의 값은 그대로 두고 화면에서만 푼다 —
// CSV 동기화가 다시 번호를 써넣어도 어긋나지 않는다.
const SOURCE_CODE = /^SRC\d+$/i;

function formatSourceEntry(source: DbSource): string {
  return [
    source.creator,
    `『${source.title}』`,
    source.publisher,
    source.date_value ? `(${source.date_value})` : null,
  ]
    .filter(Boolean)
    .join(", ")
    .replace(", (", " (");
}

// "SRC005; 근대사 연표(국사편찬위원회, 날짜 일치 확인)"처럼 번호와 메모가 섞여 있는 값도
// 있어, 세미콜론으로 끊어 번호인 조각만 바꾼다. 링크는 처음 풀린 번호의 것을 쓴다.
function resolveSourceReference(
  raw: string,
  sourceById: Map<string, DbSource>,
): { reference: string; url: string | null } {
  if (!raw) return { reference: "", url: null };

  let url: string | null = null;
  const parts = raw.split(";").map((part) => {
    const token = part.trim();
    if (!SOURCE_CODE.test(token)) return token;
    const source = sourceById.get(token.toUpperCase());
    if (!source) return token; // 대장에 없는 번호는 지우지 않고 그대로 둔다 — 지우면 단서까지 사라진다
    if (!url && source.identifier?.startsWith("http")) url = source.identifier;
    return formatSourceEntry(source);
  });

  return { reference: parts.filter(Boolean).join("; "), url };
}

interface DbTimelineEvent {
  id: string;
  event_name: string;
  date_value: string | null;
  summary: string | null;
  source_reference: string | null;
  source_url: string | null;
  source_type: string | null;
  source_author: string | null;
  source_pages: string | null;
  has_discrepancy: boolean;
  keywords: string[];
  user_saved: boolean;
  user_memo: string | null;
  highlighted: boolean;
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
  page: string | null;
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
  highlights: unknown;
}

// jsonb 컬럼이라 스키마가 강제되지 않는다 — 손으로 넣은 값이든 옛 형식이든 그대로 들어온다.
// 화면은 이 배열을 믿고 문자열을 자르므로(Transcript), 모양이 어긋난 항목은 그리기 전에 버린다.
// 뒤집힌 범위(start >= end)와 음수도 함께 걸러낸다 — 자르면 빈 문자열이 되어 조용히 사라지는데,
// 그러면 "그었는데 안 보인다"가 되고 원인을 찾을 단서가 남지 않는다.
function sanitizeHighlights(value: unknown): Highlight[] {
  if (!Array.isArray(value)) return [];
  return value.filter((h): h is Highlight => {
    if (!h || typeof h !== "object") return false;
    const { line, start, end } = h as Record<string, unknown>;
    return (
      Number.isInteger(line) &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      (line as number) >= 0 &&
      (start as number) >= 0 &&
      (end as number) > (start as number)
    );
  });
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

interface DbSegmentSpeaker {
  segment_id: string;
  person_id: string;
  role: "구술자" | "면담자";
  seq: number;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
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

  const [
    { data: events, error: eventsError },
    { data: materials, error: materialsError },
    { data: links, error: linksError },
    { data: sources, error: sourcesError },
  ] = await Promise.all([
    supabase.from("timeline_events").select("id, event_name, date_value, summary, source_reference, source_url, source_type, source_author, source_pages, has_discrepancy, keywords, user_saved, user_memo, highlighted").is("hidden_at", null).order("id"),
    // 치운 사료는 연표에서도 빠진다. 연결선은 그대로 두므로 되살리면 붙어 있던 사건으로 돌아온다.
    supabase.from("archive_items").select("id, item_type, title, source_org, source_url, description, image_url").is("hidden_at", null),
    supabase.from("links").select("event_id, target_type, target_id, status").in("status", visibleStatuses),
    // 출처 대장 — 사건에 번호(SRC007)로만 적혀 있는 출처를 실제 서지로 푸는 데 쓴다.
    supabase.from("sources").select("id, type, title, creator, publisher, date_value, identifier"),
  ]);
  if (eventsError) throw eventsError;
  if (materialsError) throw materialsError;
  if (linksError) throw linksError;
  if (sourcesError) throw sourcesError;

  const sourceById = new Map(((sources as DbSource[]) ?? []).map((s) => [s.id, s]));

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

  return ((events as DbTimelineEvent[]) ?? []).map((e) => {
    // 번호로 적힌 출처는 여기서 서지로 풀린다. 사건에 적어둔 주소가 있으면 그것이 먼저다 —
    // 대장의 주소는 자료 전체를, 사건의 주소는 이 사건이 실린 자리를 가리킨다.
    const source = resolveSourceReference(e.source_reference ?? "", sourceById);
    return {
      id: e.id,
      eventName: e.event_name,
      dateValue: e.date_value ?? "",
      summary: e.summary ?? "",
      sourceReference: e.source_reference ?? "",
      sourceLabel: source.reference,
      sourceUrl: e.source_url ?? source.url ?? "",
      sourceType: e.source_type ?? "",
      sourceAuthor: e.source_author ?? "",
      sourcePages: e.source_pages ?? "",
      places: [], // places/event_places 아직 데이터 없음 (좌표 미확보)
      keywordTags: e.keywords ?? [],
      linkedSegmentIds: segmentIdsByEvent.get(e.id) ?? [],
      linkedMaterials: materialsByEvent.get(e.id) ?? [],
      savedByUser: e.user_saved,
      userMemo: e.user_memo ?? undefined,
      highlighted: e.highlighted,
    };
  });
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

// 보류함 아래에 접어두는 "치운 사료" 목록. 치운 사료는 연표에서도 보류함에서도 빠지므로,
// 이 목록이 그것들에 닿는 유일한 길이다 — 되살리는 것도, 정말로 지우는 것도 여기서만 한다.
export async function getHiddenMaterials(): Promise<RelatedItem[]> {
  const { data, error } = await supabase
    .from("archive_items")
    .select("id, item_type, title, source_org, source_url, description, image_url, hidden_at")
    .not("hidden_at", "is", null)
    .order("hidden_at", { ascending: false }); // 방금 치운 것부터 — 잘못 치웠을 때 바로 보인다
  if (error) throw error;

  return ((data as DbArchiveItem[]) ?? []).map(toRelatedItem);
}

// 사료 연결 ②번 칸 — 연결선이 하나도 안 붙은 자료·구술.
// 사건이 정해지지 않은 상태를 "사건 칸이 빈 연결선"으로 만들지 않고, 연결선의 부재로 표현한다.
// 나중에 사건 뼈대를 채울 때 여기 쌓인 것을 재료로 쓴다.
export async function getUnlinkedMaterials(): Promise<UnlinkedMaterials> {
  const [{ data: items, error: itemsError }, { data: segments, error: segmentsError }, { data: links, error: linksError }, hiddenEventIds] =
    await Promise.all([
      // 치운 사료(hidden_at)는 보류함에서 빠진다 — 되돌리는 길은 아래 "치운 사료" 목록이다.
      supabase.from("archive_items").select("id, item_type, title, source_org, source_url, description, image_url").is("hidden_at", null).order("id"),
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

// 구술 추가 화면의 인물 목록. 역할로 미리 가르지 않는다 — 한 사람이 어떤 면담에서는
// 구술자, 다른 면담에서는 면담자일 수 있고, 역할은 발췌마다 명단에서 정해지기 때문이다.
//
// subject까지 읽는 것은 미상·익명을 가려내기 위해서다. 이 화면에서는 같은 이름이 여러 줄
// 뜨는 게 정상이라(미상은 부를 때마다 새로 만든다), 어느 줄이 미상인지 보이지 않으면
// 고르는 쪽이 그냥 첫 줄을 누르게 된다.
export async function getPersons(): Promise<PersonBrief[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("id, title, affiliation, subject")
    .order("title");
  if (error) throw error;
  return ((data as DbPerson[]) ?? []).map((p) => ({
    id: p.id,
    name: p.title,
    affiliation: p.affiliation ?? undefined,
    kind: personKindOf(p),
  }));
}

export interface SourceOption {
  id: string;
  title: string;
  creator: string; // 구술채록 사업·기관 — 같은 제목이 여럿일 때 가려내는 단서
}

export async function getSourceOptions(): Promise<SourceOption[]> {
  const { data, error } = await supabase.from("sources").select("id, title, creator").order("title");
  if (error) throw error;
  return ((data as { id: string; title: string | null; creator: string | null }[]) ?? []).map((s) => ({
    id: s.id,
    title: s.title ?? "(제목 없음)",
    creator: s.creator ?? "",
  }));
}

// 관리 "구술 연결" 화면 — 구술 하나하나가 어느 사건에 붙어 있는지, 아직 안 붙었는지.
// 사료 연결의 보류함이 "안 붙은 것"만 보여주는 것과 달리, 여기서는 붙은 것도 함께 보여
// 어느 사건에 이미 매여 있는지 알고 고칠 수 있게 한다.
export interface SegmentLinkRow {
  id: string;
  dateValue: string;
  speakers: string[]; // 구술자 이름 — 목록에서 발췌를 알아보는 가장 빠른 단서
  preview: string; // 본문 첫 발화
  linkedEvents: { id: string; eventName: string; dateValue: string }[];
}

export async function getSegmentLinkRows(): Promise<SegmentLinkRow[]> {
  const [segments, events] = await Promise.all([
    getOralSegments(),
    getChronicleEvents({ includeCandidates: true }),
  ]);

  const eventsBySegment = new Map<string, { id: string; eventName: string; dateValue: string }[]>();
  for (const event of events) {
    for (const segmentId of event.linkedSegmentIds) {
      const list = eventsBySegment.get(segmentId) ?? [];
      list.push({ id: event.id, eventName: event.eventName, dateValue: event.dateValue });
      eventsBySegment.set(segmentId, list);
    }
  }

  return segments.map((s) => ({
    id: s.id,
    dateValue: s.dateValue,
    speakers: s.narrators.map((n) => n.name),
    preview: s.utterances.find((u) => u.text.trim())?.text ?? "",
    linkedEvents: eventsBySegment.get(s.id) ?? [],
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
        "id, item_title, date_value, page, source_id, narrator_id, interviewer_id, segment_text, has_discrepancy, discrepancy_note, notes, keywords, user_memo, is_important, highlights",
      )
      .order("id"),
    // subject까지 읽는다 — 화자가 가명·익명·미상이면 목록에서 그렇게 보여야 한다.
    // 이름만 내보내면 읽는 쪽은 "김영미"를 실명으로 읽는다.
    supabase.from("persons").select("id, title, affiliation, subject"),
    supabase.from("sources").select("id, title, identifier"),
    supabase.from("segment_persons").select("segment_id, person_id"),
  ]);
  if (segmentsError) throw segmentsError;
  if (personsError) throw personsError;
  if (sourcesError) throw sourcesError;
  if (segmentPersonsError) throw segmentPersonsError;

  // 구술자·면담자가 여럿인 발췌(segment_speakers)와, 번호로 쌓이는 각주(segment_notes).
  const [{ data: speakers, error: speakersError }, { data: segmentNotes, error: notesError }] =
    await Promise.all([
      supabase.from("segment_speakers").select("segment_id, person_id, role, seq").order("seq"),
      supabase.from("segment_notes").select("segment_id, seq, note_text").order("seq"),
    ]);
  if (speakersError) throw speakersError;
  if (notesError) throw notesError;

  const personRecordById = new Map(((persons as DbPerson[]) ?? []).map((p) => [p.id, p]));
  const personById = new Map(((persons as DbPerson[]) ?? []).map((p) => [p.id, p.title]));
  const sourceById = new Map(((sources as DbSource[]) ?? []).map((s) => [s.id, s]));

  const speakerRows = (speakers as DbSegmentSpeaker[]) ?? [];
  const narratorsBySegment = new Map<string, PersonBrief[]>();
  const interviewersBySegment = new Map<string, PersonBrief[]>();
  // 이름 → 역할. 본문의 "김청기:" 같은 줄머리를 역할로 되돌리는 데 쓴다(segment-text.ts).
  const roleByNameBySegment = new Map<string, Map<string, SpeakerRole>>();
  for (const row of speakerRows) {
    const person = personRecordById.get(row.person_id);
    if (!person) continue;
    const brief: PersonBrief = {
      id: person.id,
      name: person.title,
      affiliation: person.affiliation ?? undefined,
      kind: personKindOf(person),
    };
    const bucket = row.role === "면담자" ? interviewersBySegment : narratorsBySegment;
    bucket.set(row.segment_id, [...(bucket.get(row.segment_id) ?? []), brief]);

    const names = roleByNameBySegment.get(row.segment_id) ?? new Map<string, SpeakerRole>();
    names.set(person.title, row.role === "면담자" ? "interviewer" : "narrator");
    roleByNameBySegment.set(row.segment_id, names);
  }

  const notesBySegment = new Map<string, string[]>();
  for (const row of ((segmentNotes as { segment_id: string; note_text: string }[]) ?? [])) {
    notesBySegment.set(row.segment_id, [...(notesBySegment.get(row.segment_id) ?? []), row.note_text]);
  }

  function toBrief(id: string | null) {
    if (!id) return undefined;
    const person = personRecordById.get(id);
    if (!person) return undefined;
    return {
      id: person.id,
      name: person.title,
      affiliation: person.affiliation ?? undefined,
      kind: personKindOf(person),
    };
  }

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
      // 화자 명단은 segment_speakers가 먼저다. 거기 없으면(CSV 동기화분) 한 명씩 담긴
      // narrator_id/interviewer_id로 되돌아간다.
      narrators: narratorsBySegment.get(s.id) ?? [toBrief(s.narrator_id)].filter(isPresent),
      interviewers: interviewersBySegment.get(s.id) ?? [toBrief(s.interviewer_id)].filter(isPresent),
      dateValue: s.date_value ?? "",
      utterances: parseSegmentText(s.segment_text, roleByNameBySegment.get(s.id)),
      personPlaceTags: personTagsBySegment.get(s.id) ?? [],
      keywordTags: s.keywords ?? [],
      hasDiscrepancy: s.has_discrepancy,
      discrepancyNote: s.discrepancy_note ?? undefined,
      notes: s.notes ?? undefined,
      noteList: notesBySegment.get(s.id) ?? [],
      sourceRef: source ? { title: source.title, url: source.identifier ?? undefined } : undefined,
      // 고치기 화면이 폼을 되채우는 데 쓴다 — 화면에 그리는 값은 아니다.
      page: s.page ?? undefined,
      sourceId: s.source_id ?? undefined,
      relatedItems: [], // 자료는 사건을 거쳐서만 붙는다 — 사건 쪽 linkedMaterials를 본다
      userMemo: s.user_memo ?? undefined,
      isImportant: s.is_important,
      // jsonb라 무엇이든 들어올 수 있다 — 화면이 믿고 쓰기 전에 여기서 한 번 거른다.
      highlights: sanitizeHighlights(s.highlights),
    };
  });
}
