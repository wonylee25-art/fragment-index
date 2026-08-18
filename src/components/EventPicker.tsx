"use client";

import { useMemo, useState } from "react";

// 연결 대상 사건을 고르는 목록. 드롭다운을 쓰지 않는다 — 자료마다 목록을 다시 띄우는 게
// 불편하다는 판단에 따라, 목록은 화면에 계속 펼쳐두고 스크롤을 따라오게 한다.
// 사료 검색(사료 연결 위쪽)은 검색어로 걸린 사건만 후보라 목록이 짧지만,
// 보류함은 사건 전체가 후보라 길어서 좁히기 칸을 함께 쓴다.

export interface EventOption {
  id: string;
  year: string;
  eventName: string;
  // 숨긴 사건도 붙일 수 있다 — 숨기기는 연표에서만 안 보이게 하는 일이다. 다만 목록에서는
  // "숨김"이라고 적어, 붙여도 연표에 안 나타난다는 것을 누르기 전에 알린다.
  hidden?: boolean;
}

export function EventPicker({
  events,
  selectedId,
  onSelect,
  filterable = false,
  emptyHint,
}: {
  events: EventOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filterable?: boolean;
  emptyHint?: React.ReactNode;
}) {
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.trim();
    if (!q) return events;
    return events.filter((e) => e.eventName.includes(q) || e.year.includes(q));
  }, [events, filter]);

  return (
    <div className="md:sticky md:top-4">
      <p className="mb-2 font-mono text-[11px] font-semibold text-grey">
        연결 대상 사건 · {filter.trim() ? `${visible.length} / ${events.length}` : events.length}
      </p>

      {filterable && events.length > 0 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="사건 좁히기"
          className="mb-1.5 w-full border border-line bg-background px-2 py-1 text-[12px] text-ink placeholder:text-grey focus:border-ink focus:outline-none"
        />
      )}

      {events.length === 0 ? (
        <div className="border border-dashed border-line px-3 py-6 text-center">{emptyHint}</div>
      ) : visible.length === 0 ? (
        <p className="border border-dashed border-line px-3 py-6 text-center text-[12px] text-grey">
          좁히기에 걸린 사건이 없습니다.
        </p>
      ) : (
        <ul className="max-h-[70vh] overflow-y-auto border border-line">
          {visible.map((event) => {
            const active = event.id === selectedId;
            return (
              <li key={event.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(event.id)}
                  className={`flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-ink text-background" : "hover:bg-surface"
                  }`}
                >
                  <span className="mt-[3px] font-mono text-[10px] leading-none">
                    {active ? "●" : "○"}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block font-mono text-[10px] tabular-nums ${
                        active ? "text-background" : "text-grey"
                      }`}
                    >
                      {event.year}
                    </span>
                    <span className="block text-[12px] font-semibold leading-snug">
                      {event.eventName}
                      {event.hidden && (
                        <span
                          className={`ml-1.5 font-mono text-[10px] font-normal ${
                            active ? "text-background" : "text-grey"
                          }`}
                        >
                          숨김
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
