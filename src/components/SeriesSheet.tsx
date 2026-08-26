"use client";

import { useState } from "react";
import { DescriptionCell, OralHistoryEntry, OralHistoryCategory } from "@/lib/oral-history-projects";
import { Inline } from "@/lib/inline-markdown";
import { CELL_GLYPH, CELL_TEXT_CLASSNAME } from "@/lib/design-tokens";
import { SERIES_BOX_HEIGHT_PX, Tick } from "./SeriesLabel";

// 상자를 연 면. 닫힌 라벨이 "몇 칸 찼나"를 말했다면 이쪽은 "그 칸에 뭐라고 적혀 있나"다.
//
// 키는 상자와 같다 — 덧창이 상자보다 크거나 작으면 꺼내 편 것이 아니라 딴 물건이 얹힌 것처럼
// 보인다. 그 안에서 가로를 길게 쓴다: 왼쪽에 칸 이름을 세로로 세우고 오른쪽을 본문에 준다.
//
// 축 탭(사업 개요 / 활용정책)을 걷었다. 그건 칸 열다섯을 한 번에 못 펴서 둔 장치였는데,
// 세로 난간에는 열다섯이 다 들어간다 — 탭을 눌러 축을 오갈 일 없이 한눈에 보이고,
// 본문에 줄 자리가 그만큼 늘어난다.

const OVERVIEW_ELEMENT: Record<string, string> = {
  언제: "3.1.3",
  어디서: "3.2.1",
  누구를: "3.3.1",
  무엇을: "3.3.1",
  왜: "3.2.2",
  어떻게: "3.3.4",
};

// 아홉 칸이 전부 3.4는 아니다 — 동의서는 수집의 직접적 출처, 철회·삭제는 평가·폐기다.
const POLICY_ELEMENT: Record<string, string> = {
  "1": "3.2.4",
  "2": "3.4.2",
  "3": "3.4.1",
  "4": "3.4.1",
  "5": "3.4.2",
  "6": "3.6.1",
  "7": "3.4.1",
  "8": "3.3.2",
  "9": "3.4.2",
};

type Picked = { axis: "overview" | "policy"; key: string };

function RailGroup({
  title,
  cells,
  axis,
  picked,
  done,
  onPick,
}: {
  title: string;
  cells: DescriptionCell[];
  axis: "overview" | "policy";
  picked: Picked;
  done: Set<string>;
  onPick: (p: Picked) => void;
}) {
  return (
    <>
      <p className="px-2 pb-px pt-1 font-mono text-[8px] tracking-[0.12em] text-grey">{title}</p>
      {cells.map((c) => {
        const on = picked.axis === axis && picked.key === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick({ axis, key: c.key })}
            className={`grid w-full grid-cols-[10px_1fr_12px] items-center gap-x-1 px-2 py-[1.5px] text-left font-mono text-[10px] ${
              on ? "bg-ink text-white" : "text-grey hover:bg-surface hover:text-ink"
            }`}
          >
            <span className={on ? "text-center text-white" : `text-center ${CELL_TEXT_CLASSNAME[c.state]}`}>
              {CELL_GLYPH[c.state]}
            </span>
            <span className="truncate">{c.label}</span>
            <Tick on={done.has(c.key)} />
          </button>
        );
      })}
    </>
  );
}

export function SeriesSheet({
  entry,
  category,
  doneOverview,
  donePolicy,
  onToggleOverview,
  onTogglePolicy,
  onClose,
}: {
  entry: OralHistoryEntry;
  category: OralHistoryCategory;
  doneOverview: Set<string>;
  donePolicy: Set<string>;
  onToggleOverview: (key: string) => void;
  onTogglePolicy: (key: string) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Picked>({ axis: "overview", key: entry.overviewCells[0]?.key ?? "언제" });

  const cells = picked.axis === "overview" ? entry.overviewCells : entry.policyCells;
  const cell = cells.find((c) => c.key === picked.key) ?? cells[0];
  const done = picked.axis === "overview" ? doneOverview : donePolicy;
  const toggle = picked.axis === "overview" ? onToggleOverview : onTogglePolicy;
  const element = (picked.axis === "overview" ? OVERVIEW_ELEMENT : POLICY_ELEMENT)[cell?.key ?? ""] ?? "";

  return (
    <div className="flex flex-col border border-ink bg-background" style={{ height: SERIES_BOX_HEIGHT_PX }}>
      {/* 머리는 한 줄로 눌러 둔다 — 기관명·사업명은 어느 상자를 열었는지 알리는 만큼만 있으면
          되고, 자리는 본문이 가져간다. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-ink px-2.5 py-1">
        <span className="shrink-0 font-mono text-[9.5px] font-bold tracking-[0.04em] text-ink">
          {entry.referenceCode}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-grey">
          {category.label}. {category.title}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">
          <b className="font-bold">{entry.institution}</b>
          <span className="text-grey"> · {entry.projectName}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 px-1 font-mono text-[11px] text-grey hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 세로 난간 — 열다섯 칸이 한눈에 선다. 칸 이름 앞 글리프가 읽기 전에 어디가 비었는지
            알리고, 뒤의 획이 내가 끝낸 칸을 알린다. */}
        <div className="w-[118px] shrink-0 overflow-y-auto overscroll-contain border-r border-ink/15 py-0.5">
          <RailGroup
            title="사업 개요"
            cells={entry.overviewCells}
            axis="overview"
            picked={picked}
            done={doneOverview}
            onPick={setPicked}
          />
          <RailGroup
            title="활용정책"
            cells={entry.policyCells}
            axis="policy"
            picked={picked}
            done={donePolicy}
            onPick={setPicked}
          />
        </div>

        {/* 본문 — 남은 가로를 다 쓰고, 글이 길면 여기서만 굴린다. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
            <span className="text-[12px] font-bold text-ink">{cell?.label}</span>
            <span className="font-mono text-[9px] text-grey">{element}</span>
            <span className="border border-line px-1.5 font-mono text-[9.5px] text-grey">{cell?.state}</span>
            <button
              type="button"
              onClick={() => cell && toggle(cell.key)}
              aria-pressed={cell ? done.has(cell.key) : false}
              className="ml-auto flex items-center gap-1.5 border border-line px-2 py-0.5 font-mono text-[10px] text-grey hover:border-ink hover:text-ink"
            >
              <Tick on={cell ? done.has(cell.key) : false} />
              {cell && done.has(cell.key) ? "더 볼 일 없음" : "표시하기"}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5">
            <div className="text-[13px] leading-[1.75] text-ink">
              {cell?.value ? <Inline text={cell.value} /> : <span className="text-grey">아직 조사하지 않은 칸이다.</span>}
            </div>
            {entry.sources && (
              <p className="mt-3 border-t border-line pt-2 font-mono text-[10.5px] leading-relaxed text-grey">
                출처 — <Inline text={entry.sources} />
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
