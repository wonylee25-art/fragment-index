"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Tag } from "./Tag";
import { OffTimelineFinder } from "./OffTimelineFinder";
import { MemoList } from "./MemoList";
import { AddEventPanel, EventRowControls } from "./EventEditor";
import { FlagToggle } from "./FlagToggle";
import { hideEvents } from "@/lib/event-actions";
import { setEventsHighlighted, setMaterialsHighlighted } from "@/lib/flag-actions";
import { dropMaterialsFromTimeline, setMaterialTimelineDate } from "@/lib/timeline-placement-actions";
import { saveEventSummaryHighlights } from "@/lib/highlight-actions";
import { HighlightableText } from "./HighlightableText";
import { UnlinkButton } from "./UnlinkButton";
import { addMaterialMemo, addTimelineMemo, deleteMemo, updateMemo } from "@/lib/memo-actions";
import { ArchiveItemType, RelatedItem, SegmentCardData, TimelineEventData, TimelineRow, UserMemo } from "@/lib/types";
import { edtfSortKey, edtfYearFloat, formatEdtfToKorean } from "@/lib/edtf";
import { narratorPullQuote } from "@/lib/quotes";
import { formatEventSource } from "@/lib/citation";
import { osmUrl } from "@/lib/geo";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import {
  ARCHIVE_ITEM_ICON,
  CHIP_CLASSNAME,
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

// 연도 범위 필터. 빈 칸은 그쪽 끝을 열어둔다는 뜻이고, 연도 미상인 행은 범위를 지정한 순간
// 제외한다 — 몇 년인지 모르는 것을 "1950~1960년에 속한다"고 볼 수는 없기 때문.
function matchesYearRange(row: TimelineRow, from: number | null, to: number | null): boolean {
  if (from === null && to === null) return true;
  if (!row.dateValue) return false;
  const year = Math.floor(edtfYearFloat(row.dateValue));
  if (Number.isNaN(year)) return false;
  return (from === null || year >= from) && (to === null || year <= to);
}

function parseYearInput(value: string): number | null {
  const year = parseInt(value, 10);
  return Number.isNaN(year) ? null : year;
}

// 행 하나가 검색어에 걸리는가. 갈래마다 읽을 글이 다르다 — 사건은 사건명·내용·출처,
// 사료는 제목과 옮겨 적어 둔 원문, 구술은 발췌 본문. 화면에 보이는 글은 다 걸려야 한다:
// 사료 행은 내용 칸에 원문을 통째로 싣는데 검색이 요약만 본다면, 눈앞에 뜬 문장으로
// 그 자료를 다시 찾을 수 없게 된다.
function matchesQuery(row: TimelineRow, query: string): boolean {
  if (!query) return true;

  if (row.kind === "material") {
    const { material } = row;
    return (
      material.title.includes(query) ||
      row.body.includes(query) ||
      material.sourceOrg.includes(query) ||
      (material.keywords ?? []).some((k) => k.includes(query))
    );
  }

  const event = row.event;
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

// 이 행에 내가 표시를 그었는가. 사건은 timeline_events, 사료는 archive_items의
// 같은 이름 칸에 담긴다.
function rowHighlighted(row: TimelineRow): boolean {
  return row.kind === "event" ? row.event.highlighted : row.highlighted;
}

// 고른 행들에 한꺼번에 표시를 긋거나 지운다. 갈래마다 쓰는 칸이 달라 셋으로 나눠 보낸다.
async function setRowsHighlighted(rows: TimelineRow[], value: boolean) {
  const ids = (kind: TimelineRow["kind"]) => rows.filter((r) => r.kind === kind).map((r) => r.id);
  await Promise.all([
    setEventsHighlighted(ids("event"), value),
    setMaterialsHighlighted(ids("material"), value),
  ]);
}

// 고른 행들을 연표에서 내린다. 사건은 숨기고(hidden_at), 사료는 "연표에 올림" 딱지를
// 뗀다 — 조작 이름이 다를 뿐 뜻은 같다: 연표에서만 내리고 DB의 자료는 그대로 둔다.
async function dropRowsFromTimeline(rows: TimelineRow[]) {
  const ids = (kind: TimelineRow["kind"]) => rows.filter((r) => r.kind === kind).map((r) => r.id);
  await Promise.all([hideEvents(ids("event")), dropMaterialsFromTimeline(ids("material"))]);
}

// 사용자뷰(read)와 관리페이지(admin)가 같은 컴포넌트를 쓴다 — 연표 표시 로직(눈금·필터·표)은
// 양쪽이 똑같고, 다른 것은 조작 UI뿐이라 화면을 복제하는 대신 모드로 가른다.
// read  : 확정 연결선만 담긴 데이터를 받아 읽기만 한다. 메모는 해설로 보여주되 편집 불가.
// admin : 후보 연결선까지 담긴 데이터를 받고, 메모 편집과 사건 손질 UI가 열린다.
export type TimelineMode = "read" | "admin";

// 표의 칸 나눔. 편집 「사건」(admin)에서는 사료·구술 두 칸을 접는다 — 거기서 하는 일은 사건 자체를
// 고르고 고치는 것이고, 무엇이 붙어 있는지는 옆의 「사료」·「구술」 탭이 맡는다.
// 다섯 칸을 다 세워 두면 정작 손대는 칸(사건명·내용)이 그만큼 좁아진다.
// 구술 칸에 고정폭을 주면 화면이 좁아졌을 때 남는 폭이 사건·내용에 거의 돌아가지 않아
// 글자가 한 자씩 세로로 떨어진다 — 뒤 세 칸은 비율로 나눠 같이 줄어들게 둔다.
const ROW_GRID_CLASSNAME: Record<TimelineMode, string> = {
  read: "sm:grid-cols-[220px_84px_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]",
  admin: "sm:grid-cols-[84px_1fr_1fr]",
};

// 메모·도구 칸이 눕는 자리 — 날짜부터 내용까지. 사료 칸이 접히면 시작 칸도 한 칸 당겨진다.
const TOOLS_SPAN_CLASSNAME: Record<TimelineMode, string> = {
  read: "sm:col-start-2 sm:col-end-5",
  admin: "sm:col-start-1 sm:col-end-4",
};

export function TimelineExperience({
  rows,
  segments,
  mode = "read",
}: {
  // 사건과, 사건 없이 연표에 올린 사료·구술이 한 흐름으로 섞여 온다(getTimelineRows).
  rows: TimelineRow[];
  // 사건 행이 제게 붙은 구술 인용을 찾는 데 쓴다 — 연표에 서지 않은 발췌까지 다 들어 있다.
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
    () => [...rows].sort((a, b) => edtfSortKey(a.dateValue) - edtfSortKey(b.dateValue)),
    [rows],
  );

  const yearRange = useMemo(
    () => ({ from: parseYearInput(yearFrom), to: parseYearInput(yearTo) }),
    [yearFrom, yearTo],
  );

  const visible = useMemo(() => {
    const q = query.trim();
    const base = sortedAll.filter(
      (r) => matchesQuery(r, q) && matchesYearRange(r, yearRange.from, yearRange.to),
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

  // 지금 걸린 검색·필터를 그대로 살려 "보이는 것 전부"를 고른다 — 일괄 내리기의 재료가 된다.
  const allVisibleSelected = visible.length > 0 && visible.every((r) => collection.has(r.id));
  const someVisibleSelected = visible.some((r) => collection.has(r.id));

  // 고른 것을 셀 때는 늘 지금 연표에 서 있는 행으로만 센다. 내려간 행의 id는 체크 목록에
  // 남아 있어도 rows에는 없다 — 그대로 세면 표에는 아무것도 안 짚혀 있는데 머리줄만
  // "N건 선택"으로 남는다. 걷어내는 대신 세지 않는 쪽으로 한다.
  const selectedRows = useMemo(
    () => sortedAll.filter((r) => collection.has(r.id)),
    [sortedAll, collection],
  );

  function toggleSelectAllVisible() {
    setCollection((prev) => {
      const next = new Set(prev);
      for (const row of visible) {
        if (allVisibleSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  // 고른 행을 한꺼번에 연표에서 내린다. 화면에서만 내리는 것이라 되돌리기는 사건이면
  // 아래 "숨긴 사건" 목록에서, 사료·구술이면 보류함에서 다시 올리는 것으로 한다.
  //
  // 고른 것을 여기서 풀지 않는다 — 내려간 행은 서버가 다시 그려주며 rows에서 빠지고,
  // 그러면 selectedRows에서도 저절로 빠진다. 손으로 푸는 쪽은 "해제" 하나로 족하다.
  async function handleBulkHide() {
    await dropRowsFromTimeline(selectedRows);
  }

  // 고른 행에 한꺼번에 밑줄을 긋거나 지운다. 고른 것이 전부 이미 그어져 있으면 지우는
  // 쪽으로 뒤집는다 — 같은 자리에서 긋고 지울 수 있어야 잘못 그은 뒤 되돌아갈 데가 있다.
  const allSelectedHighlighted = selectedRows.length > 0 && selectedRows.every(rowHighlighted);

  // 긋고 나서도 고른 것은 그대로 둔다 — 그어 놓고 곧바로 CSV로 내보내거나 잘못 그은 것을
  // 되돌리는 일이 잇따르는데, 매번 풀려 버리면 같은 행들을 처음부터 다시 골라야 한다.
  async function handleBulkHighlight() {
    await setRowsHighlighted(selectedRows, !allSelectedHighlighted);
  }

  // 컬렉션 이름은 CSV를 만들 때만 묻는다 — 늘 떠 있는 입력 칸으로 두면 쓰는 때보다
  // 자리만 차지하는 때가 훨씬 길다. 취소하면 내려받지 않는다.
  function handleExportCsv() {
    const name = window.prompt(`CSV로 내보낼 ${selectedRows.length}건의 이름`, collectionName);
    if (name === null) return;
    const trimmed = name.trim() || "연표컬렉션";
    setCollectionName(trimmed);
    downloadCsv(trimmed, rowsToCsv(selectedRows));
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
        {selectedRows.length > 0 ? (
          <SelectionHeader
            mode={mode}
            count={selectedRows.length}
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
          <div
            className={`mt-4 hidden grid-cols-1 gap-x-5 border-b-2 border-ink pb-1.5 font-mono text-[10px] uppercase tracking-wider text-grey sm:grid ${ROW_GRID_CLASSNAME[mode]}`}
          >
            {mode === "read" && <span>사료</span>}
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
                title={allVisibleSelected ? "보이는 행 선택 해제" : `보이는 ${visible.length}건 모두 선택`}
                aria-label={allVisibleSelected ? "보이는 행 선택 해제" : `보이는 ${visible.length}건 모두 선택`}
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
            {mode === "read" && <span>구술</span>}
          </div>
        )}

        {/* 표 본문 */}
        {visible.length === 0 ? (
          <p className="py-10 text-center font-mono text-xs text-grey">
            일치하는 연표 항목이 없습니다.
          </p>
        ) : (
          visible.map((row) => {
            const shared = {
              mode,
              inCollection: collection.has(row.id),
              onToggleCollection: () => toggleCollection(row.id),
            };
            if (row.kind === "material") {
              return <MaterialEntry key={row.id} row={row} {...shared} />;
            }
            return (
              <EventEntry
                key={row.id}
                event={row.event}
                linkedSegments={row.event.linkedSegmentIds
                  .map((id) => segmentById.get(id))
                  .filter((s): s is SegmentCardData => !!s)}
                {...shared}
              />
            );
          })
        )}
      </div>

    </div>
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
  // 편집 화면에서 손대는 일(강조·메모·수정)은 사건명을 누르면 그 자리에 뜨는 작은 메뉴로
  // 고른다 — 구술 형광펜을 눌렀을 때 뜨는 메뉴와 같은 방식이다. 버튼 줄을 행마다 늘
  // 깔아두면 200여 행이 쓰지 않는 버튼만큼 세로로 늘어지고, 훑어보는 일이 대부분인 표에서
  // 그 여백은 전부 낭비다. 메뉴는 본문 위에 떠서 행을 밀지 않는다.
  //
  // 숨김만은 이 메뉴에 없다 — 행 체크박스로 골라 표 머리줄에서 한꺼번에 내리는 길 하나로
  // 모았다. 같은 말("숨김")을 사건명 아래와 표 머리줄 두 곳에서 만나면, 무엇이 다른가를
  // 매번 다시 생각하게 된다. 한 건만 내릴 때도 그 행만 체크하면 된다.
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<"memo" | "edit" | null>(null);
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

  function choose(next: "memo" | "edit") {
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
      className={`grid grid-cols-1 gap-x-5 gap-y-3 border-b border-line py-4 ${ROW_GRID_CLASSNAME[mode]} ${
        event.highlighted ? MINE_ROW_CLASSNAME : ""
      }`}
    >
      {/* 사료 — 다른 아카이브에서 가져온 자료. 다른 컬럼보다 넓게 잡아 이미지가 잘 보이게 한다 */}
      {mode === "read" && (
        <div className="flex flex-col gap-2.5">
          {event.linkedMaterials.length === 0 ? (
            <span className="font-mono text-[10px] text-line">—</span>
          ) : (
            event.linkedMaterials.map((material) => (
              <MaterialThumb key={material.id} material={material} eventId={event.id} mode={mode} />
            ))
          )}
        </div>
      )}

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
              사건명 메뉴의 "강조"로 옮겼다 — 손대는 일(메모·수정)이 모두 그 메뉴에
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
      {mode === "read" && (
        <div className="flex flex-col gap-3">
          {linkedSegments.length === 0 ? (
            <span className="font-mono text-[10px] text-line">—</span>
          ) : (
            linkedSegments.map((segment) => (
              <OralQuote key={segment.id} segment={segment} eventId={event.id} mode={mode} />
            ))
          )}
        </div>
      )}

      {/* 메모·도구 — 사료(썸네일)·구술(인용) 컬럼까지 넓히지 않고 날짜·사건명·내용 구간
          너비에만 맞춘다. 보여줄 것이 없으면 칸 자체를 만들지 않는다 — 빈 칸을 두면
          행마다 gap-y만큼 빈 줄이 하나씩 더 생긴다. */}
      {(action !== null || event.memos.length > 0) && (
        <div className={TOOLS_SPAN_CLASSNAME[mode]}>
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
            <EventRowControls event={event} onClose={() => setAction(null)} />
          )}
        </div>
      )}
    </div>
  );
}

// 사건 없이 연표에 선 사료·구술 행. 사건 행(EventEntry)과 격자·조작은 같고, 어느 칸을
// 채우느냐만 다르다.
//
// 칸의 뜻을 지키는 것이 이 행의 규칙이다. 사료는 사료 칸에, 구술은 구술 칸에 서고 사건명
// 칸은 비운다 — 자료 제목을 사건명 칸에 채워 넣으면 표를 훑을 때 사건인지 자료인지 알 수
// 없게 되고, 비어 있다는 것 자체가 "아직 사건으로 묶이지 않았다"는 읽을 만한 정보다.
// 편집 화면(admin)은 사료·구술 칸을 접어 두므로 거기서만 자료가 사건명 칸 자리에 서는데,
// 그때는 앞에 「사료」·「구술」 딱지를 붙여 사건과 갈라 둔다.
function RowKindChip({ label }: { label: string }) {
  return <span className={`mr-1.5 align-middle font-normal ${CHIP_CLASSNAME} bg-surface`}>{label}</span>;
}

// 비어 있는 칸. 사건 행에서 붙은 자료가 없을 때 쓰는 것과 같은 표시다.
function EmptyCell() {
  return <span className="font-mono text-[10px] text-line">—</span>;
}

// 연표에 설 날짜를 고치는 자리. 자료 자신의 날짜(발행일·면담일)는 건드리지 않는다 —
// 신문 발행일은 기사가 실린 날이지 그 일이 일어난 날이 아니라서, 연표에 세울 날짜는
// 따로 받아 여기서 조정한다(timeline-placement-actions.ts).
function TimelineDateEditor({
  value,
  ownDateLabel,
  onSave,
  onClose,
}: {
  value: string;
  ownDateLabel: string;
  onSave: (next: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 border border-line bg-surface p-2">
      <label className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-grey">연표 날짜</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="1961-09-24"
          className={`w-40 ${INPUT_CLASSNAME}`}
        />
      </label>
      {/* EDTF라 폭을 가진 값도 그대로 쓴다 — 회고 기사는 한 점이 아니라 구간으로 서야 맞다 */}
      <span className="font-mono text-[10px] text-grey">
        1961-09 · 1978~1983 · 1970s 처럼 폭이 있어도 된다{ownDateLabel && ` · 자료 날짜 ${ownDateLabel}`}
      </span>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="ml-auto rounded-sm bg-ink px-2.5 py-0.5 font-mono text-[11px] text-white hover:opacity-80 disabled:opacity-50"
      >
        {saving ? "저장 중…" : "저장"}
      </button>
      <button type="button" onClick={onClose} className="font-mono text-[11px] text-grey hover:text-ink">
        취소
      </button>
    </div>
  );
}

// 사건 없이 선 행이 함께 쓰는 메뉴 — 강조·메모·날짜·내리기. 사건의 그것과 자리도 손짓도
// 같지만 "수정"이 없다: 자료의 제목·본문을 고치는 일은 그 자료의 자리(보류함·구술 목록)에서
// 한다. 여기서 하는 것은 연표에 어떻게 세울지에 대한 판단뿐이다.
function RowMenu({
  open,
  menuRef,
  highlighted,
  memoCount,
  onHighlight,
  onChoose,
  onClose,
}: {
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  highlighted: boolean;
  memoCount: number;
  onHighlight: () => void;
  onChoose: (next: "memo" | "date" | "drop") => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute left-0 top-full z-20 mt-0.5 flex overflow-hidden rounded-sm border border-line bg-background shadow-md"
    >
      <button
        type="button"
        role="menuitem"
        autoFocus
        onClick={onHighlight}
        className="px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
      >
        {highlighted ? "강조 해제" : "강조"}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onChoose("memo")}
        className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
      >
        {memoCount > 0 ? "메모" : "메모 추가"}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onChoose("date")}
        className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
      >
        날짜
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onChoose("drop")}
        className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-yellow-tint"
      >
        내리기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onClose}
        className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-grey hover:text-ink"
      >
        닫기
      </button>
    </div>
  );
}

// 바깥을 누르거나 Esc를 치면 메뉴를 닫는다 — EventEntry의 그것과 같은 사정이라 함께 쓴다.
function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

// 날짜 칸 — 고르기 체크박스, 연표에 선 날짜, 그리고 사용자뷰의 강조 스위치.
function RowDateCell({
  dateValue,
  label,
  mode,
  highlighted,
  onHighlight,
  inCollection,
  onToggleCollection,
}: {
  dateValue: string;
  label: string;
  mode: TimelineMode;
  highlighted: boolean;
  onHighlight: (next: boolean) => Promise<void>;
  inCollection: boolean;
  onToggleCollection: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={inCollection}
        onChange={onToggleCollection}
        title={inCollection ? "컬렉션에서 빼기" : "컬렉션에 담기"}
        aria-label={`${label} 고르기`}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
      />
      <div className="min-w-0">
        <span className="block font-mono text-[11px] leading-5 text-grey">
          {formatEdtfToKorean(dateValue)}
        </span>
        {mode === "read" && (
          <div className="mt-1">
            <FlagToggle
              key={String(highlighted)}
              active={highlighted}
              onToggle={onHighlight}
              activeLabel="강조"
              inactiveLabel="강조"
              dotClassName={DOT_MINE}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 이 자료가 사건에도 붙어 있다는 알림. 붙었다고 이 행이 사라지지는 않는다 — 올리는 것과
// 붙이는 것은 별개의 판단이라, 어느 하나가 다른 하나를 무르게 두지 않았다. 다만 그러면 같은
// 자료가 연표에 두 자리(이 행과 그 사건 행의 사료 칸)에 뜨므로, 겹친다는 사실과 어느 사건과
// 겹치는지를 적어 둔다. 내릴지 말지는 그걸 보고 사람이 정한다(행 메뉴의 「내리기」).
function LinkedEventNote({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="font-mono text-[10px] leading-4 text-grey">
      사건에도 붙어 있음 — {names.join(" · ")}
    </p>
  );
}

// 사료가 제 이름으로 서는 행. 사료 칸에 제목·기관·원본 링크·발행일이 서고, 내용 칸에는
// 옮겨 적어 둔 본문이 통째로 실린다(요약만 실으면 기사 한복판의 증언이 화면에서 빠진다).
function MaterialEntry({
  row,
  mode,
  inCollection,
  onToggleCollection,
}: {
  row: Extract<TimelineRow, { kind: "material" }>;
  mode: TimelineMode;
  inCollection: boolean;
  onToggleCollection: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<"memo" | "date" | "drop" | null>(null);
  const menuRef = useDismissable(menuOpen, () => setMenuOpen(false));
  const { material } = row;
  const published = material.dateValue ? formatEdtfToKorean(material.dateValue) : "";

  function choose(next: "memo" | "date" | "drop") {
    setMenuOpen(false);
    setAction(next);
  }

  return (
    <div
      className={`grid grid-cols-1 gap-x-5 gap-y-3 border-b border-line py-4 ${ROW_GRID_CLASSNAME[mode]} ${
        row.highlighted ? MINE_ROW_CLASSNAME : ""
      }`}
    >
      {/* 사료 — 이 행의 주인공이 서는 자리다 */}
      {mode === "read" && (
        <div className="flex flex-col gap-2.5">
          <MaterialThumb material={material} mode={mode} />
          {published && (
            <p className="font-mono text-[10px] leading-4 text-grey">{published} 발행</p>
          )}
          <LinkedEventNote names={row.linkedEventNames} />
        </div>
      )}

      <RowDateCell
        dateValue={row.dateValue}
        label={material.title}
        mode={mode}
        highlighted={row.highlighted}
        onHighlight={(next) => setMaterialsHighlighted([row.id], next)}
        inCollection={inCollection}
        onToggleCollection={onToggleCollection}
      />

      {/* 사건명 — 비워 둔다. 편집 화면은 사료 칸을 접으므로 여기가 자료의 자리가 된다. */}
      <div className="min-w-0">
        {mode === "admin" ? (
          <div className="relative">
            <h3 className={`${TEXT_SUBHEAD_CLASSNAME} font-bold leading-snug text-ink`}>
              <RowKindChip label="사료" />
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="눌러서 메뉴 열기"
                className="cursor-pointer text-left hover:text-green-text"
              >
                {material.title}
              </button>
            </h3>
            <RowMenu
              open={menuOpen}
              menuRef={menuRef}
              highlighted={row.highlighted}
              memoCount={row.memos.length}
              onHighlight={() => {
                setMenuOpen(false);
                void setMaterialsHighlighted([row.id], !row.highlighted);
              }}
              onChoose={choose}
              onClose={() => setMenuOpen(false)}
            />
            <p className="mt-1 font-mono text-[10px] text-grey">
              {[material.type, material.sourceOrg, published && `${published} 발행`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <LinkedEventNote names={row.linkedEventNames} />
          </div>
        ) : (
          <EmptyCell />
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(material.keywords ?? []).map((t) => (
            <Tag key={t} label={t} variant="keyword" />
          ))}
        </div>
      </div>

      {/* 내용 — 옮겨 적어 둔 본문 */}
      <div className="min-w-0">
        {row.body ? (
          <p className={`whitespace-pre-line ${TEXT_BODY_CLASSNAME} leading-5 text-ink`}>{row.body}</p>
        ) : (
          <EmptyCell />
        )}
      </div>

      {/* 구술 — 사건을 거치지 않은 행이라 여기 걸릴 것이 없다 */}
      {mode === "read" && <EmptyCell />}

      {(action !== null || row.memos.length > 0) && (
        <div className={TOOLS_SPAN_CLASSNAME[mode]}>
          {action === "memo" ? (
            <MemoList
              startEditing
              memos={row.memos}
              onAdd={(memo) => addMaterialMemo(row.id, memo)}
              onEdit={(id, memo) => updateMemo(id, memo)}
              onDelete={(id) => deleteMemo(id)}
            />
          ) : action === "date" ? (
            <TimelineDateEditor
              value={row.dateValue}
              ownDateLabel={published}
              onSave={(next) => setMaterialTimelineDate(row.id, next)}
              onClose={() => setAction(null)}
            />
          ) : action === "drop" ? (
            <DropRowConfirm
              noun="사료"
              onDrop={() => dropMaterialsFromTimeline([row.id])}
              onClose={() => setAction(null)}
            />
          ) : (
            <CuratorMemo memos={row.memos} />
          )}
        </div>
      )}
    </div>
  );
}

// 연표에서 내리기 전에 한 번 묻는다 — 사건 숨김과 같은 무게의 일이고, 되돌리는 자리가
// 화면 밖(보류함)이라 어디로 가는지 함께 알린다.
function DropRowConfirm({
  noun,
  onDrop,
  onClose,
}: {
  noun: string;
  onDrop: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 border border-line bg-surface p-2 font-mono text-[11px]">
      <span className="text-ink">
        이 {noun}를 연표에서 내립니다 — 자료는 그대로 남고, 보류함에서 다시 올릴 수 있습니다
      </span>
      <button
        type="button"
        onClick={async () => {
          setPending(true);
          try {
            await onDrop();
          } finally {
            setPending(false);
          }
        }}
        disabled={pending}
        className="ml-auto rounded-sm bg-ink px-2.5 py-0.5 text-white hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "내리는 중…" : "내리기"}
      </button>
      <button type="button" onClick={onClose} disabled={pending} className="text-grey hover:text-ink">
        취소
      </button>
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
  // 사건에 붙어서 딸려온 자료일 때만 온다 — 사건 없이 제 행으로 선 사료에는 끊을 연결선이 없다.
  eventId?: string;
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
      {mode === "admin" && eventId && (
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
  eventId?: string; // 사건에 붙어서 딸려온 인용일 때만 온다(MaterialThumb과 같은 사정)
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
      {mode === "admin" && eventId && (
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
    <div
      className={`sticky top-0 z-20 hidden gap-x-5 border-b-2 border-ink bg-background pb-1.5 pt-4 sm:grid ${
        mode === "read" ? "grid-cols-[220px_1fr]" : "grid-cols-1"
      }`}
    >
      {/* 사료 칸이 서 있는 사용자뷰에서는 그만큼 비워 둔다 — 체크박스가 아래 행들의
          체크박스와 같은 세로선에 놓이게 */}
      {mode === "read" && <span />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = !allSelected && someSelected;
          }}
          onChange={onToggleAll}
          title={allSelected ? "보이는 행 선택 해제" : "보이는 행 모두 선택"}
          aria-label={allSelected ? "보이는 행 선택 해제" : "보이는 행 모두 선택"}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
        />
        {confirming ? (
          <>
            <span className="text-ink">
              {count}건을 연표에서 내립니다 — DB는 그대로고, 사건은 아래 “숨긴 사건”에서,
              사료·구술은 보류함에서 되돌립니다
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
