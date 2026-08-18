// 형광펜의 자리 계산. 구술 본문(Transcript)과 연표 내용(HighlightableText)이 같은 셈을
// 쓰기에 여기 모아 둔다 — 한쪽에서 위치가 한 글자 어긋나는 버그를 고치면 다른 쪽도 함께
// 고쳐져야 한다.

import { Highlight } from "./types";

// (텍스트 노드, 그 안의 위치)를 컨테이너 전체에서 몇 번째 글자인지로 바꾼다.
// 이미 그어 둔 <mark> 때문에 한 덩이 글이 여러 텍스트 노드로 쪼개져 있으므로,
// 앞선 노드들의 길이를 모두 더해야 한다.
export function offsetWithin(container: Node, node: Node, offset: number): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
  }
  return null; // 선택이 이 글 밖에서 시작했거나 끝났다
}

// 한 덩이 글의 글자들을 "그은 곳/안 그은 곳"으로 잘라 낸다. 넘겨받는 ranges는 그 글의 것만,
// 이미 겹침이 정리되어 시작 위치 순으로 정렬돼 있다고 본다(highlight-actions의 normalize).
export function splitByRanges(text: string, ranges: Highlight[]) {
  const parts: { text: string; marked: boolean; start: number }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.min(range.start, text.length);
    const end = Math.min(range.end, text.length);
    if (start >= end) continue; // 본문이 짧아진 뒤 남은 범위 — 그냥 지나친다
    if (start > cursor) parts.push({ text: text.slice(cursor, start), marked: false, start: cursor });
    parts.push({ text: text.slice(start, end), marked: true, start });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false, start: cursor });
  return parts;
}
