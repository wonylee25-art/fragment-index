// 연관도 3단계 — 검색어가 있으면 텍스트 매칭 강도, 없으면 구술 연결 여부를 뜻한다.
// high(주황) = 검색어가 제목·키워드·장소에 직접 매칭 / 구술과 직접 연결
// low(파랑)  = 검색어가 내용·출처에서만 매칭 / 태그가 겹치는 간접 연관
// none(회색) = 무관
export type TickRelation = "high" | "low" | "none";

export interface RulerTick {
  id: string;
  title: string; // 호버 툴팁용 "연도 · 사건명"
  leftPct: number;
  relation: TickRelation;
}

export interface RulerDecade {
  year: number;
  leftPct: number;
  labeled: boolean; // 100년 이상 도메인에서는 라벨을 20년마다만 찍어 겹침을 피한다
}

// 스크롤 후 화면 상단에 남는 바코드 띠 높이. 컬렉션 막대가 이 아래에 붙어야 해서 밖에서도 쓴다.
export const BAR_HEIGHT = 24;
const AXIS_BOTTOM = 14; // 기준선(축)의 바닥으로부터 높이
const TICK_HEIGHT = 54; // 사건 눈금(바코드)의 세로 길이
const FULL_HEIGHT = TICK_HEIGHT + AXIS_BOTTOM + 10; // 펼쳐진 상태의 전체 높이 = 눈금 + 축 아래 라벨 자리 + 위 여백

const TICK_STYLE: Record<TickRelation, { className: string; width: number }> = {
  high: { className: "bg-orange-500", width: 3 },
  low: { className: "bg-blue-400", width: 2 },
  none: { className: "bg-zinc-200", width: 1 },
};

// 연도 범위 필터가 걸렸을 때 눈금 위에 덮는 음영의 좌우 경계(%).
// 눈금 색은 관련도라는 다른 뜻을 이미 갖고 있어서 건드리지 않고, 범위 밖 구간에 음영만 깐다.
export interface RulerRange {
  fromPct: number;
  toPct: number;
}

// 레이아웃 높이는 항상 FULL_HEIGHT로 고정하고 sticky top을 음수로 줘서,
// 위쪽은 자연스럽게 스크롤아웃되고 아래 BAR_HEIGHT(축+눈금 하단+10년 라벨)만 남는다.
// 높이를 실제로 줄이면 브라우저 스크롤 앵커링과 충돌해 스크롤이 튄다.
// 사건명 라벨은 없다 — 100년 스케일에서는 읽을 수 없으므로 10년 눈금 + 호버 툴팁으로 대체.
export function TimelineRuler({
  ticks,
  decades,
  range,
}: {
  ticks: RulerTick[];
  decades: RulerDecade[];
  range?: RulerRange | null;
}) {
  return (
    <div
      className="sticky z-30 overflow-hidden border-b border-zinc-200 bg-white/95 backdrop-blur-sm"
      style={{ height: FULL_HEIGHT, top: BAR_HEIGHT - FULL_HEIGHT }}
    >
      <div className="page-shell relative h-full">
        {/* 기준선 */}
        <div className="absolute left-4 right-4 h-px bg-zinc-300" style={{ bottom: AXIS_BOTTOM }} />

        {/* 10년 단위 눈금 — 바코드 상태에서도 연도 라벨이 남아 위치를 알려준다 */}
        {decades.map((d) => (
          <div key={d.year} className="absolute bottom-0 top-0" style={{ left: `${d.leftPct}%` }}>
            <span
              className="absolute top-2 w-px bg-zinc-100"
              style={{ bottom: AXIS_BOTTOM }}
              aria-hidden
            />
            {d.labeled && (
              <span className="absolute bottom-[2px] -translate-x-1/2 font-mono text-[9px] text-zinc-400">
                {d.year}
              </span>
            )}
          </div>
        ))}

        {/* 사건 눈금 — 검색 상태에 따라 관련도 색이 바뀌는 "바코드" */}
        {ticks.map((t) => (
          <span
            key={t.id}
            title={t.title}
            className={`absolute ${TICK_STYLE[t.relation].className}`}
            style={{
              left: `${t.leftPct}%`,
              bottom: AXIS_BOTTOM,
              width: TICK_STYLE[t.relation].width,
              height: TICK_HEIGHT,
            }}
          />
        ))}

        {/* 연도 범위 밖 — 눈금 위에 덮어 흐리게 하되, 눈금 자체의 색(관련도)은 그대로 둔다 */}
        {range && (
          <>
            {range.fromPct > 0 && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 top-0 border-r border-zinc-300 bg-zinc-500/10"
                style={{ width: `${range.fromPct}%` }}
                aria-hidden
              />
            )}
            {range.toPct < 100 && (
              <div
                className="pointer-events-none absolute bottom-0 right-0 top-0 border-l border-zinc-300 bg-zinc-500/10"
                style={{ width: `${100 - range.toPct}%` }}
                aria-hidden
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
