"use client";

import { useState } from "react";
import { WarehouseEventRow, adoptEventById, searchWarehouseEvents } from "@/lib/event-actions";

// 연표 관리 아래 "창고" 칸 — 지금 연표에 안 떠 있는 사건 전부가 여기 있다. 두 갈래가 섞여
// 있는데, 국사편찬위원회 오늘의역사에서 들여왔지만 아직 안 꺼낸 것과, 꺼냈다가 숨긴 것이다.
// 숨긴 것은 "숨김"으로 적어 구분하지만 다루는 법은 같다 — 숨기기는 연표에서만 안 보이게
// 하는 일이지, 사건을 못 쓰게 만드는 일이 아니기 때문이다.
//
// 목록을 펼쳐두지 않고 검색으로만 연다. 6천 건은 훑어서 고를 수 있는 양이 아니고, 화면을 열
// 때마다 실어 나를 양도 아니다 — 누른 뒤에 서버가 찾아서 걸린 것만 보낸다.
//
// 아래 "숨긴 사건" 칸(HiddenEventsPanel)과 겹치는 사건이 있다. 그쪽은 숨긴 것을 전부 늘어놓고
// 되돌리는 자리이고, 여기는 연표에 없는 것을 찾아 꺼내는 자리다.
export function WarehousePanel({ total }: { total: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<WarehouseEventRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adoptedIds, setAdoptedIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (total === 0) return null;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setRows(await searchWarehouseEvents(query));
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
          {open ? "▾" : "▸"} 창고 — 연표에 안 떠 있는 사건 {total.toLocaleString()}건
        </button>

        {open && (
          <div className="mt-2">
            <p className="mb-2 text-[12px] leading-relaxed text-grey">
              지금 연표에 안 떠 있는 사건입니다 — 국사편찬위원회 오늘의역사(1900년 이후)에서
              들여왔지만 아직 안 꺼낸 것과, 꺼냈다가 숨긴 것(“숨김”)이 함께 있습니다. 둘 다
              사료·구술에는 붙일 수 있고, “연표에 등록”을 누르면 연표에 올라옵니다. 글자가
              그대로 든 것만 걸리니 (‘라디오’로는 ‘수신기’가 안 나옵니다) 낱말을 바꿔가며
              찾아보세요.
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
                  ? "걸린 사건이 없습니다."
                  : rows.length === 100
                    ? "100건까지만 보여줍니다 — 더 좁혀서 찾아보세요."
                    : `${rows.length}건`}
              </p>
            )}

            {rows !== null && rows.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1">
                {rows.map((event) => {
                  const done = adoptedIds.includes(event.id);
                  return (
                    <li
                      key={event.id}
                      className="flex items-baseline justify-between gap-3 border-t border-line py-1.5"
                    >
                      <span className="text-[13px] text-ink">
                        <span className="mr-2 font-mono text-[11px] tabular-nums text-grey">
                          {event.dateValue || "—"}
                        </span>
                        {event.eventName}
                        {event.hidden && (
                          <span className="ml-1.5 font-mono text-[10px] text-grey">숨김</span>
                        )}
                      </span>
                      {done ? (
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
