"use client";

import { useMemo, useState } from "react";
import { linkTargetToEvent } from "@/lib/link-actions";
import { SegmentLinkRow } from "@/lib/db";
import { formatEdtfToKorean } from "@/lib/edtf";
import { EventOption, EventPicker } from "./EventPicker";

// 관리 "구술 연결". 구술을 넣는 일은 구술 목록에서 하고, 여기서는 넣어 둔 구술을 사건에
// 붙이는 일만 한다 — 관리 화면이 하는 일은 자료를 모으는 게 아니라 그물망을 짜는 것이다.
//
// 사료 연결의 보류함과 조작은 같다(왼쪽에서 사건을 한 번 고르고, 각 항목의 버튼 한 번으로 연결).
// 다른 점은 이미 붙은 구술도 함께 보여준다는 것이다 — 어느 사건에 매여 있는지 모르면
// 같은 구술을 두 번 붙이거나, 엉뚱한 사건에 붙은 것을 영영 못 찾는다.

type Filter = "all" | "unlinked";

export function OralLinkBoard({
  rows,
  events,
}: {
  rows: SegmentLinkRow[];
  events: EventOption[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("unlinked");
  const [justLinked, setJustLinked] = useState<Record<string, string>>({});

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const unlinkedCount = rows.filter((r) => r.linkedEvents.length === 0 && !justLinked[r.id]).length;

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.linkedEvents.length === 0)),
    [rows, filter],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">구술 연결</h2>
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
                    ? "bg-foreground text-background"
                    : "text-muted-2 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm font-medium text-muted">
          왼쪽에서 사건을 고른 뒤 구술을 붙이세요. 구술을 새로 넣는 것은{" "}
          <a
            href="/segments"
            className="font-semibold text-foreground underline decoration-dotted underline-offset-4"
          >
            구술 목록
          </a>
          에서 합니다.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-muted-2">
          {filter === "unlinked" ? "사건에 안 붙은 구술이 없습니다." : "구술이 없습니다."}
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
          <EventPicker
            events={events}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filterable
            emptyHint={
              <p className="text-[12px] leading-relaxed text-muted-2">연표에 사건이 없습니다.</p>
            }
          />

          <ul>
            {visible.map((row) => (
              <SegmentLinkCard
                key={row.id}
                row={row}
                selected={selected}
                linkedNow={justLinked[row.id]}
                onLinked={(eventName) => setJustLinked((prev) => ({ ...prev, [row.id]: eventName }))}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SegmentLinkCard({
  row,
  selected,
  linkedNow,
  onLinked,
}: {
  row: SegmentLinkRow;
  selected: EventOption | null;
  linkedNow?: string;
  onLinked: (eventName: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      await linkTargetToEvent(selected.id, "segment", row.id, null);
      onLinked(selected.eventName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="border-t border-line py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] tabular-nums text-muted-2">
          {row.dateValue ? formatEdtfToKorean(row.dateValue) : "연도 미상"}
        </span>
        {row.speakers.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-foreground">
            {row.speakers.join(" · ")}
          </span>
        )}
      </div>

      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{row.preview}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* 이미 붙어 있는 사건은 배지로 먼저 보여준다 — 붙일지 말지의 판단이 여기서 갈린다 */}
        {row.linkedEvents.map((e) => (
          <span
            key={e.id}
            className="bg-flag-marked-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-flag-marked"
          >
            {e.eventName}
          </span>
        ))}
        {linkedNow && (
          <span className="font-mono text-[11px] font-semibold text-flag-marked">
            ✓ {linkedNow}에 연결됨
          </span>
        )}

        {!linkedNow && (
          <button
            type="button"
            onClick={handleLink}
            disabled={!selected || pending}
            className="border border-foreground bg-foreground px-2.5 py-1 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-foreground disabled:border-line disabled:bg-surface disabled:text-muted-2"
          >
            {pending
              ? "연결 중…"
              : selected
                ? `${selected.year} ${selected.eventName}에 연결`
                : "왼쪽에서 사건을 고르세요"}
          </button>
        )}

        <a
          href={`/segments?focus=${row.id}`}
          className="font-mono text-[11px] text-muted-2 underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          본문 보기 ↗
        </a>

        {error && <span className="font-mono text-[11px] text-flag-attention">{error}</span>}
      </div>
    </li>
  );
}
