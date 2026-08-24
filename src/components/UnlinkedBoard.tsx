"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";
import { LinkTargetType, linkTargetToEvent, unlinkTargetFromEvent } from "@/lib/link-actions";
import { ArchiveItemType, LinkedEventRef } from "@/lib/types";
import { CardShell, FieldLabel, footButtonClass, HeadRow } from "./RecordCard";
import { RECORD_CELL_CLASSNAME as CELL_CLASSNAME, RECORD_LINE_CLASSNAME } from "@/lib/design-tokens";
import { clearMaterialsNoLink, deactivateMaterials, markMaterialsNoLink } from "@/lib/material-actions";
import { adoptMaterialsToTimeline, dropMaterialsFromTimeline } from "@/lib/timeline-placement-actions";
import { PickSection } from "./LinkPickSection";
import { BOX_TEXT, boxOf, MaterialBox } from "@/lib/material-box";

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
// 사료 카드의 생김새만 그린다. 세우는 모양은 이 화면만 격자다(구술 연결은 목록 그대로) —
// 사료는 읽어 보고 붙일지 정하는 자료라, 훑기와 읽기를 카드와 덧창으로 갈라 두었다.

export interface UnlinkedEntry {
  id: string;
  targetType: LinkTargetType;
  title: string;
  metaLine: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  // 아래 셋은 사료 줄에만 쓴다(구술 줄은 비워 둔다).
  itemType?: ArchiveItemType;
  sourceOrg?: string;
  dateValue?: string;
  fullText?: string; // 옮겨 적어 둔 원문 — 있으면 요약 아래에서 펼쳐 읽는다
  // 이 항목이 붙어 있는 사건 전부(숨긴 사건 포함). 비어 있으면 어디에도 안 붙은 것이다.
  links?: LinkedEventRef[];
  // 사건 없이 연표에 올려 둔 것인지(LinkPickSection의 PickEntry와 같은 뜻).
  onTimeline?: boolean;
  // 붙이지 않기로 한 자료인지 — 미연결함에 서는 것들이다.
  noLink?: boolean;
  timelineReady?: boolean; // 연표에 올릴 수 있는 자료인지 — 옮겨 적어 둔 본문이 있어야 한다
}

// 보류함 카드는 발췌 칸이 서는 큰 카드다 — 여기는 담긴 자료를 읽어보고 붙일지 정하는 자리라,
// 접힌 채로도 무슨 이야기인지 몇 줄은 보여야 한다.
const CARD_HEIGHT_CLASSNAME = "h-[17rem]";

// 덧창에 서는 본문. 국가기록원 기록물은 API가 표제·생산기관·생산연도까지만 주므로 읽을
// 것이 없다 — 빈 자리를 두는 대신 왜 없는지와 그 다음 할 일(원문 보기)을 세운다.
function MaterialBody({ entry }: { entry: UnlinkedEntry }) {
  const text = entry.fullText || entry.description;
  if (text) {
    return (
      <p className="whitespace-pre-line font-serif text-[13.5px] leading-[1.85] text-ink">
        {text}
      </p>
    );
  }
  return (
    <div className="border border-dashed border-line bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed">
      <p className="font-semibold text-ink">옮겨 적어 둔 본문이 없습니다.</p>
      <p className="mt-1 text-grey">
        표제와 출처만 있는 자료입니다. 본문을 옮겨 적으면 여기에 서고, 그때부터 연표에도
        올릴 수 있습니다.
      </p>
    </div>
  );
}

function MaterialCard({
  entry,
  events,
  checkbox,
  ordinal,
}: {
  entry: UnlinkedEntry;
  events: EventOption[];
  checkbox: ReactNode;
  // 이 무리에서 몇 번째 / 모두 몇 건인지. 카드가 목록의 어디쯤인지 세지 않고도 알린다.
  ordinal: string;
}) {
  const [pending, setPending] = useState(false);
  const box = boxOf(entry);

  // 세 손잡이 중 둘은 여기서 바로 먹는다(고르지 않고 그 카드 하나에만) — 붙이는 일만
  // 덧창을 연다. 어느 사건에 붙일지 골라야 하는 일이라 자리가 필요하다.
  async function move(run: (ids: string[]) => Promise<number>) {
    setPending(true);
    try {
      await run([entry.id]);
    } finally {
      setPending(false);
    }
  }

  return (
    <CardShell
      itemType={entry.itemType}
      // 사건에 많이 붙은 자료일수록 진하다. 아직 안 붙은 것은 거의 흰 종이라, 할 일이
      // 남은 것들이 옅은 쪽에 저절로 모여 보인다.
      strength={entry.links?.length ?? 0}
      heightClassName={CARD_HEIGHT_CLASSNAME}
      sourceUrl={entry.sourceUrl}
      head={
        <HeadRow
          sourceOrg={entry.sourceOrg}
          itemType={entry.itemType}
          dateValue={entry.dateValue}
          checkbox={checkbox}
        />
      }
      foot={({ openLink }) => (
        <>
          {/* 칠해진 것이 이 사료가 지금 선 함이다 — 누르는 자리이면서 상태 표시이기도 하다 */}
          <button
            type="button"
            onClick={openLink}
            title="덧창에서 사건을 골라 붙입니다"
            className={footButtonClass(box === "linked")}
          >
            사건 연결{entry.links?.length ? ` ${entry.links.length}` : ""}
          </button>
          <button
            type="button"
            onClick={() => void move(markMaterialsNoLink)}
            disabled={pending || box === "nolink"}
            title="사건에 붙이지 않기로 합니다 — 미연결함으로 갑니다"
            className={`${footButtonClass(box === "nolink")} disabled:cursor-default`}
          >
            미연결
          </button>
          <button
            type="button"
            onClick={() => void move(clearMaterialsNoLink)}
            disabled={pending || box === "hold"}
            title="판단을 미룹니다 — 보류함으로 갑니다"
            className={`${footButtonClass(box === "hold")} disabled:cursor-default`}
          >
            보류
          </button>
          {entry.onTimeline && (
            <span className="shrink-0 border border-line px-1 font-mono text-[9px] font-bold text-ink">
              연표
            </span>
          )}
          <span className="shrink-0 pl-0.5 font-mono text-[9.5px] tabular-nums tracking-wider text-grey">
            {ordinal}
          </span>
        </>
      )}
      overlay={(mode) => {
        // 칸의 차례는 늘 같다: 표제 → 본문 → 사건 연결. 무엇 하러 열었느냐(mode)는 차례가
        // 아니라 사건 고르는 창이 펼쳐진 채 뜨느냐만 가른다 — 읽던 자리가 열 때마다
        // 달라지면 같은 카드가 매번 다른 종이처럼 보인다.
        const bodyCell = (
          <div key="body" className={`border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
            <FieldLabel en="full text" ko="본문" />
            <div className="mt-1.5">
              <MaterialBody entry={entry} />
            </div>
          </div>
        );
        const linkCell = (
          <div key="link" className={`border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
            <FieldLabel en="link" ko="사건 연결" />
            <div className="mt-1.5">
              <EventAttach
                // 사건 목록 안 맨 위에 서는 손잡이 — 사건을 고르다 "이건 사건 없이 그냥
                // 연표에 세우면 되겠다"고 판단하는 자리가 바로 거기다.
                listTop={
                  entry.onTimeline ? (
                    <button
                      type="button"
                      onClick={() => void move(dropMaterialsFromTimeline)}
                      disabled={pending}
                      title="연표에서만 내립니다 — 자료도, 조정해 둔 연표 날짜도 그대로 남습니다"
                      className="border border-line px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:text-grey"
                    >
                      연표에서 내리기
                    </button>
                  ) : entry.timelineReady ? (
                    <button
                      type="button"
                      onClick={() => void move(adoptMaterialsToTimeline)}
                      disabled={pending}
                      title="사건에 붙이지 않고, 자료 자신을 연표에 한 행으로 세웁니다"
                      className="border border-ink px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:bg-surface disabled:border-line disabled:text-grey"
                    >
                      연표에 올리기
                    </button>
                  ) : (
                    <p className="font-mono text-[10.5px] text-grey">
                      옮겨 적어 둔 본문이 없어 연표에는 올릴 수 없습니다
                    </p>
                  )
                }

                events={events}
                linked={entry.links}
                // 붙이러 열었으면 고르는 창이 이미 펼쳐진 채 선다 — 한 번 더 누르게 하지 않는다.
                startOpen={mode === "link"}
                // 사료에 날짜가 있으면 그 언저리 사건부터 보인다 — 6천 건에서 손으로 찾는 일을 줄인다.
                nearDate={entry.dateValue}
                onPick={(event) => linkTargetToEvent(event.id, entry.targetType, entry.id, "keyword")}
                onUnlink={(eventId) => unlinkTargetFromEvent(eventId, entry.targetType, entry.id)}
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
                {entry.title}
              </p>
              <p className="mt-1 font-mono text-[10.5px] text-grey">{entry.metaLine}</p>
            </div>
            {[bodyCell, linkCell]}
          </>
        );
      }}
    >
      {entry.imageUrl && (
        // 외부 아카이브 이미지를 그대로 건다(재호스팅하지 않음) — next/image 설정 없이 쓰려고 <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.imageUrl}
          alt={entry.title}
          loading="lazy"
          className={`h-20 w-full shrink-0 border-b bg-surface object-cover ${RECORD_LINE_CLASSNAME}`}
        />
      )}

      <div className={`shrink-0 border-b ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
        <FieldLabel en="title" ko="표제" />
        <p className="mt-1 line-clamp-3 font-serif text-[15px] font-bold leading-snug text-ink">
          {entry.title}
        </p>
      </div>

      {/* 발췌 칸은 남는 자리를 다 가진다. 끝을 딱 자르면 잘린 것인지 원래 그만큼인지 알 수
          없어, 아래로 갈수록 흐려지게 두어 "더 있다"는 것을 글자 없이 알린다. */}
      <div className={`flex min-h-0 flex-1 flex-col ${CELL_CLASSNAME}`}>
        <FieldLabel en="excerpt" ko="발췌" />
        {entry.description ? (
          <p className="mt-1 min-h-0 flex-1 overflow-hidden text-[12px] leading-relaxed text-grey [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
            {entry.description}
          </p>
        ) : (
          <p className="mt-1 font-mono text-[10.5px] text-grey">옮겨 적어 둔 본문 없음</p>
        )}
      </div>
    </CardShell>
  );
}

export function UnlinkedBoard({
  events,
  materials,
  query,
  totalCount,
  box,
}: {
  events: EventOption[];
  materials: UnlinkedEntry[];
  // 위 "사료 검색"에 친 말. 들어오면 함도 그 말로 걸린 것만 세운다(page.tsx에서 거른다).
  query: string;
  // 좁히기 전의 전체 건수 — 몇 건 중 몇 건인지 알려야 남은 것이 사라진 것으로 읽히지 않는다.
  totalCount: number;
  box: MaterialBox;
}) {
  // 내린 것을 화면에서 빼는 일은 서버가 맡는다(deactivate…가 이 경로를 revalidate한다).
  // 처음에는 여기서 내린 id를 따로 들고 걸러냈는데, 그러면 비활성함에서 되돌린 것이
  // 목록에 돌아왔는데도 그 기억에 걸려 계속 숨겨졌다 — 한쪽만 아는 상태가 둘로 갈린다.
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const entries = materials.filter((m) => boxOf(m) === box);
  const text = BOX_TEXT[box];

  return (
    <div className="flex flex-col gap-6">
      {/* 좁혀져 있다는 것과 푸는 길을 제목 줄에 함께 둔다 — 검색은 검색 탭에서 했는데
          결과가 여기까지 미치므로, 이 자리에서 무엇 때문에 줄었는지 읽혀야 한다. */}
      {/* 함 이름은 위 탭 줄이 이미 말한다(page.tsx) — 여기서는 소리로 읽는 차례에만 남긴다. */}
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="sr-only">{text.title}</h2>
        {query && (
          <>
            <span className="font-mono text-[11px] text-grey">
              “{query}”으로 좁힘 — 전체 {totalCount}건 중 {materials.length}건
            </span>
            <Link
              href={`/admin/review?tab=${box}`}
              className="font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4 hover:text-green-text"
            >
              전체 보기
            </Link>
          </>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-grey">
          {query ? `“${query}”으로 걸린 사료가 ${text.title}에 없습니다.` : `${text.title}이 비어 있습니다.`}
        </p>
      ) : (
        <PickSection
          noun="사료"
          boxName="비활성 사료함"
          unlinkedLabel={BOX_TEXT.hold.label}
          events={events}
          picked={picked}
          setPicked={setPicked}
          onDeactivate={deactivateMaterials}
          onAdopt={adoptMaterialsToTimeline}
          onDrop={dropMaterialsFromTimeline}
          targetType="archive_item"
          basis="keyword"
          layout="grid"
          renderCard={(entry: UnlinkedEntry, form: { checkbox: ReactNode; ordinal: string }) => (
            <MaterialCard entry={entry} events={events} {...form} />
          )}
          label={text.label}
          hint={text.hint}
          entries={entries}
          // 붙지 않은 두 함 사이만 오간다 — 연결함에서 나가는 길은 연결을 끊는 것이다.
          moveAction={
            box === "hold"
              ? { label: "미연결로", run: markMaterialsNoLink }
              : box === "nolink"
                ? { label: "보류로", run: clearMaterialsNoLink }
                : undefined
          }
        />
      )}
    </div>
  );
}
