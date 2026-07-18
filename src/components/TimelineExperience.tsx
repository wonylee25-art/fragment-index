"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tag } from "./Tag";
import { TimelineRuler, TickRelation } from "./TimelineRuler";
import { ArchiveItemType, RelatedItem, SegmentCardData, TimelineEventData } from "@/lib/types";
import { edtfSortKey, edtfYear, edtfYearFloat, formatEdtfToKorean } from "@/lib/edtf";
import { narratorPullQuote } from "@/lib/quotes";
import { osmUrl } from "@/lib/geo";
import { downloadCsv, eventsToCsv } from "@/lib/csv";

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

const MATERIAL_ICON: Record<ArchiveItemType, string> = {
  구술: "🎙️",
  신문: "📰",
  문서: "🗂️",
  사진: "🖼️",
  논문: "📄",
  지도: "🗺️",
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

export function TimelineExperience({
  events,
  segments,
}: {
  events: TimelineEventData[];
  segments: SegmentCardData[];
}) {
  const [query, setQuery] = useState("");
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("full");
  const [collection, setCollection] = useState<Set<string>>(new Set());
  const [collectionName, setCollectionName] = useState("나의 컬렉션");

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

  const visible = useMemo(() => {
    const q = query.trim();
    const base = sortedAll.filter(
      (e) => (!activeKeyword || e.keywordTags.includes(activeKeyword)) && matchesQuery(e, q),
    );
    return sortDirection === "asc" ? base : [...base].reverse();
  }, [sortedAll, activeKeyword, sortDirection, query]);

  const keywords = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.keywordTags.forEach((k) => set.add(k)));
    return Array.from(set);
  }, [events]);

  // 눈금 좌표계 — 1900~2026 고정 도메인
  const toPct = (yearFloat: number) =>
    ((yearFloat - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 94 + 3;

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

  // 눈금선은 10년마다, 연도 라벨은 20년마다 (126년 도메인에서 겹치지 않게)
  const decades = useMemo(() => {
    const list = [];
    for (let y = TIMELINE_START; y <= TIMELINE_END; y += 10) {
      list.push({ year: y, leftPct: toPct(y), labeled: y % 20 === 0 });
    }
    return list;
  }, []);

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
      <TimelineRuler ticks={ticks} decades={decades} />

      {/* 표제부 — 한 줄로 최소화 */}
      <div className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-3">
          <h2 className="font-serif text-lg font-bold text-zinc-900">
            연표{" "}
            <span className="ml-1 font-mono text-xs font-normal text-zinc-400">
              {TIMELINE_START}–{TIMELINE_END}
            </span>
          </h2>
          <p className="font-mono text-[11px] text-zinc-400">
            사건 {sortedAll.length} · 교차점{" "}
            {sortedAll.filter((e) => e.linkedSegmentIds.length > 0).length}
          </p>
          <p className="ml-auto flex items-center gap-3 font-mono text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-[3px] bg-orange-500" />
              {query.trim() ? "검색어와 관련도 높음" : "구술과 직접 교차"}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-[2px] bg-blue-400" />
              {query.trim() ? "관련도 낮음" : "간접 연관"}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-[1px] bg-zinc-300" /> 무관
            </span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-5">
        {/* 검색 + 키워드 필터 + 표시 단위 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">검색</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="사건명, 내용, 장소, 키워드, 출처"
                className="w-full max-w-md rounded-sm border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-orange-400 focus:outline-none"
              />
            </label>
            <div className="ml-auto flex items-center gap-1 font-mono text-[11px]">
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
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 font-mono text-[11px]">
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

function EventEntry({
  event,
  detailLevel,
  linkedSegments,
  inCollection,
  onToggleCollection,
}: {
  event: TimelineEventData;
  detailLevel: DetailLevel;
  linkedSegments: SegmentCardData[];
  inCollection: boolean;
  onToggleCollection: () => void;
}) {
  const hasCrossing = linkedSegments.length > 0;

  if (detailLevel === "title") {
    return (
      <div className="grid grid-cols-[88px_1fr] gap-x-5 border-b border-zinc-200 py-2.5">
        <div className="font-mono text-[11px] leading-5 text-zinc-500">
          {formatEdtfToKorean(event.dateValue)}
        </div>
        <h3 className="font-serif text-[15px] font-semibold leading-snug text-zinc-900">
          {event.eventName}
        </h3>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-x-5 gap-y-3 py-4 ${
        detailLevel === "full"
          ? "sm:grid-cols-[220px_84px_1fr_1fr_280px]"
          : "sm:grid-cols-[84px_1fr_1fr]"
      } ${hasCrossing ? "border-b border-orange-200 bg-orange-50/40" : "border-b border-zinc-200"}`}
    >
      {/* 사료 — 다른 아카이브에서 가져온 자료. 다른 컬럼보다 넓게 잡아 이미지가 잘 보이게 한다 */}
      {detailLevel === "full" && (
        <div className="flex flex-col gap-2.5">
          {event.linkedMaterials.length === 0 ? (
            <span className="font-mono text-[10px] text-zinc-300">—</span>
          ) : (
            event.linkedMaterials.map((material) => <MaterialThumb key={material.id} material={material} />)
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
        <h3 className="font-serif text-[15px] font-semibold leading-snug text-zinc-900">{event.eventName}</h3>
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
            linkedSegments.map((segment) => <OralQuote key={segment.id} segment={segment} />)
          )}
        </div>
      )}
    </div>
  );
}

// 이미지(사료의 실제 물성을 흉내 낸 높이) → 제목 → 연결링크 순으로 세로로 쌓는다.
function MaterialThumb({ material }: { material: RelatedItem }) {
  return (
    <a href={material.sourceUrl} target="_blank" rel="noopener noreferrer" className="group block">
      <span
        className={`flex w-full items-center justify-center text-3xl shadow-sm ${MATERIAL_HEIGHT[material.type]} ${MATERIAL_SURFACE[material.type]}`}
      >
        {MATERIAL_ICON[material.type]}
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
  );
}

// 발췌가 짧을수록 임팩트 있는 한마디일 가능성이 높아 크게, 길수록 작게 — 구술 길이에 따라
// 인용구 크기가 자연스럽게 반응하도록 한다.
function OralQuote({ segment }: { segment: SegmentCardData }) {
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
          href={`/?focus=${segment.id}`}
          className="ml-1 text-orange-700 underline decoration-dotted underline-offset-4 hover:text-orange-900"
        >
          구술 전체 보기 ↗
        </Link>
      </p>
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
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
