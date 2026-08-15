"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tag } from "./Tag";
import { MemoField } from "./MemoField";
import { EventRowControls } from "./EventEditor";
import { UnlinkButton } from "./UnlinkButton";
import { TimelineRuler, TickRelation } from "./TimelineRuler";
import { Switch } from "./Switch";
import { saveTimelineMemo } from "@/lib/memo-actions";
import { ArchiveItemType, RelatedItem, SegmentCardData, TimelineEventData } from "@/lib/types";
import { edtfSortKey, edtfYear, edtfYearFloat, formatEdtfToKorean, yearToAxisPercent } from "@/lib/edtf";
import { narratorPullQuote } from "@/lib/quotes";
import { osmUrl } from "@/lib/geo";
import { downloadCsv, eventsToCsv } from "@/lib/csv";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";

type SortDirection = "asc" | "desc";
type DetailLevel = "full" | "content" | "title";

const DETAIL_LEVELS: { value: DetailLevel; label: string }[] = [
  { value: "full", label: "전체" },
  { value: "content", label: "내용만" },
  { value: "title", label: "제목만" },
];

// 연표가 다루는 전체 기간 — 데이터와 무관하게 고정 (서비스 범위 결정)
const TIMELINE_START = 1900;
const TIMELINE_END = 2026;

// E026~E120의 출처("근대사 연표"/"대한민국사 연표")가 나온 원본 데이터셋.
// 매 행마다 이 긴 이름을 다 보여주면 스캔하기 어려워지므로, 짧은 라벨은 그대로 두고
// 호버·클릭으로만 정식 명칭·원본 페이지에 닿을 수 있게 한다.
const HISTORY_TIMELINE_SOURCE = {
  title: "교육부 국사편찬위원회_우리역사넷 정보_오늘의역사(연표)_20211028",
  url: "https://www.data.go.kr/data/15053642/fileData.do",
};

// 실제 썸네일(오픈그래프 수집)이 붙기 전까지 사료의 물성을 흉내 내는 placeholder.
const MATERIAL_SURFACE: Record<ArchiveItemType, string> = {
  구술: "bg-gradient-to-br from-orange-100 to-orange-200",
  신문: "bg-gradient-to-br from-zinc-100 to-zinc-300",
  문서: "bg-gradient-to-br from-stone-100 to-stone-300",
  사진: "bg-gradient-to-br from-zinc-200 to-zinc-400",
  논문: "bg-gradient-to-br from-blue-100 to-blue-200",
  지도: "bg-gradient-to-br from-blue-50 to-blue-200",
};

// 사료 유형별 실제 물성 차이(사진·지도는 이미지 위주라 크게, 신문·문서·논문·구술은 텍스트
// 위주라 작게)를 흉내 내 썸네일 높이를 다르게 준다 — 획일적인 그리드 대신 콜라주에 가깝게.
const MATERIAL_HEIGHT: Record<ArchiveItemType, string> = {
  사진: "h-32",
  지도: "h-28",
  구술: "h-20",
  신문: "h-16",
  문서: "h-16",
  논문: "h-16",
};

// 사건-구술 관련도: 검색어가 있으면 텍스트 매칭 강도로, 없으면 그물망 연결 여부로 판단한다.
// high(주황) = 제목·키워드·장소에 매칭 / 구술과 직접 연결
// low(파랑)  = 내용·출처에서만 매칭 / 태그가 겹치는 간접 연관
// none(회색) = 무관
function relevanceOf(event: TimelineEventData, query: string, segmentTags: Set<string>): TickRelation {
  const q = query.trim();
  if (!q) {
    if (event.linkedSegmentIds.length > 0) return "high";
    const tags = [...event.places.map((p) => p.name), ...event.keywordTags];
    return tags.some((t) => segmentTags.has(t)) ? "low" : "none";
  }
  const primary = [event.eventName, ...event.keywordTags, ...event.places.map((p) => p.name)];
  const secondary = [event.summary, event.sourceReference];
  if (primary.some((t) => t.includes(q))) return "high";
  if (secondary.some((t) => t.includes(q))) return "low";
  return "none";
}

// 연도 범위 필터. 빈 칸은 그쪽 끝을 열어둔다는 뜻이고, 연도 미상 사건은 범위를 지정한 순간
// 제외한다 — 몇 년인지 모르는 것을 "1950~1960년에 속한다"고 볼 수는 없기 때문.
function matchesYearRange(event: TimelineEventData, from: number | null, to: number | null): boolean {
  if (from === null && to === null) return true;
  if (!event.dateValue) return false;
  const year = Math.floor(edtfYearFloat(event.dateValue));
  if (Number.isNaN(year)) return false;
  return (from === null || year >= from) && (to === null || year <= to);
}

function parseYearInput(value: string): number | null {
  const year = parseInt(value, 10);
  return Number.isNaN(year) ? null : year;
}

function matchesQuery(event: TimelineEventData, query: string): boolean {
  if (!query) return true;
  return (
    event.eventName.includes(query) ||
    event.summary.includes(query) ||
    event.sourceReference.includes(query) ||
    event.keywordTags.some((t) => t.includes(query)) ||
    event.places.some((p) => p.name.includes(query))
  );
}

// 사용자뷰(read)와 관리페이지(admin)가 같은 컴포넌트를 쓴다 — 연표 표시 로직(눈금·필터·표)은
// 양쪽이 똑같고, 다른 것은 조작 UI뿐이라 화면을 복제하는 대신 모드로 가른다.
// read  : 확정 연결선만 담긴 데이터를 받아 읽기만 한다. 메모는 해설로 보여주되 편집 불가.
// admin : 후보 연결선까지 담긴 데이터를 받고, 메모 편집·저장한 자료 필터가 열린다.
export type TimelineMode = "read" | "admin";

export function TimelineExperience({
  events,
  segments,
  mode = "read",
}: {
  events: TimelineEventData[];
  segments: SegmentCardData[];
  mode?: TimelineMode;
}) {
  const [query, setQuery] = useState("");
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [relationFilter, setRelationFilter] = useState<TickRelation | "all">("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("full");
  const [collection, setCollection] = useState<Set<string>>(new Set());
  const [collectionName, setCollectionName] = useState("나의 컬렉션");

  // 연표 위쪽 세 겹(눈금·표제부·키워드 칩)을 접을 수 있게 한다 — 표를 넓게 보고 싶을 때
  // 화면 절반을 차지하던 것들이다. 검색·연도·SCALE 줄은 접히지 않고 늘 위에 남는다.
  // 접은 상태는 기억하지 않는다 — 새로 열면 늘 펼친 상태다.
  const [showRuler, setShowRuler] = useState(true);
  const [showHeadline, setShowHeadline] = useState(true);
  const [showKeywords, setShowKeywords] = useState(true);

  const segmentById = useMemo(() => {
    const map = new Map<string, SegmentCardData>();
    segments.forEach((s) => map.set(s.id, s));
    return map;
  }, [segments]);

  const segmentTags = useMemo(
    () => new Set(segments.flatMap((s) => [...s.personPlaceTags, ...s.keywordTags])),
    [segments],
  );

  const sortedAll = useMemo(
    () => [...events].sort((a, b) => edtfSortKey(a.dateValue) - edtfSortKey(b.dateValue)),
    [events],
  );

  const yearRange = useMemo(
    () => ({ from: parseYearInput(yearFrom), to: parseYearInput(yearTo) }),
    [yearFrom, yearTo],
  );

  const visible = useMemo(() => {
    const q = query.trim();
    const base = sortedAll.filter(
      (e) =>
        (!activeKeyword || e.keywordTags.includes(activeKeyword)) &&
        matchesQuery(e, q) &&
        matchesYearRange(e, yearRange.from, yearRange.to) &&
        (relationFilter === "all" || relevanceOf(e, query, segmentTags) === relationFilter) &&
        (!savedOnly || e.savedByUser),
    );
    return sortDirection === "asc" ? base : [...base].reverse();
  }, [sortedAll, activeKeyword, sortDirection, query, relationFilter, segmentTags, savedOnly, yearRange]);

  const keywords = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.keywordTags.forEach((k) => set.add(k)));
    return Array.from(set);
  }, [events]);

  // 눈금 좌표계 — 1900~2026 고정 도메인
  const toPct = (yearFloat: number) => yearToAxisPercent(yearFloat, TIMELINE_START, TIMELINE_END);

  // 바코드는 검색·필터로 걸러진 목록이 아니라 전체 사건을 대상으로, 관련도만 색으로 표시한다.
  const ticks = useMemo(
    () =>
      sortedAll.map((e) => ({
        id: e.id,
        title: `${edtfYear(e.dateValue)} · ${e.eventName}`,
        leftPct: toPct(edtfYearFloat(e.dateValue)),
        relation: relevanceOf(e, query, segmentTags),
      })),
    [sortedAll, segmentTags, query],
  );

  // 연도 범위 필터가 걸린 구간을 바코드에도 표시한다 — 범위 밖에 음영을 깐다.
  // 끝 연도는 그 해를 포함하므로 다음 해 시작(to + 1)까지가 밝은 구간이다.
  const rulerRange = useMemo(() => {
    if (yearRange.from === null && yearRange.to === null) return null;
    const clamp = (pct: number) => Math.min(100, Math.max(0, pct));
    return {
      fromPct: yearRange.from === null ? 0 : clamp(toPct(yearRange.from)),
      toPct: yearRange.to === null ? 100 : clamp(toPct(yearRange.to + 1)),
    };
  }, [yearRange]);

  // 눈금선은 10년마다, 연도 라벨은 20년마다 (126년 도메인에서 겹치지 않게)
  const decades = useMemo(() => {
    const list = [];
    for (let y = TIMELINE_START; y <= TIMELINE_END; y += 10) {
      list.push({ year: y, leftPct: toPct(y), labeled: y % 20 === 0 });
    }
    return list;
  }, []);

  // 표제부에 걸 수 있는 필터들 — 표제부를 접으면 해제 버튼도 같이 사라지므로,
  // 접힌 상태에서도 "걸려 있음"을 알리고 풀 수 있도록 조건과 해제를 따로 뽑아둔다.
  const headlineFilterOn = relationFilter !== "all" || savedOnly || Boolean(yearFrom) || Boolean(yearTo);

  function clearHeadlineFilters() {
    setRelationFilter("all");
    setSavedOnly(false);
    setYearFrom("");
    setYearTo("");
  }

  function toggleCollection(id: string) {
    setCollection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExportCsv() {
    const picked = sortedAll.filter((e) => collection.has(e.id));
    downloadCsv(collectionName || "연표컬렉션", eventsToCsv(picked));
  }

  return (
    <div className="bg-white">
      {showRuler && <TimelineRuler ticks={ticks} decades={decades} range={rulerRange} />}

      {/* 표제부 — 페이지 제목(SiteHeader의 "연표")과 중복되지 않게 기간·통계만 한 줄로 */}
      {showHeadline && (
      <div className="border-b border-zinc-200">
        <div className="page-shell flex flex-wrap items-baseline gap-x-5 gap-y-1 py-3">
          <p className="font-mono text-xs text-zinc-400">
            {TIMELINE_START}–{TIMELINE_END} · 사건{" "}
            {visible.length === sortedAll.length ? sortedAll.length : `${visible.length} / ${sortedAll.length}`} · 교차점{" "}
            {visible.filter((e) => e.linkedSegmentIds.length > 0).length}
          </p>
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px]">
            {/* "저장한 자료만"은 검토함에서 골라 저장했거나 직접 만든 사건인지를 묻는 관리용 필터다 */}
            {mode === "admin" && (
              <>
                <button
                  type="button"
                  onClick={() => setSavedOnly((v) => !v)}
                  title="검토함에서 저장했거나 직접 만든 사건만 보기"
                  className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 ${
                    savedOnly ? "bg-emerald-100 text-emerald-700" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  }`}
                >
                  <span aria-hidden>✓</span>
                  저장한 자료만 ({sortedAll.filter((e) => e.savedByUser).length})
                </button>
                <span className="h-3 w-px bg-zinc-200" />
              </>
            )}
            <button
              type="button"
              onClick={() => setRelationFilter(relationFilter === "high" ? "all" : "high")}
              title="이 항목만 보기"
              className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 ${
                relationFilter === "high" ? "bg-orange-100 text-orange-700" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              }`}
            >
              <span className="inline-block h-2.5 w-[3px] bg-orange-500" />
              {query.trim() ? "검색어와 관련도 높음" : "구술과 직접 교차"}
            </button>
            <button
              type="button"
              onClick={() => setRelationFilter(relationFilter === "low" ? "all" : "low")}
              title="이 항목만 보기"
              className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 ${
                relationFilter === "low" ? "bg-blue-100 text-blue-700" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              }`}
            >
              <span className="inline-block h-2.5 w-[2px] bg-blue-400" />
              {query.trim() ? "관련도 낮음" : "간접 연관"}
            </button>
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-zinc-300">
              <span className="inline-block h-2.5 w-[1px] bg-zinc-300" /> 무관
            </span>
            {headlineFilterOn && (
              <button
                type="button"
                onClick={clearHeadlineFilters}
                className="ml-1 text-zinc-400 underline decoration-dotted underline-offset-2 hover:text-zinc-800"
              >
                필터 해제
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      <div className="page-shell pt-5">
        {/* 검색 + 키워드 필터 + 표시 단위 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2">
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-400">검색</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="사건명, 내용, 장소, 키워드, 출처"
                className="w-full rounded-sm border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-orange-400 focus:outline-none"
              />
            </label>
            {/* 연도 범위 — 빈 칸은 그쪽 끝을 열어둔다 */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">연도</span>
              <input
                type="number"
                inputMode="numeric"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder={String(TIMELINE_START)}
                aria-label="시작 연도"
                className="w-16 rounded-sm border border-zinc-300 bg-white px-2 py-1.5 text-center text-xs tabular-nums text-zinc-700 placeholder:text-zinc-300 focus:border-orange-400 focus:outline-none"
              />
              <span className="text-zinc-400">–</span>
              <input
                type="number"
                inputMode="numeric"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder={String(TIMELINE_END)}
                aria-label="끝 연도"
                className="w-16 rounded-sm border border-zinc-300 bg-white px-2 py-1.5 text-center text-xs tabular-nums text-zinc-700 placeholder:text-zinc-300 focus:border-orange-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="mr-1 text-zinc-400">SCALE —</span>
              {DETAIL_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setDetailLevel(level.value)}
                  className={`rounded-sm px-2 py-1 ${
                    detailLevel === level.value
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>

            {/* 위쪽 세 겹을 접었다 펴는 on/off — 검색 줄 오른쪽 끝에 붙인다.
                접혀도 걸어둔 값은 살아 있다(접기는 보기만 바꾼다). */}
            <div className="ml-auto flex items-center gap-x-3 font-mono text-[11px]">
              {(
                [
                  { label: "눈금", on: showRuler, toggle: () => setShowRuler((v) => !v) },
                  { label: "교차점", on: showHeadline, toggle: () => setShowHeadline((v) => !v) },
                  { label: "키워드", on: showKeywords, toggle: () => setShowKeywords((v) => !v) },
                ] as const
              ).map((item) => (
                <Switch key={item.label} label={item.label} on={item.on} onToggle={item.toggle} />
              ))}
            </div>
          </div>

          {/* 접힌 줄에 필터가 걸려 있으면 목록이 왜 줄었는지 알 길이 없다 — 여기서 알리고 푼다 */}
          {((!showHeadline && headlineFilterOn) || (!showKeywords && activeKeyword)) && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              {!showHeadline && headlineFilterOn && (
                <button
                  type="button"
                  onClick={clearHeadlineFilters}
                  className="rounded-sm bg-orange-100 px-2 py-1 text-orange-700 hover:bg-orange-200"
                >
                  교차점 필터 걸림 · 해제
                </button>
              )}
              {!showKeywords && activeKeyword && (
                <button
                  type="button"
                  onClick={() => setActiveKeyword(null)}
                  className="rounded-sm bg-orange-100 px-2 py-1 text-orange-700 hover:bg-orange-200"
                >
                  키워드 “{activeKeyword}” · 해제
                </button>
              )}
            </div>
          )}
          <div
            className={`flex-wrap items-baseline gap-x-4 gap-y-1.5 font-mono text-[11px] ${showKeywords ? "flex" : "hidden"}`}
          >
            <span className="text-zinc-400">필터 · 제안 키워드 —</span>
            <button
              type="button"
              onClick={() => setActiveKeyword(null)}
              className={
                activeKeyword === null
                  ? "font-bold text-orange-600 underline underline-offset-4"
                  : "text-zinc-400 hover:text-zinc-800"
              }
            >
              전체
            </button>
            {keywords.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => setActiveKeyword(kw === activeKeyword ? null : kw)}
                className={
                  activeKeyword === kw
                    ? "font-bold text-orange-600 underline underline-offset-4"
                    : "text-zinc-400 hover:text-zinc-800"
                }
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* 표 헤더 — 사료 · 날짜 · 사건명(키워드) · 내용(출처) · 구술 5단 구성 */}
        {detailLevel !== "title" && (
          <div
            className={`mt-4 hidden gap-x-5 border-b-2 border-zinc-900 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500 sm:grid ${
              detailLevel === "full"
                ? "sm:grid-cols-[220px_84px_1fr_1fr_280px]"
                : "sm:grid-cols-[84px_1fr_1fr]"
            }`}
          >
            {detailLevel === "full" && <span>사료</span>}
            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
              className="text-left hover:text-zinc-900"
            >
              날짜 {sortDirection === "asc" ? "▲" : "▼"}
            </button>
            <span>사건명</span>
            <span>내용</span>
            {detailLevel === "full" && <span>구술</span>}
          </div>
        )}
        {detailLevel === "title" && (
          <div className="mt-4 flex items-center justify-between border-b-2 border-zinc-900 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
              className="hover:text-zinc-900"
            >
              날짜 {sortDirection === "asc" ? "▲ 과거순" : "▼ 최신순"}
            </button>
            <span>연표</span>
          </div>
        )}

        {/* 표 본문 */}
        {visible.length === 0 ? (
          <p className="py-10 text-center font-mono text-xs text-zinc-400">
            일치하는 연표 항목이 없습니다.
          </p>
        ) : (
          visible.map((event) => (
            <EventEntry
              key={event.id}
              event={event}
              mode={mode}
              detailLevel={detailLevel}
              linkedSegments={event.linkedSegmentIds
                .map((id) => segmentById.get(id))
                .filter((s): s is SegmentCardData => !!s)}
              inCollection={collection.has(event.id)}
              onToggleCollection={() => toggleCollection(event.id)}
            />
          ))
        )}
      </div>

      <CollectionBar
        count={collection.size}
        name={collectionName}
        onNameChange={setCollectionName}
        onExport={handleExportCsv}
        onClear={() => setCollection(new Set())}
      />
    </div>
  );
}

// 검토함에서 저장했거나 직접 만든 사건 표시 — 그냥 나열되지 않고
// 눈에 띄게(초록 배지 + 왼쪽 테두리, EventEntry에서 함께 적용) 구분한다.
function SavedBadge() {
  return (
    <span
      title="검토함에서 저장했거나 직접 만든 사건"
      className="ml-2 inline-flex items-center gap-0.5 rounded-sm bg-emerald-100 px-1.5 py-0.5 align-middle font-mono text-[10px] font-normal text-emerald-700"
    >
      ✓ 저장됨
    </span>
  );
}

// 큐레이터 메모. 관리페이지에서는 편집할 수 있고, 사용자뷰에서는 사건 해설로 읽히기만 한다.
function CuratorMemo({ event, mode }: { event: TimelineEventData; mode: TimelineMode }) {
  if (mode === "admin") {
    return <MemoField initialValue={event.userMemo} onSave={(memo) => saveTimelineMemo(event.id, memo)} />;
  }
  if (!event.userMemo) return null;
  return (
    <p className="mt-1.5 rounded-sm border border-amber-200 bg-amber-50 p-2 font-mono text-xs leading-4 whitespace-pre-wrap text-zinc-700">
      {event.userMemo}
    </p>
  );
}

function EventEntry({
  event,
  mode,
  detailLevel,
  linkedSegments,
  inCollection,
  onToggleCollection,
}: {
  event: TimelineEventData;
  mode: TimelineMode;
  detailLevel: DetailLevel;
  linkedSegments: SegmentCardData[];
  inCollection: boolean;
  onToggleCollection: () => void;
}) {
  const hasCrossing = linkedSegments.length > 0;

  if (detailLevel === "title") {
    return (
      <div
        className={`grid grid-cols-[88px_1fr] gap-x-5 border-b border-zinc-200 py-2.5 ${
          event.savedByUser ? "border-l-2 border-l-emerald-400 pl-2" : ""
        }`}
      >
        <div className="font-mono text-[11px] leading-5 text-zinc-500">
          {formatEdtfToKorean(event.dateValue)}
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-[15px] font-semibold leading-snug text-zinc-900">
            {event.eventName}
            {mode === "admin" && event.savedByUser && <SavedBadge />}
          </h3>
          <CuratorMemo event={event} mode={mode} />
          {mode === "admin" && <EventRowControls event={event} />}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-x-5 gap-y-3 py-4 ${
        detailLevel === "full"
          ? "sm:grid-cols-[220px_84px_1fr_1fr_280px]"
          : "sm:grid-cols-[84px_1fr_1fr]"
      } ${hasCrossing ? "border-b border-orange-200 bg-orange-50/40" : "border-b border-zinc-200"} ${
        event.savedByUser ? "border-l-2 border-l-emerald-400 pl-3" : ""
      }`}
    >
      {/* 사료 — 다른 아카이브에서 가져온 자료. 다른 컬럼보다 넓게 잡아 이미지가 잘 보이게 한다 */}
      {detailLevel === "full" && (
        <div className="flex flex-col gap-2.5">
          {event.linkedMaterials.length === 0 ? (
            <span className="font-mono text-[10px] text-zinc-300">—</span>
          ) : (
            event.linkedMaterials.map((material) => (
              <MaterialThumb key={material.id} material={material} eventId={event.id} mode={mode} />
            ))
          )}
        </div>
      )}

      {/* 날짜 */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggleCollection}
          title={inCollection ? "컬렉션에서 빼기" : "컬렉션에 담기"}
          className={`font-mono text-xs leading-none ${
            inCollection ? "text-orange-500" : "text-zinc-300 hover:text-orange-400"
          }`}
        >
          {inCollection ? "★" : "☆"}
        </button>
        <span className="font-mono text-[11px] leading-5 text-zinc-500">{formatEdtfToKorean(event.dateValue)}</span>
      </div>

      {/* 사건명 + 하단 키워드 */}
      <div className="min-w-0">
        <h3 className="font-serif text-[15px] font-semibold leading-snug text-zinc-900">
          {event.eventName}
          {mode === "admin" && event.savedByUser && <SavedBadge />}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {event.places.map((p) => (
            <Tag key={p.name} label={p.name} variant="personPlace" href={osmUrl(p)} />
          ))}
          {event.keywordTags.map((t) => (
            <Tag key={t} label={t} variant="keyword" />
          ))}
        </div>
      </div>

      {/* 내용 + 하단 출처 */}
      <div className="min-w-0">
        <p className="text-[13px] leading-5 text-zinc-600">{event.summary}</p>
        <p className="mt-1 font-mono text-[10px] text-zinc-400">
          {event.sourceReference.includes("국사편찬위원회") ? (
            <a
              href={HISTORY_TIMELINE_SOURCE.url}
              target="_blank"
              rel="noopener noreferrer"
              title={HISTORY_TIMELINE_SOURCE.title}
              className="underline decoration-dotted underline-offset-4 hover:text-zinc-700"
            >
              {event.sourceReference}
            </a>
          ) : (
            event.sourceReference
          )}
        </p>
      </div>

      {/* 구술 — 교차하는 구술 인용. 다른 컬럼보다 넓게 잡아 발췌가 잘 읽히게 한다 */}
      {detailLevel === "full" && (
        <div className="flex flex-col gap-3">
          {linkedSegments.length === 0 ? (
            <span className="font-mono text-[10px] text-zinc-300">—</span>
          ) : (
            linkedSegments.map((segment) => (
              <OralQuote key={segment.id} segment={segment} eventId={event.id} mode={mode} />
            ))
          )}
        </div>
      )}

      {/* 메모 — 사료(썸네일)·구술(인용) 컬럼까지 넓히지 않고 날짜·사건명·내용 구간 너비에만 맞춘다 */}
      <div className={detailLevel === "full" ? "sm:col-start-2 sm:col-end-5" : "sm:col-span-full"}>
        <CuratorMemo event={event} mode={mode} />
        {mode === "admin" && <EventRowControls event={event} />}
      </div>
    </div>
  );
}

// 이미지(사료의 실제 물성을 흉내 낸 높이) → 제목 → 연결링크 순으로 세로로 쌓는다.
function MaterialThumb({
  material,
  eventId,
  mode,
}: {
  material: RelatedItem;
  eventId: string;
  mode: TimelineMode;
}) {
  return (
    <div className="flex flex-col">
    <a href={material.sourceUrl} target="_blank" rel="noopener noreferrer" className="group block">
      <span
        className={`flex w-full items-center justify-center text-3xl shadow-sm ${MATERIAL_HEIGHT[material.type]} ${MATERIAL_SURFACE[material.type]}`}
      >
        {ARCHIVE_ITEM_ICON[material.type]}
      </span>
      <p className="mt-1.5 font-mono text-[11px] font-semibold leading-4 text-zinc-700 group-hover:text-orange-600">
        {material.title}
      </p>
      <p className="mt-0.5 font-mono text-[10px] leading-4 text-zinc-400">
        {material.type} ·{" "}
        <span className="underline decoration-dotted underline-offset-2 group-hover:text-orange-600">
          {material.sourceOrg} ↗
        </span>
      </p>
    </a>
      {mode === "admin" && (
        <UnlinkButton eventId={eventId} targetType="archive_item" targetId={material.id} />
      )}
    </div>
  );
}

// 발췌가 짧을수록 임팩트 있는 한마디일 가능성이 높아 크게, 길수록 작게 — 구술 길이에 따라
// 인용구 크기가 자연스럽게 반응하도록 한다.
function OralQuote({
  segment,
  eventId,
  mode,
}: {
  segment: SegmentCardData;
  eventId: string;
  mode: TimelineMode;
}) {
  const quote = narratorPullQuote(segment);
  const isShort = quote.length <= 45;
  return (
    <div className="border-l-2 border-orange-400 pl-3">
      <p
        className={
          isShort
            ? "font-serif text-[17px] font-medium italic leading-6 text-zinc-900"
            : "font-serif text-[13px] italic leading-5 text-zinc-800"
        }
      >
        “{quote}”
      </p>
      <p className="mt-1 font-mono text-[10px] text-zinc-400">
        — {segment.itemTitle}{" "}
        {segment.notes && (
          <span className="cursor-help underline decoration-dotted" title={segment.notes}>
            📝
          </span>
        )}{" "}
        <Link
          href={`/segments?focus=${segment.id}`}
          className="ml-1 text-orange-700 underline decoration-dotted underline-offset-4 hover:text-orange-900"
        >
          구술 전체 보기 ↗
        </Link>
      </p>
      {mode === "admin" && (
        <UnlinkButton eventId={eventId} targetType="segment" targetId={segment.id} />
      )}
    </div>
  );
}

// WWA의 "Create Personal Collections and generate PDF readers"를 참고해,
// 사건을 골라 담고 CSV로 내보내는 기능. 브라우저 세션 안에서만 유지되는 목업 상태.
function CollectionBar({
  count,
  name,
  onNameChange,
  onExport,
  onClear,
}: {
  count: number;
  name: string;
  onNameChange: (v: string) => void;
  onExport: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-0 z-30 border-t border-zinc-900 bg-white/95 backdrop-blur-sm">
      <div className="page-shell flex flex-wrap items-center gap-3 py-2.5">
        <span className="font-mono text-[11px] text-zinc-500">
          컬렉션에 <span className="font-bold text-orange-600">{count}개</span> 담김
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="컬렉션 이름"
          className="rounded-sm border border-zinc-300 bg-white px-2.5 py-1 font-mono text-xs text-zinc-700 focus:border-orange-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={onExport}
          className="rounded-sm bg-orange-500 px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-orange-600"
        >
          CSV 생성
        </button>
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[11px] text-zinc-400 hover:text-zinc-800"
        >
          비우기
        </button>
      </div>
    </div>
  );
}
