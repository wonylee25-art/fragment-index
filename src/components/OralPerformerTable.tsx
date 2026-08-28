"use client";

import { ReactNode } from "react";
import { OralHistoryCategory, OralHistoryEntry } from "@/lib/oral-history-projects";
import { Inline } from "@/lib/inline-markdown";

// 수행기관 카테고리(A)만 따로 세우는 표. 서가에서 뽑아 온 것은 축이 다르기 때문이다 —
// 1~6번은 "이 기관이 이런 사업을 벌였다"는 주제 묶음이고, A는 "남의 사업을 대신 채록한
// 쪽"이라 출처·행위자 축이다. 같은 선반에 얹으면 상자 넷이 주제 하나인 것처럼 보인다.
//
// 상자가 아니라 표인 것도 그래서다. 수행기관을 읽는 물음은 "이 사업이 무엇인가"가 아니라
// **"누구 밑에서 몇 건을 했나"**여서, 넷을 나란히 눕혀야 답이 보인다. 유형(수탁이냐 과제냐)과
// 수주 건수가 한 열로 서면 둘이 짝을 이루는 것이 그대로 드러난다 — 수탁형만 수주 건수가 있다.
//
// 그래도 기술지는 상자와 같은 것을 쓴다. 줄을 누르면 그 자리에서 아래로 펴진다.

// 「사업 기간」 칸의 첫 문장만 세운다. 표는 훑는 자리라 두 줄을 넘기면 표가 아니라 글이 된다.
function firstSentence(text: string): string {
  const cut = text.indexOf(". ");
  return cut > 0 ? `${text.slice(0, cut)}.` : text;
}

function cellValue(entry: OralHistoryEntry, label: string): string | null {
  for (const g of entry.groups) {
    const c = g.cells.find((x) => x.label === label);
    if (c?.value) return c.value;
  }
  return null;
}

// 하위구분은 "용역 수탁형 — 발주처의 주제를 받아 수행"처럼 뜻풀이가 붙어 온다. 표에는
// 이름만 세우고 풀이는 기술지에 맡긴다.
function typeName(subgroup: string | null): string {
  if (!subgroup) return "—";
  return subgroup.split("—")[0].trim();
}

const COLUMNS = "112px minmax(140px,1fr) minmax(170px,1.3fr) 84px minmax(150px,1.2fr) 68px 46px";

export function OralPerformerTable({
  category,
  matches,
  picked,
  onPick,
  renderSheet,
}: {
  category: OralHistoryCategory;
  matches: (entry: OralHistoryEntry) => boolean;
  picked: string | null;
  onPick: (entry: OralHistoryEntry) => void;
  renderSheet: (entry: OralHistoryEntry) => ReactNode;
}) {
  const heads = ["참조코드", "수행기관", "사업", "유형", "활동 기간", "수주 이력", "확인"];

  return (
    <section>
      <p className="mb-2 max-w-[70ch] text-[12px] leading-5 text-grey">
        <b className="text-ink">KR-OHP-{category.label}.**</b> — {category.title} · {category.entries.length}건.
        발주하는 쪽이 아니라 <b className="text-ink">채록을 맡아 하는 쪽</b>이라 축이 달라, 서가에 얹지 않고
        따로 눕힌다. 발주기관을 하나씩 두드리는 것보다 이쪽 이력을 훑는 편이 미등재 사업을 훨씬 많이 찾아낸다.
      </p>

      <div className="overflow-x-auto border-y border-ink bg-background">
        <div
          className="grid min-w-[820px] items-stretch border-b border-ink bg-surface"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          {heads.map((h) => (
            <p
              key={h}
              className="flex items-center border-r border-ink/15 px-2 py-1.5 font-mono text-[9.5px] tracking-[0.08em] text-grey last:border-r-0"
            >
              {h}
            </p>
          ))}
        </div>

        {category.entries.map((entry) => {
          const open = picked === entry.referenceCode;
          const period = cellValue(entry, "사업 기간");
          const deals = entry.notes.find((n) => n.label.includes("수주 이력"));
          return (
            <div key={entry.referenceCode} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(entry)}
                aria-expanded={open}
                className={`grid min-w-[820px] w-full items-stretch text-left hover:bg-surface ${
                  open ? "bg-surface" : ""
                } ${matches(entry) ? "" : "opacity-25"}`}
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span className="flex items-center border-r border-ink/15 px-2 font-mono text-[9.5px] font-bold text-grey">
                  {entry.referenceCode}
                </span>
                <span className="min-w-0 border-r border-ink/15 px-2.5 py-2 text-[12.5px] font-bold leading-4 tracking-tight text-ink">
                  {entry.institution}
                </span>
                <span className="min-w-0 border-r border-ink/15 px-2.5 py-2 text-[11px] leading-4 text-grey">
                  {entry.projectName}
                </span>
                <span className="flex items-center border-r border-ink/15 px-2 font-mono text-[9.5px] text-ink">
                  {typeName(entry.subgroup)}
                </span>
                <span className="min-w-0 border-r border-ink/15 px-2.5 py-2 text-[11px] leading-4 text-grey">
                  {period ? <Inline text={firstSentence(period)} /> : "—"}
                </span>
                <span className="flex items-center justify-center border-r border-ink/15 px-1 font-mono text-[9.5px] text-ink">
                  {/* 수탁형만 수주 건수가 선다 — 과제형은 발주처가 자기 자신이라 셀 것이 없다. */}
                  {deals ? `${deals.subItems.length}건` : "—"}
                </span>
                <span className="flex items-center justify-center px-1 font-mono text-[9.5px] text-grey">
                  {entry.confirmationLevel}
                </span>
              </button>

              {open && <div className="border-t border-line bg-surface p-2.5">{renderSheet(entry)}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
