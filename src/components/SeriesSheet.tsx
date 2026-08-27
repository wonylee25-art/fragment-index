"use client";

import { useState } from "react";
import { DescriptionCell, DescriptionGroup, OralHistoryEntry, OralHistoryCategory } from "@/lib/oral-history-projects";
import type { MarkAxis } from "@/lib/oral-marks";
import { Inline } from "@/lib/inline-markdown";
import { CELL_GLYPH, CELL_TEXT_CLASSNAME } from "@/lib/design-tokens";
import { SERIES_BOX_HEIGHT_PX, Tick } from "./SeriesLabel";

// 상자를 연 면. 닫힌 라벨이 "어느 군이 비었나"를 말했다면 이쪽은 "그 칸에 뭐라고 적혀
// 있나"다.
//
// 키는 상자와 같다 — 덧창이 상자보다 크거나 작으면 꺼내 편 것이 아니라 딴 물건이 얹힌 것처럼
// 보인다. 그 안에서 가로를 길게 쓴다: 왼쪽에 칸 이름을 세로로 세우고 오른쪽을 본문에 준다.
//
// 난간은 군을 접었다 편다. 칸이 서른이라 다 펴면 서른 줄이 서는데, 그건 기술지가 아니라
// 차림표다. 군 다섯만 세워 두고 고른 군만 칸을 펴면, 훑을 때는 다섯 줄이고 읽을 때는
// 그 군의 칸만 선다(docs/oral_description_schema.md).

type Picked = { axis: MarkAxis; groupId: string; key: string };

const POLICY_GROUP_ID = "정책";

function GroupBlock({
  group,
  axis,
  open,
  picked,
  done,
  onOpen,
  onPick,
}: {
  group: DescriptionGroup;
  axis: MarkAxis;
  open: boolean;
  picked: Picked;
  done: Set<string>;
  onOpen: () => void;
  onPick: (cell: DescriptionCell) => void;
}) {
  // 군이 접혀 있어도 어디가 비었는지는 보여야 한다 — 칸 이름 대신 글리프만 한 줄로 눕힌다.
  const filled = group.cells.filter((c) => c.state === "확인").length;
  const checked = group.cells.filter((c) => done.has(c.key)).length;

  return (
    <div className="border-b border-line/70 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className={`flex w-full items-center gap-1 px-2 py-[3px] text-left font-mono text-[9.5px] ${
          open ? "text-ink" : "text-grey hover:text-ink"
        }`}
      >
        <span aria-hidden className="w-[7px] shrink-0 text-[7px]">
          {open ? "▾" : "▸"}
        </span>
        <span className="shrink-0 font-bold tracking-[0.06em]">{group.label}</span>
        <span aria-hidden className="ml-auto flex shrink-0 gap-px">
          {group.cells.map((c) => (
            <span key={c.key} className={`text-[7px] leading-none ${CELL_TEXT_CLASSNAME[c.state]}`}>
              {CELL_GLYPH[c.state]}
            </span>
          ))}
        </span>
        <span className="w-[26px] shrink-0 text-right tabular-nums">
          {filled}/{group.cells.length}
        </span>
        <Tick on={checked === group.cells.length} />
      </button>

      {open && (
        <ul className="pb-[3px]">
          {group.cells.map((cell) => {
            const on = picked.axis === axis && picked.key === cell.key;
            return (
              <li key={cell.key}>
                <button
                  type="button"
                  onClick={() => onPick(cell)}
                  className={`grid w-full grid-cols-[10px_1fr_12px] items-center gap-x-1 py-[1.5px] pl-[18px] pr-2 text-left font-mono text-[10px] ${
                    on ? "bg-ink text-white" : "text-grey hover:bg-surface hover:text-ink"
                  }`}
                >
                  <span className={on ? "text-center text-white" : `text-center ${CELL_TEXT_CLASSNAME[cell.state]}`}>
                    {CELL_GLYPH[cell.state]}
                  </span>
                  <span className="truncate">{cell.label}</span>
                  <Tick on={done.has(cell.key)} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SeriesSheet({
  entry,
  category,
  doneDescription,
  donePolicy,
  onToggleDescription,
  onTogglePolicy,
  onClose,
}: {
  entry: OralHistoryEntry;
  category: OralHistoryCategory;
  doneDescription: Set<string>;
  donePolicy: Set<string>;
  onToggleDescription: (key: string) => void;
  onTogglePolicy: (key: string) => void;
  onClose: () => void;
}) {
  const policyGroup: DescriptionGroup = { id: POLICY_GROUP_ID, label: "활용정책", cells: entry.policyCells };
  const groups = [...entry.groups, policyGroup];
  const first = entry.groups[0];

  const [picked, setPicked] = useState<Picked>({
    axis: "overview",
    groupId: first?.id ?? "사업",
    key: first?.cells[0]?.key ?? "사업-1",
  });

  const group = groups.find((g) => g.id === picked.groupId) ?? groups[0];
  const cell = group.cells.find((c) => c.key === picked.key) ?? group.cells[0];
  const isPolicy = picked.axis === "policy";
  const done = isPolicy ? donePolicy : doneDescription;
  const toggle = isPolicy ? onTogglePolicy : onToggleDescription;
  const checked = cell ? done.has(cell.key) : false;

  const axisOf = (id: string): MarkAxis => (id === POLICY_GROUP_ID ? "policy" : "overview");

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
        {/* 세로 난간 — 군 다섯이 선다. 접힌 군도 글리프 줄로 어디가 비었는지 알린다. */}
        <div className="w-[150px] shrink-0 overflow-y-auto overscroll-contain border-r border-ink/15">
          {groups.map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              axis={axisOf(g.id)}
              open={picked.groupId === g.id}
              picked={picked}
              done={axisOf(g.id) === "policy" ? donePolicy : doneDescription}
              onOpen={() =>
                setPicked({ axis: axisOf(g.id), groupId: g.id, key: g.cells[0]?.key ?? "" })
              }
              onPick={(c) => setPicked({ axis: axisOf(g.id), groupId: g.id, key: c.key })}
            />
          ))}
        </div>

        {/* 본문 — 남은 가로를 다 쓰고, 글이 길면 여기서만 굴린다. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
            <span className="font-mono text-[9px] text-grey">{group.label}</span>
            <span className="text-[12px] font-bold text-ink">{cell?.label}</span>
            <span className="font-mono text-[9px] text-grey">{cell?.element}</span>
            <span className="border border-line px-1.5 font-mono text-[9.5px] text-grey">{cell?.state}</span>
            {/* 문서가 매기는 상태는 "확인"이고, 여기서 켜는 것은 "검토"다 — 문서가 채웠나와
                내가 읽었나는 다른 층이라 말도 갈라 둔다. */}
            <button
              type="button"
              onClick={() => cell && toggle(cell.key)}
              aria-pressed={checked}
              className={`ml-auto flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] ${
                checked ? "border-ink text-ink" : "border-line text-grey hover:border-ink hover:text-ink"
              }`}
            >
              <Tick on={checked} />
              {checked ? "검토함" : "검토"}
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
