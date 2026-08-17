"use client";

import { useMemo, useState } from "react";
import { EventOption } from "./EventPicker";
import { LinkedEventRef } from "@/lib/types";

// 항목 하나에 사건을 붙이는 손잡이. 예전에는 화면 왼쪽에 사건 목록을 하나 펼쳐두고 거기서
// 고른 사건이 그 화면의 모든 항목에 똑같이 적용됐다 — 사료 열 건을 각각 다른 사건에 붙이려면
// 왼쪽을 열 번 다시 고르며 오르내려야 했고, 지금 무엇에 무엇을 붙이는 중인지도 흐려졌다.
//
// 이제 붙이는 일은 항목 안에서 끝난다. "사건 붙이기"를 누르면 그 자리에 좁히기 칸과 사건
// 목록이 펼쳐지고, 고른 사건은 그 항목에만 붙는다. 이미 붙어 있는 사건은 위에 배지로 서고
// 거기서 끊는다 — 붙이는 자리와 끊는 자리가 같아야 지금 상태를 한눈에 본다.
export function EventAttach({
  events,
  linked = [],
  onPick,
  onUnlink,
  emptyHint,
}: {
  events: EventOption[];
  linked?: LinkedEventRef[];
  onPick: (event: EventOption) => Promise<void>;
  onUnlink?: (eventId: string) => Promise<void>;
  emptyHint?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 방금 붙인 것은 서버가 다시 그려주기 전에도 그 자리에 보여야 한다 — 눌렀는데 아무 일도
  // 일어나지 않은 것처럼 보이면 한 번 더 누르게 되고, 그러면 같은 연결을 두 번 만든다.
  const [justLinked, setJustLinked] = useState<EventOption[]>([]);

  const visible = useMemo(() => {
    const q = filter.trim();
    if (!q) return events;
    return events.filter((e) => e.eventName.includes(q) || e.year.includes(q));
  }, [events, filter]);

  async function handlePick(event: EventOption) {
    setPending(true);
    setError(null);
    try {
      await onPick(event);
      setJustLinked((prev) => [...prev, event]);
      setOpen(false);
      setFilter("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  async function handleUnlink(eventId: string) {
    if (!onUnlink) return;
    setPending(true);
    setError(null);
    try {
      await onUnlink(eventId);
      setJustLinked((prev) => prev.filter((e) => e.id !== eventId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  // 서버가 다시 그려주면 linked에 들어오므로, 그때는 방금 붙인 목록에서 뺀다(두 번 서지 않게).
  const linkedIds = new Set(linked.map((l) => l.id));
  const pendingBadges = justLinked.filter((e) => !linkedIds.has(e.id));

  return (
    <div className="flex flex-col gap-1.5">
      {(linked.length > 0 || pendingBadges.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {linked.map((event) => (
            <span
              key={event.id}
              className="flex items-center gap-1 bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink"
            >
              {event.eventName}
              {/* 숨긴 사건에 붙어 있는 것도 숨기지 않고 그대로 알린다 — 붙어 있다는 사실과
                  그 사건이 지금 연표에 안 뜬다는 사실은 다른 얘기다.
                  다만 그 연결은 여기서 끊지 않는다: 붙일 수 있는 사건 목록에는 숨긴 사건이
                  없으므로, 한 번 끊으면 이 화면에서는 다시 붙일 길이 없다. 되돌릴 수 없는
                  버튼을 되돌릴 수 있는 것처럼 두지 않는다 — 끊으려면 사건을 먼저 되살린다. */}
              {event.hidden && (
                <span
                  title="숨긴 사건입니다. 연표 관리에서 되살린 뒤에 끊을 수 있습니다."
                  className="cursor-help font-normal text-grey"
                >
                  숨김
                </span>
              )}
              {onUnlink && !event.hidden && (
                <button
                  type="button"
                  onClick={() => handleUnlink(event.id)}
                  disabled={pending}
                  title={`${event.eventName}에서 끊기`}
                  aria-label={`${event.eventName}에서 끊기`}
                  className="text-grey hover:text-orange-fill disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {pendingBadges.map((event) => (
            <span
              key={event.id}
              className="bg-green-tint px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink"
            >
              ✓ {event.eventName}
            </span>
          ))}
        </div>
      )}

      {open ? (
        <div className="w-full max-w-[320px] border border-line bg-background p-1.5">
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="사건 좁히기"
              className="w-full border border-line bg-background px-2 py-1 text-[12px] text-ink placeholder:text-grey focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 px-1 font-mono text-[11px] text-grey hover:text-ink"
            >
              닫기
            </button>
          </div>

          {events.length === 0 ? (
            <div className="px-2 py-4 text-center text-[12px] text-grey">{emptyHint}</div>
          ) : visible.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-grey">
              좁히기에 걸린 사건이 없습니다.
            </p>
          ) : (
            <ul className="mt-1.5 max-h-56 overflow-y-auto border-t border-line">
              {visible.map((event) => (
                <li key={event.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handlePick(event)}
                    disabled={pending}
                    className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left hover:bg-surface disabled:opacity-50"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-grey">{event.year}</span>
                    <span className="text-[12px] font-semibold leading-snug text-ink">
                      {event.eventName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={pending}
            className="border border-ink bg-ink px-2.5 py-1 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-ink disabled:border-line disabled:bg-surface disabled:text-grey"
          >
            {pending ? "붙이는 중…" : "+ 사건 붙이기"}
          </button>
          {error && <span className="font-mono text-[11px] text-orange-fill">{error}</span>}
        </div>
      )}
    </div>
  );
}
