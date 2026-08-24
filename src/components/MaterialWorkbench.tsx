"use client";

import { useState } from "react";
import { MaterialDraft, saveMaterial } from "@/app/actions";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";
import { CardShell, FieldLabel, footButtonClass, HeadRow } from "./RecordCard";
import { RECORD_CELL_CLASSNAME as CELL_CLASSNAME } from "@/lib/design-tokens";

// 사료 연결의 작업대. 검색으로 걸린 자료를 저장하면서 사건에 붙인다.
// 사건은 자료마다 따로 고른다 — 화면 왼쪽에 목록 하나를 펼쳐두고 고른 사건이 모든 카드에
// 똑같이 먹던 방식은, 검색 결과 열 건을 각각 다른 사건에 붙일 수가 없었다.
// 사건을 고르면 그 자리에서 저장+연결까지 끝난다. 붙일 사건을 아직 못 정했으면 [보류]로
// 저장만 해 보류함에 쌓아둔다.

export type { EventOption };

export interface MaterialResult {
  draft: MaterialDraft;
  metaLine: string;
  // 머리칸 날짜에 그대로 적히는 글자. 소스마다 주는 것이 다르다(생산연도·등록일) — 아직
  // EDTF로 다듬기 전이라 글자 그대로 받는다.
  dateText?: string;
  // 찾던 말과 얼마나 겹치는지(0~3). 카드 종이의 짙기가 된다 — 아홉 건이 한 화면에 깔릴 때
  // 어느 것부터 열어볼지가 글을 읽기 전에 정해진다.
  strength?: number;
  badges: string[];
  saved: boolean;
}

export interface MaterialGroup {
  label: string;
  error: string | null;
  results: MaterialResult[];
}

// 카드 키는 세 화면이 같다. 검색 결과만 낮게(9.5rem) 두었더니 사진이 있는 자료(박물)에서
// 사진 띠가 카드를 다 먹어 표제가 밀려났고, 같은 자료가 화면마다 다른 키로 서 있었다.
// 본문을 안 주는 소스(국가기록원)에서 발췌 칸이 비는 것은 그대로 두는 편이 낫다 — 다른
// 화면과 같은 자리에 "옮겨 적어 둔 본문 없음"이라고 적히므로, 빈 것 자체가 정보가 된다.
const CARD_HEIGHT_CLASSNAME = "h-[17rem]";

function MaterialCard({ result, events }: { result: MaterialResult; events: EventOption[] }) {
  const { draft, metaLine, dateText, strength, badges, saved } = result;
  // 고른 사건은 폼 제출에 실어 보내려고 hidden으로 함께 넘긴다. 고르는 즉시 제출하므로
  // 화면에 남는 상태는 아니지만, 서버 액션이 FormData로만 값을 받기 때문에 한 번은 거쳐야 한다.
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  const [eventId, setEventId] = useState("");

  return (
    <li>
      {/* 폼이 카드 전체를 감싼다 — 덧창 안의 사건 고르기도 이 폼을 제출해 저장+연결을 한 번에 한다. */}
      <form ref={setFormEl} action={saveMaterial.bind(null, draft)}>
        <CardShell
          itemType={draft.itemType}
          strength={strength}
          heightClassName={CARD_HEIGHT_CLASSNAME}
          sourceUrl={draft.sourceUrl || undefined}
          foot={({ toggle }) => (
            <>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="intent" value="link" />
              {/* 세 화면의 카드가 같은 줄을 단다. 여기서만 다른 것은 아직 DB에 없는 자료라는
                  점 — 셋 다 누르는 순간 저장까지 함께 일어난다. */}
              <button
                type="button"
                onClick={toggle}
                disabled={saved}
                title="덧창에서 사건을 골라 붙이면서 저장합니다"
                className={`${footButtonClass(false)} disabled:cursor-default disabled:text-grey`}
              >
                사료 연결
              </button>
              <button
                type="submit"
                name="intent"
                value="nolink"
                disabled={saved}
                title="사건에 붙이지 않기로 하고 담습니다 — 미연결함으로 갑니다"
                className={`${footButtonClass(false)} disabled:cursor-default disabled:text-grey`}
              >
                미연결
              </button>
              <button
                type="submit"
                name="intent"
                value="hold"
                disabled={saved}
                title="판단을 미루고 담습니다 — 보류함으로 갑니다"
                className={`${footButtonClass(false)} disabled:cursor-default disabled:text-grey`}
              >
                보류
              </button>
              {saved && (
                <span className="shrink-0 pl-0.5 font-mono text-[9.5px] font-bold text-ink">
                  ✓ 담김
                </span>
              )}
            </>
          )}
          overlay={
            <>
              <div className={`shrink-0 border-b border-line ${CELL_CLASSNAME}`}>
                <FieldLabel en="title" ko="표제" />
                <p className="mt-1 font-serif text-[17px] font-bold leading-snug text-ink">
                  {draft.title}
                </p>
                <p className="mt-1 font-mono text-[10.5px] text-grey">{metaLine}</p>
              </div>

              {draft.description && (
                <div className={`border-b border-line ${CELL_CLASSNAME}`}>
                  <FieldLabel en="description" ko="설명" />
                  <p className="mt-1.5 whitespace-pre-line font-serif text-[13.5px] leading-[1.85] text-ink">
                    {draft.description}
                  </p>
                </div>
              )}

              <div className={CELL_CLASSNAME}>
                <FieldLabel en="link" ko="사건 연결" />
                <div className="mt-1.5">
                  {saved ? (
                    <span className="font-mono text-[11px] font-semibold text-ink">
                      ✓ 저장됨 — 보류함에서 사건에 붙입니다
                    </span>
                  ) : (
                    <EventAttach
                      events={events}
                      onPick={async (event) => {
                        setEventId(event.id);
                        // 값이 DOM에 반영된 다음에 제출한다 — 같은 tick에 부르면 빈 eventId가 실린다.
                        await new Promise((resolve) => setTimeout(resolve, 0));
                        formEl?.requestSubmit();
                      }}
                      emptyHint={<>연표에 사건이 없습니다.</>}
                    />
                  )}
                </div>
              </div>
            </>
          }
        >
          <HeadRow sourceOrg={draft.sourceOrg} itemType={draft.itemType} dateText={dateText} />

          {draft.imageUrl && (
            // 외부 아카이브 이미지를 그대로 건다(재호스팅하지 않음) — next/image 설정 없이 쓰려고 <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.imageUrl}
              alt={draft.title}
              loading="lazy"
              className="h-20 w-full shrink-0 border-b border-line bg-surface object-cover"
            />
          )}

          <div className={`shrink-0 border-b border-line ${CELL_CLASSNAME}`}>
            <FieldLabel en="title" ko="표제" />
            <p className="mt-1 line-clamp-3 font-serif text-[15px] font-bold leading-snug text-ink">
              {draft.title}
            </p>
          </div>

          {/* 발췌 칸은 남는 자리를 다 가진다(세 화면 공통). 배지는 그 자료를 실제로 볼 수
              있느냐를 가르는 말이라(원문 온라인 열람·비공개·영상 있음) 칸 바닥에 붙여 둔다 —
              담을지 정하는 자리에서는 발췌보다 이쪽이 먼저 필요할 때가 많다. */}
          <div className={`flex min-h-0 flex-1 flex-col ${CELL_CLASSNAME}`}>
            <FieldLabel en="excerpt" ko="발췌" />
            {draft.description ? (
              <p className="mt-1 min-h-0 flex-1 overflow-hidden text-[12px] leading-relaxed text-grey [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
                {draft.description}
              </p>
            ) : (
              <p className="mt-1 flex-1 font-mono text-[10.5px] text-grey">옮겨 적어 둔 본문 없음</p>
            )}
            {badges.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="bg-surface px-1 py-0.5 font-mono text-[9.5px] font-bold text-ink"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardShell>
      </form>
    </li>
  );
}

export function MaterialWorkbench({
  events,
  groups,
}: {
  events: EventOption[];
  groups: MaterialGroup[];
}) {
  const total = groups.reduce((sum, g) => sum + g.results.length, 0);

  return (
    <div>
        <p className="mb-2 font-mono text-[11px] font-semibold text-grey">사료 {total}</p>

        <div className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.label}>
              <p className="font-mono text-[11px] font-semibold text-grey">
                {group.label} — {group.results.length}건
              </p>
              {group.error && (
                <p className="mt-1 text-xs text-orange-fill">오류: {group.error}</p>
              )}
              {!group.error && group.results.length === 0 ? (
                <p className="mt-2 border-t border-line pt-3 text-[13px] text-grey">결과 없음</p>
              ) : (
                // 보류함과 같은 격자다 — 담기 전과 담은 뒤가 같은 모양으로 서야 한 화면으로 읽힌다.
                <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-start gap-4">
                  {group.results.map((result, i) => (
                    <MaterialCard key={`${result.draft.id}-${i}`} result={result} events={events} />
                  ))}
                </ul>
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
