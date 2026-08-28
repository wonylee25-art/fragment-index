"use client";

import { useState } from "react";
import { INPUT_CLASSNAME, TEXT_DENSE_CLASSNAME } from "@/lib/design-tokens";
import { Inline } from "@/lib/inline-markdown";
import { OralHistoryCategory, OralHistoryDoc, OralHistoryEntry } from "@/lib/oral-history-projects";
import type { CellMark, MarkAxis } from "@/lib/oral-marks";
import { setCellMark } from "@/lib/oral-mark-actions";
import { ShelfWithSheet } from "./SeriesBox";
import { SeriesLabel } from "./SeriesLabel";
import { SeriesSheet } from "./SeriesSheet";
import { OralRegister } from "./OralRegister";
import { OralPerformerTable } from "./OralPerformerTable";

// 구술 사업 목록. 예전에는 사료 카드와 같은 크기·같은 테두리의 상자를 격자로 늘어놓았는데,
// 층위가 달라서 어긋났다 — 사료는 낱장 하나(건)이고 사업은 한 벌(계열)이다. 그래서 카드가
// 아니라 서가에 얹힌 상자로 세운다.
//
// 격자가 아니라 선반인 것도 뜻이 있다. 격자는 칸이 균등한 배열이지만 선반은 얹혀 있음이라,
// 그것만으로 이미 "카드를 늘어놓은 판"이 아니게 된다. 카테고리마다 선반 하나를 준다.
//
// 상자를 누르면 그 상자가 선반의 첫 자리로 끌려 나오고, 기술지가 그 오른쪽에 펴진다
// (ShelfWithSheet). 누른 상자에 매달아 두면 자리가 상자마다 달라져, 어느 것을 눌렀느냐에
// 따라 글이 나타나는 데를 눈이 매번 다시 찾아야 했다.
//
// 보기는 둘이다 — 서가는 하나를 고르는 자리(라벨 한 장이 그 사업의 전부를 말한다), 대장은
// 여럿을 견주는 자리(한 칸이 계열 전부에 걸쳐 한 열로 선다). 한때는 둘을 세로로 쌓았지만
// 서가만 카테고리가 여럿이라 대장까지 내려가는 데 화면을 한참 굴려야 했다. 그래서 탭으로
// 가른다. 하나가 숨는 값은 치르되, 탭이 켜져 있으니 어느 보기인지는 눈에 남는다.
//
// 탭 줄은 편집 화면(AdminTabs)과 같은 꼴이다 — 머리글 바로 밑에 화면 너비로 깔린 띠에
// 밑줄 탭만 얹는다. 같은 자리에 같은 것이 있으면 화면마다 눈을 다시 맞출 일이 없다.
// 검색은 띠 안이 아니라 아래 머리줄에 남는다 — 편집 띠에도 탭 말고는 아무것도 없다.
// 대장에서 한 줄을 누르면 그 계열이 켜진 채 서가로 건너간다.

function matchesFilter(entry: OralHistoryEntry, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return [
    entry.institution,
    entry.projectName,
    entry.referenceCode,
    ...entry.groups.flatMap((g) => g.cells.map((c) => c.value ?? "")),
  ].some((s) => s.includes(q));
}

type View = "shelf" | "register" | "performer";

const VIEWS: { id: View; label: string }[] = [
  { id: "shelf", label: "기록물 박스" },
  { id: "register", label: "기록물 대장" },
  { id: "performer", label: "수행기관" },
];

// 수행기관 카테고리의 머리표. 문서가 "A"로 다는 자리다.
const PERFORMER_LABEL = "A";

export function OralHistoryDiagram({ doc, marks }: { doc: OralHistoryDoc; marks: CellMark[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("shelf");
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

  // 주제 카테고리와 수행기관 카테고리를 가른다 — 서가·대장은 앞엣것만 이고, 수행기관은
  // 제 탭에서 표로 선다. 한 계열이 두 탭에 걸치면 세는 수가 탭마다 달라진다.
  const performer = doc.categories.find((c) => c.label === PERFORMER_LABEL) ?? null;
  const subjectCategories = doc.categories.filter((c) => c !== performer);
  const subjectEntries = subjectCategories.flatMap((c) => c.entries);
  const matched = subjectEntries.filter((e) => matchesFilter(e, query)).length;
  const performerMatched = (performer?.entries ?? []).filter((e) => matchesFilter(e, query)).length;

  const sheetFor = (entry: OralHistoryEntry, category: OralHistoryCategory) => (
    <SeriesSheet
      entry={entry}
      category={category}
      doneDescription={doneSet(entry, "overview")}
      donePolicy={doneSet(entry, "policy")}
      onToggleDescription={(k: string) => toggleDone(entry, "overview", k)}
      onTogglePolicy={(k: string) => toggleDone(entry, "policy", k)}
      onClose={() => setPicked(null)}
    />
  );

  return (
    <>
      {/* 보기 탭 — 편집 화면의 탭 띠와 같은 꼴. 머리글 바로 밑에 화면 너비로 깔린다. */}
      <div className="border-b border-line bg-surface">
        <div className="page-shell">
          <nav className="flex gap-1">
            {VIEWS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs font-bold transition-colors ${
                  view === tab.id ? "border-ink text-ink" : "border-transparent text-grey hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="page-shell py-6">
        {/* 서가 머리 — 상자가 못 지는 것만 적는다. 규칙 이름은 라벨마다 지므로 여기 없다. */}
        <section className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] tracking-[0.05em] text-grey">
            <span>
              기술계층 <b className="text-ink">계열</b>(시리즈) · 참조코드 <b className="text-ink">KR-OHP-*</b> · 기술 21칸 + 정책 9칸
            </span>
            <span className="h-3 w-px bg-line" />
            <span>
              문서 ● 확인 ◐ 일부 ╱ 봤으나 못 찾음 · 아직 안 봄 · 오른쪽 ✓ 내가 검토한 칸
            </span>
            <span className="h-3 w-px bg-line" />
            <span>
              {view === "performer" ? (
                <>
                  수행기관{" "}
                  {query.trim()
                    ? `${performerMatched}/${performer?.entries.length ?? 0}`
                    : (performer?.entries.length ?? 0)}
                  건 · 주제 카테고리 {subjectCategories.length}개 {subjectEntries.length}건은 다른 탭
                </>
              ) : (
                <>
                  카테고리 {subjectCategories.length}개 · 계열{" "}
                  {query.trim() ? `${matched}/${subjectEntries.length}` : subjectEntries.length}건
                  {performer && ` · 수행기관 ${performer.entries.length}건은 다른 탭`}
                </>
              )}
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
        {view === "shelf" && (
          <div className="border border-line bg-[#eceae6] px-3.5 pb-3.5">
            {subjectCategories.map((category) => {
              const openEntry = category.entries.find((e) => e.referenceCode === picked) ?? null;
              const label = (entry: OralHistoryEntry) => (
                <SeriesLabel
                  key={entry.referenceCode}
                  entry={entry}
                  active={picked === entry.referenceCode}
                  dimmed={!matchesFilter(entry, query)}
                  onClick={() => setPicked(picked === entry.referenceCode ? null : entry.referenceCode)}
                  doneDescription={doneSet(entry, "overview")}
                  donePolicy={doneSet(entry, "policy")}
                />
              );
              return (
                <ShelfWithSheet
                  key={category.label}
                  label={`KR-OHP-${category.label}.** — ${category.title} · ${category.entries.length}건`}
                  open={openEntry !== null}
                  onClose={() => setPicked(null)}
                  // 누른 상자를 첫 자리로 끌어내고 나머지는 기술지 뒤로 흐른다.
                  boxes={(openEntry
                    ? [openEntry, ...category.entries.filter((e) => e !== openEntry)]
                    : category.entries
                  ).map(label)}
                  sheet={openEntry && sheetFor(openEntry, category)}
                />
              );
            })}
          </div>
        )}

        {/* 기록물 대장 — 아직 계열로 못 선 것들(불충분·다음 후보)도 여기에 딸린다. 서가는
            세워 둔 상자만 이는 자리라, 못 세운 것을 대는 자리는 대장 쪽이다. */}
        {view === "register" && (
          <>
            <OralRegister
              categories={subjectCategories}
              matches={(e) => matchesFilter(e, query)}
              heading={false}
              // 대장에서 고른 계열은 서가에서 펼쳐 보여 준다 — 기술지가 사는 곳은 서가다.
              onPick={(_, entry) => {
                setPicked(entry.referenceCode);
                setView("shelf");
              }}
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
                <summary className="cursor-pointer font-mono text-xs text-grey">
                  {doc.planTitle} 펼치기
                </summary>
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
          </>
        )}

        {/* 수행기관 — 축이 달라 서가에 얹지 않고 표로 눕힌다(OralPerformerTable) */}
        {view === "performer" && performer && (
          <OralPerformerTable
            category={performer}
            matches={(e) => matchesFilter(e, query)}
            picked={picked}
            onPick={(entry) =>
              setPicked(picked === entry.referenceCode ? null : entry.referenceCode)
            }
            renderSheet={(entry) => sheetFor(entry, performer)}
          />
        )}
      </main>
    </>
  );
}
