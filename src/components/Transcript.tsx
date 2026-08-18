"use client";

import { useEffect, useRef, useState } from "react";
import { Highlight, Utterance } from "@/lib/types";
import { SPEAKER_CLASSNAME, TEXT_BODY_CLASSNAME } from "@/lib/design-tokens";
import { saveSegmentHighlights } from "@/lib/highlight-actions";
import { offsetWithin, splitByRanges } from "@/lib/highlight-range";

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
  // 메뉴의 자리를 재는 기준. 선택 판정은 ul(rootRef)이 맡고, 절대배치는 이 상자가 맡는다.
  const boxRef = useRef<HTMLDivElement>(null);
  // 바깥 클릭 판정에 쓴다 — 아래 useEffect 주석 참고.
  const menuRef = useRef<HTMLDivElement>(null);
  // 저장을 기다리지 않고 먼저 그린다 — 형광펜은 그은 순간 보여야 손이 이어진다.
  // 저장이 실패하면 되돌리고 알린다(메모·중요 토글과 같은 방식).
  const [local, setLocal] = useState(highlights);
  const [failed, setFailed] = useState(false);
  // 그어 둔 자리를 누르면 뜨는 작은 메뉴. 누르자마자 지우면 본문을 읽다가 스친
  // 손짓에도 형광펜이 사라지는데, 그은 것은 내가 남긴 것이라 실수로 없어져서는 안 된다.
  // 어느 줄기를 골랐는지와, 그 줄기가 화면 어디에 있는지를 함께 들고 있는다.
  const [menu, setMenu] = useState<{ target: Highlight; top: number; left: number } | null>(null);

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
  // 잘못 그었으면 그 자리를 눌러 뜨는 메뉴에서 지운다.
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

  // 메뉴가 떠 있는 동안 바깥을 누르거나 Esc를 치면 닫는다.
  //
  // 메뉴 안쪽을 눌렀는지는 ref로 직접 확인해야 한다. 메뉴에 onMouseDown을 달아
  // stopPropagation을 부르는 방식은 여기서 통하지 않는다 — React는 핸들러를 document에
  // 위임해 두고, 아래 리스너도 같은 document에 붙는다. 같은 노드에 걸린 리스너끼리는
  // stopPropagation이 서로를 막지 못하므로(그러려면 stopImmediatePropagation이 필요하고
  // 그건 등록 순서에 기대는 일이다), 메뉴가 mousedown에서 먼저 닫히고 뒤이은 click은
  // 사라진 버튼을 향하게 된다 — "지우기를 눌렀는데 아무 일도 안 일어난다"가 된다.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // 그어 둔 자리를 누르면 그 줄기를 골라 메뉴를 띄운다. 자리는 눌린 <mark>의 위치에서
  // 본문 상자 기준으로 환산한다 — 목록이 길어 스크롤이 어디에 있든 형광펜 바로 밑에 뜬다.
  function openMenu(event: React.MouseEvent<HTMLElement>, target: Highlight) {
    event.stopPropagation(); // 바깥 클릭으로 읽혀 방금 연 메뉴가 곧바로 닫히지 않게
    const container = boxRef.current;
    if (!container) return;
    const mark = event.currentTarget.getBoundingClientRect();
    const box = container.getBoundingClientRect();
    setMenu({ target, top: mark.bottom - box.top + 4, left: mark.left - box.left });
  }

  function handleRemove(target: Highlight) {
    setMenu(null);
    void commit(local.filter((h) => !(h.line === target.line && h.start === target.start && h.end === target.end)));
  }

  return (
    <div ref={boxRef} className="relative">
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
                          role="button"
                          tabIndex={0}
                          aria-haspopup="menu"
                          onClick={(e) =>
                            openMenu(e, { line: i, start: part.start, end: part.start + part.text.length })
                          }
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            openMenu(
                              e as unknown as React.MouseEvent<HTMLElement>,
                              { line: i, start: part.start, end: part.start + part.text.length },
                            );
                          }}
                          title="눌러서 메뉴 열기"
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

      {/* 고른 형광펜의 메뉴. 목록(ul) 안에 절대배치로 두어 본문과 함께 스크롤되게 한다 —
          화면에 고정하면 목록을 굴리는 동안 메뉴만 제자리에 남아 엉뚱한 줄을 가리킨다.
          지금은 "지우기" 하나뿐이지만, 나중에 형광펜에 메모를 달거나 색을 나눈다면
          들어올 자리가 여기다. */}
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menu.top, left: menu.left }}
          className="absolute z-20 flex overflow-hidden rounded-sm border border-line bg-background shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => handleRemove(menu.target)}
            className="px-2.5 py-1 font-mono text-[11px] text-red-text hover:bg-red-tint"
          >
            지우기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setMenu(null)}
            className="border-l border-line px-2.5 py-1 font-mono text-[11px] text-grey hover:text-ink"
          >
            닫기
          </button>
        </div>
      )}

      {failed && (
        <p className="mt-1 font-mono text-[11px] text-red-text">
          형광펜을 저장하지 못했습니다. 잠시 뒤 다시 그어 보세요.
        </p>
      )}
    </div>
  );
}
