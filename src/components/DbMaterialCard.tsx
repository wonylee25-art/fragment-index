"use client";

import { useState } from "react";
import Link from "next/link";
import { RelatedItem } from "@/lib/types";
import { ARCHIVE_ITEM_ICON, RECORD_CELL_CLASSNAME as CELL_CLASSNAME, RECORD_LINE_CLASSNAME } from "@/lib/design-tokens";
import { clearMaterialsNoLink, markMaterialsNoLink } from "@/lib/material-actions";
import { adoptMaterialsToTimeline, dropMaterialsFromTimeline } from "@/lib/timeline-placement-actions";
import { linkTargetToEvent, unlinkTargetFromEvent } from "@/lib/link-actions";
import { CardShell, FieldLabel, footButtonClass, HeadRow } from "./RecordCard";
import { EventAttach } from "./EventAttach";
import { EventOption } from "./EventPicker";

// 이미 DB에 있는 사료가 서는 카드. 사료 검색 화면에서 "이걸 이미 갖고 있다"를 보여주는
// 자리인데, 손잡이는 세 함의 카드와 똑같다 — 여기서 이미 가진 자료를 보고 있는데 붙이려면
// 다른 탭으로 건너가야 한다면, 같은 자료를 두 번 찾는 일이 된다.
//
// 다만 이 화면은 연결선을 함께 읽어오지 않아서(searchLocal은 사료만 본다) 「사건 연결」이
// 지금 붙어 있는지는 칠로 알리지 않는다 — 덧창을 열면 EventAttach가 붙은 사건을 보여준다.
export function DbMaterialCard({
  material,
  strength,
  events,
}: {
  material: RelatedItem;
  strength: number;
  events: EventOption[];
}) {
  const [pending, setPending] = useState(false);
  const body = material.fullText || material.description;

  async function move(run: (ids: string[]) => Promise<number>) {
    setPending(true);
    try {
      await run([material.id]);
    } finally {
      setPending(false);
    }
  }

  return (
    <CardShell
      itemType={material.type}
      strength={strength}
      heightClassName="h-[17rem]"
      sourceUrl={material.sourceUrl || undefined}
      head={
        <HeadRow
          sourceOrg={material.sourceOrg}
          itemType={material.type}
          dateValue={material.dateValue}
        />
      }
      foot={({ openLink }) => (
        <>
          <button
            type="button"
            onClick={openLink}
            title="덧창에서 사건을 골라 붙입니다"
            className={footButtonClass(false)}
          >
            사건 연결
          </button>
          <button
            type="button"
            onClick={() => void move(markMaterialsNoLink)}
            disabled={pending || material.noLink === true}
            title="사건에 붙이지 않기로 합니다 — 미연결함으로 갑니다"
            className={`${footButtonClass(material.noLink === true)} disabled:cursor-default`}
          >
            미연결
          </button>
          <button
            type="button"
            onClick={() => void move(clearMaterialsNoLink)}
            disabled={pending || !material.noLink}
            title="판단을 미룹니다 — 보류함으로 갑니다"
            className={`${footButtonClass(!material.noLink)} disabled:cursor-default`}
          >
            보류
          </button>
        </>
      )}
      overlay={(mode) => {
        // 칸의 차례는 늘 같다 — mode는 사건 고르는 창이 펼쳐진 채 뜨느냐만 가른다.
        const bodyCell = (
          <div key="body" className={`border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
            <FieldLabel en="excerpt" ko="발췌" />
            <p className="mt-1.5 whitespace-pre-line font-serif text-[13.5px] leading-[1.85] text-ink">
              {body || "옮겨 적어 둔 본문이 없습니다."}
            </p>
          </div>
        );
        const linkCell = (
          <div key="link" className={`border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
            <FieldLabel en="link" ko="사건 연결" />
            <div className="mt-1.5">
              <EventAttach
                events={events}
                startOpen={mode === "link"}
                // 사건 목록 안 맨 위에 서는 손잡이 — 세 함의 카드와 같은 자리다.
                listTop={
                  material.onTimeline ? (
                    <button
                      type="button"
                      onClick={() => void move(dropMaterialsFromTimeline)}
                      disabled={pending}
                      title="연표에서만 내립니다 — 자료도, 조정해 둔 연표 날짜도 그대로 남습니다"
                      className="border border-line px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:text-grey"
                    >
                      연표에서 내리기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void move(adoptMaterialsToTimeline)}
                      disabled={pending}
                      title="사건에 붙이지 않고, 자료 자신을 연표에 한 행으로 세웁니다"
                      className="border border-ink px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:bg-surface disabled:border-line disabled:text-grey"
                    >
                      연표에 올리기
                    </button>
                  )
                }
                nearDate={material.dateValue}
                onPick={(event) => linkTargetToEvent(event.id, "archive_item", material.id, "keyword")}
                onUnlink={(eventId) => unlinkTargetFromEvent(eventId, "archive_item", material.id)}
                emptyHint={
                  <>
                    연표에 사건이 없습니다.
                    <Link
                      href="/admin/timeline"
                      className="mt-2 block font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4"
                    >
                      사건 관리에서 사건 만들기 →
                    </Link>
                  </>
                }
              />
            </div>
          </div>
        );
        return (
          <>
            <div className={`shrink-0 border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
              <FieldLabel en="title" ko="표제" />
              <p className="mt-1 font-serif text-[17px] font-bold leading-snug text-ink">
                {material.title}
              </p>
              <p className="mt-1 font-mono text-[10.5px] text-grey">
                {[ARCHIVE_ITEM_ICON[material.type], material.type, material.sourceOrg, material.dateValue]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {[bodyCell, linkCell]}
          </>
        );
      }}
    >
      {material.imageUrl && (
        // 외부 아카이브 이미지를 그대로 건다(재호스팅하지 않음) — next/image 설정 없이 쓰려고 <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={material.imageUrl}
          alt={material.title}
          loading="lazy"
          className={`h-20 w-full shrink-0 border-b bg-surface object-cover ${RECORD_LINE_CLASSNAME}`}
        />
      )}

      <div className={`shrink-0 border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
        <FieldLabel en="title" ko="표제" />
        <p className="mt-1 line-clamp-3 font-serif text-[15px] font-bold leading-snug text-ink">
          {material.title}
        </p>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${CELL_CLASSNAME}`}>
        <FieldLabel en="excerpt" ko="발췌" />
        {body ? (
          <p className="mt-1 min-h-0 flex-1 overflow-hidden text-[12px] leading-relaxed text-grey [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
            {body}
          </p>
        ) : (
          <p className="mt-1 font-mono text-[10.5px] text-grey">옮겨 적어 둔 본문 없음</p>
        )}
      </div>
    </CardShell>
  );
}
