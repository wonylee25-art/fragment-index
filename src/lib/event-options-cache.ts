import { getEventOptions } from "./db";
import { EventOption } from "./event-candidates";

// 사건 명단은 고르는 칸에 글자를 칠 때마다 필요하다. 한 번 부르는 데 여섯 쪽 왕복이라,
// 매번 다시 읽으면 좁히기 칸이 한 글자마다 멎는다. 짧게 들고 있다가 버린다.
//
// 사건을 새로 만들거나 고치면 그 자리에서 버린다(event-actions). 그래도 수명을 함께 두는
// 것은 서버가 한 대가 아니어서다 — 고친 쪽과 들고 있는 쪽이 다른 인스턴스일 수 있다.
const TTL_MS = 60_000;

let held: { at: number; rows: EventOption[] } | null = null;
let loading: Promise<EventOption[]> | null = null;

export async function loadEventOptions(): Promise<EventOption[]> {
  if (held && Date.now() - held.at < TTL_MS) return held.rows;
  // 같은 순간에 여러 요청이 몰려도 읽기는 한 번이면 된다.
  loading ??= getEventOptions()
    .then((rows) => {
      held = { at: Date.now(), rows };
      return rows;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function bustEventOptions() {
  held = null;
}
