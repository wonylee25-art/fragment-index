"use client";

import { useState } from "react";
import { MaterialDraft, saveMaterial } from "@/app/actions";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";

// 사료 연결의 작업대. 검색으로 걸린 자료를 저장하면서 사건에 붙인다.
// 사건은 자료마다 따로 고른다 — 화면 왼쪽에 목록 하나를 펼쳐두고 고른 사건이 모든 카드에
// 똑같이 먹던 방식은, 검색 결과 열 건을 각각 다른 사건에 붙일 수가 없었다.
// 사건을 고르면 그 자리에서 저장+연결까지 끝난다. 붙일 사건을 아직 못 정했으면 [보류]로
// 저장만 해 보류함에 쌓아둔다.

export type { EventOption };

export interface MaterialResult {
  draft: MaterialDraft;
  metaLine: string;
  badges: string[];
  saved: boolean;
}

export interface MaterialGroup {
  label: string;
  error: string | null;
  results: MaterialResult[];
}

function MaterialCard({ result, events }: { result: MaterialResult; events: EventOption[] }) {
  const { draft, metaLine, badges, saved } = result;
  // 고른 사건은 폼 제출에 실어 보내려고 hidden으로 함께 넘긴다. 고르는 즉시 제출하므로
  // 화면에 남는 상태는 아니지만, 서버 액션이 FormData로만 값을 받기 때문에 한 번은 거쳐야 한다.
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  const [eventId, setEventId] = useState("");

  return (
    <li className="border-t border-line py-4">
      <form ref={setFormEl} action={saveMaterial.bind(null, draft)} className="flex gap-4">
        {draft.imageUrl ? (
          // 외부 아카이브 이미지를 그대로 건다(재호스팅하지 않음) — next/image 설정 없이 쓰려고 <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.imageUrl}
            alt={draft.title}
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
          <p className="text-[14px] font-bold leading-snug text-ink">{draft.title}</p>
          <p className="mt-1 font-mono text-[11px] text-grey">{metaLine}</p>

          {badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="bg-surface px-1.5 py-0.5 text-[11px] font-bold text-ink"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          {draft.description && (
            <p className="mt-2 border-l-2 border-line pl-2.5 text-[12px] leading-relaxed text-grey">
              {draft.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
            {saved ? (
              <span className="font-mono text-[11px] font-semibold text-ink">✓ 저장됨</span>
            ) : (
              <>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="intent" value="link" />
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
                <button
                  type="submit"
                  name="intent"
                  value="hold"
                  className="self-end border border-line px-2.5 py-1 font-mono text-[11px] font-semibold text-grey hover:border-ink hover:text-ink"
                >
                  보류
                </button>
              </>
            )}
            {draft.sourceUrl && (
              <a
                href={draft.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                원문 ↗
              </a>
            )}
          </div>
        </div>
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
                <ul>
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
