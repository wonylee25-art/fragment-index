"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tag } from "./Tag";
import { MemoField } from "./MemoField";
import { AddEventPanel, EventRowControls } from "./EventEditor";
import { hideEvents } from "@/lib/event-actions";
import { UnlinkButton } from "./UnlinkButton";
import { saveTimelineMemo } from "@/lib/memo-actions";
import { ArchiveItemType, RelatedItem, SegmentCardData, TimelineEventData } from "@/lib/types";
import { edtfSortKey, edtfYearFloat, formatEdtfToKorean } from "@/lib/edtf";
import { narratorPullQuote } from "@/lib/quotes";
import { osmUrl } from "@/lib/geo";
import { downloadCsv, eventsToCsv } from "@/lib/csv";
import {
  ARCHIVE_ITEM_ICON,
  TEXT_BODY_CLASSNAME,
  TEXT_SUBHEAD_CLASSNAME,
} from "@/lib/design-tokens";

type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { value: SortDirection; label: string }[] = [
  { value: "asc", label: "과거순" },
  { value: "desc", label: "최신순" },
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
  이미지: "bg-gradient-to-br from-zinc-200 to-zinc-400",
  학술: "bg-gradient-to-br from-blue-100 to-blue-200",
  지도: "bg-gradient-to-br from-blue-50 to-blue-200",
  박물: "bg-gradient-to-br from-rose-100 to-rose-200",
  음원: "bg-gradient-to-br from-teal-100 to-teal-200",
  영상: "bg-gradient-to-br from-indigo-100 to-indigo-300",
};

// 사료 유형별 실제 물성 차이(이미지·지도·박물은 볼거리 위주라 크게, 신문·문서·학술·구술은 텍스트
// 위주라 작게)를 흉내 내 썸네일 높이를 다르게 준다 — 획일적인 그리드 대신 콜라주에 가깝게.
const MATERIAL_HEIGHT: Record<ArchiveItemType, string> = {
  이미지: "h-32",
  지도: "h-28",
  박물: "h-28",
  영상: "h-28",
  음원: "h-20",
  구술: "h-20",
  신문: "h-16",
  문서: "h-16",
  학술: "h-16",
};

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
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [collection, setCollection] = useState<Set<string>>(new Set());
  const [collectionName, setCollectionName] = useState("나의 컬렉션");

  const segmentById = useMemo(() => {
    const map = new Map<string, SegmentCardData>();
    segments.forEach((s) => map.set(s.id, s));
    return map;
  }, [segments]);

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
      (e) => matchesQuery(e, q) && matchesYearRange(e, yearRange.from, yearRange.to),
    );
    return sortDirection === "asc" ? base : [...base].reverse();
  }, [sortedAll, sortDirection, query, yearRange]);

  function toggleCollection(id: string) {
    setCollection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 지금 걸린 검색·필터를 그대로 살려 "보이는 것 전부"를 고른다 — 일괄 숨김의 재료가 된다.
  const allVisibleSelected = visible.length > 0 && visible.every((e) => collection.has(e.id));
  const someVisibleSelected = visible.some((e) => collection.has(e.id));

  function toggleSelectAllVisible() {
    setCollection((prev) => {
      const next = new Set(prev);
      for (const event of visible) {
        if (allVisibleSelected) next.delete(event.id);
        else next.add(event.id);
      }
      return next;
    });
  }

  // 고른 사건을 한꺼번에 숨긴다. 화면에서만 내리는 것이라 되돌리기는 아래 "숨긴 사건" 목록에서.
  async function handleBulkHide() {
    await hideEvents([...collection]);
    setCollection(new Set());
  }

  // 컬렉션 이름은 CSV를 만들 때만 묻는다 — 늘 떠 있는 입력 칸으로 두면 쓰는 때보다
  // 자리만 차지하는 때가 훨씬 길다. 취소하면 내려받지 않는다.
  function handleExportCsv() {
    const picked = sortedAll.filter((e) => collection.has(e.id));
    const name = window.prompt(`CSV로 내보낼 ${picked.length}건의 이름`, collectionName);
    if (name === null) return;
    const trimmed = name.trim() || "연표컬렉션";
    setCollectionName(trimmed);
    downloadCsv(trimmed, eventsToCsv(picked));
  }

  return (
    <div className="bg-white">
      <div className="page-shell pt-5">
        {/* 표 위 도구는 한 줄로 끝낸다 — 검색·연도·정렬. 사건을 고르면 표 헤더 줄이 그대로
            선택 도구가 되므로, 그때도 겹이 늘지 않는다. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 pb-3">
          {/* 검색 칸은 한 줄을 다 먹지 않는다 — 넓다고 더 찾아지는 것도 아니고,
              옆의 연도·정렬이 밀려나면 그것들을 찾느라 다시 눈이 돌아간다. */}
          <label className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-400">검색</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사건명, 장소, 키워드"
              className="w-52 rounded-sm border border-zinc-300 bg-white px-2.5 py-1 font-mono text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-orange-400 focus:outline-none"
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
              className="w-16 rounded-sm border border-zinc-300 bg-white px-2 py-1 text-center text-xs tabular-nums text-zinc-700 placeholder:text-zinc-300 focus:border-orange-400 focus:outline-none"
            />
            <span className="text-zinc-400">–</span>
            <input
              type="number"
              inputMode="numeric"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder={String(TIMELINE_END)}
              aria-label="끝 연도"
              className="w-16 rounded-sm border border-zinc-300 bg-white px-2 py-1 text-center text-xs tabular-nums text-zinc-700 placeholder:text-zinc-300 focus:border-orange-400 focus:outline-none"
            />
          </div>
          {/* 정렬은 표 헤더의 화살표에만 숨어 있었다 — 연표에서 과거순·최신순은 훑는 방향을
              정하는 필터에 가까우므로, 검색·연도와 같은 줄에 이름을 달고 나와 있게 한다. */}
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-400">정렬</span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSortDirection(option.value)}
                className={`rounded-sm px-2 py-1 ${
                  sortDirection === option.value
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* 사건 추가는 도구 줄 오른쪽 끝 — 연표를 훑다 "없네" 싶은 순간 눈이 이미 이 줄에 있다 */}
          {mode === "admin" && <AddEventPanel />}
        </div>

        {/* 표 헤더 — 사료 · 날짜 · 사건명(키워드) · 내용(출처) · 구술 5단 구성.
            고른 사건이 있으면 이 줄이 그대로 선택 도구로 바뀐다 — 새 막대를 얹지 않는다. */}
        {collection.size > 0 ? (
          <SelectionHeader
            mode={mode}
            count={collection.size}
            allSelected={allVisibleSelected}
            someSelected={someVisibleSelected}
            onToggleAll={toggleSelectAllVisible}
            onExport={handleExportCsv}
            onHide={handleBulkHide}
            onClear={() => setCollection(new Set())}
          />
        ) : (
          <div className="mt-4 hidden grid-cols-[220px_84px_1fr_1fr_280px] gap-x-5 border-b-2 border-zinc-900 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500 sm:grid">
            <span>사료</span>
            {/* 행마다 붙는 체크박스와 같은 자리에 "보이는 것 모두" 스위치를 둔다 — 검색·필터로 좁힌
                다음 여기서 한 번에 고르면, 이 줄이 곧바로 선택 도구로 바뀐다. */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                }}
                onChange={toggleSelectAllVisible}
                title={allVisibleSelected ? "보이는 사건 선택 해제" : `보이는 ${visible.length}건 모두 선택`}
                aria-label={allVisibleSelected ? "보이는 사건 선택 해제" : `보이는 ${visible.length}건 모두 선택`}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-orange-500"
              />
              {/* 정렬은 위 줄에 나와 있지만, 표를 읽다 방향을 바꾸고 싶을 때 손이 가는 곳은
                  날짜 칸 머리다 — 같은 값을 여기서도 뒤집는다. */}
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                className="text-left hover:text-zinc-900"
              >
                날짜 {sortDirection === "asc" ? "▲" : "▼"}
              </button>
            </div>
            <span>사건명</span>
            <span>내용</span>
            <span>구술</span>
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
              linkedSegments={event.linkedSegmentIds
                .map((id) => segmentById.get(id))
                .filter((s): s is SegmentCardData => !!s)}
              inCollection={collection.has(event.id)}
              onToggleCollection={() => toggleCollection(event.id)}
            />
          ))
        )}
      </div>

    </div>
  );
}

// 사료 연결에서 저장했거나 직접 만든 사건 표시 — 그냥 나열되지 않고
// 눈에 띄게(초록 배지 + 왼쪽 테두리, EventEntry에서 함께 적용) 구분한다.
function SavedBadge() {
  return (
    <span
      title="사료 연결에서 저장했거나 직접 만든 사건"
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
  linkedSegments,
  inCollection,
  onToggleCollection,
}: {
  event: TimelineEventData;
  mode: TimelineMode;
  linkedSegments: SegmentCardData[];
  inCollection: boolean;
  onToggleCollection: () => void;
}) {
  const hasCrossing = linkedSegments.length > 0;

  return (
    <div
      className={`grid grid-cols-1 gap-x-5 gap-y-3 py-4 sm:grid-cols-[220px_84px_1fr_1fr_280px] ${
        hasCrossing ? "border-b border-orange-200 bg-orange-50/40" : "border-b border-zinc-200"
      } ${event.savedByUser ? "border-l-2 border-l-emerald-400 pl-3" : ""}`}
    >
      {/* 사료 — 다른 아카이브에서 가져온 자료. 다른 컬럼보다 넓게 잡아 이미지가 잘 보이게 한다 */}
      <div className="flex flex-col gap-2.5">
        {event.linkedMaterials.length === 0 ? (
          <span className="font-mono text-[10px] text-zinc-300">—</span>
        ) : (
          event.linkedMaterials.map((material) => (
            <MaterialThumb key={material.id} material={material} eventId={event.id} mode={mode} />
          ))
        )}
      </div>

      {/* 날짜 */}
      <div className="flex items-start gap-2">
        {/* 체크박스로 둔다 — 별표는 중요도 표시로 읽혀서, 고르는 일과 뜻이 어긋난다. */}
        <input
          type="checkbox"
          checked={inCollection}
          onChange={onToggleCollection}
          title={inCollection ? "컬렉션에서 빼기" : "컬렉션에 담기"}
          aria-label={`${event.eventName} 고르기`}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-orange-500"
        />
        <span className="font-mono text-[11px] leading-5 text-zinc-500">{formatEdtfToKorean(event.dateValue)}</span>
      </div>

      {/* 사건명 + 하단 키워드 */}
      <div className="min-w-0">
        {/* 사건명은 본문과 같은 고딕(Gothic A1)이다. 여기만 명조로 두었더니 다른 화면의
            제목들(논문 제목·기관명)과 서체가 갈려 사건명만 다른 종류의 글처럼 보였다.
            굵기는 font-bold(700) — layout.tsx가 받는 굵기는 400·500·700·800이라
            font-semibold(600)로 적으면 브라우저가 알아서 700으로 바꿔 그린다. */}
        <h3 className={`${TEXT_SUBHEAD_CLASSNAME} font-bold leading-snug text-zinc-900`}>
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
        <p className={`${TEXT_BODY_CLASSNAME} leading-5 text-zinc-600`}>{event.summary}</p>
        <p className="mt-1 font-mono text-[10px] text-zinc-400">
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 hover:text-zinc-700"
            >
              {event.sourceReference || event.sourceUrl}
            </a>
          ) : event.sourceReference.includes("국사편찬위원회") ? (
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
      <div className="flex flex-col gap-3">
        {linkedSegments.length === 0 ? (
          <span className="font-mono text-[10px] text-zinc-300">—</span>
        ) : (
          linkedSegments.map((segment) => (
            <OralQuote key={segment.id} segment={segment} eventId={event.id} mode={mode} />
          ))
        )}
      </div>

      {/* 메모 — 사료(썸네일)·구술(인용) 컬럼까지 넓히지 않고 날짜·사건명·내용 구간 너비에만 맞춘다 */}
      <div className="sm:col-start-2 sm:col-end-5">
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
            ? `font-serif ${TEXT_SUBHEAD_CLASSNAME} font-medium italic leading-6 text-zinc-900`
            : `font-serif ${TEXT_BODY_CLASSNAME} italic leading-5 text-zinc-800`
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

// WWA의 "Create Personal Collections and generate PDF readers"를 참고해, 사건을 골라 담고
// CSV로 내보내는 기능. 관리페이지에서는 같은 선택을 일괄 숨김의 대상으로도 쓴다 — 고르는
// 행위를 두 벌 만들지 않는다. 도구를 담는 자리는 표 헤더 줄 자신이다: 고른 것이 있는 동안
// 헤더가 이 줄로 바뀌므로 화면에 겹이 하나도 늘지 않고, 표를 따라 내려가도 늘 표 위에 있다.
function SelectionHeader({
  mode,
  count,
  allSelected,
  someSelected,
  onToggleAll,
  onExport,
  onHide,
  onClear,
}: {
  mode: TimelineMode;
  count: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onExport: () => void;
  onHide: () => Promise<void>;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleHide() {
    setPending(true);
    try {
      await onHide();
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  // 표를 따라 내려가는 동안에도 도구가 화면 위에 붙어 있게 한다 — 아래쪽에서 고른 사건을
  // 숨기려고 맨 위까지 되돌아가지 않아도 된다. 위 여백은 margin 대신 padding으로 두어야
  // 붙었을 때 그 틈으로 행이 비쳐 보이지 않는다.
  return (
    <div className="sticky top-0 z-20 hidden grid-cols-[220px_1fr] gap-x-5 border-b-2 border-zinc-900 bg-white pb-1.5 pt-4 sm:grid">
      {/* 사료 칸은 비워 둔다 — 체크박스가 아래 행들의 체크박스와 같은 세로선에 놓이게 */}
      <span />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = !allSelected && someSelected;
          }}
          onChange={onToggleAll}
          title={allSelected ? "보이는 사건 선택 해제" : "보이는 사건 모두 선택"}
          aria-label={allSelected ? "보이는 사건 선택 해제" : "보이는 사건 모두 선택"}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-orange-500"
        />
        {confirming ? (
          <>
            <span className="text-zinc-700">
              {count}건을 연표에서 내립니다 — DB는 그대로고, 아래 “숨긴 사건”에서 되돌립니다
            </span>
            <button
              type="button"
              onClick={handleHide}
              disabled={pending}
              className="ml-auto rounded-sm bg-zinc-900 px-2.5 py-0.5 text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {pending ? "숨기는 중…" : "숨김"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="text-zinc-400 hover:text-zinc-800"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span className="font-bold text-orange-600">{count}건 선택</span>
            <button type="button" onClick={onExport} className="text-zinc-500 hover:text-zinc-900">
              CSV
            </button>
            {mode === "admin" && (
              <button type="button" onClick={() => setConfirming(true)} className="text-zinc-500 hover:text-zinc-900">
                숨김
              </button>
            )}
            <button type="button" onClick={onClear} className="ml-auto text-zinc-400 hover:text-zinc-800">
              해제
            </button>
          </>
        )}
      </div>
    </div>
  );
}
