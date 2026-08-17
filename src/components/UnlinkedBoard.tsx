"use client";

import { useState } from "react";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";
import { LinkTargetType, linkTargetToEvent, unlinkTargetFromEvent } from "@/lib/link-actions";
import { LinkedEventRef } from "@/lib/types";
import { deactivateMaterials } from "@/lib/material-actions";
import { deactivateSegments } from "@/lib/segment-actions";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

// 보류함. 저장은 됐지만 아직 어느 사건에도 붙지 않은 자료·구술이 쌓이는 곳.
// 사건은 항목마다 따로 붙인다(EventAttach) — 화면 하나에 사건 하나를 골라두고 모든 항목에
// 같이 먹이던 방식은, 열 건을 각각 다른 사건에 붙이려면 왼쪽을 열 번 다시 골라야 했다.
//
// 붙이는 것만으로는 보류함이 줄지 않는다 — 검색으로 저장했다가 결국 안 쓰는 것이 계속
// 남기 때문에, 골라서 한꺼번에 내리는 길을 함께 둔다(연표 일괄 숨김과 같은 조작).
// 내리는 것은 화면에서 내리는 일이지 지우는 일이 아니다 — DB의 행도 연결선도 그대로 두고,
// 아래 비활성함에서 되돌린다. 정말로 지우는 일은 그 함 안에서만 할 수 있다.
// 사료와 구술이 같은 조작을 쓰되 내리는 함은 따로다 — 비활성 사료함, 비활성 구술함.

export interface UnlinkedEntry {
  id: string;
  targetType: LinkTargetType;
  title: string;
  metaLine: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  // 숨긴 사건에만 붙어 있어서 보류함으로 내려온 경우, 그 사건들. 비어 있으면 정말로
  // 어디에도 안 붙은 것이다(db.getUnlinkedMaterials 주석 참고).
  hiddenLinks?: LinkedEventRef[];
}

function EntryCard({
  entry,
  events,
  picked,
  onPick,
}: {
  entry: UnlinkedEntry;
  events: EventOption[];
  picked?: boolean;
  onPick?: (id: string, next: boolean) => void;
}) {
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

          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
            <EventAttach
              events={events}
              linked={entry.hiddenLinks}
              onPick={(event) =>
                linkTargetToEvent(event.id, entry.targetType, entry.id, "keyword")
              }
              onUnlink={(eventId) =>
                unlinkTargetFromEvent(eventId, entry.targetType, entry.id)
              }
              emptyHint={
                <>
                  연표에 사건이 없습니다.
                  <a
                    href="/admin/timeline"
                    className="mt-2 block font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4"
                  >
                    연표 관리에서 사건 만들기 →
                  </a>
                </>
              }
            />
            {entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pb-1 font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
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

// 사료 무리와 구술 무리는 조작이 같고 내리는 함만 다르다 — 머리줄(전체 고르기 체크박스와
// 비활성 버튼)과 목록을 한 벌로 묶어 둘이 나란히 같은 모양으로 서게 한다.
function PickSection({
  label,
  boxName,
  entries,
  events,
  picked,
  setPicked,
  onDeactivate,
}: {
  label: string;
  boxName: string;
  entries: UnlinkedEntry[];
  events: EventOption[];
  picked: Set<string>;
  setPicked: (next: Set<string>) => void;
  onDeactivate: (ids: string[]) => Promise<number>;
}) {
  if (entries.length === 0) return null;

  const pickedHere = entries.filter((e) => picked.has(e.id));
  const allPicked = pickedHere.length === entries.length;
  const somePicked = pickedHere.length > 0;

  function togglePick(id: string, next: boolean) {
    const draft = new Set(picked);
    if (next) draft.add(id);
    else draft.delete(id);
    setPicked(draft);
  }

  async function handleDeactivate() {
    if (pickedHere.length === 0) return;
    await onDeactivate(pickedHere.map((e) => e.id));
    setPicked(new Set());
  }

  return (
    <section>
      {/* 머리줄의 체크박스는 연표 표 머리와 같은 자리·같은 조작이다 — 행마다 붙는 체크박스가
          선 자리에서 "보이는 것 모두"를 한 번에 고른다. 일부만 골랐을 때는 반쯤 찬
          모양(indeterminate)으로 그것을 알린다. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allPicked}
            ref={(el) => {
              if (el) el.indeterminate = !allPicked && somePicked;
            }}
            onChange={() => setPicked(allPicked ? new Set() : new Set(entries.map((e) => e.id)))}
            title={allPicked ? "선택 해제" : `${label} ${entries.length}건 모두 선택`}
            aria-label={allPicked ? "선택 해제" : `${label} ${entries.length}건 모두 선택`}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
          />
          <p className="font-mono text-[11px] font-semibold text-grey">
            {label} — {entries.length}건
            {somePicked && ` · ${pickedHere.length}건 고름`}
          </p>
        </div>
        {somePicked && (
          <ConfirmDeleteButton
            onDelete={handleDeactivate}
            confirmMessage={`고른 ${label} ${pickedHere.length}건을 비활성으로 내립니다. DB에서는 지워지지 않고, 아래 “${boxName}”에서 되돌릴 수 있습니다.`}
            label={`고른 ${pickedHere.length}건 비활성`}
            pendingLabel="내리는 중…"
            className="border border-line px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:text-grey"
          />
        )}
      </div>
      <ul>
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            events={events}
            picked={picked.has(entry.id)}
            onPick={togglePick}
          />
        ))}
      </ul>
    </section>
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
  // 내린 것을 화면에서 빼는 일은 서버가 맡는다(deactivate…가 이 경로를 revalidate한다).
  // 처음에는 여기서 내린 id를 따로 들고 걸러냈는데, 그러면 비활성함에서 되돌린 것이
  // 목록에 돌아왔는데도 그 기억에 걸려 계속 숨겨졌다 — 한쪽만 아는 상태가 둘로 갈린다.
  //
  // 고른 것은 사료와 구술을 따로 센다. 두 무리는 내리는 함이 다르고(비활성 사료함/구술함),
  // 한 벌로 묶으면 "고른 5건 비활성"이 어느 함으로 가는 말인지 알 수 없다.
  const [pickedMaterials, setPickedMaterials] = useState<Set<string>>(new Set());
  const [pickedSegments, setPickedSegments] = useState<Set<string>>(new Set());
  const total = materials.length + segments.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">보류함</h2>
        <p className="text-sm font-medium text-grey">
          어느 사건에도 붙지 않은 자료 {materials.length}건, 구술 {segments.length}건. 항목마다
          “+ 사건 붙이기”로 각자의 사건에 붙이세요. 쓰지 않을 것은 골라서 비활성으로 내릴 수
          있습니다 — DB에서 지워지지 않고 아래 비활성함에서 되돌립니다.
        </p>
      </div>

      {total === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-grey">
          보류 중인 자료가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-7">
          <PickSection
            label="사료"
            boxName="비활성 사료함"
            entries={materials}
            events={events}
            picked={pickedMaterials}
            setPicked={setPickedMaterials}
            onDeactivate={deactivateMaterials}
          />
          <PickSection
            label="구술"
            boxName="비활성 구술함"
            entries={segments}
            events={events}
            picked={pickedSegments}
            setPicked={setPickedSegments}
            onDeactivate={deactivateSegments}
          />
        </div>
      )}
    </div>
  );
}
