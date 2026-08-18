"use client";

import { useEffect, useRef, useState } from "react";
import { Highlight } from "@/lib/types";
import { offsetWithin, splitByRanges } from "@/lib/highlight-range";

// 한 덩이 글에 긋는 형광펜. 연표의 내용 칸이 이것을 쓴다.
//
// 구술 본문(Transcript)과 하는 일은 같지만, 저쪽은 발화가 여러 줄로 나뉘어 있어 어느 줄의
// 몇 번째 글자인지를 한 쌍으로 잡아야 한다. 여기는 글이 하나라 line이 늘 0이다 — 그래도
// 같은 Highlight 모양을 쓴다. 저장하는 곳(highlight-actions)과 읽는 곳(sanitizeHighlights)을
// 두 벌로 갈라놓지 않기 위해서다.
//
// 긋는 방식도 구술과 같게 둔다: 드래그가 끝나면 확인 없이 곧바로 그어지고, 잘못 그었으면
// 그 자리를 눌러 뜨는 메뉴에서 지운다.
export function HighlightableText({
  text,
  highlights,
  onSave,
  className,
}: {
  text: string;
  highlights: Highlight[];
  onSave: (next: Highlight[]) => Promise<void>;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  // 바깥 클릭 판정에 쓴다 — Transcript에 같은 사정을 적어 두었다(React의 document 위임 때문에
  // 메뉴 쪽 stopPropagation으로는 막지 못한다).
  const menuRef = useRef<HTMLDivElement>(null);
  // 저장을 기다리지 않고 먼저 그린다. 실패하면 되돌리고 알린다.
  const [local, setLocal] = useState(highlights);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState<{ target: Highlight; top: number; left: number } | null>(null);

  async function commit(next: Highlight[]) {
    const previous = local;
    setLocal(next);
    setFailed(false);
    try {
      await onSave(next);
    } catch {
      setLocal(previous);
      setFailed(true);
    }
  }

  function handleMouseUp() {
    const selection = window.getSelection();
    const container = textRef.current;
    if (!selection || selection.isCollapsed || !container) return;

    const range = selection.getRangeAt(0);
    // 이 글 안에서 시작하고 끝난 선택만 받는다 — 연표는 한 행에 여러 칸이 나란히 있어
    // 드래그가 옆 칸(사건명·출처)까지 넘어가기 쉽다.
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

    const start = offsetWithin(container, range.startContainer, range.startOffset);
    const end = offsetWithin(container, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) return;

    selection.removeAllRanges(); // 파란 선택 띠가 노란 형광펜 위에 겹쳐 남지 않게
    void commit([...local, { line: 0, start, end }]);
  }

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
    void commit(local.filter((h) => !(h.start === target.start && h.end === target.end)));
  }

  const ranges = [...local].sort((a, b) => a.start - b.start);

  return (
    <div ref={boxRef} className="relative">
      <p ref={textRef} onMouseUp={handleMouseUp} className={className}>
        {ranges.length === 0
          ? text
          : splitByRanges(text, ranges).map((part, j) =>
              part.marked ? (
                <mark
                  key={j}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="menu"
                  onClick={(e) => openMenu(e, { line: 0, start: part.start, end: part.start + part.text.length })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    openMenu(e as unknown as React.MouseEvent<HTMLElement>, {
                      line: 0,
                      start: part.start,
                      end: part.start + part.text.length,
                    });
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
      </p>

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
