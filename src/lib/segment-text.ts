import { Utterance } from "./types";

// segment_text 원문("면담자:"/"구술자:" 접두사가 붙은 줄바꿈 텍스트)을 화면 표시용 발화 배열로 바꾼다.
// DB에는 이 형태 그대로 저장하고(6-1-1: 발화 단위로 쪼개 저장하지 않기로 결정), 파싱은 항상 여기서 한다.
export function parseSegmentText(text: string): Utterance[] {
  return text.split("\n").map((line) => {
    const m = line.match(/^(면담자|구술자)\s*[:;]\s*(.*)$/);
    if (!m) return { role: "narrator" as const, text: line };
    return { role: m[1] === "면담자" ? ("interviewer" as const) : ("narrator" as const), text: m[2] };
  });
}
