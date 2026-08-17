"use client";

import { Fragment, useEffect, useState } from "react";
import { INPUT_CLASSNAME, TEXT_SUBHEAD_CLASSNAME, TEXT_DENSE_CLASSNAME } from "@/lib/design-tokens";
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

// 카테고리마다 색을 하나씩 주어 여덟 벌(패널 배경·머리띠·글씨·테두리·점)을 들고 있었다.
// 걷어낸다 — 색은 사람이 손댄 흔적을 가리키는 자리이고, 사업의 갈래는 자료가 스스로
// 말하는 것이다. 게다가 그 여덟 색 중에 주황·초록이 섞여 있어, 다른 화면에서 "확정"과
// "아직 확정 안 됨"을 뜻하던 색이 여기서만 갈래 이름으로 쓰이고 있었다.
// 덩어리 구분은 테두리·머리띠·건수가 이미 하고 있고, 이름은 번호가 가른다(1~7, A).

// 확인 수준. 초록·파랑·회색 세 색이었는데, 확실성은 색상이 아니라 진하기로 읽힌다 —
// 다 확인된 것만 "확인된 것"의 초록을 쓰고, 나머지는 회색이 옅어지며 물러난다.
const LEVEL_DOT_CLASSNAME: Record<ConfirmationLevel, string> = {
  "●●●": "text-green-fill",
  "●●○": "text-grey",
  "●○○": "text-line",
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-grey">
          <span className="text-grey">확인 수준 —</span>
          {doc.levelLegend.map((l) => (
            <span key={l.level} title={l.description} className="flex items-center gap-1">
              <span className={LEVEL_DOT_CLASSNAME[l.level]}>{l.level}</span>
              {l.label}
            </span>
          ))}
          <span className="h-3 w-px bg-line" />
          <span className="text-grey">
            카테고리 {doc.categories.length}개 · 사업 {doc.totalEntries}건
          </span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="기관·사업명·구술 대상 검색"
          className={`w-56 ${INPUT_CLASSNAME}`}
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
      className={`rounded-sm border border-line p-2.5 ${
        query.trim() && matchCount === 0 ? "opacity-30" : ""
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between rounded-sm bg-surface px-2 py-1.5">
        <span className={`font-mono ${TEXT_DENSE_CLASSNAME} font-bold text-ink`}>
          {category.label}. {category.title}
        </span>
        <span className="font-mono text-[10px] text-grey">
          {query.trim() ? `${matchCount}/${category.entries.length}건` : `${category.entries.length}건`}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {groups.map((g) => (
          <div key={g.subgroup ?? "_"}>
            {g.subgroup && (
              <p className="mb-1 font-mono text-[10px] font-semibold text-grey">
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
      className={`w-[280px] rounded-sm border bg-background px-2.5 py-2 text-left shadow-sm transition-all hover:shadow-md ${
        active ? "border-green-fill ring-1 ring-green-fill" : "border-line"
      } ${dimmed ? "opacity-25" : ""} ${entry.yearApprox ? "border-dashed" : ""}`}
    >
      <div className="flex items-center gap-1 font-mono text-[9px] text-grey">
        <span className={LEVEL_DOT_CLASSNAME[entry.confirmationLevel]}>{entry.confirmationLevel}</span>
        <span>
          {entry.year ?? "미상"}
          {entry.yearApprox && entry.year !== null ? "경" : ""}
        </span>
      </div>
      <p className={`truncate mt-1 ${TEXT_DENSE_CLASSNAME} font-semibold leading-4 text-ink`}>{entry.institution}</p>
      {entry.projectName && (
        <p className="truncate mt-0.5 text-[11px] leading-4 text-grey">{entry.projectName}</p>
      )}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className={`grid grid-cols-[56px_1fr] gap-2 py-1 ${TEXT_DENSE_CLASSNAME} leading-5`}>
      <dt className="font-mono text-[10px] text-grey">{label}</dt>
      <dd className="text-ink">
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
  return (
    <div className="mt-1 w-full rounded-sm border border-line bg-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <span
            className="inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey"
          >
            {category.label}. {category.title}
          </span>
          <h3 className={`mt-1.5 ${TEXT_SUBHEAD_CLASSNAME} font-semibold text-ink`}>
            {entry.institution}
            {entry.projectName && <span className="text-grey"> — {entry.projectName}</span>}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-grey">
            <span className={LEVEL_DOT_CLASSNAME[entry.confirmationLevel]}>{entry.confirmationLevel}</span>{" "}
            {entry.confirmationNote && <Inline text={entry.confirmationNote} />}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-sm bg-surface px-2 py-1 font-mono text-[11px] text-grey hover:bg-line"
        >
          닫기 ×
        </button>
      </div>

      <dl>
        <Row label="언제" value={entry.when} />
        {entry.whenSubItems.length > 0 && (
          <ul className="ml-[64px] mb-1 list-disc space-y-0.5 pl-4">
            {entry.whenSubItems.map((s, i) => (
              <li key={i} className={`${TEXT_DENSE_CLASSNAME} leading-5 text-ink`}>
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
        <div key={i} className={`mt-2 rounded-sm bg-yellow-tint p-2 ${TEXT_DENSE_CLASSNAME} leading-5 text-ink`}>
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
        <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-grey">
          <Inline text={entry.sources} />
        </p>
      )}
    </div>
  );
}
