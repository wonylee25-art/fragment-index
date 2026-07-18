import { SegmentCardData } from "./types";

// 교차 블록에서는 발췌 전체가 아니라 구술자의 말만 부분 인용한다.
// 면담자 질문·지문은 빼고, 너무 길면 앞부분만 자른다.
export function narratorPullQuote(segment: SegmentCardData, maxLength = 90): string {
  const joined = segment.utterances
    .filter((u) => u.role === "narrator")
    .map((u) => u.text)
    .join(" ");
  if (joined.length <= maxLength) return joined;
  return `${joined.slice(0, maxLength).trimEnd()}…`;
}
