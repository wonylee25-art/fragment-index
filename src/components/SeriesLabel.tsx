"use client";

import { CellState, DescriptionCell, DescriptionGroup, OralHistoryEntry } from "@/lib/oral-history-projects";
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

// 상자 키. 내용이 정하게 두면 기술지 덧창과 어긋나므로 명시값으로 못 박고 둘이 나눠 쓴다.
export const SERIES_BOX_HEIGHT_PX = 363;

// 라벨이 지는 칸 목록. 칸이 서른이 되면서 이름을 다 세울 수 없게 됐다 — 라벨 안쪽이 30줄이면
// 상자가 아니라 표가 된다. 그래서 이름 대신 **군**을 세운다.
//
// 다만 점수만 남기면 "어느 칸이 비었나"가 사라지므로, 군마다 칸 글리프를 한 줄로 눕혀
// 함께 싣는다. 훑는 눈에는 군 다섯 줄이지만, 그 줄 안에 칸 하나하나의 상태가 그대로 있다.
// 이름은 어차피 상자를 열어야 읽는다(SeriesSheet의 난간).
const GROUP_ROW_PX = 17;

function GroupRow({ group, done }: { group: DescriptionGroup; done: Set<string> }) {
  const allChecked = group.cells.every((c) => done.has(c.key));
  return (
    <li
      title={`${group.label} — ${cellsScore(group.cells)}`}
      className="grid grid-cols-[46px_1fr_24px_12px] items-center gap-x-[3px] font-mono text-[8px] leading-[13px]"
      style={{ height: GROUP_ROW_PX }}
    >
      <span className="truncate tracking-[0.04em] text-ink">{group.label}</span>
      <span aria-hidden className="flex gap-px overflow-hidden">
        {group.cells.map((c) => (
          <span key={c.key} className={`text-[7px] leading-none ${CELL_TEXT_CLASSNAME[c.state]}`}>
            {CELL_GLYPH[c.state]}
          </span>
        ))}
      </span>
      <span className="text-right tabular-nums text-grey">{cellsScore(group.cells)}</span>
      <Tick on={allChecked} />
    </li>
  );
}

// 확인 수준은 ISAD(G)로는 기술통제 영역(3.7)이지만 라벨 맨 위 오른쪽에 둔다 — 이 상자를
// 열어 볼지 말지를 가르는 첫 잣대라, 훑는 눈에 가장 먼저 걸려야 한다.
export function SeriesLabel({
  entry,
  active,
  dimmed,
  onClick,
  doneDescription,
  donePolicy,
}: {
  entry: OralHistoryEntry;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
  doneDescription: Set<string>;
  donePolicy: Set<string>;
}) {
  // 채워진 칸이 많을수록 종이가 진해진다. 색상은 구술 자주 하나로 고정 — 이 화면은 통째로
  // 한 유형이라 색으로 카테고리를 가를 이유가 없다.
  const cells = [...entry.groups.flatMap((g) => g.cells), ...entry.policyCells];
  const filled = cells.filter((c) => c.state === "확인").length;
  // 칸이 15에서 30으로 늘었으므로 종이가 진해지는 문턱도 갑절로 둔다.
  const strength = Math.min(3, Math.floor(filled / 8));

  // 3.1.5 규모와 매체는 문장이라 라벨 한 줄에 다 안 들어간다. 첫 마디(마침표 앞)만 세우고
  // 나머지는 덧창이 진다. 안 본 칸이면 "규모 미기재"로 남긴다 — 없다는 말이 아니라 안 봤다는 말이다.
  const extentCell = entry.groups[0]?.cells[1];
  const extent =
    extentCell && extentCell.state !== "안봄" && extentCell.value
      ? extentCell.value.replace(/\*\*/g, "").split(/\.\s|\. $/)[0].trim()
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      // 열린 상자가 선반의 몇 번째 줄에 있는지 재는 표식(ShelfWithSheet가 읽는다).
      data-ref={entry.referenceCode}
      title={`${entry.institution} — ${entry.projectName}`}
      style={{ ...archiveTintStyle(ARCHIVE_ITEM_HUE.구술, strength), height: SERIES_BOX_HEIGHT_PX }}
      className={`w-full cursor-pointer border border-b-2 pb-2 text-left shadow-[1px_2px_3px_rgba(0,0,0,0.12)] transition-opacity ${
        active ? "border-ink" : "border-line"
      } ${dimmed ? "opacity-25" : ""}`}
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
          {/* 3.1.3 일자 · 3.1.5 규모 — 규모는 한 줄이라 첫 마디만 세우고 나머지는 덧창이 진다 */}
          <span className="mt-[5px] block border-t border-line pt-[5px] font-mono text-[8px] leading-[1.55] text-ink">
            {entry.year === null ? "일자 미상" : `${entry.year}${entry.yearApprox ? "년경" : "년"}~`}
            <br />
            <span className={`block truncate ${extent ? "" : "text-grey"}`}>{extent ?? "규모 미기재"}</span>
          </span>
        </span>

        <span className="mx-2 block border-t border-ink py-1.5">
          <ul className="flex flex-col justify-between" style={{ height: 5 * GROUP_ROW_PX }}>
            {entry.groups.map((g) => (
              <GroupRow key={g.id} group={g} done={doneDescription} />
            ))}
            <GroupRow
              group={{ id: "정책", label: "활용정책", cells: entry.policyCells }}
              done={donePolicy}
            />
          </ul>
        </span>

        <span className="block border-t border-ink bg-surface px-2 py-1 font-mono text-[7.5px] tracking-[0.03em] text-grey">
          ISAD(G) 2판 · 2026-08-26
        </span>
      </span>
    </button>
  );
}

export type { CellState };
