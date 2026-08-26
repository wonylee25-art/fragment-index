"use client";

import { useState } from "react";
import { DescriptionCell, OralHistoryEntry, OralHistoryCategory } from "@/lib/oral-history-projects";
import { Inline } from "@/lib/inline-markdown";
import { CELL_GLYPH, CELL_TEXT_CLASSNAME, TEXT_BODY_CLASSNAME } from "@/lib/design-tokens";
import { Tick } from "./SeriesLabel";

// 상자를 연 면. 닫힌 라벨이 "몇 칸 찼나"를 말했다면 이쪽은 "그 칸에 뭐라고 적혀 있나"다.
// 축이 둘이라 탭도 둘이다 — 사업 개요(ISAD 3.2~3.3)와 활용정책(3.4)은 성격이 달라서
// 한 면에 겹쳐 놓으면 서로를 가린다.

// 각 칸이 ISAD(G)의 어느 요소인지. 값에 요소 번호를 붙여 두면 나중에 EAD나 다른 목록으로
// 내보낼 때 옮길 자리를 다시 찾지 않아도 된다.
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

function CellPanel({
  cells,
  elements,
  done,
  onToggle,
}: {
  cells: DescriptionCell[];
  elements: Record<string, string>;
  done: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [picked, setPicked] = useState(cells[0]?.key ?? "");
  const cell = cells.find((c) => c.key === picked) ?? cells[0];
  if (!cell) return null;

  return (
    <div>
      {/* 칸 고르기. 이름 앞의 글리프가 읽기 전에 어디가 비었는지 알린다. */}
      <div className="flex flex-wrap border-b border-line bg-surface">
        {cells.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setPicked(c.key)}
            className={`flex items-center gap-1 border-r border-line px-2.5 py-1.5 font-mono text-[10px] ${
              c.key === cell.key ? "bg-background font-bold text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-grey"
            }`}
          >
            <span className={CELL_TEXT_CLASSNAME[c.state]}>{CELL_GLYPH[c.state]}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-3.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-bold text-ink">{cell.label}</span>
          <span className="font-mono text-[9px] text-grey">{elements[cell.key]}</span>
          <span className="border border-line px-1.5 py-px font-mono text-[9.5px] text-grey">{cell.state}</span>
          {/* 내가 켜는 자리 — "여기는 더 볼 일 없다". 문서에 없던 정보라 문서와 겹치지 않는다. */}
          <button
            type="button"
            onClick={() => onToggle(cell.key)}
            aria-pressed={done.has(cell.key)}
            className="ml-auto flex items-center gap-1.5 border border-line px-2 py-0.5 font-mono text-[10px] text-grey hover:border-ink hover:text-ink"
          >
            <Tick on={done.has(cell.key)} />
            {done.has(cell.key) ? "더 볼 일 없음" : "표시하기"}
          </button>
        </p>
        <div className={`mt-2 max-w-[70ch] ${TEXT_BODY_CLASSNAME} leading-7 text-ink`}>
          {cell.value ? <Inline text={cell.value} /> : <span className="text-grey">아직 조사하지 않은 칸이다.</span>}
        </div>
      </div>
    </div>
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
  const [axis, setAxis] = useState<"overview" | "policy">("overview");

  return (
    <div className="w-full border border-ink bg-background">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[9.5px] font-bold tracking-[0.14em] text-grey">
            {entry.referenceCode} · 계열 · {category.label}. {category.title}
          </p>
          <h3 className="mt-1 font-serif text-[19px] font-bold leading-tight text-ink">{entry.institution}</h3>
          <p className="mt-0.5 text-[12px] text-grey">{entry.projectName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 border border-line px-2 py-1 font-mono text-[11px] text-grey hover:border-ink hover:text-ink"
        >
          닫기 ✕
        </button>
      </div>

      <div className="flex border-b border-ink">
        {(
          [
            ["overview", "사업 개요", "3.2~3.3 배경 · 내용과 구조"],
            ["policy", "활용정책", "3.4 접근과 이용조건"],
          ] as const
        ).map(([key, name, area]) => (
          <button
            key={key}
            type="button"
            onClick={() => setAxis(key)}
            className={`border-r border-line px-4 py-2 text-left text-[12.5px] font-bold ${
              axis === key ? "bg-ink text-white" : "bg-surface text-grey"
            }`}
          >
            {name}
            <span className="block font-mono text-[8.5px] font-normal tracking-[0.04em]">{area}</span>
          </button>
        ))}
      </div>

      {axis === "overview" ? (
        <CellPanel
          cells={entry.overviewCells}
          elements={OVERVIEW_ELEMENT}
          done={doneOverview}
          onToggle={onToggleOverview}
        />
      ) : (
        <CellPanel cells={entry.policyCells} elements={POLICY_ELEMENT} done={donePolicy} onToggle={onTogglePolicy} />
      )}

      {entry.sources && (
        <p className="border-t border-line px-4 py-2 font-mono text-[11px] text-grey">
          출처 — <Inline text={entry.sources} />
        </p>
      )}
    </div>
  );
}
