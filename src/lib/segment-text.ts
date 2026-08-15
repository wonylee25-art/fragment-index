import { SpeakerRole, Utterance } from "./types";

// segment_text 원문을 화면 표시용 발화 배열로 바꾼다. DB에는 줄바꿈 텍스트 한 덩어리로
// 저장하고(6-1-1: 발화 단위로 쪼개 저장하지 않기로 결정), 파싱은 항상 여기서 한다.
//
// 줄머리 표기는 두 가지다.
//   "구술자: …" / "면담자: …"  CSV 동기화분이 쓰던 역할 표기
//   "김청기: …"                 사람 이름 표기 — 구술자가 둘 이상인 면담에서 누구 말인지 가른다
// 이름 표기를 역할로 되돌리려면 그 발췌의 화자 명단이 필요하므로 roleByName으로 받는다.
// 명단에 없는 이름이 줄머리에 오면 접두사로 보지 않고 본문 그대로 둔다 — "김씨: 그러니까"
// 같은 인용을 화자로 오해하지 않기 위해서다.

const ROLE_PREFIX = /^(면담자|구술자)\s*[:;]\s*(.*)$/;
const NAME_PREFIX = /^([^\s:;]{1,20})\s*[:;]\s*(.*)$/;

export function parseSegmentText(text: string, roleByName?: Map<string, SpeakerRole>): Utterance[] {
  return text.split("\n").map((line) => {
    const byRole = line.match(ROLE_PREFIX);
    if (byRole) {
      return {
        role: byRole[1] === "면담자" ? ("interviewer" as const) : ("narrator" as const),
        text: byRole[2],
      };
    }

    const byName = roleByName ? line.match(NAME_PREFIX) : null;
    if (byName) {
      const role = roleByName!.get(byName[1]);
      if (role) return { role, text: byName[2], speaker: byName[1] };
    }

    return { role: "narrator" as const, text: line };
  });
}

// 발화 배열을 다시 segment_text 한 덩어리로 되돌린다 — 구술 추가 화면의 입력기가 화자를
// 줄 단위로 들고 있다가 저장 직전에 이 형태로 눌러 담는다. parseSegmentText와 짝이므로
// 줄머리 표기를 바꾸려면 두 함수를 함께 고쳐야 한다.
// 지문(stage)은 접두사 없이 그대로 둔다 — 원본 채록문에서도 지문은 화자가 없는 줄이다.
export function serializeUtterances(utterances: Utterance[]): string {
  return utterances
    .map(({ role, text, speaker }) => {
      const line = text.trim();
      if (!line) return "";
      if (role === "stage") return line;
      const label = speaker?.trim() || (role === "interviewer" ? "면담자" : "구술자");
      return `${label}: ${line}`;
    })
    .filter(Boolean)
    .join("\n");
}
