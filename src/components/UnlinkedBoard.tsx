"use client";

import { useState, useTransition } from "react";
import { EventOption, EventPicker } from "./EventPicker";
import { LinkTargetType, linkTargetToEvent } from "@/lib/link-actions";

// 보류함. 저장은 됐지만 아직 어느 사건에도 붙지 않은 자료·구술이 쌓이는 곳.
// 사료 검색과 같은 조작을 쓴다 — 왼쪽에서 사건을 한 번 고르고, 각 항목의 버튼 한 번으로 연결.
// 다른 점은 검색어가 없어 사건 전체가 후보라는 것뿐이라, 목록에 좁히기 칸을 붙였다.

export interface UnlinkedEntry {
  id: string;
  targetType: LinkTargetType;
  title: string;
  metaLine: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
}

function EntryCard({
  entry,
  selected,
}: {
  entry: UnlinkedEntry;
  selected: EventOption | null;
}) {
  const [pending, startTransition] = useTransition();
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleLink() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await linkTargetToEvent(selected.id, entry.targetType, entry.id, "keyword");
        setLinked(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <li className="border-t border-line py-4">
      <div className="flex gap-4">
        {entry.imageUrl ? (
          // 외부 아카이브 이미지를 그대로 건다(재호스팅하지 않음) — next/image 설정 없이 쓰려고 <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt={entry.title}
            loading="lazy"
            className="h-[118px] w-24 shrink-0 border border-line bg-surface object-cover"
          />
        ) : (
          <div className="flex h-[118px] w-24 shrink-0 items-center justify-center border border-dashed border-line bg-surface text-center font-mono text-[10px] leading-relaxed text-grey">
            이미지
            <br />
            없음
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug text-ink">{entry.title}</p>
          <p className="mt-1 font-mono text-[11px] text-grey">{entry.metaLine}</p>

          {entry.description && (
            <p className="mt-2 border-l-2 border-line pl-2.5 text-[12px] leading-relaxed text-grey">
              {entry.description}
            </p>
          )}

          {error && <p className="mt-2 font-mono text-[11px] text-orange-fill">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {linked ? (
              <span className="font-mono text-[11px] font-semibold text-ink">
                ✓ {selected?.eventName}에 연결됨
              </span>
            ) : (
              <button
                type="button"
                onClick={handleLink}
                disabled={!selected || pending}
                className="border border-ink bg-ink px-2.5 py-1 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-ink disabled:border-line disabled:bg-surface disabled:text-grey"
              >
                {pending
                  ? "연결 중…"
                  : selected
                    ? `${selected.year} ${selected.eventName}에 연결`
                    : "왼쪽에서 사건을 고르세요"}
              </button>
            )}
            {entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                원문 ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function UnlinkedBoard({
  events,
  materials,
  segments,
}: {
  events: EventOption[];
  materials: UnlinkedEntry[];
  segments: UnlinkedEntry[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const total = materials.length + segments.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">보류함</h2>
        <p className="text-sm font-medium text-grey">
          어느 사건에도 붙지 않은 자료 {materials.length}건, 구술 {segments.length}건. 왼쪽에서
          사건을 고른 뒤 각 항목을 연결하세요.
        </p>
      </div>

      {total === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-grey">
          보류 중인 자료가 없습니다.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
          <EventPicker
            events={events}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filterable
            emptyHint={
              <>
                <p className="text-[12px] leading-relaxed text-grey">
                  연표에 사건이 없습니다.
                </p>
                <a
                  href="/admin/timeline"
                  className="mt-2 inline-block font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4"
                >
                  연표 관리에서 사건 만들기 →
                </a>
              </>
            }
          />

          <div className="flex flex-col gap-7">
            {materials.length > 0 && (
              <section>
                <p className="font-mono text-[11px] font-semibold text-grey">
                  사료 — {materials.length}건
                </p>
                <ul>
                  {materials.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} selected={selected} />
                  ))}
                </ul>
              </section>
            )}

            {segments.length > 0 && (
              <section>
                <p className="font-mono text-[11px] font-semibold text-grey">
                  구술 — {segments.length}건
                </p>
                <ul>
                  {segments.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} selected={selected} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
