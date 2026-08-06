"use client";

import { useState } from "react";
import { Inline } from "@/lib/inline-markdown";
import {
  ConfirmationLevel,
  OralHistoryCategory,
  OralHistoryDoc,
  OralHistoryEntry,
} from "@/lib/oral-history-projects";

// 발주기관·사업명·연도·구술 대상만 압축해서 보여주는 마인드맵형 다이어그램.
// 카테고리(1~7)마다 캔버스 위에 고정된 "허브" 지점을 두고, 그 주변에 나선형으로
// 노드를 흩뿌려 배치한다(연도축 정렬은 포기 — 자유로운 배치가 목적). 허브↔노드는
// 곡선으로 이어 가지처럼 보이게 한다. 자세한 5W1H는 노드를 클릭하면 아래 상세
// 패널에 펼쳐진다.

const NODE_WIDTH = 146;
const NODE_HEIGHT = 62;
const NODE_PAD = 16; // 노드끼리 최소 여백
const CANVAS_WIDTH = 1760;
const CANVAS_HEIGHT = 1180;

// 카테고리별 허브 좌표(캔버스 비율) — 손으로 흩어 놓은 배치. 카테고리가 늘어나면
// (8번 이상) 여기에 좌표를 하나 추가해야 한다.
const HUBS: Record<number, { x: number; y: number }> = {
  1: { x: 0.3, y: 0.46 },
  2: { x: 0.13, y: 0.16 },
  3: { x: 0.62, y: 0.12 },
  4: { x: 0.85, y: 0.4 },
  5: { x: 0.1, y: 0.78 },
  6: { x: 0.46, y: 0.88 },
  7: { x: 0.83, y: 0.82 },
};

const CATEGORY_STYLE: Record<
  number,
  { bg: string; text: string; border: string; dot: string; stroke: string }
> = {
  1: { bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-300", dot: "bg-zinc-400", stroke: "#a1a1aa" },
  2: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-400", stroke: "#c4b5fd" },
  3: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-400", stroke: "#fda4af" },
  4: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400", stroke: "#fcd34d" },
  5: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-400", stroke: "#93c5fd" },
  6: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-400", stroke: "#fdba74" },
  7: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400", stroke: "#6ee7b7" },
};

const LEVEL_DOT_CLASSNAME: Record<ConfirmationLevel, string> = {
  "●●●": "text-emerald-600",
  "●●○": "text-blue-500",
  "●○○": "text-zinc-400",
};

interface PlacedNode {
  entry: OralHistoryEntry;
  categoryNumber: number;
  key: string;
  x: number; // 중심 좌표
  y: number;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function entryKey(categoryNumber: number, entry: OralHistoryEntry, index: number): string {
  return `${categoryNumber}-${index}-${entry.institution}`;
}

function matchesFilter(entry: OralHistoryEntry, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return [entry.institution, entry.projectName, entry.who ?? ""].some((s) => s.includes(q));
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function rectOf(x: number, y: number): Rect {
  return {
    left: x - NODE_WIDTH / 2 - NODE_PAD,
    right: x + NODE_WIDTH / 2 + NODE_PAD,
    top: y - NODE_HEIGHT / 2 - NODE_PAD,
    bottom: y + NODE_HEIGHT / 2 + NODE_PAD,
  };
}

// 허브를 중심으로 나선(스파이럴)을 그리며 겹치지 않는 첫 자리를 찾는다 — 워드클라우드에
// 흔히 쓰이는 방식. seedAngle을 카테고리·순번마다 다르게 줘서 매번 같은 방향으로만
// 뻗지 않게 한다. 결정론적이라(랜덤 없음) 검색·필터로 다시 렌더링돼도 자리가 안 흔들린다.
function placeOnSpiral(hub: { x: number; y: number }, seedAngle: number, placed: Rect[]): { x: number; y: number } {
  const angleStep = 0.62;
  const radiusStep = 5.5;
  let angle = seedAngle;
  let radius = 0;

  for (let attempt = 0; attempt < 600; attempt++) {
    const x = hub.x + radius * Math.cos(angle);
    const y = hub.y + radius * Math.sin(angle) * 0.72; // 캔버스가 가로로 넓으니 세로는 살짝 눌러서
    const clampedX = Math.min(Math.max(x, NODE_WIDTH / 2 + 4), CANVAS_WIDTH - NODE_WIDTH / 2 - 4);
    const clampedY = Math.min(Math.max(y, NODE_HEIGHT / 2 + 4), CANVAS_HEIGHT - NODE_HEIGHT / 2 - 4);
    const rect = rectOf(clampedX, clampedY);
    if (!placed.some((p) => overlaps(rect, p))) return { x: clampedX, y: clampedY };
    angle += angleStep;
    radius += radiusStep * (angleStep / (Math.PI * 2)) * 6;
  }
  return { x: hub.x, y: hub.y };
}

function curvePath(x1: number, y1: number, x2: number, y2: number, flip: boolean): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(len * 0.22, 70) * (flip ? -1 : 1);
  const nx = (-dy / len) * bend;
  const ny = (dx / len) * bend;
  return `M ${x1} ${y1} Q ${mx + nx} ${my + ny} ${x2} ${y2}`;
}

export function OralHistoryDiagram({ doc }: { doc: OralHistoryDoc }) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // 카테고리·연도 37건 규모의 가벼운 계산이라 React Compiler의 자동 메모이제이션에
  // 맡긴다(수동 useMemo로 감싸면 컴파일러가 최적화를 건너뛰는 경우가 있어 여기선 뺐다).
  const placedRects: Rect[] = [];
  const nodes: PlacedNode[] = [];

  doc.categories.forEach((category) => {
    const hub = {
      x: (HUBS[category.number]?.x ?? 0.5) * CANVAS_WIDTH,
      y: (HUBS[category.number]?.y ?? 0.5) * CANVAS_HEIGHT,
    };
    placedRects.push(rectOf(hub.x, hub.y)); // 허브 자리 자체도 겹침 후보에서 비켜가게

    const sorted = [...category.entries].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    sorted.forEach((entry, i) => {
      const seedAngle = category.number * 0.9 + i * 2.4;
      const { x, y } = placeOnSpiral(hub, seedAngle, placedRects);
      const rect = rectOf(x, y);
      placedRects.push(rect);
      nodes.push({
        entry,
        categoryNumber: category.number,
        key: entryKey(category.number, entry, i),
        x,
        y,
      });
    });
  });

  let selected: { category: OralHistoryCategory; entry: OralHistoryEntry } | null = null;
  for (const node of nodes) {
    if (node.key === selectedKey) {
      const category = doc.categories.find((c) => c.number === node.categoryNumber)!;
      selected = { category, entry: node.entry };
      break;
    }
  }

  return (
    <div>
      {/* 소개문 */}
      <section className="mb-5">
        {doc.introParagraphs.slice(0, 2).map((p, i) => (
          <p key={i} className="mb-2 text-[13px] leading-6 text-zinc-600">
            <Inline text={p} />
          </p>
        ))}
      </section>

      {/* 범례 + 검색 */}
      <section className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-zinc-500">
          <span className="text-zinc-400">확인 수준 —</span>
          {doc.levelLegend.map((l) => (
            <span key={l.level} title={l.description} className="flex items-center gap-1">
              <span className={LEVEL_DOT_CLASSNAME[l.level]}>{l.level}</span>
              {l.label}
            </span>
          ))}
          <span className="h-3 w-px bg-zinc-200" />
          <span className="text-zinc-400">
            카테고리 {doc.categories.length}개 · 사업 {doc.totalEntries}건
          </span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="기관·사업명·구술 대상 검색"
          className="w-56 rounded-sm border border-zinc-300 bg-white px-2.5 py-1 font-mono text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-orange-400 focus:outline-none"
        />
      </section>

      {/* 카테고리 색 범례 */}
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-500">
        {doc.categories.map((c) => (
          <span key={c.number} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_STYLE[c.number]?.dot ?? "bg-zinc-400"}`} />
            {c.number}. {c.title} ({c.entries.length})
          </span>
        ))}
      </div>

      {/* 마인드맵 캔버스 */}
      <div className="overflow-auto rounded-sm border border-zinc-200 bg-[radial-gradient(circle,_#f4f4f5_1px,_transparent_1px)] bg-[length:18px_18px]">
        <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          <svg
            className="absolute inset-0"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          >
            {nodes.map((n, i) => {
              const hub = {
                x: (HUBS[n.categoryNumber]?.x ?? 0.5) * CANVAS_WIDTH,
                y: (HUBS[n.categoryNumber]?.y ?? 0.5) * CANVAS_HEIGHT,
              };
              const dimmed = !matchesFilter(n.entry, query);
              return (
                <path
                  key={n.key}
                  d={curvePath(hub.x, hub.y, n.x, n.y, i % 2 === 0)}
                  fill="none"
                  stroke={CATEGORY_STYLE[n.categoryNumber]?.stroke ?? "#d4d4d8"}
                  strokeWidth={selectedKey === n.key ? 2 : 1.3}
                  opacity={dimmed ? 0.15 : selectedKey === n.key ? 0.9 : 0.55}
                />
              );
            })}
          </svg>

          {doc.categories.map((c) => {
            const hub = { x: (HUBS[c.number]?.x ?? 0.5) * CANVAS_WIDTH, y: (HUBS[c.number]?.y ?? 0.5) * CANVAS_HEIGHT };
            const style = CATEGORY_STYLE[c.number] ?? CATEGORY_STYLE[1];
            return (
              <div
                key={c.number}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold shadow-sm ${style.bg} ${style.text} ${style.border}`}
                style={{ left: hub.x, top: hub.y }}
              >
                {c.number}. {c.title}
              </div>
            );
          })}

          {nodes.map((n) => (
            <NodeCard
              key={n.key}
              entry={n.entry}
              x={n.x}
              y={n.y}
              dimmed={!matchesFilter(n.entry, query)}
              active={selectedKey === n.key}
              onClick={() => setSelectedKey(n.key)}
            />
          ))}
        </div>
      </div>

      {/* 상세 패널 */}
      {selected && (
        <DetailPanel category={selected.category} entry={selected.entry} onClose={() => setSelectedKey(null)} />
      )}

      {/* 8. 확인 필요 목록 */}
      {doc.unresolvedSubsections.length > 0 && (
        <details className="mt-8 rounded-sm border border-zinc-200 p-3">
          <summary className="cursor-pointer font-mono text-xs text-zinc-500">
            {doc.unresolvedTitle} — 존재는 확인했지만 5W1H를 못 채운 기관 목록 펼치기
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {doc.unresolvedSubsections.map((sub) => (
              <div key={sub.id}>
                <h4 className="mb-1 font-mono text-[11px] font-bold text-zinc-500">
                  {sub.id}. {sub.title}
                </h4>
                <ul className="space-y-1">
                  {sub.items.map((item, i) => (
                    <li key={i} className="text-[12px] leading-5 text-zinc-600">
                      {item.isBullet && <span className="mr-1 text-zinc-300">·</span>}
                      <Inline text={item.text} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 다음으로 고려할 것 */}
      {doc.planGroups.length > 0 && (
        <details className="mt-3 rounded-sm border border-zinc-200 p-3">
          <summary className="cursor-pointer font-mono text-xs text-zinc-500">{doc.planTitle} 펼치기</summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {doc.planGroups.map((g) => (
              <div key={g.title}>
                <h4 className="mb-1 font-mono text-[11px] font-bold text-zinc-500">{g.title}</h4>
                <ol className="list-decimal space-y-1 pl-4">
                  {g.items.map((item, i) => (
                    <li key={i} className="text-[12px] leading-5 text-zinc-600">
                      <Inline text={item} />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function NodeCard({
  entry,
  x,
  y,
  dimmed,
  active,
  onClick,
}: {
  entry: OralHistoryEntry;
  x: number;
  y: number;
  dimmed: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.institution} — ${entry.projectName}`}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border bg-white px-2 py-1.5 text-left shadow-sm transition-all hover:z-20 hover:shadow-md ${
        active ? "z-20 border-orange-400 ring-1 ring-orange-300" : "border-zinc-200"
      } ${dimmed ? "opacity-20" : ""} ${entry.yearApprox ? "border-dashed" : ""}`}
      style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      <div className="flex items-center gap-1 font-mono text-[9px] text-zinc-400">
        <span className={LEVEL_DOT_CLASSNAME[entry.confirmationLevel]}>{entry.confirmationLevel}</span>
        <span>
          {entry.year ?? "미상"}
          {entry.yearApprox && entry.year !== null ? "경" : ""}
        </span>
      </div>
      <p className="truncate text-[11px] font-semibold leading-4 text-zinc-900">{entry.institution}</p>
      <p className="truncate text-[10px] leading-4 text-zinc-500">{entry.projectName || " "}</p>
      <p className="truncate text-[9px] leading-4 text-zinc-400">{entry.who ?? " "}</p>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[56px_1fr] gap-2 py-1 text-[12px] leading-5">
      <dt className="font-mono text-[10px] text-zinc-400">{label}</dt>
      <dd className="text-zinc-700">
        <Inline text={value} />
      </dd>
    </div>
  );
}

function DetailPanel({
  category,
  entry,
  onClose,
}: {
  category: OralHistoryCategory;
  entry: OralHistoryEntry;
  onClose: () => void;
}) {
  const style = CATEGORY_STYLE[category.number] ?? CATEGORY_STYLE[1];
  return (
    <div className="mt-3 rounded-sm border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${style.bg} ${style.text}`}
          >
            {category.number}. {category.title}
          </span>
          <h3 className="mt-1.5 text-[16px] font-semibold text-zinc-900">
            {entry.institution}
            {entry.projectName && <span className="text-zinc-500"> — {entry.projectName}</span>}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
            <span className={LEVEL_DOT_CLASSNAME[entry.confirmationLevel]}>{entry.confirmationLevel}</span>{" "}
            {entry.confirmationNote && <Inline text={entry.confirmationNote} />}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-sm bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-500 hover:bg-zinc-200"
        >
          닫기 ×
        </button>
      </div>

      <dl>
        <Row label="언제" value={entry.when} />
        {entry.whenSubItems.length > 0 && (
          <ul className="ml-[64px] mb-1 list-disc space-y-0.5 pl-4">
            {entry.whenSubItems.map((s, i) => (
              <li key={i} className="text-[12px] leading-5 text-zinc-600">
                <Inline text={s} />
              </li>
            ))}
          </ul>
        )}
        <Row label="어디서" value={entry.where} />
        <Row label="누구를" value={entry.who} />
        <Row label="무엇을" value={entry.what} />
        <Row label="왜" value={entry.why} />
        <Row label="어떻게" value={entry.how} />
      </dl>

      {entry.notes.map((note, i) => (
        <div key={i} className="mt-2 rounded-sm bg-amber-50 p-2 text-[12px] leading-5 text-amber-900">
          <strong className="font-semibold">{note.label}</strong>: <Inline text={note.value} />
        </div>
      ))}

      {entry.sources && (
        <p className="mt-2 border-t border-zinc-200 pt-2 font-mono text-[11px] text-zinc-400">
          <Inline text={entry.sources} />
        </p>
      )}
    </div>
  );
}
