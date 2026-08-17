"use client";

import { useRef, useState } from "react";
import { Highlight, Utterance } from "@/lib/types";
import { SPEAKER_CLASSNAME, TEXT_BODY_CLASSNAME } from "@/lib/design-tokens";
import { saveSegmentHighlights } from "@/lib/highlight-actions";

// 구술 본문. 발화마다 줄을 주고, 화자가 바뀌는 줄에만 이름을 붙인다 — 같은 사람이
// 이어 말할 때 이름을 반복하면 이름이 본문만큼 눈에 들어온다. 색으로도 한 번 더
// 가른다: 면담자(연구자)의 물음은 초록, 구술자의 답은 본문색(SPEAKER_CLASSNAME).
//
// 여기에 형광펜을 얹는다. 위치는 (발화 인덱스, 시작·끝 문자 위치)로 잡는다 — 화면에
// 그려지는 글자 기준이라, 줄머리("구술자: ")를 떼어낸 뒤의 문자열과 그대로 대응한다.

function speakerLabel(utterance: Utterance): string | null {
  if (utterance.role === "stage") return null;
  return utterance.speaker ?? (utterance.role === "interviewer" ? "면담자" : "구술자");
}

// (텍스트 노드, 그 안의 위치)를 컨테이너 전체에서 몇 번째 글자인지로 바꾼다.
// 이미 그어 둔 <mark> 때문에 한 발화가 여러 텍스트 노드로 쪼개져 있으므로,
// 앞선 노드들의 길이를 모두 더해야 한다.
function offsetWithin(container: Node, node: Node, offset: number): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
  }
  return null; // 선택이 이 발화 밖에서 시작했거나 끝났다
}

// 한 발화의 글자들을 "그은 곳/안 그은 곳"으로 잘라 낸다. 넘겨받는 ranges는 이 발화 것만,
// 이미 겹침이 정리되어 시작 위치 순으로 정렬돼 있다고 본다(highlight-actions의 normalize).
function splitByRanges(text: string, ranges: Highlight[]) {
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

export function Transcript({
  segmentId,
  utterances,
  highlights,
}: {
  segmentId: string;
  utterances: Utterance[];
  highlights: Highlight[];
}) {
  const rootRef = useRef<HTMLUListElement>(null);
  // 저장을 기다리지 않고 먼저 그린다 — 형광펜은 그은 순간 보여야 손이 이어진다.
  // 저장이 실패하면 되돌리고 알린다(메모·중요 토글과 같은 방식).
  const [local, setLocal] = useState(highlights);
  const [failed, setFailed] = useState(false);

  async function commit(next: Highlight[]) {
    const previous = local;
    setLocal(next);
    setFailed(false);
    try {
      await saveSegmentHighlights(segmentId, next);
    } catch {
      setLocal(previous);
      setFailed(true);
    }
  }

  // 드래그가 끝나는 순간 긋는다. 따로 "긋기" 버튼을 두지 않는 이유는, 버튼이 뜨는 자리가
  // 늘 방금 읽던 줄을 가리기 때문이다 — 종이에 형광펜을 그을 때도 확인을 묻지 않는다.
  // 잘못 그었으면 그 자리를 다시 눌러 지운다.
  function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !rootRef.current) return;

    const range = selection.getRangeAt(0);
    // 한 발화 안에서 끝난 선택만 받는다. 여러 발화에 걸친 선택은 화자가 바뀌는 지점을
    // 가로지르는 것이라, 어느 발화의 몇 번째 글자인지가 한 쌍으로 정해지지 않는다.
    const startLine = (range.startContainer.parentElement as HTMLElement | null)?.closest("[data-line]");
    const endLine = (range.endContainer.parentElement as HTMLElement | null)?.closest("[data-line]");
    if (!startLine || startLine !== endLine) return;
    if (!rootRef.current.contains(startLine)) return;

    const line = Number(startLine.getAttribute("data-line"));
    const start = offsetWithin(startLine, range.startContainer, range.startOffset);
    const end = offsetWithin(startLine, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) return;

    selection.removeAllRanges(); // 그은 뒤 파란 선택 띠가 노란 형광펜 위에 겹쳐 남지 않게
    void commit([...local, { line, start, end }]);
  }

  // 그어 둔 자리를 누르면 그 한 줄기를 지운다.
  function handleRemove(target: Highlight) {
    void commit(local.filter((h) => !(h.line === target.line && h.start === target.start && h.end === target.end)));
  }

  return (
    <>
      {/* 크기는 본문 한 단(design-tokens.ts). 행간만 연표 요약(leading-5)보다 넓게 잡는다 —
          구술은 요약 한 줄이 아니라 여러 줄을 이어 읽는 글이다. */}
      <ul
        ref={rootRef}
        onMouseUp={handleMouseUp}
        className={`flex flex-col gap-1 ${TEXT_BODY_CLASSNAME} leading-6 text-ink`}
      >
        {utterances.map((utterance, i) => {
          const previous = utterances[i - 1];
          // 지문은 화자가 없는 줄이라 이름을 달지 않고, 다음 발화의 "바뀌었는가" 판단에서도
          // 건너뛴다 — 지문이 끼었다고 같은 사람의 이름을 다시 적을 이유는 없다.
          const label = speakerLabel(utterance);
          const previousLabel = previous && previous.role !== "stage" ? speakerLabel(previous) : undefined;
          const showLabel = label !== null && label !== previousLabel;

          const text = utterance.role === "stage" ? `[${utterance.text}]` : utterance.text;
          const ranges = local
            .filter((h) => h.line === i)
            .sort((a, b) => a.start - b.start);

          return (
            <li key={i} className={utterance.role === "stage" ? "pl-3" : undefined}>
              {/* 이름표는 data-line 밖에 둔다 — 안에 있으면 드래그가 이름까지 삼켜
                  본문 글자 수와 어긋난 위치가 저장된다. */}
              {showLabel && <span className="mr-1.5 font-mono text-[10px] text-grey">{label}</span>}
              <span data-line={i} className={SPEAKER_CLASSNAME[utterance.role]}>
                {ranges.length === 0
                  ? text
                  : splitByRanges(text, ranges).map((part, j) =>
                      part.marked ? (
                        <mark
                          key={j}
                          onClick={() =>
                            handleRemove({ line: i, start: part.start, end: part.start + part.text.length })
                          }
                          title="눌러서 지우기"
                          className="cursor-pointer bg-yellow-mark text-inherit"
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={j}>{part.text}</span>
                      ),
                    )}
              </span>
            </li>
          );
        })}
      </ul>
      {failed && (
        <p className="mt-1 font-mono text-[11px] text-red-text">
          형광펜을 저장하지 못했습니다. 잠시 뒤 다시 그어 보세요.
        </p>
      )}
    </>
  );
}
