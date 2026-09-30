import { supabaseAdmin } from "./supabase-admin";

// 일상 조각(grains) 읽기. 텔레그램 봇이 grains 스키마에 쌓는 메모를 화면용으로 묶는다.
// 스키마에는 anon/authenticated가 들어오지 못하게 막아 두었으므로 service_role인
// 관리자 클라이언트로만 읽는다 — 서버 컴포넌트에서만 import한다.

export type GrainKind = "text" | "photo" | "forward";

// 조각에 딸린 각주. 조각의 어느 글자가 아니라 조각 전체에 붙는다.
export interface GrainNote {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface Grain {
  id: string;
  createdAt: string;
  body: string;
  kind: GrainKind;
  source: string | null;
  editedAt: string | null;
  caption: string | null; // 사진 조각의 썸네일 밑에 붙는 설명. 내가 적는다
  notes: GrainNote[]; // 각주. 달린 순서대로(오래된 것이 1번)
  photoUrl: string | null; // 비공개 버킷의 사진을 잠깐 볼 수 있게 서명한 주소. 사진이 없거나 못 만들면 null
  // 본문 속 키워드. 화면의 「키워드만 진하게」가 이 낱말이 본문에 나오는 자리를 진하게 남긴다.
  // 아직 DB에 칸이 없어 실제 조각은 늘 비어 있고, 데모만 채운다.
  keywords: string[];
  // 내가 강조로 그은 구간(본문 글자 위치). 키워드와 달리 화면이 계산하지 않고 내가 정한 자리다.
  highlights: { start: number; end: number }[];
}

export interface GrainThread {
  id: string;
  createdAt: string;
  title: string | null;
  summary: string | null;
  grains: Grain[]; // 오래된 것부터
}

// 시킬 때마다 Claude가 지난 정리 이후에 쌓인 조각을 읽고 써 넣는 정리. 되풀이된 것·이어질 것을 짧게 적은 글이다.
// 기간이 지난 정리의 끝에서 이어지므로 빠지거나 겹치는 조각이 없다.
export interface Summary {
  id: string;
  periodStart: string; // 이 정리가 다룬 기간의 시작(ISO 시각)
  periodEnd: string; // 끝(ISO 시각). 다음 정리는 여기서부터 이어진다
  body: string;
  fragmentCount: number;
}

interface FragmentRow {
  id: string;
  created_at: string;
  body: string;
  kind: GrainKind;
  source: string | null;
  edited_at: string | null;
  thread_id: string | null;
  image_path: string | null;
  photo_caption: string | null;
}

interface NoteRow {
  id: string;
  fragment_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
}

interface ThreadRow {
  id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
}

const PAGE = 1000; // PostgREST 한 번에 돌려주는 최대 행 수
const PHOTO_BUCKET = "grains";
const PHOTO_URL_SECONDS = 60 * 60; // 화면을 열어 둔 채 한 시간쯤은 사진이 보이게

export async function getGrainThreads(): Promise<{ threads: GrainThread[]; error: string | null }> {
  const db = supabaseAdmin.schema("grains");

  const fragments: FragmentRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("fragments")
      .select("id, created_at, body, kind, source, edited_at, thread_id, image_path, photo_caption")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { threads: [], error: error.message };
    fragments.push(...(data as FragmentRow[]));
    if (data.length < PAGE) break;
  }

  const notes: NoteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("notes")
      .select("id, fragment_id, body, created_at, edited_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { threads: [], error: error.message };
    notes.push(...(data as NoteRow[]));
    if (data.length < PAGE) break;
  }
  const notesByFragment = new Map<string, GrainNote[]>();
  for (const n of notes) {
    const list = notesByFragment.get(n.fragment_id) ?? [];
    list.push({ id: n.id, body: n.body, createdAt: n.created_at, editedAt: n.edited_at });
    notesByFragment.set(n.fragment_id, list);
  }

  const { data: threadRows, error: threadError } = await db
    .from("threads")
    .select("id, created_at, title, summary");
  if (threadError) return { threads: [], error: threadError.message };

  // 버킷에 올라간 사진(photos/…)만 서명한다. 올리기에 실패해 tg:… 로 남은 것은 볼 방법이 없다.
  // 서명에 실패해도 글은 그대로 보여야 하므로 오류는 삼키고 사진만 뺀다.
  const photoUrls = new Map<string, string>();
  const paths = [
    ...new Set(
      fragments.map((f) => f.image_path).filter((p): p is string => !!p && p.startsWith("photos/")),
    ),
  ];
  if (paths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, PHOTO_URL_SECONDS);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
    }
  }

  const byId = new Map<string, GrainThread>();
  for (const t of threadRows as ThreadRow[]) {
    byId.set(t.id, {
      id: t.id,
      createdAt: t.created_at,
      title: t.title,
      summary: t.summary,
      grains: [],
    });
  }
  for (const f of fragments) {
    // 덩어리 없이 저장된 조각은 없어야 하지만, 있어도 화면에서 사라지지 않게 자기 혼자 한 덩어리로 둔다.
    const key = f.thread_id ?? `solo-${f.id}`;
    let thread = byId.get(key);
    if (!thread) {
      thread = { id: key, createdAt: f.created_at, title: null, summary: null, grains: [] };
      byId.set(key, thread);
    }
    thread.grains.push({
      id: f.id,
      createdAt: f.created_at,
      body: f.body,
      kind: f.kind,
      source: f.source,
      editedAt: f.edited_at,
      caption: f.photo_caption,
      notes: notesByFragment.get(f.id) ?? [],
      photoUrl: (f.image_path && photoUrls.get(f.image_path)) || null,
      keywords: [],
      highlights: [],
    });
  }

  // 조각이 없는 덩어리(/new만 보낸 경우 등)는 보여줄 게 없다. 최근 조각이 있는 덩어리가 위로.
  const threads = [...byId.values()]
    .filter((t) => t.grains.length > 0)
    .sort((a, b) => {
      const lastA = a.grains[a.grains.length - 1].createdAt;
      const lastB = b.grains[b.grains.length - 1].createdAt;
      return lastB.localeCompare(lastA);
    });

  return { threads, error: null };
}

// 정리는 조각 목록의 덤이라, 못 읽어도 화면 전체를 막지 않고 그냥 비워 둔다.
export async function getSummaries(limit = 12): Promise<Summary[]> {
  const { data, error } = await supabaseAdmin
    .schema("grains")
    .from("summaries")
    .select("id, period_start, period_end, body, fragment_count")
    .order("period_end", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    body: r.body as string,
    fragmentCount: r.fragment_count as number,
  }));
}
