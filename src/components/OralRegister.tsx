"use client";

import { ReactNode, useState } from "react";
import { OralHistoryCategory, OralHistoryEntry } from "@/lib/oral-history-projects";
import { CELL_GLYPH, CELL_TEXT_CLASSNAME, TOGGLE_BUTTON_CLASSNAME, TOGGLE_ON_CLASSNAME, TOGGLE_OFF_CLASSNAME } from "@/lib/design-tokens";

// 기록물 대장. 서가는 하나를 고르는 자리라 상자마다 제 라벨을 들고 서 있고, 같은 칸이
// 세로로 서지 않는다. "누가 열람절차를 확인했나"처럼 한 요소를 여러 계열에 걸쳐 훑으려면
// 눕힌 표가 따로 있어야 한다.
//
// 서가와는 탭으로 갈라 세운다. 한때는 화면 맨 아래에 쌓아 두었는데, 서가만 해도 카테고리가
// 여럿이라 대장에 닿으려면 화면을 한참 굴려야 했다. 어느 보기인지는 탭이 켜져 있어 알 수 있다.
//
// 카드는 닫힌 상자지만 대장은 열린 줄이다 — 좌우 테두리가 없고 아랫줄과 선을 나눠 쓴다.
//
// 줄을 누르면 그 자리에서 기술지가 아래로 펴진다(수행기관 표와 같은 꼴). 한때는 서가 탭으로
// 건너뛰게 했는데, 누른 것이 화면 밖 선반에 가서 펴져 무엇을 눌렀는지 되레 잃었다.
//
// 줄은 카테고리마다 묶여 선다. 눕힌 표라고 갈래까지 지울 까닭은 없다 — 견주는 자리이되
// 무엇끼리 견주는지는 남아야 한다. 묶음머리는 접힌다: 한 갈래만 두고 볼 수 있다.

// 대장이 한 번에 세울 수 있는 것은 군 하나다. 기술 축이 23칸이 되면서 한 표에 다 눕히면
// 열이 서른이라 아무것도 안 읽힌다 — 군을 갈아 끼우고, 한 번에 그 군의 칸만 세운다.
const POLICY_GROUP_ID = "정책";

export function OralRegister({
  categories,
  matches,
  picked,
  onPick,
  renderSheet,
  heading = true,
}: {
  categories: OralHistoryCategory[];
  matches: (entry: OralHistoryEntry) => boolean;
  picked: string | null;
  onPick: (entry: OralHistoryEntry) => void;
  renderSheet: (entry: OralHistoryEntry, category: OralHistoryCategory) => ReactNode;
  // 탭 안에서는 탭이 이미 이름을 대므로 제목을 두 번 쓰지 않는다.
  heading?: boolean;
}) {
  const sample = categories[0]?.entries[0];
  const tabs = [
    ...(sample?.groups ?? []).map((g) => ({ id: g.id, label: g.label })),
    { id: POLICY_GROUP_ID, label: "활용정책" },
  ];
  const [groupId, setGroupId] = useState<string>(tabs[0]?.id ?? "사업");
  // 접힌 묶음. 편 것이 아니라 접은 것을 센다 — 처음에는 다 펴져 있어야 한다.
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const toggleCategory = (label: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const cellsOf = (entry: OralHistoryEntry) =>
    groupId === POLICY_GROUP_ID
      ? entry.policyCells
      : entry.groups.find((g) => g.id === groupId)?.cells ?? [];
  const heads = sample ? cellsOf(sample) : [];
  const marksWidth = `${Math.max(160, heads.length * 46)}px`;

  return (
    <section className={heading ? "mt-10" : ""}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {heading && (
          <h2 className="font-mono text-[11px] tracking-[0.14em] text-grey">기록물 대장</h2>
        )}
        <div className="flex items-center gap-1 font-mono text-[11px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGroupId(tab.id)}
              className={`${TOGGLE_BUTTON_CLASSNAME} ${groupId === tab.id ? TOGGLE_ON_CLASSNAME : TOGGLE_OFF_CLASSNAME}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="ml-auto font-mono text-[9.5px] text-grey">
          ● 확인 ◐ 일부 ╱ 봤으나 못 찾음 · 아직 안 봄
        </p>
      </div>

      {/* 머리줄이 표를 따라 내려온다 — 백 줄을 훑는 동안 저 ●이 어느 칸인지 잊지 않도록.
          붙는 데는 화면이라야 한다: 판이 제 스크롤 통을 지면 머리줄은 화면이 아니라 그 통에만
          붙어, 페이지를 굴리면 판째로 위로 올라가 버린다. 그래서 넓은 화면에서는 통을 풀어
          (md:overflow-visible) 페이지가 곧 스크롤이 되게 하고, 머리줄은 화면 꼭대기에 선다.
          좁은 화면에서만 가로 통을 진다 — 스물세 칸이 640px 밑으로는 안 들어가므로. 가로만
          굴리는 통에서도 세로가 hidden으로 승격돼 sticky가 죽으니(clip을 적어도 마찬가지)
          그 폭에서는 판 안쪽 스크롤로 받는다. */}
      <div className="max-h-[calc(100vh-7rem)] overflow-auto border-y border-ink bg-background md:max-h-none md:overflow-x-visible md:overflow-y-visible">
        <div
          className="sticky top-0 z-20 grid min-w-[640px] items-stretch border-b border-ink bg-surface"
          style={{ gridTemplateColumns: `112px minmax(200px,1fr) ${marksWidth}` }}
        >
          <p className="flex items-center border-r border-ink/15 px-2 font-mono text-[9.5px] tracking-[0.08em] text-grey">
            참조코드
          </p>
          <p className="flex items-center border-r border-ink/15 px-2.5 font-mono text-[9.5px] tracking-[0.08em] text-grey">
            생산자 · 제목
          </p>
          <div className="grid" style={{ gridAutoFlow: "column", gridAutoColumns: "1fr" }}>
            {heads.map((c) => (
              <span
                key={c.key}
                className="flex items-center justify-center break-keep border-r border-ink/10 px-0.5 text-center font-mono text-[8.5px] leading-tight text-grey last:border-r-0"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {/* 대장도 카테고리를 지운 한 벌이 아니라 카테고리마다 한 묶음으로 선다. 참조코드가
            이미 KR-OHP-1.** 식으로 갈래를 이고 있는데 줄이 백을 넘으면 그 갈래가 눈에 안
            남는다 — 묶음머리를 한 줄 얹어 어디서 갈리는지 보이게 한다. 서가의 선반 라벨과
            같은 글귀를 쓴다. 접으면 그 묶음은 줄만 감추고 머리는 남는다. */}
        {categories.map((category) => {
          const shown = category.entries.filter(matches).length;
          const folded = closed.has(category.label);
          return (
            <div key={category.label}>
              <button
                type="button"
                onClick={() => toggleCategory(category.label)}
                aria-expanded={!folded}
                className="flex min-w-[640px] w-full items-center gap-2 border-b border-ink/20 bg-surface px-2 py-1.5 text-left hover:bg-line/40"
              >
                <span className="font-mono text-[9.5px] text-grey">{folded ? "▸" : "▾"}</span>
                <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-ink">
                  KR-OHP-{category.label}.**
                </span>
                <span className="truncate text-[11px] leading-4 text-grey">{category.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[9.5px] text-grey">
                  {shown === category.entries.length
                    ? `${category.entries.length}건`
                    : `${shown}/${category.entries.length}건`}
                </span>
              </button>

              {!folded &&
                category.entries.map((entry) => {
                  const cells = cellsOf(entry);
                  const open = picked === entry.referenceCode;
                  return (
                    <div key={entry.referenceCode} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onPick(entry)}
                        aria-expanded={open}
                        className={`grid min-w-[640px] w-full items-stretch text-left hover:bg-surface ${
                          open ? "bg-surface" : ""
                        } ${matches(entry) ? "" : "opacity-25"}`}
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

                      {open && (
                        <div className="border-t border-line bg-surface p-2.5">
                          {renderSheet(entry, category)}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
