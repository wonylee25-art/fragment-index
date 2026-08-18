"use client";

// 쪽 넘기기 한 벌. 보류함(LinkPickSection)과 사건 고르기(EventAttach)가 함께 쓴다 —
// 같은 조작을 두 벌 만들면 한쪽만 고쳐지고 두 화면이 어긋난다.
//
// 예전에는 이전·다음뿐이었다. 사료가 90건이 되자 4쪽으로 가려고 세 번을 눌러야 했고,
// 그 사이 화면은 매번 처음으로 튀어 무엇을 지나쳤는지도 잃었다. 쪽 번호를 직접 짚는다.
//
// 쪽이 많으면 번호를 다 늘어놓을 수 없다 — 사건 목록은 6천 건이 넘어 수백 쪽이다.
// 처음·끝과 지금 선 자리 언저리만 남기고 사이는 …로 접는다.

// 쪽 번호는 0부터 세고(자르는 쪽과 같은 셈), 화면에만 1을 더해 보인다.
export function pageWindow(current: number, count: number): (number | "gap")[] {
  // 아홉 쪽까지는 접지 않고 다 늘어놓는다. 여섯 쪽짜리 목록에서 "1 2 … 6"이 되면 3·4쪽으로
  // 바로 가라고 만든 물건이 정작 그 번호를 감춘다 — 접는 것은 번호가 줄줄이 흐를 때만 한다.
  if (count <= 9) return Array.from({ length: count }, (_, i) => i);

  const keep = new Set<number>();
  for (const p of [0, count - 1, current - 1, current, current + 1]) {
    if (p >= 0 && p < count) keep.add(p);
  }

  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (const [i, p] of sorted.entries()) {
    const prev = sorted[i - 1];
    if (i > 0 && p - prev > 1) {
      // 접었을 때 가려지는 쪽이 하나뿐이면 …보다 그 번호를 그냥 보이는 편이 낫다.
      if (p - prev === 2) out.push(prev + 1);
      else out.push("gap");
    }
    out.push(p);
  }
  return out;
}

export function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-grey">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="shrink-0 px-1.5 py-0.5 hover:text-ink disabled:text-line"
      >
        ‹ 이전
      </button>

      <div className="flex flex-wrap items-center justify-center gap-x-0.5 tabular-nums">
        {pageWindow(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-line">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`${p + 1}쪽`}
              className={
                p === page
                  ? "px-1.5 py-0.5 font-bold text-ink underline decoration-dotted underline-offset-4"
                  : "px-1.5 py-0.5 hover:text-ink"
              }
            >
              {p + 1}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        className="shrink-0 px-1.5 py-0.5 hover:text-ink disabled:text-line"
      >
        다음 ›
      </button>
    </div>
  );
}
