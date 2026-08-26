"use client";

import { CellState, DescriptionCell, OralHistoryEntry } from "@/lib/oral-history-projects";
import {
  ARCHIVE_ITEM_HUE,
  archiveTintStyle,
  CELL_GLYPH,
  CELL_TEXT_CLASSNAME,
  TICK_OFF_CLASSNAME,
  TICK_ON_CLASSNAME,
} from "@/lib/design-tokens";

// 구술 사업 한 건이 서는 상자. 사료 카드(RecordCard)와 층위가 다르다 — 카드는 손에 잡히는
// 낱장 하나(건)를 적지만, 이쪽은 한 사업이 낳은 한 벌(계열)을 적는다. 그래서 카드가 아니라
// 서가에 얹힌 상자이고, 겉에 붙은 것은 표제가 아니라 기술 라벨이다.
//
// 라벨이 지는 것은 ISAD(G) 2판의 국제 교환용 필수 6요소다 —
//   3.1.1 참조코드 · 3.1.4 기술계층 · 3.2.1 생산자 · 3.1.2 제목 · 3.1.3 일자 · 3.1.5 규모
// 나머지 스무 요소는 상자를 열었을 때 나온다(다층기술 규칙 4.1 "계층에 적합한 정보").
//
// 라벨은 두 겹이다. 왼쪽 글리프는 문서에서 자동으로 찍히므로 색이 없고 누를 수 없다.
// 오른쪽 노란 획만 사람이 켠다 — 이 화면에서 색을 가지는 것은 그것뿐이다.

// 붓으로 그은 ✓. 네모도 바탕도 없이 획만 남는다.
export function Tick({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-3 w-3 overflow-visible">
      <path
        d="M4 12.6 L9.6 18.6 L20.6 4.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={on ? TICK_ON_CLASSNAME : TICK_OFF_CLASSNAME}
      />
    </svg>
  );
}

function cellsScore(cells: DescriptionCell[]): string {
  const got = cells.reduce((n, c) => n + (c.state === "확인" ? 1 : c.state === "일부" ? 0.5 : 0), 0);
  return `${got % 1 === 0 ? got : got.toFixed(1)}/${cells.length}`;
}

// 칸 한 벌. 왼쪽 글리프(문서) · 이름 · 오른쪽 획(나) 세 자리 격자다. 꺼진 획도 자리를
// 지키는 것은, 자리가 생겼다 없어지면 옆 글자가 좌우로 밀리기 때문이다.
function CellList({ title, cells, done }: { title: string; cells: DescriptionCell[]; done: Set<string> }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[7.5px] tracking-[0.05em] text-grey">
        {title} <b className="text-ink">{cellsScore(cells)}</b>
      </p>
      <ul className="mt-0.5">
        {cells.map((cell) => (
          <li
            key={cell.key}
            title={`${cell.label} — ${cell.state}`}
            className="grid grid-cols-[8px_1fr_12px] items-center gap-x-[3px] font-mono text-[8px] leading-[14px]"
          >
            <span className={`text-center ${CELL_TEXT_CLASSNAME[cell.state]}`}>{CELL_GLYPH[cell.state]}</span>
            <span className={`truncate ${CELL_TEXT_CLASSNAME[cell.state]}`}>{cell.label}</span>
            <Tick on={done.has(cell.key)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// 확인 수준은 ISAD(G)로는 기술통제 영역(3.7)이지만 라벨 맨 위 오른쪽에 둔다 — 이 상자를
// 열어 볼지 말지를 가르는 첫 잣대라, 훑는 눈에 가장 먼저 걸려야 한다.
export function SeriesLabel({
  entry,
  active,
  dimmed,
  onClick,
  doneOverview,
  donePolicy,
}: {
  entry: OralHistoryEntry;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
  doneOverview: Set<string>;
  donePolicy: Set<string>;
}) {
  // 채워진 칸이 많을수록 종이가 진해진다. 색상은 구술 자주 하나로 고정 — 이 화면은 통째로
  // 한 유형이라 색으로 갈래를 가를 이유가 없다.
  const filled = [...entry.overviewCells, ...entry.policyCells].filter((c) => c.state === "확인").length;
  const strength = Math.min(3, Math.floor(filled / 4));

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.institution} — ${entry.projectName}`}
      className={`w-[202px] shrink-0 cursor-pointer border border-b-2 pb-2 text-left shadow-[1px_2px_3px_rgba(0,0,0,0.12)] transition-opacity ${
        active ? "border-ink" : "border-line"
      } ${dimmed ? "opacity-25" : ""}`}
      style={archiveTintStyle(ARCHIVE_ITEM_HUE.구술, strength)}
    >
      {/* 상자 뚜껑 — 손잡이 홈이 파인 자리 */}
      <span className="flex h-[15px] items-end justify-center border-b border-ink/15">
        <span aria-hidden className="h-1.5 w-[34px] rounded-t-sm bg-ink/10" />
      </span>

      <span className="mx-[9px] mt-2 block border border-ink/20 bg-background">
        {/* 3.1.1 참조코드 — 바코드 자리. 오른쪽 끝이 확인 수준 */}
        <span className="flex items-center gap-1.5 border-b border-ink px-[7px] py-1 font-mono text-[8.5px] font-bold tracking-[0.05em]">
          <span
            aria-hidden
            className="h-[11px] w-[26px] shrink-0"
            style={{
              background:
                "repeating-linear-gradient(90deg,var(--ink) 0 1px,transparent 1px 2px,var(--ink) 2px 4px,transparent 4px 5px,var(--ink) 5px 6px,transparent 6px 8px)",
            }}
          />
          {entry.referenceCode}
          <span className="ml-auto font-normal tracking-normal text-grey">{entry.confirmationLevel}</span>
        </span>

        <span className="block px-2 pb-[7px] pt-1.5">
          <span className="block truncate font-mono text-[7.5px] leading-[13px] tracking-[0.1em] text-grey">
            <b className="tracking-[0.16em] text-ink">계열</b>
            {entry.subgroup ? ` · ${entry.subgroup}` : ""}
          </span>
          {/* 3.2.1 생산자 — 계열을 부르는 이름은 제목이 아니라 생산자다 */}
          <span className="mt-[3px] block h-9 overflow-hidden font-serif text-[14.5px] font-bold leading-tight tracking-tight text-ink">
            {entry.institution}
          </span>
          {/* 3.1.2 제목 */}
          <span className="mt-0.5 block h-[30px] overflow-hidden text-[12px] leading-[15px] text-ink">
            {entry.projectName || "(사업명 미상)"}
          </span>
          {/* 3.1.3 일자 · 3.1.5 규모 — 규모는 문서에 아직 필드가 없어 늘 미기재다 */}
          <span className="mt-[5px] block border-t border-line pt-[5px] font-mono text-[8px] leading-[1.55] text-ink">
            {entry.year === null ? "일자 미상" : `${entry.year}${entry.yearApprox ? "년경" : "년"}~`}
            <br />
            <span className="text-grey">규모 미기재</span>
          </span>
        </span>

        <span className="mx-2 grid grid-cols-2 gap-x-[7px] border-t border-ink py-1.5">
          <CellList title="사업 개요" cells={entry.overviewCells} done={doneOverview} />
          <CellList title="활용정책" cells={entry.policyCells} done={donePolicy} />
        </span>

        <span className="block border-t border-ink bg-surface px-2 py-1 font-mono text-[7.5px] tracking-[0.03em] text-grey">
          ISAD(G) 2판 · 2026-08-26
        </span>
      </span>
    </button>
  );
}

export type { CellState };
