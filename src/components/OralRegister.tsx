"use client";

import { useState } from "react";
import { OralHistoryCategory, OralHistoryEntry } from "@/lib/oral-history-projects";
import { CELL_GLYPH, CELL_TEXT_CLASSNAME, TOGGLE_BUTTON_CLASSNAME, TOGGLE_ON_CLASSNAME, TOGGLE_OFF_CLASSNAME } from "@/lib/design-tokens";

// 기록물 대장. 서가는 하나를 고르는 자리라 상자마다 제 라벨을 들고 서 있고, 같은 칸이
// 세로로 서지 않는다. "누가 열람절차를 확인했나"처럼 한 요소를 여러 계열에 걸쳐 훑으려면
// 눕힌 표가 따로 있어야 한다.
//
// 서가와 단추로 갈아 끼우지 않고 화면 맨 아래에 쌓는 것은, 갈아 끼우면 둘 중 하나가 늘
// 숨어서 "지금 어느 보기인가"를 기억해야 하기 때문이다.
//
// 카드는 닫힌 상자지만 대장은 열린 줄이다 — 좌우 테두리가 없고 아랫줄과 선을 나눠 쓴다.

type Axis = "overview" | "policy";

export function OralRegister({
  categories,
  matches,
  onPick,
}: {
  categories: OralHistoryCategory[];
  matches: (entry: OralHistoryEntry) => boolean;
  onPick: (categoryLabel: string, entry: OralHistoryEntry) => void;
}) {
  const [axis, setAxis] = useState<Axis>("overview");
  const rows = categories.flatMap((c) => c.entries.map((e) => ({ category: c, entry: e })));
  const heads = axis === "overview" ? rows[0]?.entry.overviewCells : rows[0]?.entry.policyCells;
  const marksWidth = axis === "overview" ? "240px" : "330px";

  return (
    <section className="mt-10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-[11px] tracking-[0.14em] text-grey">기록물 대장</h2>
        <div className="ml-2 flex items-center gap-1 font-mono text-[11px]">
          {(
            [
              ["overview", "사업 개요 6칸"],
              ["policy", "활용정책 9칸"],
            ] as const
          ).map(([key, name]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAxis(key)}
              className={`${TOGGLE_BUTTON_CLASSNAME} ${axis === key ? TOGGLE_ON_CLASSNAME : TOGGLE_OFF_CLASSNAME}`}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="ml-auto font-mono text-[9.5px] text-grey">
          ● 확인 ◐ 일부 ╱ 봤으나 못 찾음 · 아직 안 봄
        </p>
      </div>

      <div className="overflow-x-auto border-y border-ink bg-background">
        <div
          className="grid min-w-[640px] items-stretch border-b border-ink bg-surface"
          style={{ gridTemplateColumns: `112px minmax(200px,1fr) ${marksWidth}` }}
        >
          <p className="flex items-center border-r border-ink/15 px-2 font-mono text-[9.5px] tracking-[0.08em] text-grey">
            참조코드
          </p>
          <p className="flex items-center border-r border-ink/15 px-2.5 font-mono text-[9.5px] tracking-[0.08em] text-grey">
            생산자 · 제목
          </p>
          <div className="grid" style={{ gridAutoFlow: "column", gridAutoColumns: "1fr" }}>
            {heads?.map((c) => (
              <span
                key={c.key}
                className="flex items-center justify-center break-keep border-r border-ink/10 px-0.5 text-center font-mono text-[8.5px] leading-tight text-grey last:border-r-0"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {rows.map(({ category, entry }) => {
          const cells = axis === "overview" ? entry.overviewCells : entry.policyCells;
          return (
            <button
              key={entry.referenceCode}
              type="button"
              onClick={() => onPick(category.label, entry)}
              className={`grid min-w-[640px] w-full items-stretch border-b border-line text-left last:border-b-0 hover:bg-surface ${
                matches(entry) ? "" : "opacity-25"
              }`}
              style={{ gridTemplateColumns: `112px minmax(200px,1fr) ${marksWidth}` }}
            >
              <span className="flex items-center border-r border-ink/15 px-2 font-mono text-[9.5px] font-bold text-grey">
                {entry.referenceCode}
              </span>
              <span className="min-w-0 border-r border-ink/15 px-2.5 py-2">
                <span className="block truncate text-[12.5px] font-bold tracking-tight text-ink">
                  {entry.institution}
                </span>
                <span className="block truncate text-[11px] leading-4 text-grey">
                  {entry.projectName}
                  <span className="ml-1 font-mono text-[9.5px]">{entry.year ?? "미상"}</span>
                </span>
              </span>
              <span className="grid" style={{ gridAutoFlow: "column", gridAutoColumns: "1fr" }}>
                {cells.map((c) => (
                  <span
                    key={c.key}
                    title={`${c.label} — ${c.state}`}
                    className={`flex items-center justify-center border-r border-ink/10 text-[10px] last:border-r-0 ${CELL_TEXT_CLASSNAME[c.state]}`}
                  >
                    {CELL_GLYPH[c.state]}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
