"use client";

import { useState } from "react";
import { linkTargetToEvent, unlinkTargetFromEvent } from "@/lib/link-actions";
import { SegmentLinkRow, SourceOption } from "@/lib/db";
import { formatEdtfToKorean } from "@/lib/edtf";
import { deactivateSegments } from "@/lib/segment-actions";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";
import { OralIntakeForm } from "./OralIntakeForm";
import { PersonBrief } from "@/lib/types";
import { PickSection, isUnlinkedEntry } from "./LinkPickSection";

// 관리 "구술 연결". 넣어 둔 구술을 사건에 붙이는 일을 하고, 새 구술을 넣는 입구도 여기 있다.
// 한동안은 넣는 일을 구술 목록에만 두고 여기서는 링크만 걸어뒀는데 — 붙일 것이 없다는 걸
// 아는 자리가 바로 여기라, 알아차린 자리에서 화면을 옮겨야 넣을 수 있는 게 번거로웠다.
// 사료 연결의 "+ 사료 추가"와 같은 규칙이다: 없다는 걸 아는 순간 눈이 이미 그 줄에 있다.
//
// 사료 연결의 보류함과 조작이 같다 — 같은 한 벌(LinkPickSection)을 쓴다. 붙었느냐로 두
// 무리를 갈라 나란히 세우고, 체크박스로 골라 한꺼번에 붙이거나 끊거나 내리고, 열 건씩
// 끊어 넘긴다. 한동안 이쪽만 토글 하나에 한 건씩 다루는 화면으로 남아 있었는데, 같은
// 일을 하는 두 화면의 손버릇이 다르면 쓰는 사람이 매번 다시 익혀야 한다.
//
// 숨긴 사건에 붙어 있는 구술도 붙은 것으로 보여준다(배지에 "숨김"). 예전에는 연결선을
// 사건 목록에서 거꾸로 훑느라 숨긴 사건이 통째로 빠졌고, 그래서 멀쩡히 붙어 있는 구술이
// "안 붙은 구술"로 세어졌다.

// PickSection이 읽는 몫(title·links)을 구술 줄에 맞춰 붙인다. title은 화면에 그려지지
// 않고 체크박스를 소리로 읽을 때만 쓰이므로, 그 줄을 알아볼 수 있는 말로 짓는다.
type SegmentEntry = SegmentLinkRow & { title: string; links: SegmentLinkRow["linkedEvents"] };

function SegmentCard({ entry, events }: { entry: SegmentEntry; events: EventOption[] }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] tabular-nums text-grey">
          {entry.dateValue ? formatEdtfToKorean(entry.dateValue) : "연도 미상"}
        </span>
        {entry.speakers.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-ink">
            {entry.speakers.join(" · ")}
          </span>
        )}
      </div>

      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-grey">{entry.preview}</p>

      {/* 이미 붙어 있는 사건은 배지로 먼저 서고(붙일지 말지의 판단이 여기서 갈린다),
          붙이고 끊는 일도 그 자리에서 한다 */}
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
        <EventAttach
          events={events}
          linked={entry.linkedEvents}
          onPick={(event) => linkTargetToEvent(event.id, "segment", entry.id, null)}
          onUnlink={(eventId) => unlinkTargetFromEvent(eventId, "segment", entry.id)}
          emptyHint={<>연표에 사건이 없습니다.</>}
        />
        <a
          href={`/segments?focus=${entry.id}`}
          className="pb-1 font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          본문 보기 ↗
        </a>
      </div>
    </>
  );
}

const UNLINKED_LABEL = "사건과 연결되지 않은 구술";

export function OralLinkBoard({
  rows,
  events,
  persons,
  sources,
}: {
  rows: SegmentLinkRow[];
  events: EventOption[];
  // 구술 추가 폼이 쓰는 재료 — 화자 명단과 이미 등록된 출처(구술 목록과 같은 것을 받는다).
  persons: PersonBrief[];
  sources: SourceOption[];
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const entries: SegmentEntry[] = rows.map((row) => ({
    ...row,
    title: `${row.speakers.join(" · ") || "화자 미상"} — ${row.preview.slice(0, 20)}`,
    links: row.linkedEvents,
  }));
  const unlinked = entries.filter(isUnlinkedEntry);
  const linked = entries.filter((e) => !isUnlinkedEntry(e));

  const shared = {
    noun: "구술",
    boxName: "비활성 구술함",
    unlinkedLabel: UNLINKED_LABEL,
    events,
    picked,
    setPicked,
    onDeactivate: deactivateSegments,
    targetType: "segment" as const,
    basis: null,
    renderCard: (entry: SegmentEntry) => <SegmentCard entry={entry} events={events} />,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="mr-auto text-xl font-extrabold tracking-tight text-ink">구술 연결</h2>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="shrink-0 border border-line px-2.5 py-1 font-mono text-[11px] font-semibold text-ink hover:bg-ink hover:text-background"
            >
              + 구술 추가
            </button>
          )}
        </div>
        <p className="text-sm font-medium text-grey">
          구술 {entries.length}건 — 사건에 붙지 않은 것 {unlinked.length}건, 붙은 것{" "}
          {linked.length}건. 항목마다 “+ 사건 연결”로 각자의 사건에 붙이고, “− 사건 연결
          해제”로 끊습니다. 붙이면 아래 무리로 내려갈 뿐 목록에서 사라지지 않습니다. 쓰지
          않을 것은 골라서 비활성으로 내릴 수 있습니다 — DB에서 지워지지 않고 아래
          비활성함에서 되돌립니다. 새 구술은 위의 “+ 구술 추가”로 여기서 바로 넣을 수 있고,{" "}
          <a
            href="/segments"
            className="font-semibold text-ink underline decoration-dotted underline-offset-4"
          >
            구술 목록
          </a>
          에서 넣어도 됩니다 — 같은 폼입니다.
        </p>
      </div>

      {/* 넣자마자 그 구술이 아래 "사건과 연결되지 않은 구술"에 나타난다(서버가 다시 그린다) */}
      {adding && (
        <OralIntakeForm
          persons={persons}
          sources={sources}
          events={events}
          onClose={() => setAdding(false)}
        />
      )}

      {entries.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-grey">
          구술이 없습니다.
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
            label="사건과 연결된 구술"
            hint="잘못 붙였으면 여기서 끊는다"
            entries={linked}
          />
        </div>
      )}
    </div>
  );
}
