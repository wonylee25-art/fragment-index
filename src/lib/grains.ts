import { supabaseAdmin } from "./supabase-admin";

// 일상 조각(grains) 읽기. 텔레그램 봇이 grains 스키마에 쌓는 메모를 화면용으로 묶는다.
// 스키마에는 anon/authenticated가 들어오지 못하게 막아 두었으므로 service_role인
// 관리자 클라이언트로만 읽는다 — 서버 컴포넌트에서만 import한다.

export type GrainKind = "text" | "photo" | "forward";

export interface Grain {
  id: string;
  createdAt: string;
  body: string;
  kind: GrainKind;
  source: string | null;
  editedAt: string | null;
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

interface FragmentRow {
  id: string;
  created_at: string;
  body: string;
  kind: GrainKind;
  source: string | null;
  edited_at: string | null;
  thread_id: string | null;
  image_path: string | null;
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
      .select("id, created_at, body, kind, source, edited_at, thread_id, image_path")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { threads: [], error: error.message };
    fragments.push(...(data as FragmentRow[]));
    if (data.length < PAGE) break;
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
