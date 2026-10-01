"use client";

import { useMemo, useState, useTransition } from "react";
import type { Grain, GrainKind, GrainNote, GrainThread } from "@/lib/grains";
import {
  addNote,
  deleteGrain,
  deleteNote,
  mergeThreads,
  splitThread,
  updateGrain,
  updateNote,
} from "@/lib/grain-actions";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { KeywordGrid } from "./KeywordGrid";
import { Switch } from "./Switch";

// 일상 조각 — 덩어리(thread) 단위로 묶어 보여 준다. 검색과 종류 필터는 브라우저에서 건다:
// 조각이 수천 건이 되기 전까지는 통째로 받아 거르는 것이 왕복 없이 가장 빠르다.
//
// 연결은 두 가지로 보인다.
//  · 키워드 렌즈 — 「키워드만 진하게」를 켜면 키워드가 아닌 글은 회색으로 물러나고 키워드만 남는다.
//    키워드를 하나 고르면 그 낱말만 남아, 여러 날에 걸쳐 되풀이되는 자리가 한눈에 보인다.
//    색을 얹지 않고 있는 글의 농도만 덜어 내므로 "색은 내가 손댄 흔적"이라는 규칙과 어긋나지 않는다.
//  · 강조 — 내가 직접 그은 구간만 노랑이다. 렌즈를 켜도 꺼도 그대로 남는다.

const KIND_LABEL: Record<GrainKind, string> = {
  text: "글",
  photo: "사진",
  forward: "전달",
};

type KindFilter = "all" | GrainKind;

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "text", label: KIND_LABEL.text },
  { value: "photo", label: KIND_LABEL.photo },
  { value: "forward", label: KIND_LABEL.forward },
];

// 서버와 브라우저의 시간대가 달라도 같은 글자가 나오도록 시간대를 못 박는다.
const DAY = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});
const NOTE_DAY = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
});
const TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// 본문에서 키워드가 나오는 모든 자리에 표를 한다. 대소문자는 가리지 않는다.
function keywordFlags(text: string, keywords: string[], active: string | null) {
  const any = new Array<boolean>(text.length).fill(false);
  const selected = new Array<boolean>(text.length).fill(false);
  // toLowerCase가 글자 수를 바꾸는 드문 글자에서는 위치가 어긋나므로 그때는 원문으로 찾는다.
  const lower = text.toLowerCase().length === text.length ? text.toLowerCase() : text;
  for (const keyword of keywords) {
    const needle = keyword.toLowerCase();
    if (!needle) continue;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
      for (let i = at; i < at + needle.length; i++) {
        any[i] = true;
        if (keyword === active) selected[i] = true;
      }
    }
  }
  return { any, selected };
}

function GrainBody({
  grain,
  lens,
  active,
}: {
  grain: Grain;
  lens: boolean;
  active: string | null;
}) {
  const noteCount = grain.notes.length;
  const text = grain.body;
  const { any, selected } = keywordFlags(text, grain.keywords, active);
  const marked = new Array<boolean>(text.length).fill(false);
  for (const h of grain.highlights) {
    for (let i = Math.max(0, h.start); i < Math.min(text.length, h.end); i++) marked[i] = true;
  }

  // 같은 표를 가진 글자를 한 덩이로 묶어 span 수를 줄인다.
  const runs: { text: string; keyword: boolean; on: boolean; mark: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    // 렌즈에서 진하게 남는 글자: 고른 키워드가 있으면 그 낱말만, 없으면 모든 키워드.
    const on = active ? selected[i] : any[i];
    const last = runs[runs.length - 1];
    if (last && last.keyword === any[i] && last.on === on && last.mark === marked[i]) {
      last.text += text[i];
    } else {
      runs.push({ text: text[i], keyword: any[i], on, mark: marked[i] });
    }
  }

  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
      {runs.map((r, i) => {
        // 렌즈를 켰을 때: 남길 글자는 진하게, 나머지는 회색. 강조 구간은 늘 진한 글씨에 노랑.
        const dim = lens && !r.on && !r.mark;
        const cls = [
          dim ? "text-grey" : "text-ink",
          lens && r.on ? "font-semibold underline decoration-ink underline-offset-2" : "",
          // 렌즈가 꺼져 있어도 키워드 자리가 어디인지는 얇은 점선으로 알 수 있게 한다.
          !lens && r.keyword ? "underline decoration-dotted decoration-grey underline-offset-2" : "",
          r.mark ? "bg-yellow-mark" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={i} className={cls}>
            {r.text}
          </span>
        );
      })}
      {/* 각주가 달린 조각은 글 끝에 그 번호를 위첨자로 붙여, 아래 각주 목록과 이어 읽게 한다. */}
      {noteCount > 0 && (
        <sup className="ml-0.5 font-mono text-[10px] text-grey">
          {Array.from({ length: noteCount }, (_, i) => i + 1).join(",")}
        </sup>
      )}
    </p>
  );
}

// 조각 하나의 본문을 고치는 칸. 사진 조각이면 사진이 칸 위에 그대로 있어서 보면서 적는다.
// ⌘/Ctrl + Enter로 저장하고 Esc로 닫는다. 저장이 끝나야 닫히므로, 실패하면 적은 글이 그대로 남는다.
function GrainEditor({ grain, onDone }: { grain: Grain; onDone: () => void }) {
  const hasPhoto = grain.kind === "photo" || !!grain.photoUrl;
  const [draft, setDraft] = useState(grain.body);
  const [caption, setCaption] = useState(grain.caption ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await updateGrain(grain.id, draft, hasPhoto ? caption : null);
      if (result.ok) onDone();
      else setError(result.error);
    } catch {
      setError("저장하지 못했습니다. 잠시 뒤 다시 해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-2">
      {hasPhoto && (
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="사진 설명(썸네일 밑에 붙어요)"
          maxLength={300}
          disabled={pending}
          className="mb-2 w-full border-b border-line bg-transparent pb-1 text-[12px] text-ink placeholder:text-grey focus:outline-none"
        />
      )}
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
        }}
        placeholder={
          grain.kind === "photo" ? "사진에 적힌 내용이나 메모를 적어 주세요" : "메모를 입력하세요"
        }
        rows={Math.min(12, Math.max(4, draft.split("\n").length + 1))}
        disabled={pending}
        className="w-full resize-y bg-transparent text-[13px] leading-relaxed text-ink placeholder:text-grey focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-end gap-2 font-mono text-[11px]">
        {error && <span className="mr-auto text-red-text">{error}</span>}
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-sm px-2 py-1 text-grey hover:text-ink"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !draft.trim()}
          className="rounded-sm bg-ink px-2 py-1 font-bold text-background disabled:opacity-40"
        >
          {pending ? "저장 중" : "저장"}
        </button>
      </div>
    </div>
  );
}

// 각주 하나를 쓰거나 고치는 작은 칸. ⌘/Ctrl + Enter로 저장, Esc로 닫는다.
// 저장이 끝나야 닫히므로 실패하면 적은 글이 그대로 남는다.
function NoteForm({
  initial = "",
  onSubmit,
  onCancel,
}: {
  initial?: string;
  onSubmit: (body: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onSubmit(draft);
      if (result.ok) onCancel();
      else setError(result.error);
    } catch {
      setError("저장하지 못했습니다. 잠시 뒤 다시 해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-1.5">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
        }}
        placeholder="각주를 적어 주세요"
        rows={2}
        disabled={pending}
        className="w-full resize-y bg-transparent text-[12px] leading-relaxed text-ink placeholder:text-grey focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2 font-mono text-[11px]">
        {error && <span className="mr-auto text-red-text">{error}</span>}
        <button type="button" onClick={onCancel} disabled={pending} className="px-1.5 py-0.5 text-grey hover:text-ink">
          취소
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !draft.trim()}
          className="rounded-sm bg-ink px-1.5 py-0.5 font-bold text-background disabled:opacity-40"
        >
          {pending ? "저장 중" : "저장"}
        </button>
      </div>
    </div>
  );
}

function NoteLine({
  note,
  index,
  editable,
}: {
  note: GrainNote;
  index: number;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <NoteForm
          initial={note.body}
          onSubmit={(body) => updateNote(note.id, body)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex gap-1.5 text-[12px] leading-relaxed text-grey">
      <span className="w-3 shrink-0 pt-px text-right font-mono text-[10px]">{index}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
        {note.body}
        <span className="ml-1.5 font-mono text-[10px]">
          {NOTE_DAY.format(new Date(note.createdAt))}
          {note.editedAt ? " · 수정됨" : ""}
        </span>
        {editable && (
          <span className="ml-2 inline-flex items-center gap-2 font-mono text-[10px]">
            <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-2 hover:text-ink">
              수정
            </button>
            <ConfirmDeleteButton
              label="삭제"
              confirmMessage="이 각주를 지울까요?"
              className="underline underline-offset-2 hover:text-ink"
              onDelete={async () => {
                const result = await deleteNote(note.id);
                if (!result.ok) window.alert(result.error);
              }}
            />
          </span>
        )}
      </span>
    </li>
  );
}

// 조각 아래에 붙는 각주 목록. 조각의 어느 글자가 아니라 조각 전체에 붙는다 — 글을 고치면 글자 위치가
// 밀리므로 위치에 붙이지 않았다. 번호는 단 순서대로이고, 글 끝의 위첨자와 같은 번호다.
function GrainNotes({ grain, editable }: { grain: Grain; editable: boolean }) {
  const [adding, setAdding] = useState(false);

  if (grain.notes.length === 0 && !editable) return null;

  return (
    <div className="mt-2 space-y-1 border-t border-line pt-1.5">
      {grain.notes.length > 0 && (
        <ol className="space-y-1">
          {grain.notes.map((n, i) => (
            <NoteLine key={n.id} note={n} index={i + 1} editable={editable} />
          ))}
        </ol>
      )}
      {editable &&
        (adding ? (
          <NoteForm onSubmit={(body) => addNote(grain.id, body)} onCancel={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="font-mono text-[11px] text-grey underline underline-offset-2 hover:text-ink"
          >
            각주 달기
          </button>
        ))}
    </div>
  );
}

// 덩어리를 나누거나 잇는 동그란 버튼. 둘 다 서로 되돌릴 수 있어 확인 창은 두지 않는다.
function CircleButton({
  glyph,
  title,
  action,
}: {
  glyph: string;
  title: string;
  action: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await action();
          if (!result.ok) window.alert(result.error);
        })
      }
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-background font-mono text-[11px] leading-none text-grey hover:border-ink hover:text-ink disabled:opacity-40"
    >
      {glyph}
    </button>
  );
}

export function GrainsBoard({
  threads,
  editable = false,
  demo = false,
}: {
  threads: GrainThread[];
  editable?: boolean;
  // 예시 화면: 덩어리 나누기·합치기 버튼의 자리만 보여 주고, 누르면 안내만 띄운다.
  demo?: boolean;
}) {
  const showThreadButtons = editable || demo;
  const DEMO_REFUSE = async () =>
    ({ ok: false, error: "예시 화면에서는 동작하지 않습니다." }) as const;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [lens, setLens] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [grid, setGrid] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .map((t) => ({
        ...t,
        grains: t.grains.filter(
          (g) =>
            (kind === "all" || g.kind === kind) &&
            (!q || g.body.toLowerCase().includes(q) || (g.source ?? "").toLowerCase().includes(q)),
        ),
      }))
      .filter((t) => t.grains.length > 0);
  }, [threads, query, kind]);

  // 덩어리를 나누고 잇는 자리는 검색·종류 필터와 상관없이 전체 데이터로 정한다.
  // 덩어리의 첫 조각 위에서는 나눌 수 없고, 맨 위·맨 아래 덩어리는 한쪽으로 이을 이웃이 없다.
  const { neighbors, firstGrainIds } = useMemo(() => {
    const firsts = new Set<string>();
    const near = new Map<string, { up: string | null; down: string | null }>();
    threads.forEach((t, i) => {
      if (t.grains.length > 0) firsts.add(t.grains[0].id);
      near.set(t.id, { up: threads[i - 1]?.id ?? null, down: threads[i + 1]?.id ?? null });
    });
    return { neighbors: near, firstGrainIds: firsts };
  }, [threads]);

  const total = visible.reduce((n, t) => n + t.grains.length, 0);

  // 키워드별로 몇 건의 조각에, 며칠에 걸쳐 나왔는지. 며칠에 걸쳤는지가 "연결"의 크기다.
  const keywordStats = useMemo(() => {
    const stats = new Map<string, { grains: number; days: Set<string> }>();
    for (const t of visible) {
      for (const g of t.grains) {
        for (const k of new Set(g.keywords)) {
          const s = stats.get(k) ?? { grains: 0, days: new Set<string>() };
          s.grains += 1;
          s.days.add(DAY.format(new Date(g.createdAt)));
          stats.set(k, s);
        }
      }
    }
    return [...stats.entries()]
      .map(([keyword, s]) => ({ keyword, grains: s.grains, days: s.days.size }))
      .sort((a, b) => b.days - a.days || b.grains - a.grains || a.keyword.localeCompare(b.keyword));
  }, [visible]);

  const hasKeywords = keywordStats.length > 0;
  const activeStat = keywordStats.find((s) => s.keyword === active) ?? null;

  function toggleLens() {
    // 렌즈를 끄면 고른 키워드도 함께 푼다 — 렌즈 없이 고른 키워드만 남아 있으면 무엇이 눌려 있는지 알 수 없다.
    if (lens) setActive(null);
    setLens(!lens);
  }

  function pickKeyword(keyword: string) {
    if (active === keyword) {
      setActive(null);
    } else {
      setActive(keyword);
      setLens(true);
    }
  }

  // 격자의 점을 눌렀을 때: 그 키워드를 고르고 그 날 그 키워드가 나온 조각으로 내려간다.
  // 이미 고른 키워드라면 풀지 않고 이동만 한다 — 같은 행의 다른 날 점을 잇달아 누르며 훑어볼 수 있게.
  function jumpTo(keyword: string, grain: Grain) {
    setActive(keyword);
    setLens(true);
    // 렌즈가 그려진 뒤에 스크롤해야 위치가 맞는다.
    requestAnimationFrame(() => {
      document
        .getElementById(`grain-${grain.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="조각 안에서 찾기"
          className="w-64 rounded-sm border border-line bg-surface px-2 py-1 font-mono text-xs text-ink placeholder:text-grey focus:outline-none"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setKind(f.value)}
              className={`rounded-sm px-2 py-1 font-mono text-xs font-bold transition-colors ${
                kind === f.value ? "bg-ink text-background" : "bg-surface text-grey hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {hasKeywords && (
          <div className="flex items-center gap-4 font-mono text-xs">
            <Switch label="키워드만 진하게" on={lens} onToggle={toggleLens} />
            <Switch label="날짜×키워드 격자" on={grid} onToggle={() => setGrid(!grid)} />
          </div>
        )}
        <span className="font-mono text-xs text-grey">
          조각 {total}건 · 덩어리 {visible.length}개
        </span>
      </div>

      {hasKeywords && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] text-grey">키워드</span>
            {keywordStats.map((s) => (
              <button
                key={s.keyword}
                type="button"
                onClick={() => pickKeyword(s.keyword)}
                aria-pressed={active === s.keyword}
                className={`rounded-sm px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                  active === s.keyword
                    ? "bg-ink text-background"
                    : "bg-surface text-ink hover:bg-line"
                }`}
              >
                {s.keyword}
                <span className={active === s.keyword ? "ml-1 opacity-70" : "ml-1 text-grey"}>
                  {s.days}일
                </span>
              </button>
            ))}
          </div>
          {activeStat && (
            <p className="mt-2 font-mono text-[11px] text-grey">
              ‘{activeStat.keyword}’ — {activeStat.days}일에 걸쳐 조각 {activeStat.grains}건에 나옵니다.
              다시 누르면 풉니다.
            </p>
          )}
        </div>
      )}

      {hasKeywords && grid && <KeywordGrid threads={visible} active={active} onPick={jumpTo} />}

      {visible.length === 0 ? (
        <p className="py-10 font-mono text-xs text-grey">
          {threads.length === 0
            ? "아직 쌓인 조각이 없습니다. 텔레그램 봇에 메모를 보내 보세요."
            : "조건에 맞는 조각이 없습니다."}
        </p>
      ) : (
        <ol className="space-y-4">
          {visible.map((t) => {
            const first = t.grains[0];
            const near = neighbors.get(t.id);
            return (
              <li key={t.id} className="rounded-sm border border-line">
                <div className="flex items-start justify-between gap-3 border-b border-line bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-ink">
                      {DAY.format(new Date(first.createdAt))} {TIME.format(new Date(first.createdAt))}
                      {t.title ? ` · ${t.title}` : ""}
                    </div>
                    {t.summary && <p className="mt-1 text-[13px] text-grey">{t.summary}</p>}
                  </div>
                  {showThreadButtons && !t.id.startsWith("solo-") && (
                    <div className="flex shrink-0 gap-1">
                      {near?.up && (
                        <CircleButton
                          glyph="↑"
                          title="위 덩어리와 연결하기"
                          action={demo ? DEMO_REFUSE : () => mergeThreads(near.up!, t.id)}
                        />
                      )}
                      {near?.down && (
                        <CircleButton
                          glyph="↓"
                          title="아래 덩어리와 연결하기"
                          action={demo ? DEMO_REFUSE : () => mergeThreads(t.id, near.down!)}
                        />
                      )}
                    </div>
                  )}
                </div>
                <ul className="divide-y divide-line">
                  {t.grains.map((g) => (
                    <li key={g.id} id={`grain-${g.id}`} className="flex gap-3 px-3 py-2">
                      <span className="w-12 shrink-0 font-mono text-xs text-grey">
                        {TIME.format(new Date(g.createdAt))}
                      </span>
                      <div className="min-w-0 flex-1">
                        {g.photoUrl && (
                          // 서명 주소는 요청마다 달라지고 도메인도 바뀌어 next/image의 최적화 대상이 아니다.
                          // 작게 보여 주고, 누르면 새 창에서 저장된 사본 그대로 크게 연다.
                          <figure className="mb-2 w-fit max-w-full">
                            <a
                              href={g.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-fit"
                              aria-label="사진 크게 보기"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={g.photoUrl}
                                alt={g.caption ?? "텔레그램으로 보낸 사진"}
                                loading="lazy"
                                className="h-24 w-auto rounded-sm border border-line"
                              />
                            </a>
                            {g.caption && (
                              <figcaption className="mt-1 max-w-[18rem] text-[11px] leading-snug text-grey">
                                {g.caption}
                              </figcaption>
                            )}
                          </figure>
                        )}
                        {editingId === g.id ? (
                          <GrainEditor grain={g} onDone={() => setEditingId(null)} />
                        ) : (
                          <>
                            <GrainBody grain={g} lens={lens} active={active} />
                            {(g.kind !== "text" || g.source || g.editedAt || editable) && (
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-grey">
                                <span>
                                  {[
                                    g.kind !== "text" ? KIND_LABEL[g.kind] : null,
                                    g.source ? `출처 ${g.source}` : null,
                                    g.editedAt ? "수정됨" : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                                {editable && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(g.id)}
                                    className="underline underline-offset-2 hover:text-ink"
                                  >
                                    수정
                                  </button>
                                )}
                                {editable && (
                                  <ConfirmDeleteButton
                                    label="삭제"
                                    confirmMessage={
                                      g.kind === "photo"
                                        ? "이 조각을 지울까요? 글과 사진, 달아 둔 각주가 모두 사라지고 되돌릴 수 없어요."
                                        : "이 조각을 지울까요? 글과 달아 둔 각주가 모두 사라지고 되돌릴 수 없어요."
                                    }
                                    className="underline underline-offset-2 hover:text-ink"
                                    onDelete={async () => {
                                      const result = await deleteGrain(g.id);
                                      if (!result.ok) window.alert(result.error);
                                    }}
                                  />
                                )}
                              </p>
                            )}
                          </>
                        )}
                        <GrainNotes grain={g} editable={editable} />
                      </div>
                      {showThreadButtons && !firstGrainIds.has(g.id) && !t.id.startsWith("solo-") && (
                        <CircleButton
                          glyph="✂"
                          title="이 조각 위에서 덩어리 나누기"
                          action={demo ? DEMO_REFUSE : () => splitThread(g.id)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
