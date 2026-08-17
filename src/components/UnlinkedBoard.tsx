"use client";

import { useState, useTransition } from "react";
import { EventOption, EventPicker } from "./EventPicker";
import { LinkTargetType, linkTargetToEvent } from "@/lib/link-actions";
import { hideMaterials } from "@/lib/material-actions";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

// 보류함. 저장은 됐지만 아직 어느 사건에도 붙지 않은 자료·구술이 쌓이는 곳.
// 사료 검색과 같은 조작을 쓴다 — 왼쪽에서 사건을 한 번 고르고, 각 항목의 버튼 한 번으로 연결.
// 다른 점은 검색어가 없어 사건 전체가 후보라는 것뿐이라, 목록에 좁히기 칸을 붙였다.
//
// 붙이는 것만으로는 보류함이 줄지 않는다 — 검색으로 저장했다가 결국 안 쓰는 자료가 계속
// 남기 때문에, 사료 쪽에는 골라서 한꺼번에 치우는 길을 함께 둔다(연표 일괄 숨김과 같은 조작).
// 치우는 것은 화면에서 내리는 일이지 지우는 일이 아니다 — DB의 행도 연결선도 그대로 두고,
// 아래 "치운 사료" 목록에서 되돌린다. 정말로 지우는 일은 그 목록 안에서만 할 수 있다.
// 구술은 여기서 손대지 않는다. 원본이 있는 곳(구술 목록)에서 지우는 규칙을 흩뜨리지 않는다.

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
  picked,
  onPick,
}: {
  entry: UnlinkedEntry;
  selected: EventOption | null;
  // picked/onPick이 있으면 일괄 삭제 대상으로 고를 수 있는 항목이다(사료만).
  picked?: boolean;
  onPick?: (id: string, next: boolean) => void;
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
        {onPick && (
          <input
            type="checkbox"
            checked={picked ?? false}
            onChange={(e) => onPick(entry.id, e.target.checked)}
            aria-label={`${entry.title} 고르기`}
            className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
          />
        )}
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

  // 치운 사료를 화면에서 빼는 일은 서버가 맡는다(hideMaterials가 이 경로를 revalidate한다).
  // 처음에는 여기서 지운 id를 따로 들고 걸러냈는데, 그러면 "치운 사료"에서 되돌린 것이
  // 목록에 돌아왔는데도 그 기억에 걸려 계속 숨겨졌다 — 한쪽만 아는 상태가 둘로 갈린다.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const visibleMaterials = materials;
  const total = visibleMaterials.length + segments.length;

  const allPicked = visibleMaterials.length > 0 && visibleMaterials.every((m) => picked.has(m.id));
  const somePicked = visibleMaterials.some((m) => picked.has(m.id));

  function togglePick(id: string, next: boolean) {
    setPicked((prev) => {
      const draft = new Set(prev);
      if (next) draft.add(id);
      else draft.delete(id);
      return draft;
    });
  }

  function togglePickAll() {
    setPicked(allPicked ? new Set() : new Set(visibleMaterials.map((m) => m.id)));
  }

  async function handleHide() {
    const ids = visibleMaterials.filter((m) => picked.has(m.id)).map((m) => m.id);
    if (ids.length === 0) return;
    await hideMaterials(ids);
    setPicked(new Set());
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">보류함</h2>
        <p className="text-sm font-medium text-grey">
          어느 사건에도 붙지 않은 자료 {visibleMaterials.length}건, 구술 {segments.length}건.
          왼쪽에서 사건을 고른 뒤 각 항목을 연결하세요. 쓰지 않을 사료는 골라서 치울 수
          있습니다 — 치운 것은 DB에 그대로 남고 아래 “치운 사료”에서 되돌립니다.
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
            {visibleMaterials.length > 0 && (
              <section>
                {/* 머리줄의 체크박스는 연표 표 머리와 같은 자리·같은 조작이다 — 행마다 붙는
                    체크박스가 선 자리에서 "보이는 것 모두"를 한 번에 고른다. 일부만 골랐을
                    때는 반쯤 찬 모양(indeterminate)으로 그것을 알린다. */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      ref={(el) => {
                        if (el) el.indeterminate = !allPicked && somePicked;
                      }}
                      onChange={togglePickAll}
                      title={allPicked ? "선택 해제" : `사료 ${visibleMaterials.length}건 모두 선택`}
                      aria-label={allPicked ? "선택 해제" : `사료 ${visibleMaterials.length}건 모두 선택`}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
                    />
                    <p className="font-mono text-[11px] font-semibold text-grey">
                      사료 — {visibleMaterials.length}건
                      {picked.size > 0 && ` · ${picked.size}건 고름`}
                    </p>
                  </div>
                  {picked.size > 0 && (
                    <ConfirmDeleteButton
                      onDelete={handleHide}
                      confirmMessage={`고른 사료 ${picked.size}건을 보류함에서 치웁니다. DB에서는 지워지지 않고, 아래 “치운 사료”에서 되돌릴 수 있습니다.`}
                      label={`고른 ${picked.size}건 치우기`}
                      pendingLabel="치우는 중…"
                      className="border border-line px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:text-grey"
                    />
                  )}
                </div>
                <ul>
                  {visibleMaterials.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      selected={selected}
                      picked={picked.has(entry.id)}
                      onPick={togglePick}
                    />
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
