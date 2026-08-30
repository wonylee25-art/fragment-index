import { edtfDayGap } from "./edtf";

// 사건을 고르는 자리(EventPicker·EventAttach·구술 추가 폼)가 후보를 추리는 규칙.
//
// 예전에는 사건 6,431건을 세 화면이 통째로 클라이언트로 안고 갔다. 구술이 4건인 화면의
// 페이로드가 1.2MB였고 그 대부분이 열지도 않은 폼의 사건 명단이었다 — 화면을 누르고 기다리는
// 시간이 거기서 났다. 이제 목록은 서버에 두고, 고르는 자리가 필요할 때 좁혀서 받아 간다.
//
// 추리는 일 자체는 예전에 각 화면이 하던 것과 같다. 순서를 정하는 실마리가 셋인데 서로
// 다투므로 차례를 정해 둔다 — 사람이 직접 친 말이 가장 앞서고, 그다음이 자료의 날짜,
// 아무것도 없으면 화면이 물고 들어온 검색어다.

export interface EventOption {
  id: string;
  year: string;
  eventName: string;
  // 사료와 며칠 떨어졌는지 재는 데 쓴다(EventAttach의 nearDate). 연도만으로는 못 잰다.
  dateValue?: string;
  // 숨긴 사건도 붙일 수 있다 — 숨기기는 연표에서만 안 보이게 하는 일이다. 다만 목록에서는
  // "숨김"이라고 적어, 붙여도 연표에 안 나타난다는 것을 누르기 전에 알린다.
  hidden?: boolean;
}

export interface EventCandidates {
  options: EventOption[];
  matched: number; // 좁히기에 걸린 것 전부 — 지금 실어 보낸 수가 아니다
  total: number; // 후보가 될 수 있는 사건 전부
}

export const EVENT_CANDIDATE_LIMIT = 50;

export interface EventCandidateQuery {
  // 사람이 좁히기 칸에 친 말
  query?: string;
  // 이 날짜 언저리를 앞세운다 — 사료의 연대
  nearDate?: string;
  // 화면이 물고 들어온 검색어. 사료를 찾아 들어온 사람에게는 그 말과 얽힌 사건이
  // 첫 쪽에 있어야 한다(예전 「사료」 화면이 서버에서 하던 자리 올리기다).
  boostQuery?: string;
  limit?: number;
}

function hit(event: EventOption, q: string): boolean {
  return event.eventName.includes(q) || event.year.includes(q);
}

// rows는 최근 사건부터 정렬돼 들어온다(getEventOptions). 그 순서가 아무 실마리도 없을 때의 기본이다.
export function rankEventCandidates(
  rows: EventOption[],
  { query = "", nearDate, boostQuery, limit = EVENT_CANDIDATE_LIMIT }: EventCandidateQuery,
): EventCandidates {
  const q = query.trim();
  const matched = q ? rows.filter((e) => hit(e, q)) : rows;

  let ordered = matched;
  if (q) {
    // 사람이 친 말로 좁힌 뒤에는 순서를 더 건드리지 않는다 — 무엇으로 걸렀는지가 이미
    // 실마리라, 여기에 날짜 근접까지 겹치면 왜 이 차례인지 화면이 설명할 길이 없다.
  } else if (nearDate) {
    // 날짜를 모르는 사건은 견줄 수가 없으니 뒤로 보낸다. 걸러내지는 않는다 — 날짜가 성긴
    // 사건도 있고, 후보에서 조용히 빼면 찾다가 없다고 여기게 된다.
    ordered = [...matched].sort((a, b) => {
      const ga = a.dateValue ? edtfDayGap(a.dateValue, nearDate) : null;
      const gb = b.dateValue ? edtfDayGap(b.dateValue, nearDate) : null;
      if (ga === null) return gb === null ? 0 : 1;
      if (gb === null) return -1;
      return ga - gb;
    });
  } else if (boostQuery?.trim()) {
    const b = boostQuery.trim();
    ordered = [...matched.filter((e) => hit(e, b)), ...matched.filter((e) => !hit(e, b))];
  }

  return {
    options: ordered.slice(0, limit),
    matched: matched.length,
    total: rows.length,
  };
}
