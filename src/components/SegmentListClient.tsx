"use client";

import { useEffect, useMemo, useState } from "react";
import { SegmentRow } from "./SegmentRow";
import { AddSegmentForm } from "./AddSegmentForm";
import { SegmentCardData } from "@/lib/types";
import { edtfSortKey } from "@/lib/edtf";

type SortDirection = "asc" | "desc";

export function SegmentListClient({
  segments,
  focusId,
}: {
  segments: SegmentCardData[];
  focusId?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [adding, setAdding] = useState(false);

  // 연표 목록 등 다른 화면에서 "이 구술로 이동" 링크를 타고 들어온 경우 해당 행까지 스크롤한다.
  // 검색어/키워드 필터는 애초에 빈 상태로 시작하므로 focusId 행을 가릴 일이 없다.
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`segment-${focusId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId]);

  const allKeywords = useMemo(() => {
    const set = new Set<string>();
    segments.forEach((s) => s.keywordTags.forEach((k) => set.add(k)));
    return Array.from(set);
  }, [segments]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return segments
      .filter((s) => {
        const matchesKeyword = !activeKeyword || s.keywordTags.includes(activeKeyword);
        const matchesQuery =
          !q ||
          s.itemTitle.includes(q) ||
          s.personPlaceTags.some((t) => t.includes(q)) ||
          s.utterances.some((u) => u.text.includes(q));
        return matchesKeyword && matchesQuery;
      })
      .sort((a, b) => {
        const diff = edtfSortKey(a.dateValue) - edtfSortKey(b.dateValue);
        return sortDirection === "asc" ? diff : -diff;
      });
  }, [segments, query, activeKeyword, sortDirection]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색어를 입력하세요 (인물, 장소, 본문)"
          className="w-full rounded-sm border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveKeyword(null)}
            className={`rounded-sm px-2.5 py-1 font-mono text-xs ${
              activeKeyword === null ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            전체
          </button>
          {allKeywords.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => setActiveKeyword(kw === activeKeyword ? null : kw)}
              className={`rounded-sm px-2.5 py-1 font-mono text-xs ${
                activeKeyword === kw ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {kw}
            </button>
          ))}
          </div>
          {/* 연구 동향의 "+ 논문 추가"와 같은 자리·같은 모양 — 목록 위 오른쪽 끝 */}
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="shrink-0 rounded-sm bg-zinc-900 px-2.5 py-1 font-mono text-xs text-white hover:bg-zinc-700"
            >
              + 구술 추가
            </button>
          )}
        </div>
      </div>

      {adding && <AddSegmentForm onClose={() => setAdding(false)} />}

      <div className="grid grid-cols-[64px_1fr] gap-4 border-t border-b border-zinc-200 px-1 py-2 sm:grid-cols-[88px_1fr_110px]">
        <button
          type="button"
          onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
          className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-zinc-800"
        >
          연도 {sortDirection === "asc" ? "▲" : "▼"}
        </button>
        <div />
        <div className="hidden sm:block" />
      </div>

      <div>
        {filtered.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-zinc-400">
            일치하는 구술 발췌가 없습니다.
          </p>
        ) : (
          filtered.map((segment, i) => (
            <SegmentRow
              key={segment.id}
              data={segment}
              zebra={i % 2 === 1}
              highlighted={segment.id === focusId}
            />
          ))
        )}
      </div>
    </div>
  );
}
