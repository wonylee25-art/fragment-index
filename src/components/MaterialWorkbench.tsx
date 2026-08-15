"use client";

import { useState } from "react";
import { MaterialDraft, saveMaterial } from "@/app/actions";
import { EventOption, EventPicker } from "./EventPicker";

// 검토함의 작업대. 왼쪽에 연결 대상 사건 목록을 펼쳐두고(드롭다운 없이 항상 보이게),
// 오른쪽 사료 카드에서 버튼 한 번으로 저장+연결한다.
// 사건을 고르면 카드 버튼이 "1931 청계천 상류 복개에 연결"처럼 대상을 이름으로 보여줘서,
// 자료마다 목록을 다시 띄울 필요가 없다.

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

function MaterialCard({
  result,
  selected,
}: {
  result: MaterialResult;
  selected: EventOption | null;
}) {
  const { draft, metaLine, badges, saved } = result;

  return (
    <li className="border-t border-line py-4">
      <form action={saveMaterial.bind(null, draft)} className="flex gap-4">
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
          <div className="flex h-[118px] w-24 shrink-0 items-center justify-center border border-dashed border-line bg-surface text-center font-mono text-[10px] leading-relaxed text-muted-2">
            이미지
            <br />
            없음
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug text-foreground">{draft.title}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-2">{metaLine}</p>

          {badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="bg-flag-marked-soft px-1.5 py-0.5 text-[11px] font-bold text-flag-marked"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          {draft.description && (
            <p className="mt-2 border-l-2 border-line-strong pl-2.5 text-[12px] leading-relaxed text-muted">
              {draft.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {saved ? (
              <span className="font-mono text-[11px] font-semibold text-flag-marked">✓ 저장됨</span>
            ) : (
              <>
                {/* 선택된 사건은 화면 상태라, 폼 제출에 실어 보내려고 hidden으로 함께 넘긴다 */}
                <input type="hidden" name="eventId" value={selected?.id ?? ""} />
                <button
                  type="submit"
                  name="intent"
                  value="link"
                  disabled={!selected}
                  className="border border-foreground bg-foreground px-2.5 py-1 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-foreground disabled:border-line disabled:bg-surface disabled:text-muted-2"
                >
                  {selected
                    ? `${selected.year} ${selected.eventName}에 연결`
                    : "왼쪽에서 사건을 고르세요"}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="hold"
                  className="border border-line-strong px-2.5 py-1 font-mono text-[11px] font-semibold text-muted hover:border-foreground hover:text-foreground"
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
                className="font-mono text-[11px] text-muted-2 underline decoration-dotted underline-offset-4 hover:text-foreground"
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
  // 처음부터 하나 골라두면 "고르지 않고 눌렀다"는 사고가 나기 쉬워, 선택은 비워둔 채 시작한다.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const total = groups.reduce((sum, g) => sum + g.results.length, 0);

  return (
    <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
      <EventPicker
        events={events}
        selectedId={selectedId}
        onSelect={setSelectedId}
        emptyHint={
          <>
            <p className="text-[12px] leading-relaxed text-muted-2">
              이 검색어로 걸린 사건이 없습니다.
            </p>
            <a
              href="/admin/timeline"
              className="mt-2 inline-block font-mono text-[11px] font-semibold text-foreground underline decoration-dotted underline-offset-4"
            >
              연표 관리에서 사건 만들기 →
            </a>
          </>
        }
      />

      <div>
        <p className="mb-2 font-mono text-[11px] font-semibold text-muted-2">사료 {total}</p>

        <div className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.label}>
              <p className="font-mono text-[11px] font-semibold text-muted-2">
                {group.label} — {group.results.length}건
              </p>
              {group.error && (
                <p className="mt-1 text-xs text-flag-attention">오류: {group.error}</p>
              )}
              {!group.error && group.results.length === 0 ? (
                <p className="mt-2 border-t border-line pt-3 text-[13px] text-muted-2">결과 없음</p>
              ) : (
                <ul>
                  {group.results.map((result, i) => (
                    <MaterialCard
                      key={`${result.draft.id}-${i}`}
                      result={result}
                      selected={selected}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
