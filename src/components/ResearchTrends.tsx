"use client";

import { useMemo, useState } from "react";
import { PaperData, PaperType } from "@/lib/types";
import { TAG_CLASSNAME } from "@/lib/design-tokens";
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
import { deletePaper } from "@/lib/paper-actions";
import { addQuote, deleteQuote, updateQuote } from "@/lib/quote-actions";

const MIN_MENTIONS = 2; // 노이즈를 줄이기 위해 2회 이상 등장한 주제어만 클라우드에 노출
const MIN_FONT_PX = 11;
const MAX_FONT_PX = 27;

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

const PAPER_TYPE_CLASSNAME: Record<PaperType, string> = {
  학위논문: "bg-violet-100 text-violet-700",
  학술논문: "bg-blue-100 text-blue-800",
  단행본: "bg-teal-100 text-teal-700",
  보고서: "bg-amber-100 text-amber-800",
};

function buildFrequency(papers: PaperData[]) {
  const freq = new Map<string, number>();
  for (const p of papers) {
    for (const k of p.keywords) {
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }
  return freq;
}

// 같은 논문에 함께 등장한 주제어 쌍의 횟수 — "연관 단어" 파악용.
function buildCooccurrence(papers: PaperData[]) {
  const co = new Map<string, Map<string, number>>();
  for (const p of papers) {
    const uniq = Array.from(new Set(p.keywords));
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

  const frequency = useMemo(() => buildFrequency(papers), [papers]);
  const cooccurrence = useMemo(() => buildCooccurrence(papers), [papers]);

  const cloudKeywords = useMemo(() => {
    return Array.from(frequency.entries())
      .filter(([, count]) => count >= MIN_MENTIONS)
      .sort((a, b) => b[1] - a[1]);
  }, [frequency]);

  const maxCount = cloudKeywords[0]?.[1] ?? 1;
  const relatedCounts = activeKeyword ? cooccurrence.get(activeKeyword) : undefined;

  const importantCount = useMemo(() => papers.filter((p) => p.isImportant).length, [papers]);

  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (activeKeyword && !p.keywords.includes(activeKeyword)) return false;
      if (importantOnly && !p.isImportant) return false;
      return true;
    });
  }, [papers, activeKeyword, importantOnly]);

  const sortedPapers = useMemo(() => sortPapers(filteredPapers, sortMode), [filteredPapers, sortMode]);

  const scopeLabel = [activeKeyword ? `"${activeKeyword}"` : null, importantOnly ? "★ 중요" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <section className="mb-8">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="font-mono text-xs text-zinc-400">
            주제어 {cloudKeywords.length}개 · 논문 {papers.length}편 (RISS, 국내 구술사·구술생애사 연구)
          </h2>
          {/* 오른쪽 상단 — 최신화 줄 아래에 보기 스위치와 정렬 띠를 모아 둔다 */}
          <div className="flex flex-col items-end gap-1.5 font-mono text-[11px] text-zinc-400">
            <div className="flex items-center gap-2">
              <span>최신화: {formatSyncedAt(syncedAt)} 기준</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-sm bg-zinc-100 px-2 py-0.5 text-zinc-600 hover:bg-zinc-200 disabled:opacity-50"
              >
                {refreshing ? "시작하는 중…" : "🔄 새로고침"}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <Switch label="키워드" on={showKeywords} onToggle={() => setShowKeywords((v) => !v)} />
              <span className="mx-1 h-3 w-px bg-zinc-200" />
              {/* 중요만 보기는 정렬이 아니라 필터다 — 정렬 띠와 붙어 있되 스위치 모양으로 구분한다 */}
              <Switch
                label={`★ 중요만 (${importantCount})`}
                on={importantOnly}
                onToggle={() => setImportantOnly((v) => !v)}
              />
              <span className="mx-1 h-3 w-px bg-zinc-200" />
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  aria-pressed={sortMode === mode}
                  className={`rounded-sm px-2 py-1 ${
                    sortMode === mode
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  {SORT_LABELS[mode]}
                </button>
              ))}
              <span className="mx-1 h-3 w-px bg-zinc-200" />
              {!addingPaper && (
                <button
                  type="button"
                  onClick={() => setAddingPaper(true)}
                  className="rounded-sm bg-zinc-900 px-2.5 py-1 text-white hover:bg-zinc-700"
                >
                  + 논문 추가
                </button>
              )}
            </div>
          </div>
        </div>

        {refreshMessage && <p className="mb-2 text-xs text-emerald-700">{refreshMessage}</p>}

        {showKeywords && (
          <p className="mb-3 text-xs text-zinc-500">
            자주 등장한 주제어일수록 크게 표시됩니다. 클릭하면 같은 논문에 함께 등장한 연관 주제어가 강조되고,
            아래 목록이 해당 주제어로 좁혀집니다.
          </p>
        )}

        {/* 클라우드를 접어도 골라둔 주제어는 살아 있다 — 접힌 채로도 무엇이 걸렸는지 보이고 풀 수 있다 */}
        {activeKeyword && (
          <button
            type="button"
            onClick={() => setActiveKeyword(null)}
            className="mb-3 rounded-sm bg-zinc-900 px-2.5 py-1 font-mono text-xs text-white hover:bg-zinc-700"
          >
            × &ldquo;{activeKeyword}&rdquo; 선택 해제
          </button>
        )}

        <div
          className={`flex-wrap items-baseline gap-x-2.5 gap-y-1.5 rounded-sm border border-zinc-200 bg-zinc-50/60 p-4 ${
            showKeywords ? "flex" : "hidden"
          }`}
        >
          {cloudKeywords.length === 0 ? (
            <p className="font-mono text-xs text-zinc-400">데이터가 아직 없습니다.</p>
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
                      ? "bg-zinc-900 text-white"
                      : isRelated
                        ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-300"
                        : "text-zinc-600 hover:bg-zinc-200/70"
                  } ${isDimmed ? "opacity-30" : ""}`}
                >
                  {keyword}
                  {isRelated && <span className="ml-1 align-super text-[9px] text-amber-600">{coCount}</span>}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section>
        {/* 중요만·정렬·논문 추가는 모두 오른쪽 상단 띠로 옮겼다 — 여기는 지금 무엇이 걸렸는지만 남긴다 */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
          <h2 className="font-mono text-xs text-zinc-400">
            논문 목록 · {scopeLabel ? `${scopeLabel} ${sortedPapers.length}편` : `전체 ${sortedPapers.length}편`}
          </h2>
        </div>

        {addingPaper && <AddPaperForm onClose={() => setAddingPaper(false)} />}

        {sortedPapers.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-zinc-400">일치하는 논문이 없습니다.</p>
        ) : (
          <ul className="flex flex-col">
            {sortedPapers.map((paper) =>
              editingId === paper.id ? (
                <li key={paper.id} className="border-b border-zinc-200 py-3">
                  <AddPaperForm paper={paper} onClose={() => setEditingId(null)} />
                </li>
              ) : (
                <li
                  key={paper.id}
                  className="grid grid-cols-1 gap-3 border-b border-zinc-200 py-3 sm:grid-cols-[2fr_1fr]"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${PAPER_TYPE_CLASSNAME[paper.paperType]}`}>
                        {paper.paperType}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">{paper.year ?? "연도 미상"}</span>
                      <FlagToggle
                        active={paper.isImportant}
                        onToggle={(next) => togglePaperImportant(paper.id, next)}
                        activeLabel="★ 중요"
                        inactiveLabel="☆ 중요"
                        activeClassName="bg-amber-100 text-amber-700"
                      />
                      <FlagToggle
                        active={paper.isRead}
                        onToggle={(next) => togglePaperRead(paper.id, next)}
                        activeLabel="✓ 읽음"
                        inactiveLabel="안 읽음"
                        activeClassName="bg-emerald-100 text-emerald-700"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingId(paper.id)}
                        className="rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      >
                        수정
                      </button>
                      <ConfirmDeleteButton
                        onDelete={() => deletePaper(paper.id)}
                        confirmMessage={`"${paper.title}"을(를) 삭제할까요? 되돌릴 수 없습니다.`}
                        label="삭제"
                        pendingLabel="삭제 중…"
                        className="rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                      />
                    </div>

                    {/* 원문 링크가 없는 논문(직접 추가분 등)은 링크로 만들지 않는다 — href=""는 클릭해도
                        같은 페이지를 다시 불러올 뿐이라 "안 넘어간다"로 보인다. 차콜 글씨로 두어
                        링크가 없다는 걸 드러내고, 링크는 「수정」에서 채워 넣게 한다. */}
                    {paper.rissUrl ? (
                      <a
                        href={paper.rissUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[15px] leading-6 text-zinc-800 underline decoration-dotted underline-offset-4 hover:text-zinc-950"
                      >
                        {paper.title} <span className="text-zinc-300">↗</span>
                      </a>
                    ) : (
                      <p className="text-[15px] leading-6 text-zinc-700">{paper.title}</p>
                    )}

                    <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
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
                        {paper.keywords.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setActiveKeyword(k === activeKeyword ? null : k)}
                            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] ${
                              k === activeKeyword ? "bg-zinc-900 text-white" : TAG_CLASSNAME.keyword
                            } hover:brightness-95`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    )}

                    {paper.paperType === "보고서" && paper.researchSummary && (
                      <p className="mt-1.5 text-xs leading-5 text-zinc-500">{paper.researchSummary}</p>
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
      </section>
    </div>
  );
}
