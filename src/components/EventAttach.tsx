"use client";

import { useMemo, useState } from "react";
import { EventOption } from "./EventPicker";
import { Pager } from "./Pager";
import { edtfDayGap, formatDayGap, formatEdtfToKorean } from "@/lib/edtf";
import { LinkedEventRef } from "@/lib/types";
import { RECORD_LINE_CLASSNAME } from "@/lib/design-tokens";

// 항목 하나에 사건을 붙이고 끊는 손잡이. 예전에는 화면 왼쪽에 사건 목록을 하나 펼쳐두고
// 거기서 고른 사건이 그 화면의 모든 항목에 똑같이 적용됐다 — 사료 열 건을 각각 다른 사건에
// 붙이려면 왼쪽을 열 번 다시 고르며 오르내려야 했다.
//
// 붙이는 일도 끊는 일도 항목 안에서 끝난다. 두 버튼은 늘 나란히 서 있는다: 끊을 것이 있을
// 때만 나타나게 했더니, 정작 끊고 싶을 때 버튼이 어디 있는지 찾아 헤매게 됐다.
//
// 사건 목록은 한 번에 열 개씩만 보여주고 이전·다음으로 넘긴다. 200건이 든 목록을 스크롤로
// 훑는 것은 고르는 일이 아니라 뒤지는 일이 된다 — 좁히기 칸으로 줄이고, 남은 것을 쪽으로 센다.
const PAGE_SIZE = 10;

function gapLabel(event: EventOption, nearDate: string): string | null {
  const gap = event.dateValue ? edtfDayGap(event.dateValue, nearDate) : null;
  return gap === null ? null : formatDayGap(gap);
}

function EventPage({
  events,
  nearDate,
  onChoose,
  disabled,
  emptyText,
}: {
  events: EventOption[];
  // 있으면 이 날짜에서 얼마나 떨어졌는지를 줄마다 적는다(사료 날짜).
  nearDate?: string;
  onChoose: (id: string) => void;
  disabled: boolean;
  emptyText: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));

  if (events.length === 0) {
    return <p className="px-2 py-4 text-center text-[12px] text-grey">{emptyText}</p>;
  }

  // 좁히기로 목록이 줄면 보고 있던 쪽이 사라질 수 있다. 상태를 고쳐 맞추지 않고 그릴 때
  // 끌어당긴다 — 렌더 도중 상태를 되돌리면 그린 것을 또 그리는 일이 꼬리를 문다.
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const shown = events.slice(start, start + PAGE_SIZE);

  return (
    <>
      <ul className="mt-1.5 border-t border-line">
        {shown.map((event) => (
          <li key={event.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onChoose(event.id)}
              disabled={disabled}
              className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left hover:bg-surface disabled:opacity-50"
            >
              <span className="font-mono text-[10px] tabular-nums text-grey">{event.year}</span>
              <span className="text-[12px] font-semibold leading-snug text-ink">
                {event.eventName}
              </span>
              {event.hidden && <span className="font-mono text-[10px] text-grey">숨김</span>}
              {/* 사료와 며칠 떨어졌는지. 연도만으로는 같은 해 안에서 어느 것이 가까운지 모른다. */}
              {nearDate && gapLabel(event, nearDate) && (
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-grey">
                  {gapLabel(event, nearDate)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="mt-1">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </>
  );
}

export function EventAttach({
  events,
  linked = [],
  onPick,
  onUnlink,
  emptyHint,
  // 머리줄의 일괄 연결처럼, 이미 "고르겠다"고 누르고 들어온 자리에서는 목록이 곧바로 펼쳐진다.
  startOpen = false,
  onClose,
  pickLabel = "+ 사건 연결",
  nearDate,
  listTop,
}: {
  events: EventOption[];
  linked?: LinkedEventRef[];
  onPick: (event: EventOption) => Promise<void>;
  onUnlink?: (eventId: string) => Promise<void>;
  emptyHint?: React.ReactNode;
  startOpen?: boolean;
  onClose?: () => void;
  pickLabel?: string;
  // 이 날짜 언저리의 사건을 앞세운다 — 사료의 연대. 없으면 예전대로 최근 사건부터.
  nearDate?: string;
  // 펼친 사건 목록 맨 위에 서는 것. 사건을 고르다 "이건 사건 없이 그냥 연표에 세우면
  // 되겠다"고 판단하는 자리가 여기라, 그 손잡이를 목록 안에 들여놓는다(「연표에 올리기」).
  listTop?: React.ReactNode;
}) {
  const [mode, setMode] = useState<"none" | "link" | "unlink">(startOpen ? "link" : "none");
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 방금 붙인 것은 서버가 다시 그려주기 전에도 그 자리에 보여야 한다 — 눌렀는데 아무 일도
  // 일어나지 않은 것처럼 보이면 한 번 더 누르게 되고, 그러면 같은 연결을 두 번 만든다.
  const [justLinked, setJustLinked] = useState<EventOption[]>([]);
  const [justUnlinked, setJustUnlinked] = useState<string[]>([]);

  // 사료에 날짜가 있으면 그 언저리 사건을 앞세운다. 예전에는 늘 최근 사건부터였는데,
  // 1961년 기사에 붙일 사건을 고르려면 2020년대부터 예순 쪽을 넘겨야 했다 — 좁히기 칸에
  // 넣을 말이 미리 떠오르지 않으면 손쓸 방법이 없었다.
  // 날짜를 모르는 사건은 견줄 수가 없으니 뒤로 보낸다. 걸러내지는 않는다 — 사건 6천 건 중
  // 날짜가 성긴 것도 있고, 붙일 수 있는 후보에서 조용히 빼면 찾다가 없다고 여기게 된다.
  // 좁히기 칸에 말을 넣으면 그 순간부터는 사람이 고른 실마리가 앞선다(원래 순서로 돌아간다).
  const candidates = useMemo(() => {
    const q = filter.trim();
    if (q) return events.filter((e) => e.eventName.includes(q) || e.year.includes(q));
    if (!nearDate) return events;

    return [...events].sort((a, b) => {
      const ga = a.dateValue ? edtfDayGap(a.dateValue, nearDate) : null;
      const gb = b.dateValue ? edtfDayGap(b.dateValue, nearDate) : null;
      if (ga === null) return gb === null ? 0 : 1;
      if (gb === null) return -1;
      return ga - gb;
    });
  }, [events, filter, nearDate]);

  const linkedNow = linked.filter((l) => !justUnlinked.includes(l.id));
  const linkedIds = new Set(linkedNow.map((l) => l.id));
  const pendingBadges = justLinked.filter((e) => !linkedIds.has(e.id));

  function close() {
    setMode("none");
    setFilter("");
    onClose?.();
  }

  async function handlePick(id: string) {
    const event = events.find((e) => e.id === id);
    if (!event) return;
    setPending(true);
    setError(null);
    try {
      await onPick(event);
      setJustLinked((prev) => [...prev, event]);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  async function handleUnlink(eventId: string) {
    if (!onUnlink) return;
    // 숨긴 사건이라고 따로 물어보던 때가 있었다 — 붙일 수 있는 목록에 숨긴 사건이 없어서
    // 한 번 끊으면 되붙일 길이 없었기 때문이다. 이제 목록이 숨긴 사건까지 담으므로("숨김"으로
    // 적힌다) 끊는 것도 되붙이는 것도 이 화면에서 끝난다.
    setPending(true);
    setError(null);
    try {
      await onUnlink(eventId);
      setJustUnlinked((prev) => [...prev, eventId]);
      setJustLinked((prev) => prev.filter((e) => e.id !== eventId));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {(linkedNow.length > 0 || pendingBadges.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedNow.map((event) => (
            <span
              key={event.id}
              className="flex items-center gap-1 bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink"
            >
              {event.eventName}
              {/* 숨긴 사건에 붙어 있는 것도 그대로 알린다 — 붙어 있다는 사실과 그 사건이 지금
                  연표에 안 뜬다는 사실은 다른 얘기다. */}
              {event.hidden && <span className="font-normal text-grey">숨김</span>}
            </span>
          ))}
          {pendingBadges.map((event) => (
            <span
              key={event.id}
              className="bg-green-tint px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink"
            >
              ✓ {event.eventName}
            </span>
          ))}
        </div>
      )}

      {mode === "none" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("link")}
            disabled={pending}
            className="border border-ink bg-ink px-2.5 py-1 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-ink disabled:border-line disabled:bg-surface disabled:text-grey"
          >
            {pending ? "여는 중…" : pickLabel}
          </button>
          {/* 끊을 것이 없어도 자리를 지킨다 — 있을 때만 나타나면 정작 찾을 때 안 보인다 */}
          {onUnlink && (
            <button
              type="button"
              onClick={() => setMode("unlink")}
              disabled={pending || linkedNow.length === 0}
              title={linkedNow.length === 0 ? "끊을 사건 연결이 없습니다" : undefined}
              className="border border-line px-2.5 py-1 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:border-line disabled:text-line"
            >
              − 사건 연결 해제
            </button>
          )}
          {error && <span className="font-mono text-[11px] text-orange-fill">{error}</span>}
        </div>
      ) : (
        <div className="w-full max-w-[320px] border border-line bg-background p-1.5">
          <div className="flex items-center gap-1.5">
            {mode === "link" ? (
              <input
                autoFocus
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="사건 좁히기"
                className="w-full border border-line bg-background px-2 py-1 text-[12px] text-ink placeholder:text-grey focus:border-ink focus:outline-none"
              />
            ) : (
              <p className="w-full font-mono text-[11px] font-semibold text-grey">
                끊을 사건 고르기
              </p>
            )}
            <button
              type="button"
              onClick={close}
              className="shrink-0 px-1 font-mono text-[11px] text-grey hover:text-ink"
            >
              닫기
            </button>
          </div>

          {mode === "link" && listTop && (
            <div className={`mt-1.5 border-b pb-1.5 ${RECORD_LINE_CLASSNAME}`}>{listTop}</div>
          )}

          {/* 무엇이 앞에 서 있는지 적어 둔다 — 목록 순서가 바뀐 이유를 화면이 말하지 않으면
              "왜 이 사건이 먼저 뜨지"가 된다. 좁히기 칸에 말을 넣으면 이 줄도 사라진다. */}
          {mode === "link" && nearDate && !filter.trim() && (
            <p className="mt-1 px-0.5 font-mono text-[10px] text-grey">
              사료 날짜({formatEdtfToKorean(nearDate)})에 가까운 사건부터
            </p>
          )}

          {mode === "link" && events.length === 0 ? (
            <div className="px-2 py-4 text-center text-[12px] text-grey">{emptyHint}</div>
          ) : mode === "link" ? (
            <EventPage
              events={candidates}
              nearDate={filter.trim() ? undefined : nearDate}
              onChoose={handlePick}
              disabled={pending}
              emptyText="좁히기에 걸린 사건이 없습니다."
            />
          ) : (
            <EventPage
              events={linkedNow.map((l) => ({
                id: l.id,
                year: l.dateValue ? l.dateValue.slice(0, 4) : "—",
                eventName: l.eventName,
                hidden: l.hidden,
              }))}
              onChoose={handleUnlink}
              disabled={pending}
              emptyText="끊을 사건 연결이 없습니다."
            />
          )}

          {error && (
            <p className="mt-1 px-1 font-mono text-[11px] text-orange-fill">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
