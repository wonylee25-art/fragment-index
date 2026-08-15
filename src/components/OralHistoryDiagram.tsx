"use client";

import { Fragment, useEffect, useState } from "react";
import { TEXT_SUBHEAD_CLASSNAME, TEXT_BODY_CLASSNAME } from "@/lib/design-tokens";
import { Inline } from "@/lib/inline-markdown";
import {
  ConfirmationLevel,
  OralHistoryCategory,
  OralHistoryDoc,
  OralHistoryEntry,
} from "@/lib/oral-history-projects";

// 발주기관·사업명·연도·구술 대상만 압축해서 보여주는 클러스터 다이어그램.
// 카테고리(주제별 1~7, 축이 다른 A)마다 테두리 있는 패널을 만들고, 그 안에 카드를 채워 넣는다 —
// 나선형으로 흩뿌리는 대신 이 방식을 쓴 이유는, 흩뿌리면 "큰 카테고리가 한눈에
// 보이고 세부 항목이 분명히 구분된다"는 목표를 만족하지 못했기 때문(패널 경계 +
// flex-wrap이면 겹침 걱정 없이 브라우저가 알아서 정렬해 준다). 패널은 CSS 다단
// (columns)으로 캔버스 위에 벽돌쌓기처럼 배치돼, 항목이 많은 카테고리는 자연히
// 더 큰 덩어리로 보인다. 자세한 5W1H는 카드를 클릭하면 아래 상세 패널에 펼쳐진다.

const CATEGORY_STYLE: Record<
  string,
  { panelBg: string; headerBg: string; text: string; border: string; dot: string }
> = {
  "1": { panelBg: "bg-zinc-50/60", headerBg: "bg-zinc-200", text: "text-zinc-700", border: "border-zinc-300", dot: "bg-zinc-400" },
  "2": { panelBg: "bg-violet-50/50", headerBg: "bg-violet-100", text: "text-violet-800", border: "border-violet-300", dot: "bg-violet-400" },
  "3": { panelBg: "bg-rose-50/50", headerBg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", dot: "bg-rose-400" },
  "4": { panelBg: "bg-amber-50/50", headerBg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-400" },
  "5": { panelBg: "bg-blue-50/50", headerBg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", dot: "bg-blue-400" },
  "6": { panelBg: "bg-orange-50/50", headerBg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", dot: "bg-orange-400" },
  "7": { panelBg: "bg-emerald-50/50", headerBg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-400" },
  // A. 구술채록 수행기관 — 주제별 사업과 축이 다르므로 번호가 아니라 글자를 쓰고, 색도 무채색으로 뗀다.
  A: { panelBg: "bg-slate-50/60", headerBg: "bg-slate-200", text: "text-slate-700", border: "border-slate-400", dot: "bg-slate-500" },
};

const LEVEL_DOT_CLASSNAME: Record<ConfirmationLevel, string> = {
  "●●●": "text-emerald-600",
  "●●○": "text-blue-500",
  "●○○": "text-zinc-400",
};

// 정렬 순서(연도순)에 기대지 않는 안정적인 키 — 카테고리 안에서 기관+사업명 조합은
// 유일하다고 가정한다(현재 문서에 중복 사례 없음).
function entryKey(categoryLabel: string, entry: OralHistoryEntry): string {
  return `${categoryLabel}-${entry.institution}-${entry.projectName}`;
}

function matchesFilter(entry: OralHistoryEntry, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return [entry.institution, entry.projectName, entry.who ?? ""].some((s) => s.includes(q));
}

// CSS 다단(columns)은 내용 높이가 바뀌면(상세 패널이 펼쳐지면) 브라우저가 전체 단을
// 다시 균형 잡으면서 카드들이 엉뚱한 위치로 튀는 문제가 있었다 — 그래서 컬럼 배정을
// 직접 계산해 고정된 flex 컬럼에 나눠 담는다. selectedKey·query와 무관하게 카테고리
// 목록에서만 계산하므로, 패널 하나가 펼쳐져도 다른 컬럼은 흔들리지 않고 같은 컬럼 안의
// 아래쪽 패널만 자연스럽게 밀려난다("아코디언"처럼 동작).
function distributeIntoColumns(categories: OralHistoryCategory[], columnCount: number): OralHistoryCategory[][] {
  const columns: OralHistoryCategory[][] = Array.from({ length: columnCount }, () => []);
  const weights = Array(columnCount).fill(0);
  for (const category of categories) {
    let minIdx = 0;
    for (let i = 1; i < columnCount; i++) {
      if (weights[i] < weights[minIdx]) minIdx = i;
    }
    columns[minIdx].push(category);
    weights[minIdx] += category.entries.length + 1;
  }
  return columns;
}

// 화면 너비에 따라 컬럼 수를 정한다. 서버 렌더링은 항상 1컬럼으로 시작하고(SSR은
// 창 너비를 모르니까), 마운트 후 실제 너비를 재서 조정한다 — 반응형을 CSS
// hidden/md:flex로 두 벌 렌더링하는 방식은 카드 버튼이 DOM에 두 개씩 존재해
// 클릭이 두 번 처리되는 버그(중복 상세 패널)로 이어져서 이 방식으로 바꿨다.
function useColumnCount(): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const update = () => setCount(mql.matches ? 3 : 1);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return count;
}

export function OralHistoryDiagram({ doc }: { doc: OralHistoryDoc }) {
  const [query, setQuery] = useState("");
  const columnCount = useColumnCount();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  return (
    <div>
      {/* 소개문(doc.introParagraphs)은 화면에 걸지 않는다 — 표만 봐도 무엇인지 읽히고,
          문서 원문은 reference/의 마크다운에 그대로 남아 있다. */}

      {/* 범례 + 검색 */}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

      {/* 카테고리 패널 — 컬럼별로 고정 배정해 쌓는다(큰 카테고리일수록 자연히 큰 덩어리로 보인다).
          화면 너비에 따라 컬럼 수만 바뀌고, DOM에는 항상 이 구조 하나만 존재한다. */}
      <div className="flex gap-4">
        {distributeIntoColumns(doc.categories, columnCount).map((column, i) => (
          <div key={i} className="flex flex-1 flex-col gap-4">
            {column.map((category) => (
              <CategoryPanel
                key={category.label}
                category={category}
                query={query}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 확인 필요 목록 */}
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
                    <li key={i} className={`${TEXT_BODY_CLASSNAME} leading-5 text-zinc-600`}>
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
                    <li key={i} className={`${TEXT_BODY_CLASSNAME} leading-5 text-zinc-600`}>
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

function CategoryPanel({
  category,
  query,
  selectedKey,
  onSelect,
}: {
  category: OralHistoryCategory;
  query: string;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const style = CATEGORY_STYLE[category.label] ?? CATEGORY_STYLE["1"];
  const matchCount = category.entries.filter((e) => matchesFilter(e, query)).length;

  // 하위구분(문서의 "- **하위구분**:" 필드)이 있으면 문서에 처음 등장하는 순서대로
  // 소그룹을 만들어 카드 벽을 잘게 쪼갠다 — 카테고리가 커서(예: 14건) 한 덩어리로는
  // 안 읽힐 때를 위한 장치. 하위구분이 없는 카테고리는 그냥 통짜로 보여준다.
  const groupOrder: (string | null)[] = [];
  for (const entry of category.entries) {
    if (!groupOrder.includes(entry.subgroup)) groupOrder.push(entry.subgroup);
  }
  const groups = groupOrder.map((subgroup) => ({
    subgroup,
    entries: category.entries
      .filter((e) => e.subgroup === subgroup)
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
  }));

  return (
    <div
      className={`rounded-sm border-2 ${style.border} ${style.panelBg} p-2.5 ${
        query.trim() && matchCount === 0 ? "opacity-30" : ""
      }`}
    >
      <div className={`mb-2.5 flex items-center justify-between rounded-sm px-2 py-1.5 ${style.headerBg}`}>
        <span className={`flex items-center gap-1.5 font-mono ${TEXT_BODY_CLASSNAME} font-bold ${style.text}`}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.dot}`} />
          {category.label}. {category.title}
        </span>
        <span className={`font-mono text-[10px] ${style.text} opacity-70`}>
          {query.trim() ? `${matchCount}/${category.entries.length}건` : `${category.entries.length}건`}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {groups.map((g) => (
          <div key={g.subgroup ?? "_"}>
            {g.subgroup && (
              <p className={`mb-1 font-mono text-[10px] font-semibold ${style.text} opacity-80`}>
                {g.subgroup} · {g.entries.length}건
              </p>
            )}
            {/* 상세 패널을 클릭한 카드 바로 뒤에 w-full로 끼워 넣는다 — flex-wrap 컨테이너 안에서
                폭 100%짜리 요소는 그 지점에서 강제로 줄바꿈되므로, 클릭한 카드가 몇 번째 줄
                몇 번째 칸에 있든 바로 그 밑에서 펼쳐지고 뒤이은 카드들만 아래로 밀린다. */}
            <div className="flex flex-wrap gap-2">
              {g.entries.map((entry) => {
                const key = entryKey(category.label, entry);
                return (
                  <Fragment key={key}>
                    <EntryCard
                      entry={entry}
                      dimmed={!matchesFilter(entry, query)}
                      active={selectedKey === key}
                      onClick={() => onSelect(key)}
                    />
                    {selectedKey === key && (
                      <DetailPanel category={category} entry={entry} onClose={() => onSelect(null)} />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  dimmed,
  active,
  onClick,
}: {
  entry: OralHistoryEntry;
  dimmed: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.institution} — ${entry.projectName}`}
      className={`w-[280px] rounded-sm border bg-white px-2.5 py-2 text-left shadow-sm transition-all hover:shadow-md ${
        active ? "border-orange-400 ring-1 ring-orange-300" : "border-zinc-200"
      } ${dimmed ? "opacity-25" : ""} ${entry.yearApprox ? "border-dashed" : ""}`}
    >
      <div className="flex items-center gap-1 font-mono text-[9px] text-zinc-400">
        <span className={LEVEL_DOT_CLASSNAME[entry.confirmationLevel]}>{entry.confirmationLevel}</span>
        <span>
          {entry.year ?? "미상"}
          {entry.yearApprox && entry.year !== null ? "경" : ""}
        </span>
      </div>
      <p className={`truncate mt-1 ${TEXT_BODY_CLASSNAME} font-semibold leading-4 text-zinc-900`}>{entry.institution}</p>
      {entry.projectName && (
        <p className="truncate mt-0.5 text-[11px] leading-4 text-zinc-500">{entry.projectName}</p>
      )}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className={`grid grid-cols-[56px_1fr] gap-2 py-1 ${TEXT_BODY_CLASSNAME} leading-5`}>
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
  const style = CATEGORY_STYLE[category.label] ?? CATEGORY_STYLE["1"];
  return (
    <div className="mt-1 w-full rounded-sm border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${style.headerBg} ${style.text}`}
          >
            {category.label}. {category.title}
          </span>
          <h3 className={`mt-1.5 ${TEXT_SUBHEAD_CLASSNAME} font-semibold text-zinc-900`}>
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
              <li key={i} className={`${TEXT_BODY_CLASSNAME} leading-5 text-zinc-600`}>
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
        <div key={i} className={`mt-2 rounded-sm bg-amber-50 p-2 ${TEXT_BODY_CLASSNAME} leading-5 text-amber-900`}>
          <strong className="font-semibold">{note.label}</strong>
          {note.value && (
            <>
              : <Inline text={note.value} />
            </>
          )}
          {note.subItems.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {note.subItems.map((s, j) => (
                <li key={j}>
                  <Inline text={s} />
                </li>
              ))}
            </ul>
          )}
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
