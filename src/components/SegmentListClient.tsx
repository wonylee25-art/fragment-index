"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SegmentRow } from "./SegmentRow";
import { OralIntakeForm } from "./OralIntakeForm";
import { EventOption } from "./EventPicker";
import { SourceOption } from "@/lib/db";
import { PersonBrief, SegmentCardData } from "@/lib/types";
import { edtfSortKey } from "@/lib/edtf";
import {
  ADD_BUTTON_CLASSNAME,
  INPUT_CLASSNAME,
  TOGGLE_BUTTON_CLASSNAME,
  TOGGLE_OFF_CLASSNAME,
  TOGGLE_ON_CLASSNAME,
} from "@/lib/design-tokens";

type SortDirection = "asc" | "desc";

// 연표와 같은 말을 쓴다 — 같은 자료를 두 화면에서 다르게 부르면 같은 것인지 알 수 없다.
const SORT_OPTIONS: { value: SortDirection; label: string }[] = [
  { value: "asc", label: "과거순" },
  { value: "desc", label: "최신순" },
];

// URL의 ?focus= 만 브라우저에서 읽어 위로 올린다. 이 값을 페이지의 searchParams로 받으면
// /segments 라우트 전체가 요청 시점 렌더링으로 내려가 목록을 열 때마다 DB 왕복을 기다리게
// 된다(segments/page.tsx 참고). useSearchParams는 프리렌더된 라우트에서 가장 가까운 Suspense
// 경계까지를 클라이언트 렌더로 돌리므로, 아무것도 그리지 않는 이 잎만 경계 안에 둔다 —
// 목록 자체는 빌드 때 만든 HTML 그대로 나온다.
function FocusParam({ onChange }: { onChange: (id: string | null) => void }) {
  const focus = useSearchParams().get("focus");
  useEffect(() => {
    onChange(focus);
  }, [focus, onChange]);
  return null;
}

export function SegmentListClient({
  segments,
  persons,
  sources,
  events,
}: {
  segments: SegmentCardData[];
  persons: PersonBrief[];
  sources: SourceOption[];
  events: EventOption[];
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [adding, setAdding] = useState(false);
  // 고치는 중인 발췌. 행 자리에 폼이 대신 펼쳐진다 — 어느 줄을 고치는 중인지가
  // 위치로 드러나서, 폼 안에 "무엇을 고치는 중"이라고 또 적을 필요가 없다.
  const [editingId, setEditingId] = useState<string | null>(null);

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
      <Suspense fallback={null}>
        <FocusParam onChange={setFocusId} />
      </Suspense>

      {/* 목록 위 도구는 한 줄로 끝낸다 — 검색·정렬·추가. 연표(TimelineExperience)가 먼저
          같은 모양으로 줄였고, 두 목록이 다른 규칙으로 열려 있을 이유가 없다.
          키워드는 개수가 정해져 있지 않아 이 줄 아래로 내린다 — 한 줄에 끼워 넣으면
          키워드가 늘어난 날 검색칸과 정렬이 어디로 밀릴지 알 수 없다. */}
      <div className="mb-3 flex flex-col gap-2 border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-grey">
              검색
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="인물, 장소, 본문"
              className={`w-52 ${INPUT_CLASSNAME}`}
            />
          </label>

          {/* 정렬은 표 헤더의 화살표에만 숨어 있었다 — 과거순·최신순은 훑는 방향을 정하는
              것이라 이름을 달고 나와 있어야 한다(연표에서 같은 판단을 이미 했다). */}
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-grey">정렬</span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSortDirection(option.value)}
                className={`${TOGGLE_BUTTON_CLASSNAME} ${
                  sortDirection === option.value ? TOGGLE_ON_CLASSNAME : TOGGLE_OFF_CLASSNAME
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 연구 동향의 "+ 논문 추가"와 같은 자리·같은 모양 — 도구 줄 오른쪽 끝 */}
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`ml-auto ${ADD_BUTTON_CLASSNAME}`}
            >
              + 구술 추가
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-grey">
            키워드
          </span>
          <button
            type="button"
            onClick={() => setActiveKeyword(null)}
            className={`px-2 py-0.5 font-mono text-[11px] ${TOGGLE_BUTTON_CLASSNAME} ${
              activeKeyword === null ? TOGGLE_ON_CLASSNAME : TOGGLE_OFF_CLASSNAME
            }`}
          >
            전체
          </button>
          {allKeywords.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => setActiveKeyword(kw === activeKeyword ? null : kw)}
              className={`px-2 py-0.5 font-mono text-[11px] ${TOGGLE_BUTTON_CLASSNAME} ${
                activeKeyword === kw ? TOGGLE_ON_CLASSNAME : TOGGLE_OFF_CLASSNAME
              }`}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {adding && (
        <OralIntakeForm
          persons={persons}
          sources={sources}
          events={events}
          onClose={() => setAdding(false)}
        />
      )}

      <div className="border-t border-line">
        {filtered.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-grey">
            일치하는 구술 발췌가 없습니다.
          </p>
        ) : (
          filtered.map((segment, i) =>
            segment.id === editingId ? (
              <OralIntakeForm
                key={segment.id}
                persons={persons}
                sources={sources}
                events={events}
                editing={segment}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <SegmentRow
                key={segment.id}
                data={segment}
                zebra={i % 2 === 1}
                highlighted={segment.id === focusId}
                onEdit={() => {
                  setAdding(false);
                  setEditingId(segment.id);
                }}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
