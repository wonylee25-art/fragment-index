"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Tag } from "./Tag";
import { OffTimelineFinder } from "./OffTimelineFinder";
import { MemoList } from "./MemoList";
import { AddEventPanel, EventRowControls } from "./EventEditor";
import { FlagToggle } from "./FlagToggle";
import { hideEvents } from "@/lib/event-actions";
import { setEventsHighlighted } from "@/lib/flag-actions";
import { saveEventSummaryHighlights } from "@/lib/highlight-actions";
import { HighlightableText } from "./HighlightableText";
import { UnlinkButton } from "./UnlinkButton";
import { addTimelineMemo, deleteMemo, updateMemo } from "@/lib/memo-actions";
import { ArchiveItemType, RelatedItem, SegmentCardData, TimelineEventData, UserMemo } from "@/lib/types";
import { edtfSortKey, edtfYearFloat, formatEdtfToKorean } from "@/lib/edtf";
import { narratorPullQuote } from "@/lib/quotes";
import { formatEventSource } from "@/lib/citation";
import { osmUrl } from "@/lib/geo";
import { downloadCsv, eventsToCsv } from "@/lib/csv";
import {
  ARCHIVE_ITEM_ICON,
  CHIP_CLASSNAME,
  DOT_CONFIRMED,
  DOT_MINE,
  INPUT_CLASSNAME,
  MATERIAL_THUMB_CLASSNAME,
  MINE_ROW_CLASSNAME,
  TEXT_BODY_CLASSNAME,
  TEXT_SUBHEAD_CLASSNAME,
  TOGGLE_BUTTON_CLASSNAME,
  TOGGLE_OFF_CLASSNAME,
  TOGGLE_ON_CLASSNAME,
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
    // 화면에 보이는 서지(풀린 것)와 적힌 그대로(SRC007) 둘 다에 걸리게 한다 — 눈에 보이는
    // 글로도, 대장 번호로도 찾을 수 있어야 한다.
    event.sourceLabel.includes(query) ||
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

  // 고른 사건에 한꺼번에 밑줄을 긋거나 지운다. 고른 것이 전부 이미 그어져 있으면 지우는
  // 쪽으로 뒤집는다 — 같은 자리에서 긋고 지울 수 있어야 잘못 그은 뒤 되돌아갈 데가 있다.
  const allSelectedHighlighted =
    collection.size > 0 && sortedAll.filter((e) => collection.has(e.id)).every((e) => e.highlighted);

  async function handleBulkHighlight() {
    await setEventsHighlighted([...collection], !allSelectedHighlighted);
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
    <div className="bg-background">
      <div className="page-shell pt-5">
        {/* 표 위 도구는 한 줄로 끝낸다 — 검색·연도·정렬. 사건을 고르면 표 헤더 줄이 그대로
            선택 도구가 되므로, 그때도 겹이 늘지 않는다. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
          {/* 검색 칸은 한 줄을 다 먹지 않는다 — 넓다고 더 찾아지는 것도 아니고,
              옆의 연도·정렬이 밀려나면 그것들을 찾느라 다시 눈이 돌아간다. */}
          <label className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-grey">검색</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사건명, 장소, 키워드"
              className={`w-52 ${INPUT_CLASSNAME}`}
            />
          </label>
          {/* 연도 범위 — 빈 칸은 그쪽 끝을 열어둔다 */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-[10px] uppercase tracking-wider text-grey">연도</span>
            <input
              type="number"
              inputMode="numeric"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder={String(TIMELINE_START)}
              aria-label="시작 연도"
              className={`w-16 text-center tabular-nums ${INPUT_CLASSNAME}`}
            />
            <span className="text-grey">–</span>
            <input
              type="number"
              inputMode="numeric"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder={String(TIMELINE_END)}
              aria-label="끝 연도"
              className={`w-16 text-center tabular-nums ${INPUT_CLASSNAME}`}
            />
          </div>
          {/* 정렬은 표 헤더의 화살표에만 숨어 있었다 — 연표에서 과거순·최신순은 훑는 방향을
              정하는 필터에 가까우므로, 검색·연도와 같은 줄에 이름을 달고 나와 있게 한다. */}
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
          {/* 사건 추가는 도구 줄 오른쪽 끝 — 연표를 훑다 "없네" 싶은 순간 눈이 이미 이 줄에 있다 */}
          {mode === "admin" && <AddEventPanel />}
        </div>

        {/* 검색어에 걸렸지만 연표에는 안 떠 있는 사건 — 검색칸이 위아래로 둘이 되지 않게,
            맨 위 한 곳에서 찾고 걸린 것만 여기로 흘러나오게 한다 */}
        {mode === "admin" && <OffTimelineFinder query={query} />}

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
            onHighlight={handleBulkHighlight}
            // 한꺼번에 긋는 이 버튼과 행마다의 그것은 같은 일이라 같은 말을 쓴다.
            highlightLabel={allSelectedHighlighted ? "강조 해제" : "강조"}
            onClear={() => setCollection(new Set())}
          />
        ) : (
          <div className="mt-4 hidden grid-cols-[220px_84px_1fr_1fr_280px] gap-x-5 border-b-2 border-ink pb-1.5 font-mono text-[10px] uppercase tracking-wider text-grey sm:grid">
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
                className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
              />
              {/* 정렬은 위 줄에 나와 있지만, 표를 읽다 방향을 바꾸고 싶을 때 손이 가는 곳은
                  날짜 칸 머리다 — 같은 값을 여기서도 뒤집는다. */}
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                className="text-left hover:text-ink"
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
          <p className="py-10 text-center font-mono text-xs text-grey">
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
// 눈에 띄게(초록 점 + 왼쪽 테두리, EventEntry에서 함께 적용) 구분한다.
// 색면(점)에 반드시 글자를 붙인다 — 초록과 빨강은 적록색약에서 서로 무너진다.
function SavedBadge() {
  return (
    <span
      title="사료 연결에서 저장했거나 직접 만든 사건"
      className={`ml-2 align-middle font-normal ${CHIP_CLASSNAME} bg-green-tint`}
    >
      <span className={DOT_CONFIRMED} aria-hidden />
      저장됨
    </span>
  );
}

// 큐레이터 메모를 읽기 전용으로 보여준다 — 사용자뷰에서는 사건 해설로, 편집 화면에서는
// 도구를 펼치지 않은 행에서 "적어둔 것이 있다"는 표시로 쓰인다. 고치는 것은 도구를 편 뒤.
function CuratorMemo({ memos }: { memos: UserMemo[] }) {
  if (memos.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {memos.map((m) => (
        <p
          key={m.id}
          className="rounded-sm border border-line bg-yellow-tint p-2 font-mono text-xs leading-4 whitespace-pre-wrap text-ink"
        >
          {m.memoText}
        </p>
      ))}
    </div>
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
  // 예전에는 구술이 붙은 사건 행에 초록 바탕이 자동으로 깔렸다. 데이터가 스스로 정하는
  // 음영이라 훑으면서 고를 수가 없었고, 이미 칠해진 색 위에서는 정작 내가 표시한 것이
  // 묻힌다 — 걷어냈다. 구술이 붙어 있다는 사실은 오른쪽 구술 칸에 인용이 실제로 실려
  // 있는 것으로 이미 보인다.
  //
  // 내가 표시한 행은 바탕을 칠하지 않고 사건명에 밑줄을 긋는다(아래 h3). 행 하나가
  // 다섯 칸에 걸쳐 있어 바탕을 칠하면 사료·구술 칸까지 통째로 물드는데, 표시는 내가
  // 이 사건을 짚었다는 뜻이지 여기 붙은 자료까지 짚었다는 뜻은 아니다.
  //
  // 편집 화면에서 손대는 일(메모·수정·숨김)은 사건명을 누르면 그 자리에 뜨는 작은 메뉴로
  // 고른다 — 구술 형광펜을 눌렀을 때 뜨는 메뉴와 같은 방식이다. 버튼 줄을 행마다 늘
  // 깔아두면 200여 행이 쓰지 않는 버튼만큼 세로로 늘어지고, 훑어보는 일이 대부분인 표에서
  // 그 여백은 전부 낭비다. 메뉴는 본문 위에 떠서 행을 밀지 않는다.
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<"memo" | "edit" | "hide" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 치면 닫는다. 메뉴 안쪽을 눌렀는지는 ref로 직접 확인한다 —
  // 메뉴에 stopPropagation을 다는 방식은 React가 핸들러를 document에 위임하기 때문에
  // 통하지 않는다(Transcript.tsx의 형광펜 메뉴에 같은 사정을 적어 두었다).
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function choose(next: "memo" | "edit" | "hide") {
    setMenuOpen(false);
    setAction(next);
  }

  // 강조만은 고른 뒤 펼칠 것이 없다 — 바로 긋고 메뉴를 닫는다. 화면은 저장이 끝난 뒤
  // 서버가 다시 그려준다(setEventsHighlighted가 이 경로를 revalidate한다).
  function handleHighlight() {
    setMenuOpen(false);
    void setEventsHighlighted([event.id], !event.highlighted);
  }

  return (
    <div
      // 내가 그은 사건은 행 전체에 음영을 깐다(구술 목록의 "중요"와 같은 바탕이다 —
      // MINE_ROW_CLASSNAME). 사건명에만 밑줄을 그었을 때는 표를 훑는 눈에 걸리지
      // 않았다 — 사건명 칸은 표의 다섯 칸 중 하나라, 그 안의 3px 선은 옆 칸(사료·날짜·
      // 출처)까지 훑는 시선에 묻힌다.
      className={`grid grid-cols-1 gap-x-5 gap-y-3 border-b border-line py-4 sm:grid-cols-[220px_84px_1fr_1fr_280px] ${
        event.highlighted ? MINE_ROW_CLASSNAME : ""
      }`}
    >
      {/* 사료 — 다른 아카이브에서 가져온 자료. 다른 컬럼보다 넓게 잡아 이미지가 잘 보이게 한다 */}
      <div className="flex flex-col gap-2.5">
        {event.linkedMaterials.length === 0 ? (
          <span className="font-mono text-[10px] text-line">—</span>
        ) : (
          event.linkedMaterials.map((material) => (
            <MaterialThumb key={material.id} material={material} eventId={event.id} mode={mode} />
          ))
        )}
      </div>

      {/* 날짜 + 강조 스위치(사용자뷰 전용) */}
      <div className="flex items-start gap-2">
        {/* 체크박스로 둔다 — 별표는 중요도 표시로 읽혀서, 고르는 일과 뜻이 어긋난다. */}
        <input
          type="checkbox"
          checked={inCollection}
          onChange={onToggleCollection}
          title={inCollection ? "컬렉션에서 빼기" : "컬렉션에 담기"}
          aria-label={`${event.eventName} 고르기`}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
        />
        <div className="min-w-0">
          <span className="block font-mono text-[11px] leading-5 text-grey">
            {formatEdtfToKorean(event.dateValue)}
          </span>
          {/* 사용자뷰에서는 날짜 옆의 스위치로 긋는다. 편집 화면에서는 이 자리에 두지 않고
              사건명 메뉴의 "강조"로 옮겼다 — 손대는 일(메모·수정·숨김)이 모두 그 메뉴에
              모여 있는데 표시만 따로 떨어져 있으면, 같은 일을 두 곳에서 찾게 된다.
              key에 지금 값을 넣는 것은 표 헤더에서 여러 건을 한꺼번에 그었을 때다 —
              FlagToggle은 처음 받은 값으로 제 상태를 잡으므로, 값이 바뀌면 새로 태워야
              한꺼번에 그은 행의 스위치도 함께 켜진 채로 다시 그려진다. */}
          {mode === "read" && (
            <div className="mt-1">
              <FlagToggle
                key={String(event.highlighted)}
                active={event.highlighted}
                onToggle={(next) => setEventsHighlighted([event.id], next)}
                activeLabel="강조"
                inactiveLabel="강조"
                dotClassName={DOT_MINE}
              />
            </div>
          )}
        </div>
      </div>

      {/* 사건명 + 하단 키워드 */}
      <div className="min-w-0">
        {/* 메뉴는 사건명 바로 아래에 뜨고 키워드 줄을 덮는다 — 기준 상자를 사건명에만 씌워
            그 아래로 내려온다. 칸 전체를 기준으로 잡으면 키워드 밑, 다음 행 어름에 떠서
            어느 사건의 메뉴인지 한눈에 붙지 않는다. 덮인 키워드는 메뉴를 닫으면 돌아온다. */}
        <div className="relative">
        {/* 사건명은 본문과 같은 고딕(Gothic A1)이다. 여기만 명조로 두었더니 다른 화면의
            제목들(논문 제목·기관명)과 서체가 갈려 사건명만 다른 종류의 글처럼 보였다.
            굵기는 font-bold(700) — layout.tsx가 받는 굵기는 400·500·700·800이라
            font-semibold(600)로 적으면 브라우저가 알아서 700으로 바꿔 그린다. */}
        <h3 className={`${TEXT_SUBHEAD_CLASSNAME} font-bold leading-snug text-ink`}>
          {/* 편집 화면에서는 사건명 자체가 메뉴를 여는 손잡이다. 사건명은 링크가 아니라
              읽는 이름이라 밑줄·색을 더하지 않는다 — 누를 수 있다는 것은 손이 닿았을 때만
              알린다(형광펜과 같다). */}
          {mode === "admin" ? (
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="눌러서 메뉴 열기"
              className="cursor-pointer text-left hover:text-green-text"
            >
              {event.eventName}
            </button>
          ) : (
            event.eventName
          )}
          {mode === "admin" && event.savedByUser && <SavedBadge />}
        </h3>

        {/* 사건명 아래에 뜨는 메뉴. 상자 안에 절대배치라 표를 굴려도 제 사건명을 따라간다.
            고르면 메뉴는 닫히고, 고른 일만 아래 메모·도구 칸에 펼쳐진다. */}
        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute left-0 top-full z-20 mt-0.5 flex overflow-hidden rounded-sm border border-line bg-background shadow-md"
          >
            {/* 강조는 메뉴에서 유일하게 그 자리에서 끝나는 일이다 — 아래에 펼칠 것이 없고
                누르는 즉시 사건명에 밑줄이 그어진다. 켜졌는지는 앞에 점을 두지 않고 말로만
                알린다(켜져 있으면 "강조 해제") — 메뉴는 지금 상태를 보는 자리가 아니라
                무엇을 할지 고르는 자리다. */}
            <button
              type="button"
              role="menuitem"
              autoFocus
              onClick={handleHighlight}
              className="px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
            >
              {event.highlighted ? "강조 해제" : "강조"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("memo")}
              className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
            >
              {event.memos.length > 0 ? "메모" : "메모 추가"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("edit")}
              className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
            >
              수정
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("hide")}
              className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
            >
              숨김
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-grey hover:text-ink"
            >
              닫기
            </button>
          </div>
        )}
        </div>

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
        {/* 내용에도 형광펜을 긋는다 — 구술 본문과 같은 손짓(드래그하면 그어지고, 그은 자리를
            누르면 지우는 메뉴가 뜬다). 사건 전체를 짚는 "강조"와는 갈래가 다르다: 저것은
            표를 훑을 때 이 행이 눈에 걸리게 하는 일이고, 이것은 두어 문장 안에서 어느 구절이
            걸렸는지를 남기는 일이다. 사건이 비어 있으면 그을 것이 없어 그냥 —를 둔다. */}
        {event.summary ? (
          <HighlightableText
            text={event.summary}
            highlights={event.summaryHighlights}
            onSave={(next) => saveEventSummaryHighlights(event.id, next)}
            className={`${TEXT_BODY_CLASSNAME} leading-5 text-ink`}
          />
        ) : (
          <span className="font-mono text-[10px] text-line">—</span>
        )}
        {/* 출처 한 줄. 책·학술지·간행물이면 저자와 쪽수가 함께 붙는다(citation.ts) */}
        <p className="mt-1 font-mono text-[10px] text-grey">
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 hover:text-ink"
            >
              {formatEventSource(event) || event.sourceUrl}
            </a>
          ) : event.sourceLabel.includes("국사편찬위원회") ? (
            <a
              href={HISTORY_TIMELINE_SOURCE.url}
              target="_blank"
              rel="noopener noreferrer"
              title={HISTORY_TIMELINE_SOURCE.title}
              className="underline decoration-dotted underline-offset-4 hover:text-ink"
            >
              {formatEventSource(event)}
            </a>
          ) : (
            formatEventSource(event)
          )}
        </p>
      </div>

      {/* 구술 — 교차하는 구술 인용. 다른 컬럼보다 넓게 잡아 발췌가 잘 읽히게 한다 */}
      <div className="flex flex-col gap-3">
        {linkedSegments.length === 0 ? (
          <span className="font-mono text-[10px] text-line">—</span>
        ) : (
          linkedSegments.map((segment) => (
            <OralQuote key={segment.id} segment={segment} eventId={event.id} mode={mode} />
          ))
        )}
      </div>

      {/* 메모·도구 — 사료(썸네일)·구술(인용) 컬럼까지 넓히지 않고 날짜·사건명·내용 구간
          너비에만 맞춘다. 보여줄 것이 없으면 칸 자체를 만들지 않는다 — 빈 칸을 두면
          행마다 gap-y만큼 빈 줄이 하나씩 더 생긴다. */}
      {(action !== null || event.memos.length > 0) && (
        <div className="sm:col-start-2 sm:col-end-5">
          {action === "memo" ? (
            <MemoList
              startEditing
              memos={event.memos}
              onAdd={(memo) => addTimelineMemo(event.id, memo)}
              onEdit={(id, memo) => updateMemo(id, memo)}
              onDelete={(id) => deleteMemo(id)}
            />
          ) : action === null ? (
            <CuratorMemo memos={event.memos} />
          ) : (
            <EventRowControls event={event} action={action} onClose={() => setAction(null)} />
          )}
        </div>
      )}
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
        className={`flex w-full items-center justify-center text-3xl shadow-sm ${MATERIAL_HEIGHT[material.type]} ${MATERIAL_THUMB_CLASSNAME}`}
      >
        {ARCHIVE_ITEM_ICON[material.type]}
      </span>
      <p className="mt-1.5 font-mono text-[11px] font-semibold leading-4 text-ink group-hover:text-green-text">
        {material.title}
      </p>
      <p className="mt-0.5 font-mono text-[10px] leading-4 text-grey">
        {material.type} ·{" "}
        <span className="underline decoration-dotted underline-offset-2 group-hover:text-green-text">
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
    <div className="border-l-2 border-green-fill pl-3">
      <p
        className={
          isShort
            ? `font-serif ${TEXT_SUBHEAD_CLASSNAME} font-medium italic leading-6 text-ink`
            : `font-serif ${TEXT_BODY_CLASSNAME} italic leading-5 text-ink`
        }
      >
        “{quote}”
      </p>
      <p className="mt-1 font-mono text-[10px] text-grey">
        — {segment.itemTitle}{" "}
        {segment.notes && (
          <span className="cursor-help underline decoration-dotted" title={segment.notes}>
            📝
          </span>
        )}{" "}
        <Link
          href={`/segments?focus=${segment.id}`}
          className="ml-1 text-green-text underline decoration-dotted underline-offset-4 hover:text-green-text"
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
  onHighlight,
  highlightLabel,
  onClear,
}: {
  mode: TimelineMode;
  count: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onExport: () => void;
  onHide: () => Promise<void>;
  onHighlight: () => Promise<void>;
  highlightLabel: string;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [highlighting, setHighlighting] = useState(false);

  async function handleHighlight() {
    setHighlighting(true);
    try {
      await onHighlight();
    } finally {
      setHighlighting(false);
    }
  }

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
    <div className="sticky top-0 z-20 hidden grid-cols-[220px_1fr] gap-x-5 border-b-2 border-ink bg-background pb-1.5 pt-4 sm:grid">
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
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
        />
        {confirming ? (
          <>
            <span className="text-ink">
              {count}건을 연표에서 내립니다 — DB는 그대로고, 아래 “숨긴 사건”에서 되돌립니다
            </span>
            <button
              type="button"
              onClick={handleHide}
              disabled={pending}
              className="ml-auto rounded-sm bg-ink px-2.5 py-0.5 text-white hover:opacity-80 disabled:opacity-50"
            >
              {pending ? "숨기는 중…" : "숨김"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="text-grey hover:text-ink"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <span className="font-bold text-green-text">{count}건 선택</span>
            {/* 강조는 숨김과 달리 확인을 묻지 않는다 — 되돌리는 길이 같은 자리에 있다.
                다시 고르면 라벨이 "강조 해제"로 바뀐다. */}
            <button
              type="button"
              onClick={() => void handleHighlight()}
              disabled={highlighting}
              className="text-grey hover:text-ink disabled:opacity-50"
            >
              {highlighting ? "긋는 중…" : highlightLabel}
            </button>
            <button type="button" onClick={onExport} className="text-grey hover:text-ink">
              CSV
            </button>
            {mode === "admin" && (
              <button type="button" onClick={() => setConfirming(true)} className="text-grey hover:text-ink">
                숨김
              </button>
            )}
            <button type="button" onClick={onClear} className="ml-auto text-grey hover:text-ink">
              해제
            </button>
          </>
        )}
      </div>
    </div>
  );
}
