"use client";

import { useMemo, useState } from "react";
import { linkTargetToEvent, unlinkTargetFromEvent } from "@/lib/link-actions";
import { SegmentLinkRow } from "@/lib/db";
import { formatEdtfToKorean } from "@/lib/edtf";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";

// 관리 "구술 연결". 구술을 넣는 일은 구술 목록에서 하고, 여기서는 넣어 둔 구술을 사건에
// 붙이는 일만 한다 — 관리 화면이 하는 일은 자료를 모으는 게 아니라 그물망을 짜는 것이다.
//
// 사료 연결의 보류함과 조작은 같다 — 구술 하나하나가 제 "+ 사건 붙이기"를 가지고, 붙인
// 사건은 그 줄 안에 배지로 선다. 어느 사건에 매여 있는지 모르면 같은 구술을 두 번 붙이거나,
// 엉뚱한 사건에 붙은 것을 영영 못 찾는다.
//
// 숨긴 사건에 붙어 있는 구술도 그렇게 보여준다(배지에 "숨김"). 예전에는 연결선을 사건
// 목록에서 거꾸로 훑느라 숨긴 사건이 통째로 빠졌고, 그래서 멀쩡히 붙어 있는 구술이
// "안 붙은 구술"로 세어졌다.

type Filter = "all" | "unlinked";

export function OralLinkBoard({
  rows,
  events,
}: {
  rows: SegmentLinkRow[];
  events: EventOption[];
}) {
  const [filter, setFilter] = useState<Filter>("unlinked");

  const unlinkedCount = rows.filter((r) => r.linkedEvents.length === 0).length;

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.linkedEvents.length === 0)),
    [rows, filter],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">구술 연결</h2>
          <div className="flex gap-1 font-mono text-[11px]">
            {(
              [
                { value: "unlinked", label: `안 붙은 구술 ${unlinkedCount}` },
                { value: "all", label: `전체 ${rows.length}` },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`px-2 py-1 ${
                  filter === option.value
                    ? "bg-ink text-background"
                    : "text-grey hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm font-medium text-grey">
          구술마다 “+ 사건 붙이기”로 각자의 사건에 붙이세요. 구술을 새로 넣는 것은{" "}
          <a
            href="/segments"
            className="font-semibold text-ink underline decoration-dotted underline-offset-4"
          >
            구술 목록
          </a>
          에서 합니다.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-grey">
          {filter === "unlinked" ? "사건에 안 붙은 구술이 없습니다." : "구술이 없습니다."}
        </p>
      ) : (
        <ul>
          {visible.map((row) => (
            <SegmentLinkCard key={row.id} row={row} events={events} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SegmentLinkCard({
  row,
  events,
}: {
  row: SegmentLinkRow;
  events: EventOption[];
}) {
  return (
    <li className="border-t border-line py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] tabular-nums text-grey">
          {row.dateValue ? formatEdtfToKorean(row.dateValue) : "연도 미상"}
        </span>
        {row.speakers.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-ink">
            {row.speakers.join(" · ")}
          </span>
        )}
      </div>

      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-grey">{row.preview}</p>

      {/* 이미 붙어 있는 사건은 배지로 먼저 서고(붙일지 말지의 판단이 여기서 갈린다),
          붙이고 끊는 일도 그 자리에서 한다 */}
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
        <EventAttach
          events={events}
          linked={row.linkedEvents}
          onPick={(event) => linkTargetToEvent(event.id, "segment", row.id, null)}
          onUnlink={(eventId) => unlinkTargetFromEvent(eventId, "segment", row.id)}
          emptyHint={<>연표에 사건이 없습니다.</>}
        />
        <a
          href={`/segments?focus=${row.id}`}
          className="pb-1 font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          본문 보기 ↗
        </a>
      </div>
    </li>
  );
}
