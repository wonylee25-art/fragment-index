"use client";

import { useState } from "react";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";
import { LinkTargetType, linkTargetToEvent, unlinkTargetFromEvent } from "@/lib/link-actions";
import { LinkedEventRef } from "@/lib/types";
import { deactivateMaterials } from "@/lib/material-actions";
import { PickSection, isUnlinkedEntry } from "./LinkPickSection";

// 보류함. 저장해 둔 사료가 쌓이는 곳. 사건에 붙었느냐로 두 무리를 갈라 나란히 세운다 —
// 붙는 순간 목록에서 사라지면 잘못 붙였을 때 끊을 대상이 화면에 없어지므로, 붙은 것은
// 지워지지 않고 아래 무리로 옮겨 갈 뿐이다.
// 구술은 여기서 다루지 않는다 — [구술 연결] 탭이 같은 일을 구술만 놓고 한다.
// 사건은 항목마다 따로 붙인다(EventAttach) — 화면 하나에 사건 하나를 골라두고 모든 항목에
// 같이 먹이던 방식은, 열 건을 각각 다른 사건에 붙이려면 왼쪽을 열 번 다시 골라야 했다.
//
// 붙이는 것만으로는 보류함이 줄지 않는다 — 검색으로 저장했다가 결국 안 쓰는 것이 계속
// 남기 때문에, 골라서 한꺼번에 내리는 길을 함께 둔다(연표 일괄 숨김과 같은 조작).
// 내리는 것은 화면에서 내리는 일이지 지우는 일이 아니다 — DB의 행도 연결선도 그대로 두고,
// 아래 비활성함에서 되돌린다. 정말로 지우는 일은 그 함 안에서만 할 수 있다.
//
// 고르고 넘기고 내리는 조작은 구술 연결과 한 벌을 함께 쓴다(LinkPickSection) — 여기서는
// 사료 줄의 생김새만 그린다.

export interface UnlinkedEntry {
  id: string;
  targetType: LinkTargetType;
  title: string;
  metaLine: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  // 이 항목이 붙어 있는 사건 전부(숨긴 사건 포함). 비어 있으면 어디에도 안 붙은 것이다.
  links?: LinkedEventRef[];
}

function MaterialCard({ entry, events }: { entry: UnlinkedEntry; events: EventOption[] }) {
  return (
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

        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
          <EventAttach
            events={events}
            linked={entry.links}
            onPick={(event) => linkTargetToEvent(event.id, entry.targetType, entry.id, "keyword")}
            onUnlink={(eventId) => unlinkTargetFromEvent(eventId, entry.targetType, entry.id)}
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
  );
}

const UNLINKED_LABEL = "사건과 연결되지 않은 사료";

export function UnlinkedBoard({
  events,
  materials,
}: {
  events: EventOption[];
  materials: UnlinkedEntry[];
}) {
  // 내린 것을 화면에서 빼는 일은 서버가 맡는다(deactivate…가 이 경로를 revalidate한다).
  // 처음에는 여기서 내린 id를 따로 들고 걸러냈는데, 그러면 비활성함에서 되돌린 것이
  // 목록에 돌아왔는데도 그 기억에 걸려 계속 숨겨졌다 — 한쪽만 아는 상태가 둘로 갈린다.
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const unlinked = materials.filter(isUnlinkedEntry);
  const linked = materials.filter((m) => !isUnlinkedEntry(m));

  const shared = {
    noun: "사료",
    boxName: "비활성 사료함",
    unlinkedLabel: UNLINKED_LABEL,
    events,
    picked,
    setPicked,
    onDeactivate: deactivateMaterials,
    targetType: "archive_item" as const,
    basis: "keyword" as const,
    renderCard: (entry: UnlinkedEntry) => <MaterialCard entry={entry} events={events} />,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 조작법을 적어두던 문단이 있었는데 걷어냈다(구술 연결과 같이) — 버튼에 적힌 말과
          아래 무리 이름이 같은 얘기를 이미 하고 있어, 매번 읽고 지나가는 짐이 됐다. */}
      <h2 className="text-xl font-extrabold tracking-tight text-ink">보류함</h2>

      {materials.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-grey">
          보류 중인 자료가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-7">
          <PickSection
            {...shared}
            label={UNLINKED_LABEL}
            hint="아직 할 일이 남은 것"
            entries={unlinked}
          />
          <PickSection
            {...shared}
            label="사건과 연결된 사료"
            hint="잘못 붙였으면 여기서 끊는다"
            entries={linked}
          />
        </div>
      )}
    </div>
  );
}
