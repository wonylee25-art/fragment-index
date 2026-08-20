"use client";

import { useMemo, useState } from "react";
import { PaperData } from "@/lib/types";
import { buildCanonicalMap, canonicalKeywords } from "@/lib/keyword-aliases";
import { buildDuplicateFolding } from "@/lib/paper-duplicates";
import {
  ADD_BUTTON_CLASSNAME,
  DOT_CONFIRMED,
  DOT_MINE,
  TOGGLE_BUTTON_CLASSNAME,
  TOGGLE_OFF_CLASSNAME,
  TOGGLE_ON_CLASSNAME,
  TAG_CLASSNAME,
  TEXT_SUBHEAD_CLASSNAME,
} from "@/lib/design-tokens";
import { MemoField } from "./MemoField";
import { QuoteList } from "./QuoteList";
import { CopyForNotionButton } from "./CopyForNotionButton";
import { FlagToggle } from "./FlagToggle";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { AddPaperForm } from "./AddPaperForm";
import { Switch } from "./Switch";
import { savePaperMemo } from "@/lib/memo-actions";
import { togglePaperImportant, togglePaperRead } from "@/lib/flag-actions";
import { refreshResearchData } from "@/lib/research-sync-actions";
import { hidePaper, restorePaper } from "@/lib/paper-actions";
import { addQuote, deleteQuote, updateQuote } from "@/lib/quote-actions";

const MIN_MENTIONS = 2; // 노이즈를 줄이기 위해 2회 이상 등장한 주제어만 클라우드에 노출
const MIN_FONT_PX = 11;
const MAX_FONT_PX = 27;

// 한 번에 그리는 논문 편수. 460편을 다 펼치면 행마다 붙는 플래그·수정·삭제·키워드·인용구
// 버튼이 5천 개가 되어, 정렬을 한 번 누를 때마다 그 전부가 다시 그려지고 스크롤도 바닥에
// 닿지 않는다. 처음에는 한 묶음만 내고 "더 보기"로 늘린다 — 좁히는 조건(주제어·중요만)이나
// 정렬이 바뀌면 보는 자리가 달라진 것이므로 다시 첫 묶음으로 돌아간다.
const PAGE_SIZE = 100;

// 발행 시점(최신순·과거순)과 수집 시점(등록순)은 서로 다른 축이다 — 이름으로 구분한다.
// "등록순"은 논문이 이 DB에 들어온 시각(created_at)이고, 논문이 언제 쓰였는지와는 무관하다.
type SortMode = "latest" | "oldest" | "registered" | "read" | "important";

const SORT_LABELS: Record<SortMode, string> = {
  latest: "최신순",
  oldest: "과거순",
  registered: "등록순",
  read: "읽은순",
  important: "중요순",
};

function sortPapers(papers: PaperData[], mode: SortMode): PaperData[] {
  const sorted = [...papers];
  switch (mode) {
    case "oldest":
      // 연도 미상은 어느 방향으로 정렬하든 끝으로 보낸다.
      sorted.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
      break;
    case "registered":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "read":
      // 읽은 논문을 먼저, 동일 조건 내에서는 최신 연도순.
      sorted.sort((a, b) => Number(b.isRead) - Number(a.isRead) || (b.year ?? -Infinity) - (a.year ?? -Infinity));
      break;
    case "important":
      // ★ 표시한 논문을 먼저 — "중요만 보기"(필터)와 달리 나머지도 아래에 그대로 남는다.
      sorted.sort(
        (a, b) => Number(b.isImportant) - Number(a.isImportant) || (b.year ?? -Infinity) - (a.year ?? -Infinity),
      );
      break;
    case "latest":
    default:
      sorted.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
      break;
  }
  return sorted;
}

// 유형 넷을 보라·파랑·청록·앰버로 갈라 두었었다. 논문의 갈래는 자료가 스스로 말하는 것이라
// 색을 주지 않는다 — 글자가 이미 "학위논문"이라고 적혀 있어서, 색은 뜻을 더하지 않고
// "이 배지가 무슨 색이었더라"만 늘렸다. 넷 다 같은 회색 칩으로 두고 글자로 읽는다.
const PAPER_TYPE_CLASSNAME = "bg-surface text-grey";

// 한 논문 안에서 「농촌 여성」과 「농촌여성노인」이 같은 대표어로 접히면 한 번만 센다.
function buildFrequency(papers: PaperData[], canonical: Map<string, string>) {
  const freq = new Map<string, number>();
  for (const p of papers) {
    for (const k of canonicalKeywords(p.keywords, canonical)) {
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }
  return freq;
}

// 같은 논문에 함께 등장한 주제어 쌍의 횟수 — "연관 단어" 파악용.
function buildCooccurrence(papers: PaperData[], canonical: Map<string, string>) {
  const co = new Map<string, Map<string, number>>();
  for (const p of papers) {
    const uniq = canonicalKeywords(p.keywords, canonical);
    for (const a of uniq) {
      for (const b of uniq) {
        if (a === b) continue;
        if (!co.has(a)) co.set(a, new Map());
        const inner = co.get(a)!;
        inner.set(b, (inner.get(b) ?? 0) + 1);
      }
    }
  }
  return co;
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "아직 없음";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
}

export function ResearchTrends({ papers, syncedAt }: { papers: PaperData[]; syncedAt: string | null }) {
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [addingPaper, setAddingPaper] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importantOnly, setImportantOnly] = useState(false);
  // 쳐낸 논문만 보는 자리. 훑다가 잘못 누른 것을 여기서 되돌린다.
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  // 주제어 클라우드는 화면 위쪽을 크게 차지한다 — 논문 목록만 보고 싶을 때 접는다.
  // 접어도 골라둔 주제어는 살아 있고, 접힌 채로도 해제할 수 있게 알린다.
  const [showKeywords, setShowKeywords] = useState(true);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      await refreshResearchData();
      setRefreshMessage(
        "백그라운드에서 갱신을 시작했습니다. 새 논문이 없으면 몇 분 내로, 있으면 건당 10초씩 더 걸려요. 잠시 후 새로고침해서 '최신화' 시각을 확인하세요.",
      );
    } catch {
      setRefreshMessage("갱신 시작에 실패했습니다.");
    } finally {
      setTimeout(() => setRefreshing(false), 8000); // 연타 방지용 쿨다운
    }
  }

  // 쳐낸 논문도 함께 받아 온다(되돌리려면 목록이 있어야 한다) — 세는 자리·주제어 클라우드는
  // 보이는 논문만 기준으로 삼는다.
  const livePapers = useMemo(() => papers.filter((p) => !p.hiddenAt), [papers]);
  const hiddenPapers = useMemo(() => papers.filter((p) => p.hiddenAt), [papers]);

  // 같은 논문이 두 번 잡힌 것은 한 편만 세우고 나머지는 접는다. 쳐낸 논문은 애초에 목록에
  // 없으니 대표가 될 수 없다 — 접기는 살아 있는 것들 사이에서만 따진다.
  const duplicates = useMemo(() => buildDuplicateFolding(livePapers), [livePapers]);
  const visiblePool = useMemo(
    () => livePapers.filter((p) => !duplicates.folded.has(p.id)),
    [livePapers, duplicates],
  );

  // 표기가 갈린 주제어를 대표어로 묶는 표 — 클라우드·연관·필터·논문 칩이 모두 이걸 통해 본다.
  // 쳐낸 논문의 주제어도 대표를 정하는 데 함께 센다(되돌리면 같은 이름으로 돌아와야 한다).
  const canonical = useMemo(() => buildCanonicalMap(papers), [papers]);

  const frequency = useMemo(() => buildFrequency(visiblePool, canonical), [visiblePool, canonical]);
  const cooccurrence = useMemo(() => buildCooccurrence(visiblePool, canonical), [visiblePool, canonical]);

  const cloudKeywords = useMemo(() => {
    return Array.from(frequency.entries())
      .filter(([, count]) => count >= MIN_MENTIONS)
      .sort((a, b) => b[1] - a[1]);
  }, [frequency]);

  const maxCount = cloudKeywords[0]?.[1] ?? 1;
  const relatedCounts = activeKeyword ? cooccurrence.get(activeKeyword) : undefined;

  const importantCount = useMemo(() => visiblePool.filter((p) => p.isImportant).length, [visiblePool]);

  const filteredPapers = useMemo(() => {
    return (hiddenOnly ? hiddenPapers : visiblePool).filter((p) => {
      if (activeKeyword && !canonicalKeywords(p.keywords, canonical).includes(activeKeyword)) return false;
      if (importantOnly && !p.isImportant) return false;
      return true;
    });
  }, [visiblePool, hiddenPapers, hiddenOnly, activeKeyword, importantOnly, canonical]);

  const sortedPapers = useMemo(() => sortPapers(filteredPapers, sortMode), [filteredPapers, sortMode]);

  // 좁히는 조건이나 정렬이 바뀌면 첫 묶음으로 되돌린다. 효과(useEffect)로 되돌리면 100편을
  // 한 번 그린 뒤 다시 그리게 되므로, 렌더 중에 이전 조건과 비교해 바로 맞춘다.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scopeKey = `${activeKeyword}|${importantOnly}|${hiddenOnly}|${sortMode}`;
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey);
  if (prevScopeKey !== scopeKey) {
    setPrevScopeKey(scopeKey);
    setVisibleCount(PAGE_SIZE);
  }
  const visiblePapers = sortedPapers.slice(0, visibleCount);
  const remaining = sortedPapers.length - visiblePapers.length;

  const scopeLabel = [activeKeyword ? `"${activeKeyword}"` : null, importantOnly ? "★ 중요" : null, hiddenOnly ? "쳐냄" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <section className="mb-8">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="font-mono text-xs text-grey">
            주제어 {cloudKeywords.length}개 · 논문 {visiblePool.length}편 (RISS, 국내 구술사·생애사 연구)
          </h2>
          {/* 오른쪽 상단 — 최신화 줄 아래에 보기 스위치와 정렬 띠를 모아 둔다 */}
          <div className="flex flex-col items-end gap-1.5 font-mono text-[11px] text-grey">
            <div className="flex items-center gap-2">
              <span>최신화: {formatSyncedAt(syncedAt)} 기준</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-sm bg-surface px-2 py-0.5 text-ink hover:bg-line disabled:opacity-50"
              >
                {refreshing ? "시작하는 중…" : "🔄 새로고침"}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <Switch label="키워드" on={showKeywords} onToggle={() => setShowKeywords((v) => !v)} />
              <span className="mx-1 h-3 w-px bg-line" />
              {/* 중요만 보기는 정렬이 아니라 필터다 — 정렬 띠와 붙어 있되 스위치 모양으로 구분한다 */}
              <Switch
                label={`★ 중요만 (${importantCount})`}
                on={importantOnly}
                onToggle={() => setImportantOnly((v) => !v)}
              />
              {/* 쳐낸 논문은 평소엔 안 보이지만 지워진 게 아니다 — 여기서 꺼내 되돌린다.
                  쳐낸 게 하나도 없으면 스위치를 내지 않되, 켜 둔 채로 마지막 하나를 되돌린
                  경우에는 남겨 둔다 — 안 그러면 빈 목록에 갇혀 끌 방법이 없어진다. */}
              {(hiddenPapers.length > 0 || hiddenOnly) && (
                <Switch
                  label={`쳐냄 (${hiddenPapers.length})`}
                  on={hiddenOnly}
                  onToggle={() => setHiddenOnly((v) => !v)}
                />
              )}
              <span className="mx-1 h-3 w-px bg-line" />
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  aria-pressed={sortMode === mode}
                  className={`${TOGGLE_BUTTON_CLASSNAME} ${sortMode === mode ? TOGGLE_ON_CLASSNAME : TOGGLE_OFF_CLASSNAME}`}
                >
                  {SORT_LABELS[mode]}
                </button>
              ))}
              <span className="mx-1 h-3 w-px bg-line" />
              {!addingPaper && (
                <button
                  type="button"
                  onClick={() => setAddingPaper(true)}
                  className={ADD_BUTTON_CLASSNAME}
                >
                  + 논문 추가
                </button>
              )}
            </div>
          </div>
        </div>

        {refreshMessage && <p className="mb-2 text-xs text-green-text">{refreshMessage}</p>}

        {showKeywords && (
          <p className="mb-3 text-xs text-grey">
            자주 등장한 주제어일수록 크게 표시됩니다. 클릭하면 같은 논문에 함께 등장한 연관 주제어가 강조되고,
            아래 목록이 해당 주제어로 좁혀집니다.
          </p>
        )}

        {/* 클라우드를 접어도 골라둔 주제어는 살아 있다 — 접힌 채로도 무엇이 걸렸는지 보이고 풀 수 있다 */}
        {activeKeyword && (
          <button
            type="button"
            onClick={() => setActiveKeyword(null)}
            className="mb-3 rounded-sm bg-ink px-2.5 py-1 font-mono text-xs text-white hover:opacity-80"
          >
            × &ldquo;{activeKeyword}&rdquo; 선택 해제
          </button>
        )}

        <div
          className={`flex-wrap items-baseline gap-x-2.5 gap-y-1.5 rounded-sm border border-line bg-surface p-4 ${
            showKeywords ? "flex" : "hidden"
          }`}
        >
          {cloudKeywords.length === 0 ? (
            <p className="font-mono text-xs text-grey">데이터가 아직 없습니다.</p>
          ) : (
            cloudKeywords.map(([keyword, count]) => {
              const fontSize = MIN_FONT_PX + (MAX_FONT_PX - MIN_FONT_PX) * Math.sqrt(count / maxCount);
              const isActive = keyword === activeKeyword;
              const coCount = relatedCounts?.get(keyword);
              const isRelated = !isActive && coCount !== undefined;
              const isDimmed = activeKeyword !== null && !isActive && !isRelated;

              return (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => setActiveKeyword(isActive ? null : keyword)}
                  style={{ fontSize }}
                  title={`${count}편에 등장`}
                  className={`rounded-sm px-1.5 py-0.5 leading-none transition-all duration-150 ${
                    isActive
                      ? "bg-ink text-white"
                      : isRelated
                        ? // 고른 주제어와 함께 등장한 것 — 내가 지금 고른 것에서 파생된 상태라 초록이다.
                          // 예전엔 앰버였는데, 앰버(노랑)는 내가 얹은 것(메모·중요)의 색이 되었다.
                          "bg-green-tint text-green-text ring-1 ring-inset ring-green-fill"
                        : "text-ink hover:bg-line"
                  } ${isDimmed ? "opacity-30" : ""}`}
                >
                  {keyword}
                  {isRelated && <span className="ml-1 align-super text-[9px] text-green-text">{coCount}</span>}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section>
        {/* 중요만·정렬·논문 추가는 모두 오른쪽 상단 띠로 옮겼다 — 여기는 지금 무엇이 걸렸는지만 남긴다 */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
          <h2 className="font-mono text-xs text-grey">
            논문 목록 · {scopeLabel ? `${scopeLabel} ${sortedPapers.length}편` : `전체 ${sortedPapers.length}편`}
          </h2>
        </div>

        {addingPaper && <AddPaperForm onClose={() => setAddingPaper(false)} />}

        {sortedPapers.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-grey">일치하는 논문이 없습니다.</p>
        ) : (
          <ul className="flex flex-col">
            {visiblePapers.map((paper) =>
              editingId === paper.id ? (
                <li key={paper.id} className="border-b border-line py-3">
                  <AddPaperForm paper={paper} onClose={() => setEditingId(null)} />
                </li>
              ) : (
                <li
                  key={paper.id}
                  // 오른쪽 열의 폭은 그 행에 적은 것이 있느냐로 갈린다.
                  //
                  // 메모나 인용구가 있으면 반씩 나눈다 — 1/3로 두었더니 인용구가 열다섯 자에서
                  // 꺾여 세로로만 길어졌고, 그만큼 왼쪽에 빈 자리가 남았다. 인용구는 한 논문에
                  // 두세 개가 기본이라, 그런 행의 높이를 정하는 쪽은 오른쪽 열이다.
                  //
                  // 비어 있으면 오른쪽에 있는 것은 "+ 메모 추가" 같은 입구 세 줄뿐이다. 여기에
                  // 절반을 내주면 아무것도 없는 자리 때문에 논문 제목만 접힌다 — 입구가 들어갈
                  // 만큼만 떼어 주고(최소 7rem, 메모를 쓰기 시작하면 입력칸 폭까지 늘어난다)
                  // 나머지는 제목에 준다. 저장하면 목록이 다시 불려 이 행은 반반으로 바뀐다.
                  className={`grid grid-cols-1 gap-4 border-b border-line py-3 ${
                    paper.userMemo?.trim() || paper.quotes.length > 0
                      ? "sm:grid-cols-2"
                      : "sm:grid-cols-[1fr_minmax(7rem,auto)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${PAPER_TYPE_CLASSNAME}`}>
                        {paper.paperType}
                      </span>
                      <span className="font-mono text-[11px] text-grey">{paper.year ?? "연도 미상"}</span>
                      {/* 같은 논문이 여러 번 잡혀 접힌 자리 — 무엇이 접혔는지 짚어 준다. 지운 것이
                          아니라 겹쳐 둔 것이라, 쳐냄의 빨강이 아니라 회색 칩으로 둔다. */}
                      {(duplicates.foldedUnder.get(paper.id)?.length ?? 0) > 0 && (
                        <span
                          title={duplicates.foldedUnder
                            .get(paper.id)!
                            .map((d) => `${d.author} · ${d.journalName ?? d.institution ?? ""} ${d.year ?? ""}`.trim())
                            .join("\n")}
                          className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey"
                        >
                          중복 {duplicates.foldedUnder.get(paper.id)!.length}편 접힘
                        </span>
                      )}
                      <FlagToggle
                        active={paper.isImportant}
                        onToggle={(next) => togglePaperImportant(paper.id, next)}
                        activeLabel="중요"
                        inactiveLabel="중요"
                        dotClassName={DOT_MINE}
                      />
                      <FlagToggle
                        active={paper.isRead}
                        onToggle={(next) => togglePaperRead(paper.id, next)}
                        activeLabel="읽음"
                        inactiveLabel="안 읽음"
                        dotClassName={DOT_CONFIRMED}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingId(paper.id)}
                        className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey hover:bg-line hover:text-ink"
                      >
                        수정
                      </button>
                      {paper.hiddenAt ? (
                        <button
                          type="button"
                          onClick={() => restorePaper(paper.id)}
                          className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey hover:bg-line hover:text-ink"
                        >
                          되돌리기
                        </button>
                      ) : (
                        <ConfirmDeleteButton
                          onDelete={() => hidePaper(paper.id)}
                          confirmMessage={`"${paper.title}"을(를) 목록에서 뺄까요? 「쳐냄」에서 되돌릴 수 있습니다.`}
                          label="삭제"
                          pendingLabel="빼는 중…"
                          className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey hover:bg-red-tint hover:text-red-text disabled:opacity-50"
                        />
                      )}
                    </div>

                    {/* 원문 링크가 없는 논문(직접 추가분 등)은 링크로 만들지 않는다 — href=""는 클릭해도
                        같은 페이지를 다시 불러올 뿐이라 "안 넘어간다"로 보인다. 차콜 글씨로 두어
                        링크가 없다는 걸 드러내고, 링크는 「수정」에서 채워 넣게 한다. */}
                    {paper.rissUrl ? (
                      <a
                        href={paper.rissUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${TEXT_SUBHEAD_CLASSNAME} leading-6 text-ink underline decoration-dotted underline-offset-4 hover:text-ink`}
                      >
                        {paper.title} <span className="text-line">↗</span>
                      </a>
                    ) : (
                      <p className={`${TEXT_SUBHEAD_CLASSNAME} leading-6 text-ink`}>{paper.title}</p>
                    )}

                    <p className="mt-0.5 font-mono text-[11px] text-grey">
                      {paper.author}
                      {paper.translator && ` (${paper.translator} 역)`}
                      {paper.author && " · "}
                      {paper.paperType === "단행본"
                        ? [paper.publisherLocation, paper.institution].filter(Boolean).join(": ")
                        : paper.paperType === "보고서"
                          ? [paper.institution, paper.researchPeriod].filter(Boolean).join(" · ")
                          : [paper.journalName ?? paper.institution, paper.volumeIssue].filter(Boolean).join(" ")}
                      {paper.degreeLevel ? ` · ${paper.degreeLevel}` : ""}
                      {paper.paperType === "보고서" && paper.researchTeam ? ` · 연구진: ${paper.researchTeam}` : ""}
                    </p>

                    {paper.keywords.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {canonicalKeywords(paper.keywords, canonical).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setActiveKeyword(k === activeKeyword ? null : k)}
                            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] ${
                              k === activeKeyword ? "bg-ink text-white" : TAG_CLASSNAME.keyword
                            } hover:brightness-95`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    )}

                    {paper.paperType === "보고서" && paper.researchSummary && (
                      <p className="mt-1.5 text-xs leading-5 text-grey">{paper.researchSummary}</p>
                    )}
                  </div>

                  <div>
                    <MemoField initialValue={paper.userMemo} onSave={(memo) => savePaperMemo(paper.id, memo)} />
                    <QuoteList
                      quotes={paper.quotes}
                      onAdd={(quoteText, page) => addQuote(paper.id, quoteText, page)}
                      onEdit={(id, quoteText, page) => updateQuote(id, quoteText, page)}
                      onDelete={(id) => deleteQuote(id)}
                    />
                    <CopyForNotionButton paper={paper} />
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {remaining > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 py-5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="rounded-sm bg-surface px-3 py-1.5 text-ink hover:bg-line"
            >
              + {Math.min(PAGE_SIZE, remaining)}편 더 보기
            </button>
            {/* 남은 편수를 적어 둔다 — 목록이 끊긴 것인지 다 본 것인지가 스크롤 끝에서만 갈린다 */}
            <span className="text-grey">
              {sortedPapers.length}편 중 {visiblePapers.length}편 표시 · {remaining}편 남음
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
