"use client";

import { useEffect, useState } from "react";
import { FoundEventRow, adoptEventById, searchEvents } from "@/lib/event-actions";

// 연표 도구 줄의 검색어에 걸렸지만 연표에는 안 떠 있는 사건. 표 바로 위에 띠로 붙는다.
//
// 한동안 이 일을 화면 맨 아래 따로 접힌 칸에서 했다 — 검색칸이 위아래로 둘이 되는 셈이라,
// 무엇을 어디서 찾아야 하는지가 매번 헷갈렸다. 검색은 맨 위 한 곳에서 하고, 걸린 것 중
// 연표에 없는 것만 여기로 흘러나오게 한다.
//
// 검색어를 칠 때마다 서버에 묻지 않는다(연표 표는 이미 손안에서 걸러진다). 손을 멈추면
// 그때 한 번 묻는다.
const DEBOUNCE_MS = 350;
const SHOWN_MAX = 12;

// 답에 검색어를 함께 담아 둔다. 검색어가 바뀌면 이 답은 그냥 안 쓰게 되므로, 바뀔 때마다
// 상태를 비우러 갈 필요가 없다 — 늦게 온 답이 새 검색어의 자리에 끼어드는 일도 막힌다.
interface Answer {
  query: string;
  rows: FoundEventRow[];
  error: string | null;
}

export function OffTimelineFinder({ query }: { query: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [adoptedIds, setAdoptedIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const q = query.trim();

  useEffect(() => {
    if (!q) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const found = await searchEvents(q);
        if (live) setAnswer({ query: q, rows: found.filter((r) => !r.onTimeline), error: null });
      } catch (err) {
        if (live) {
          setAnswer({ query: q, rows: [], error: err instanceof Error ? err.message : String(err) });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  const current = answer && answer.query === q ? answer : null;
  const error = current?.error ?? null;
  const remaining = (current?.rows ?? []).filter((r) => !adoptedIds.includes(r.id));
  if (!q || (remaining.length === 0 && !error)) return null;

  return (
    <div className="border-b border-line bg-surface px-3 py-2">
      <p className="font-mono text-[11px] text-grey">
        연표에 없는 사건 {remaining.length}건 — 국사편찬위원회 오늘의역사에서 들여왔거나 숨긴
        것입니다. <span className="text-ink">+</span> 를 누르면 연표에 오릅니다.
      </p>

      {error && <p className="mt-1 text-[12px] text-orange-fill">오류: {error}</p>}

      <ul className="mt-1.5 flex flex-col gap-1">
        {remaining.slice(0, SHOWN_MAX).map((event) => (
          <li key={event.id} className="flex items-baseline gap-2 border-t border-line py-1">
            <button
              type="button"
              onClick={async () => {
                setPendingId(event.id);
                try {
                  await adoptEventById(event.id);
                  setAdoptedIds((prev) => [...prev, event.id]);
                } catch (err) {
                  setAnswer((prev) =>
                    prev
                      ? { ...prev, error: err instanceof Error ? err.message : String(err) }
                      : prev,
                  );
                } finally {
                  setPendingId(null);
                }
              }}
              disabled={pendingId === event.id}
              aria-label={`“${event.eventName}”을 연표에 등록`}
              title="연표에 등록"
              className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center border border-line bg-background font-mono text-[12px] leading-none text-ink hover:border-ink hover:bg-ink hover:text-background disabled:opacity-50"
            >
              {pendingId === event.id ? "…" : "+"}
            </button>
            <span className="font-mono text-[11px] tabular-nums text-grey">
              {event.dateValue || "—"}
            </span>
            <span className="text-[13px] leading-snug text-ink">
              {event.eventName}
              {event.hidden && (
                <span className="ml-1.5 font-mono text-[10px] text-grey">숨김</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {remaining.length > SHOWN_MAX && (
        <p className="mt-1 font-mono text-[11px] text-grey">
          외 {remaining.length - SHOWN_MAX}건 — 더 좁혀서 찾아보세요.
        </p>
      )}
    </div>
  );
}
