"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

// 상자 하나와, 그 위로 열리는 기술지 덧창.
//
// 기술지를 줄 안에 끼워 넣으면 선반이 밀린다 — 누른 상자가 옆으로 튀거나, 상자가 열 개인
// 갈래에서는 아예 화면 밖에서 열린다. 사료 카드(RecordCard)가 같은 문제를 이미 덧창으로
// 풀어 두었으므로 그 문법을 그대로 쓴다. 덧창이면 서가는 한 칸도 움직이지 않는다.
//
// 여기 딸린 셈은 전부 그쪽에서 겪은 것이다 — 오른쪽 끝 칸에서는 창 밖으로 나가니 오른쪽에
// 맞춰 펴고, 아래쪽 상자에서는 그대로 펴면 끝이 잘리는데 그 아래를 보려고 굴리면 페이지가
// 밀려 덧창이 함께 움직여서 잘린 끝에 영영 닿지 못하므로 창 안에 들어오도록 끌어올린다.

const OVERLAY_WIDTH_PX = 720;

export function SeriesBox({
  open,
  onClose,
  box,
  sheet,
}: {
  open: boolean;
  onClose: () => void;
  box: ReactNode;
  sheet: ReactNode;
}) {
  const [flip, setFlip] = useState(false);
  const [offsetTop, setOffsetTop] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !hostRef.current || !overlayRef.current) return;
    const host = hostRef.current.getBoundingClientRect();
    setFlip(host.left + OVERLAY_WIDTH_PX > window.innerWidth - 16);
    const height = overlayRef.current.offsetHeight;
    const highest = 8 - host.top; // 이보다 올리면 창 위로 넘는다
    const lowest = window.innerHeight - 8 - height - host.top; // 이보다 내리면 창 아래로 넘는다
    setOffsetTop(Math.round(Math.min(Math.max(0, highest), Math.max(highest, lowest))));
  }, [open]);

  // 덧창은 옆 상자를 덮으므로 닫는 길이 여럿이어야 한다 — 바깥을 누르거나 Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!hostRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={hostRef} className={`relative ${open ? "z-30" : ""}`}>
      {box}
      {open && (
        <div
          ref={overlayRef}
          // 키는 창을 넘지 않는다 — 넘으면 잘린 부분이 스크롤로도 안 닿는다.
          // overscroll-contain은 덧창 끝까지 굴렸을 때 그 힘이 페이지로 넘어가지 않게 한다:
          // 페이지가 밀리면 상자가 움직이고 덧창도 따라가 읽던 자리를 잃는다.
          style={{ top: offsetTop }}
          className={`absolute z-30 flex w-[720px] max-w-[calc(100vw-2rem)] flex-col bg-background shadow-[6px_6px_0_rgba(26,26,24,0.14)] ${
            flip ? "right-0" : "left-0"
          }`}
        >
          {sheet}
        </div>
      )}
    </div>
  );
}
