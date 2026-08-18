"use client";

import { useState } from "react";
import { FoundEventRow, adoptEventById, searchEvents } from "@/lib/event-actions";
import { EventCounts } from "@/lib/db";

// 연표 관리 아래 "사건 찾기" 칸. 사건 전체에서 찾아, 연표에 없는 것은 그 자리에서 올린다.
//
// 한동안 연표에 없는 것만 찾았다. 그러면 찾는 사건이 안 나올 때 파일에 없어서인지 이미
// 꺼내서인지를 가릴 수 없다 — 둘 다 "걸린 사건이 없습니다"로 똑같이 보인다. 지금은 연표에
// 오른 것까지 함께 찾고, 그 줄에는 등록 버튼 대신 "이미 연표에 있음"이라고 적는다.
//
// 위쪽 연표 검색과 하는 일이 다르다: 그것은 연표에 오른 사건을 훑는 도구이고, 이것은
// 연표 바깥까지 뒤져 사건을 꺼내오는 도구다.
//
// 목록을 펼쳐두지 않고 검색으로만 연다. 6천 건은 훑어서 고를 수 있는 양이 아니고, 화면을 열
// 때마다 실어 나를 양도 아니다 — 누른 뒤에 서버가 찾아서 걸린 것만 보낸다.
export function EventFinderPanel({ counts }: { counts: EventCounts }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<FoundEventRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adoptedIds, setAdoptedIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (counts.total === 0) return null;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setRows(await searchEvents(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="border-t border-line bg-surface">
      <div className="page-shell py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="font-mono text-[11px] font-bold text-grey hover:text-ink"
        >
          {open ? "▾" : "▸"} 사건 찾기 — {counts.total.toLocaleString()}건 (연표에 없는 것{" "}
          {counts.warehouse.toLocaleString()}건 포함)
        </button>

        {open && (
          <div className="mt-2">
            <p className="mb-2 text-[12px] leading-relaxed text-grey">
              연표에 오른 사건과 국사편찬위원회 오늘의역사(1900년 이후)에서 들여와 아직 안 꺼낸
              사건을 함께 찾습니다. 연표에 없는 것은 “연표에 등록”으로 그 자리에서 올릴 수
              있습니다 — 숨긴 사건(“숨김”)도 누르면 숨김이 풀리며 올라옵니다. 글자가 그대로 든
              것만 걸리니 (‘라디오’로는 ‘수신기’가 안 나옵니다) 낱말을 바꿔가며 찾아보세요.
            </p>

            <form onSubmit={runSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="사건명 또는 연도로 검색"
                className="w-full max-w-md border border-line bg-background px-2.5 py-1.5 text-[13px] text-ink placeholder:text-grey focus:border-ink focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="shrink-0 border border-ink bg-ink px-3 py-1.5 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                {searching ? "찾는 중…" : "찾기"}
              </button>
            </form>

            {error && <p className="mt-2 text-[12px] text-orange-fill">오류: {error}</p>}

            {rows !== null && !searching && (
              <p className="mt-2 font-mono text-[11px] text-grey">
                {rows.length === 0
                  ? "걸린 사건이 없습니다 — 연표에도, 창고에도 없습니다."
                  : rows.length === SHOWN_MAX
                    ? `${SHOWN_MAX}건까지만 보여줍니다 — 더 좁혀서 찾아보세요.`
                    : `${rows.length}건 · 연표에 없는 것 ${
                        rows.filter((r) => !r.onTimeline).length
                      }건`}
              </p>
            )}

            {rows !== null && rows.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1">
                {rows.map((event) => {
                  const justAdopted = adoptedIds.includes(event.id);
                  return (
                    <li
                      key={event.id}
                      className="flex items-baseline justify-between gap-3 border-t border-line py-1.5"
                    >
                      <span
                        className={`text-[13px] ${event.onTimeline ? "text-grey" : "text-ink"}`}
                      >
                        <span className="mr-2 font-mono text-[11px] tabular-nums text-grey">
                          {event.dateValue || "—"}
                        </span>
                        {event.eventName}
                        {event.hidden && !justAdopted && (
                          <span className="ml-1.5 font-mono text-[10px] text-grey">숨김</span>
                        )}
                      </span>

                      {/* 이미 연표에 있는 줄에는 버튼을 안 단다 — 누를 일이 없는 버튼이
                          늘어서 있으면 어느 것이 할 일인지 되레 흐려진다. */}
                      {event.onTimeline ? (
                        <span className="shrink-0 font-mono text-[11px] text-grey">
                          이미 연표에 있음
                        </span>
                      ) : justAdopted ? (
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">
                          ✓ 연표에 올림
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            setPendingId(event.id);
                            setError(null);
                            try {
                              await adoptEventById(event.id);
                              setAdoptedIds((prev) => [...prev, event.id]);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setPendingId(null);
                            }
                          }}
                          disabled={pendingId === event.id}
                          className="shrink-0 rounded-sm border border-line bg-background px-2 py-0.5 font-mono text-[11px] text-ink hover:border-ink disabled:opacity-50"
                        >
                          {pendingId === event.id ? "올리는 중…" : "+ 연표에 등록"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 서버가 한 번에 돌려주는 최대 건수(event-actions.ts의 SEARCH_LIMIT와 같아야 한다).
// 결과가 딱 이 수면 잘렸다는 뜻이라, 더 좁히라고 알린다.
const SHOWN_MAX = 100;
