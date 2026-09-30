"use client";

import { useMemo, useState } from "react";
import type { Grain, GrainKind, GrainThread } from "@/lib/grains";
import { KeywordGrid } from "./KeywordGrid";
import { Switch } from "./Switch";

// 일상 조각 — 덩어리(thread) 단위로 묶어 보여 준다. 검색과 종류 필터는 브라우저에서 건다:
// 조각이 수천 건이 되기 전까지는 통째로 받아 거르는 것이 왕복 없이 가장 빠르다.
//
// 연결은 두 가지로 보인다.
//  · 키워드 렌즈 — 「키워드만 진하게」를 켜면 키워드가 아닌 글은 회색으로 물러나고 키워드만 남는다.
//    키워드를 하나 고르면 그 낱말만 남아, 여러 날에 걸쳐 되풀이되는 자리가 한눈에 보인다.
//    색을 얹지 않고 있는 글의 농도만 덜어 내므로 "색은 내가 손댄 흔적"이라는 규칙과 어긋나지 않는다.
//  · 강조 — 내가 직접 그은 구간만 노랑이다. 렌즈를 켜도 꺼도 그대로 남는다.

const KIND_LABEL: Record<GrainKind, string> = {
  text: "글",
  photo: "사진",
  forward: "전달",
};

type KindFilter = "all" | GrainKind;

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "text", label: KIND_LABEL.text },
  { value: "photo", label: KIND_LABEL.photo },
  { value: "forward", label: KIND_LABEL.forward },
];

// 서버와 브라우저의 시간대가 달라도 같은 글자가 나오도록 시간대를 못 박는다.
const DAY = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});
const TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// 본문에서 키워드가 나오는 모든 자리에 표를 한다. 대소문자는 가리지 않는다.
function keywordFlags(text: string, keywords: string[], active: string | null) {
  const any = new Array<boolean>(text.length).fill(false);
  const selected = new Array<boolean>(text.length).fill(false);
  // toLowerCase가 글자 수를 바꾸는 드문 글자에서는 위치가 어긋나므로 그때는 원문으로 찾는다.
  const lower = text.toLowerCase().length === text.length ? text.toLowerCase() : text;
  for (const keyword of keywords) {
    const needle = keyword.toLowerCase();
    if (!needle) continue;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
      for (let i = at; i < at + needle.length; i++) {
        any[i] = true;
        if (keyword === active) selected[i] = true;
      }
    }
  }
  return { any, selected };
}

function GrainBody({
  grain,
  lens,
  active,
}: {
  grain: Grain;
  lens: boolean;
  active: string | null;
}) {
  const text = grain.body;
  const { any, selected } = keywordFlags(text, grain.keywords, active);
  const marked = new Array<boolean>(text.length).fill(false);
  for (const h of grain.highlights) {
    for (let i = Math.max(0, h.start); i < Math.min(text.length, h.end); i++) marked[i] = true;
  }

  // 같은 표를 가진 글자를 한 덩이로 묶어 span 수를 줄인다.
  const runs: { text: string; keyword: boolean; on: boolean; mark: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    // 렌즈에서 진하게 남는 글자: 고른 키워드가 있으면 그 낱말만, 없으면 모든 키워드.
    const on = active ? selected[i] : any[i];
    const last = runs[runs.length - 1];
    if (last && last.keyword === any[i] && last.on === on && last.mark === marked[i]) {
      last.text += text[i];
    } else {
      runs.push({ text: text[i], keyword: any[i], on, mark: marked[i] });
    }
  }

  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
      {runs.map((r, i) => {
        // 렌즈를 켰을 때: 남길 글자는 진하게, 나머지는 회색. 강조 구간은 늘 진한 글씨에 노랑.
        const dim = lens && !r.on && !r.mark;
        const cls = [
          dim ? "text-grey" : "text-ink",
          lens && r.on ? "font-semibold underline decoration-ink underline-offset-2" : "",
          // 렌즈가 꺼져 있어도 키워드 자리가 어디인지는 얇은 점선으로 알 수 있게 한다.
          !lens && r.keyword ? "underline decoration-dotted decoration-grey underline-offset-2" : "",
          r.mark ? "bg-yellow-mark" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={i} className={cls}>
            {r.text}
          </span>
        );
      })}
    </p>
  );
}

export function GrainsBoard({ threads }: { threads: GrainThread[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [lens, setLens] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [grid, setGrid] = useState(true);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .map((t) => ({
        ...t,
        grains: t.grains.filter(
          (g) =>
            (kind === "all" || g.kind === kind) &&
            (!q || g.body.toLowerCase().includes(q) || (g.source ?? "").toLowerCase().includes(q)),
        ),
      }))
      .filter((t) => t.grains.length > 0);
  }, [threads, query, kind]);

  const total = visible.reduce((n, t) => n + t.grains.length, 0);

  // 키워드별로 몇 건의 조각에, 며칠에 걸쳐 나왔는지. 며칠에 걸쳤는지가 "연결"의 크기다.
  const keywordStats = useMemo(() => {
    const stats = new Map<string, { grains: number; days: Set<string> }>();
    for (const t of visible) {
      for (const g of t.grains) {
        for (const k of new Set(g.keywords)) {
          const s = stats.get(k) ?? { grains: 0, days: new Set<string>() };
          s.grains += 1;
          s.days.add(DAY.format(new Date(g.createdAt)));
          stats.set(k, s);
        }
      }
    }
    return [...stats.entries()]
      .map(([keyword, s]) => ({ keyword, grains: s.grains, days: s.days.size }))
      .sort((a, b) => b.days - a.days || b.grains - a.grains || a.keyword.localeCompare(b.keyword));
  }, [visible]);

  const hasKeywords = keywordStats.length > 0;
  const activeStat = keywordStats.find((s) => s.keyword === active) ?? null;

  function toggleLens() {
    // 렌즈를 끄면 고른 키워드도 함께 푼다 — 렌즈 없이 고른 키워드만 남아 있으면 무엇이 눌려 있는지 알 수 없다.
    if (lens) setActive(null);
    setLens(!lens);
  }

  function pickKeyword(keyword: string) {
    if (active === keyword) {
      setActive(null);
    } else {
      setActive(keyword);
      setLens(true);
    }
  }

  // 격자의 점을 눌렀을 때: 그 키워드를 고르고 그 날 그 키워드가 나온 조각으로 내려간다.
  // 이미 고른 키워드라면 풀지 않고 이동만 한다 — 같은 행의 다른 날 점을 잇달아 누르며 훑어볼 수 있게.
  function jumpTo(keyword: string, grain: Grain) {
    setActive(keyword);
    setLens(true);
    // 렌즈가 그려진 뒤에 스크롤해야 위치가 맞는다.
    requestAnimationFrame(() => {
      document
        .getElementById(`grain-${grain.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="조각 안에서 찾기"
          className="w-64 rounded-sm border border-line bg-surface px-2 py-1 font-mono text-xs text-ink placeholder:text-grey focus:outline-none"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setKind(f.value)}
              className={`rounded-sm px-2 py-1 font-mono text-xs font-bold transition-colors ${
                kind === f.value ? "bg-ink text-background" : "bg-surface text-grey hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {hasKeywords && (
          <div className="flex items-center gap-4 font-mono text-xs">
            <Switch label="키워드만 진하게" on={lens} onToggle={toggleLens} />
            <Switch label="날짜×키워드 격자" on={grid} onToggle={() => setGrid(!grid)} />
          </div>
        )}
        <span className="font-mono text-xs text-grey">
          조각 {total}건 · 덩어리 {visible.length}개
        </span>
      </div>

      {hasKeywords && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] text-grey">키워드</span>
            {keywordStats.map((s) => (
              <button
                key={s.keyword}
                type="button"
                onClick={() => pickKeyword(s.keyword)}
                aria-pressed={active === s.keyword}
                className={`rounded-sm px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                  active === s.keyword
                    ? "bg-ink text-background"
                    : "bg-surface text-ink hover:bg-line"
                }`}
              >
                {s.keyword}
                <span className={active === s.keyword ? "ml-1 opacity-70" : "ml-1 text-grey"}>
                  {s.days}일
                </span>
              </button>
            ))}
          </div>
          {activeStat && (
            <p className="mt-2 font-mono text-[11px] text-grey">
              ‘{activeStat.keyword}’ — {activeStat.days}일에 걸쳐 조각 {activeStat.grains}건에 나옵니다.
              다시 누르면 풉니다.
            </p>
          )}
        </div>
      )}

      {hasKeywords && grid && <KeywordGrid threads={visible} active={active} onPick={jumpTo} />}

      {visible.length === 0 ? (
        <p className="py-10 font-mono text-xs text-grey">
          {threads.length === 0
            ? "아직 쌓인 조각이 없습니다. 텔레그램 봇에 메모를 보내 보세요."
            : "조건에 맞는 조각이 없습니다."}
        </p>
      ) : (
        <ol className="space-y-4">
          {visible.map((t) => {
            const first = t.grains[0];
            return (
              <li key={t.id} className="rounded-sm border border-line">
                <div className="border-b border-line bg-surface px-3 py-2">
                  <div className="font-mono text-xs font-bold text-ink">
                    {DAY.format(new Date(first.createdAt))} {TIME.format(new Date(first.createdAt))}
                    {t.title ? ` · ${t.title}` : ""}
                  </div>
                  {t.summary && <p className="mt-1 text-[13px] text-grey">{t.summary}</p>}
                </div>
                <ul className="divide-y divide-line">
                  {t.grains.map((g) => (
                    <li key={g.id} id={`grain-${g.id}`} className="flex gap-3 px-3 py-2">
                      <span className="w-12 shrink-0 font-mono text-xs text-grey">
                        {TIME.format(new Date(g.createdAt))}
                      </span>
                      <div className="min-w-0 flex-1">
                        {g.photoUrl && (
                          // 서명 주소는 요청마다 달라지고 도메인도 바뀌어 next/image의 최적화 대상이 아니다.
                          // 작게 보여 주고, 누르면 새 창에서 저장된 사본 그대로 크게 연다.
                          <a
                            href={g.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-2 block w-fit"
                            aria-label="사진 크게 보기"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={g.photoUrl}
                              alt="텔레그램으로 보낸 사진"
                              loading="lazy"
                              className="h-24 w-auto rounded-sm border border-line"
                            />
                          </a>
                        )}
                        <GrainBody grain={g} lens={lens} active={active} />
                        {(g.kind !== "text" || g.source || g.editedAt) && (
                          <p className="mt-1 font-mono text-[11px] text-grey">
                            {[
                              g.kind !== "text" ? KIND_LABEL[g.kind] : null,
                              g.source ? `출처 ${g.source}` : null,
                              g.editedAt ? "수정됨" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
