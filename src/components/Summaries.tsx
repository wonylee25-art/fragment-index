import type { Summary } from "@/lib/grains";

// 시킬 때마다 올라오는 정리. 가장 최근 것은 펼쳐 두고, 예전 것은 접어 둔다.
// 상태가 없는 화면이라 서버에서 그대로 그린다(details가 접고 펴는 일을 맡는다).

// 서버와 브라우저의 시간대가 달라도 같은 날로 읽히도록 한국 시간으로 날짜를 자른다.
const MONTH_DAY = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

// 정리가 다룬 기간. 하루 안이면 그 날 하나만, 아니면 "9월 27일 ~ 10월 5일"로 적는다.
function periodLabel(start: string, end: string) {
  const from = MONTH_DAY.format(new Date(start));
  const to = MONTH_DAY.format(new Date(end));
  return from === to ? from : `${from} ~ ${to}`;
}

export function Summaries({ summaries }: { summaries: Summary[] }) {
  if (summaries.length === 0) {
    return (
      <p className="mb-4 font-mono text-[11px] text-grey">
        정리는 Claude에게 시키면 만들어져 여기 올라옵니다.
      </p>
    );
  }

  return (
    <section className="mb-6 space-y-2" aria-label="정리">
      {summaries.map((s, i) => (
        <details key={s.id} open={i === 0} className="rounded-sm border border-line bg-surface">
          <summary className="cursor-pointer px-3 py-2 font-mono text-xs font-bold text-ink">
            {periodLabel(s.periodStart, s.periodEnd)} 정리
            <span className="ml-2 font-normal text-grey">조각 {s.fragmentCount}건</span>
          </summary>
          <p className="whitespace-pre-wrap break-words border-t border-line px-3 py-3 text-[13px] leading-relaxed text-ink">
            {s.body}
          </p>
        </details>
      ))}
    </section>
  );
}
