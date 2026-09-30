"use client";

import { useMemo } from "react";
import type { Grain, GrainThread } from "@/lib/grains";

// 날짜 × 키워드 격자. 가로는 날짜, 세로는 키워드이고 키워드가 나온 날에 점을 찍는다.
// 기록이 시간순 로그라서 시간 축을 그대로 둔 채 "어느 키워드가 어느 날들에 되풀이되는가"만 뽑아 보인다.
// 점을 누르면 그 키워드를 고르고(렌즈가 켜진다) 그 날 그 키워드가 나온 첫 조각으로 스크롤한다.

// 서버와 브라우저의 시간대가 달라도 같은 날로 묶이도록 한국 시간으로 날짜를 자른다.
const DAY_KEY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }); // 2026-09-30

// 이 일수 이하로 걸치면 데이터가 없는 날도 빈 칸으로 이어 그려 쉬는 간격이 보이게 한다.
// 넘으면 조각이 있는 날만 그린다 — 몇 달 치를 날마다 그리면 가로로 너무 길어진다.
const CONTINUOUS_DAYS = 31;

function dayKeyOf(iso: string) {
  return DAY_KEY.format(new Date(iso));
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function shortDay(key: string) {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function KeywordGrid({
  threads,
  active,
  onPick,
}: {
  threads: GrainThread[];
  active: string | null;
  onPick: (keyword: string, grain: Grain) => void;
}) {
  const { rows, days } = useMemo(() => {
    const cells = new Map<string, Map<string, Grain[]>>(); // 키워드 → 날짜 → 조각들
    const seen = new Set<string>();
    for (const t of threads) {
      for (const g of t.grains) {
        const day = dayKeyOf(g.createdAt);
        for (const k of new Set(g.keywords)) {
          const byDay = cells.get(k) ?? new Map<string, Grain[]>();
          byDay.set(day, [...(byDay.get(day) ?? []), g]);
          cells.set(k, byDay);
          seen.add(day);
        }
      }
    }
    const sorted = [...seen].sort();
    const days =
      sorted.length === 0
        ? []
        : daysBetween(sorted[0], sorted[sorted.length - 1]).length <= CONTINUOUS_DAYS
          ? daysBetween(sorted[0], sorted[sorted.length - 1])
          : sorted;
    // 여러 날에 걸친 키워드가 위로. 같으면 조각이 많은 쪽.
    const rows = [...cells.entries()]
      .map(([keyword, byDay]) => ({
        keyword,
        byDay,
        spread: byDay.size,
        total: [...byDay.values()].reduce((n, gs) => n + gs.length, 0),
      }))
      .sort((a, b) => b.spread - a.spread || b.total - a.total || a.keyword.localeCompare(b.keyword));
    return { rows, days };
  }, [threads]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 overflow-x-auto rounded-sm border border-line">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="border-b border-line bg-surface text-grey">
            <th className="sticky left-0 bg-surface px-3 py-1.5 text-left font-normal">키워드 \ 날짜</th>
            {days.map((d) => (
              <th key={d} className="px-2 py-1.5 text-center font-normal">
                {shortDay(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isActive = active === r.keyword;
            return (
              <tr
                key={r.keyword}
                className={`border-b border-line last:border-b-0 ${isActive ? "bg-surface" : ""} ${
                  active && !isActive ? "opacity-40" : ""
                }`}
              >
                <th
                  scope="row"
                  className={`sticky left-0 px-3 py-1.5 text-left ${
                    isActive ? "bg-surface font-bold text-ink" : "bg-background font-normal text-ink"
                  }`}
                >
                  {r.keyword}
                  <span className="ml-1 text-grey">{r.spread}일</span>
                </th>
                {days.map((d) => {
                  const grains = r.byDay.get(d);
                  return (
                    <td key={d} className="px-2 py-1.5 text-center">
                      {grains ? (
                        <button
                          type="button"
                          onClick={() => onPick(r.keyword, grains[0])}
                          aria-label={`${r.keyword} ${shortDay(d)} 조각 ${grains.length}건으로 이동`}
                          className={`inline-flex items-center justify-center rounded-full bg-ink text-[10px] leading-none text-background transition-transform hover:scale-125 ${
                            grains.length > 1 ? "h-4 w-4" : "h-2.5 w-2.5"
                          }`}
                        >
                          {grains.length > 1 ? grains.length : ""}
                        </button>
                      ) : (
                        // 그 키워드가 없던 날. 쉬는 간격이 보이도록 아주 옅은 점만 둔다.
                        <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-line" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
