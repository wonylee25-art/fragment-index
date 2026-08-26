"use client";

import { useState } from "react";
import { INPUT_CLASSNAME, TEXT_DENSE_CLASSNAME } from "@/lib/design-tokens";
import { Inline } from "@/lib/inline-markdown";
import { OralHistoryDoc, OralHistoryEntry } from "@/lib/oral-history-projects";
import type { CellMark, MarkAxis } from "@/lib/oral-marks";
import { setCellMark } from "@/lib/oral-mark-actions";
import { SeriesBox } from "./SeriesBox";
import { SeriesLabel } from "./SeriesLabel";
import { SeriesSheet } from "./SeriesSheet";
import { OralRegister } from "./OralRegister";

// 구술 사업 목록. 예전에는 사료 카드와 같은 크기·같은 테두리의 상자를 격자로 늘어놓았는데,
// 층위가 달라서 어긋났다 — 사료는 낱장 하나(건)이고 사업은 한 벌(계열)이다. 그래서 카드가
// 아니라 서가에 얹힌 상자로 세운다.
//
// 격자가 아니라 선반인 것도 뜻이 있다. 격자는 칸이 균등한 배열이지만 선반은 얹혀 있음이라,
// 그것만으로 이미 "카드를 늘어놓은 판"이 아니게 된다. 갈래마다 선반 하나를 준다.
//
// 상자를 누르면 기술지가 그 위로 덧창처럼 열린다(SeriesBox). 줄 안에 끼워 넣으면 선반이
// 밀려서, 상자가 열 개인 갈래에서는 첫 줄을 눌러도 기술지가 화면 밖에서 열렸다.
//
// 화면은 두 층이다 — 위의 서가는 하나를 고르는 자리(라벨 한 장이 그 사업의 전부를 말한다),
// 아래의 대장은 여럿을 견주는 자리(한 칸이 52건에 걸쳐 한 열로 선다). 단추로 갈아 끼우지
// 않고 세로로 쌓는 것은, 갈아 끼우면 둘 중 하나가 늘 숨기 때문이다.

function matchesFilter(entry: OralHistoryEntry, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return [entry.institution, entry.projectName, entry.referenceCode, ...entry.overviewCells.map((c) => c.value ?? "")]
    .some((s) => s.includes(q));
}

// 선반 한 칸. 아래로 지나가는 강철 빔이 "얹혀 있음"을 만든다.
function Shelf({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-wrap items-end gap-3 pt-4">
      {children}
      <div className="w-full">
        <div
          className="mt-3.5 h-[9px] w-full shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
          style={{ background: "linear-gradient(#cfcbc4,#b6b1a8)" }}
        />
        <p className="pl-1.5 pt-0.5 font-mono text-[9px] text-grey">{label}</p>
      </div>
    </div>
  );
}

export function OralHistoryDiagram({ doc, marks }: { doc: OralHistoryDoc; marks: CellMark[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // 내가 켠 칸. 주인은 참조코드가 아니라 기관명+사업명이다 — 참조코드는 문서 순서로
  // 매겨져서 가운데 기관이 하나 끼면 뒤가 전부 밀리고, 표시가 엉뚱한 사업에 붙는다.
  const groupKey = (institution: string, projectName: string, axis: MarkAxis) =>
    `${institution}\u0000${projectName}\u0000${axis}`;

  const [done, setDone] = useState<Record<string, Set<string>>>(() => {
    const seed: Record<string, Set<string>> = {};
    for (const m of marks) {
      const key = groupKey(m.institution, m.projectName, m.axis);
      (seed[key] ??= new Set()).add(m.cellKey);
    }
    return seed;
  });

  const doneSet = (entry: OralHistoryEntry, axis: MarkAxis) =>
    done[groupKey(entry.institution, entry.projectName, axis)] ?? new Set<string>();

  // 낙관적으로 먼저 바꾸고, 저장에 실패하면 되돌린다 — FlagToggle이 쓰는 방식 그대로다.
  const toggleDone = (entry: OralHistoryEntry, axis: MarkAxis, cellKey: string) => {
    const key = groupKey(entry.institution, entry.projectName, axis);
    const on = !(done[key]?.has(cellKey) ?? false);
    const apply = (turnOn: boolean) =>
      setDone((prev) => {
        const next = new Set(prev[key] ?? []);
        if (turnOn) next.add(cellKey);
        else next.delete(cellKey);
        return { ...prev, [key]: next };
      });
    apply(on);
    void setCellMark(
      { institution: entry.institution, projectName: entry.projectName, axis, cellKey },
      on,
    ).catch(() => apply(!on));
  };

  const matched = doc.categories.flatMap((c) => c.entries).filter((e) => matchesFilter(e, query)).length;

  return (
    <div>
      {/* 서가 머리 — 상자가 못 지는 것만 적는다. 규칙 이름은 라벨마다 지므로 여기 없다. */}
      <section className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] tracking-[0.05em] text-grey">
          <span>
            기술계층 <b className="text-ink">계열</b>(시리즈) · 참조코드 <b className="text-ink">KR-OHP-*</b>
          </span>
          <span className="h-3 w-px bg-line" />
          <span>
            왼쪽 ● 확인 ◐ 일부 ╱ 봤으나 못 찾음 · 아직 안 봄 · 오른쪽 ✓ 내가 켠 것
          </span>
          <span className="h-3 w-px bg-line" />
          <span>
            갈래 {doc.categories.length}개 · 계열 {query.trim() ? `${matched}/${doc.totalEntries}` : doc.totalEntries}건
          </span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="기관·사업명·참조코드 검색"
          className={`w-56 ${INPUT_CLASSNAME}`}
        />
      </section>

      {/* 서가 */}
      <div className="border border-line bg-[#eceae6] px-3.5 pb-3.5">
        {doc.categories.map((category) => (
          <Shelf
            key={category.label}
            label={`KR-OHP-${category.label}.** — ${category.title} · ${category.entries.length}건`}
          >
            {category.entries.map((entry) => {
              const open = picked === entry.referenceCode;
              return (
                <SeriesBox
                  key={entry.referenceCode}
                  open={open}
                  onClose={() => setPicked(null)}
                  box={
                    <SeriesLabel
                      entry={entry}
                      active={open}
                      dimmed={!matchesFilter(entry, query)}
                      onClick={() => setPicked(open ? null : entry.referenceCode)}
                      doneOverview={doneSet(entry, "overview")}
                      donePolicy={doneSet(entry, "policy")}
                    />
                  }
                  sheet={
                    <SeriesSheet
                      entry={entry}
                      category={category}
                      doneOverview={doneSet(entry, "overview")}
                      donePolicy={doneSet(entry, "policy")}
                      onToggleOverview={(k) => toggleDone(entry, "overview", k)}
                      onTogglePolicy={(k) => toggleDone(entry, "policy", k)}
                      onClose={() => setPicked(null)}
                    />
                  }
                />
              );
            })}
          </Shelf>
        ))}
      </div>

      {/* 기록물 대장 — 화면 맨 아래 */}
      <OralRegister
        categories={doc.categories}
        matches={(e) => matchesFilter(e, query)}
        onPick={(_, entry) => setPicked(entry.referenceCode)}
      />


      {/* 확인 필요 목록 */}
      {doc.unresolvedSubsections.length > 0 && (
        <details className="mt-8 rounded-sm border border-line p-3">
          <summary className="cursor-pointer font-mono text-xs text-grey">
            {doc.unresolvedTitle} — 존재는 확인했지만 5W1H를 못 채운 기관 목록 펼치기
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {doc.unresolvedSubsections.map((sub) => (
              <div key={sub.id}>
                <h4 className="mb-1 font-mono text-[11px] font-bold text-grey">
                  {sub.id}. {sub.title}
                </h4>
                <ul className="space-y-1">
                  {sub.items.map((item, i) => (
                    <li key={i} className={`${TEXT_DENSE_CLASSNAME} leading-5 text-ink`}>
                      {item.isBullet && <span className="mr-1 text-line">·</span>}
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
        <details className="mt-3 rounded-sm border border-line p-3">
          <summary className="cursor-pointer font-mono text-xs text-grey">{doc.planTitle} 펼치기</summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {doc.planGroups.map((g) => (
              <div key={g.title}>
                <h4 className="mb-1 font-mono text-[11px] font-bold text-grey">{g.title}</h4>
                <ol className="list-decimal space-y-1 pl-4">
                  {g.items.map((item, i) => (
                    <li key={i} className={`${TEXT_DENSE_CLASSNAME} leading-5 text-ink`}>
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
