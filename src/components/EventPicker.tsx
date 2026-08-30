"use client";

import { useState } from "react";
import { EventOption } from "@/lib/event-candidates";
import { useEventCandidates } from "./useEventCandidates";

// 연결 대상 사건을 고르는 목록. 드롭다운을 쓰지 않는다 — 자료마다 목록을 다시 띄우는 게
// 불편하다는 판단에 따라, 목록은 화면에 계속 펼쳐두고 스크롤을 따라오게 한다.
//
// 예전에는 사건 전체를 받아 들고 좁히기도 여기서 했다. 6천 건을 실어 보내는 값이 화면을
// 여는 시간이 되어서, 이제 좁히는 일은 서버에 맡기고 여기서는 받은 것만 그린다.

export type { EventOption };

export function EventPicker({
  selectedId,
  selected,
  onSelect,
  filterable = false,
  emptyHint,
  boostQuery,
}: {
  selectedId: string | null;
  // 고른 사건은 좁히기를 바꿔 목록에서 사라져도 이름이 남아야 한다 — 고른 쪽이 들고 있는다.
  selected?: EventOption | null;
  onSelect: (event: EventOption) => void;
  filterable?: boolean;
  emptyHint?: React.ReactNode;
  boostQuery?: string;
}) {
  const [filter, setFilter] = useState("");
  const { options, matched, total, ready, error } = useEventCandidates({
    query: filter,
    boostQuery,
  });

  // 고른 것이 이번 목록에 없으면 위에 한 줄로 얹어 준다.
  const pinned = selected && !options.some((e) => e.id === selected.id) ? selected : null;
  const shown = pinned ? [pinned, ...options] : options;

  return (
    <div className="md:sticky md:top-4">
      <p className="mb-2 font-mono text-[11px] font-semibold text-grey">
        연결 대상 사건 · {filter.trim() ? `${matched} / ${total}` : total}
      </p>

      {filterable && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="사건 좁히기"
          className="mb-1.5 w-full border border-line bg-background px-2 py-1 text-[12px] text-ink placeholder:text-grey focus:border-ink focus:outline-none"
        />
      )}

      {error ? (
        <p className="border border-dashed border-line px-3 py-6 text-center font-mono text-[11px] text-orange-fill">
          {error}
        </p>
      ) : !ready ? (
        <p className="border border-dashed border-line px-3 py-6 text-center text-[12px] text-grey">
          사건을 불러오는 중…
        </p>
      ) : total === 0 ? (
        <div className="border border-dashed border-line px-3 py-6 text-center">{emptyHint}</div>
      ) : shown.length === 0 ? (
        <p className="border border-dashed border-line px-3 py-6 text-center text-[12px] text-grey">
          좁히기에 걸린 사건이 없습니다.
        </p>
      ) : (
        <>
          <ul className="max-h-[70vh] overflow-y-auto border border-line">
            {shown.map((event) => {
              const active = event.id === selectedId;
              return (
                <li key={event.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
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

          {/* 실어 보낸 것보다 걸린 것이 많으면 그렇다고 적는다 — 목록 끝이 곧 후보의 끝인
              줄 알면, 없는 사건을 찾았다고 여기고 새로 만들게 된다. */}
          {matched > options.length && (
            <p className="mt-1 px-0.5 font-mono text-[10px] text-grey">
              {matched}건 중 {options.length}건 — 좁히기 칸으로 줄이세요
            </p>
          )}
        </>
      )}
    </div>
  );
}
