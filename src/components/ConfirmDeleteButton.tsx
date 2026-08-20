"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// 삭제처럼 되돌릴 수 없는 동작 공통 버튼 — 버튼 바로 옆에 뜨는 팝오버로 한 번 더 확인한
// 뒤에만 onDelete를 호출한다. 브라우저 confirm은 화면 최상단에 떠서 목록 아래쪽 항목일수록
// 마우스가 멀리 가야 했다.
export function ConfirmDeleteButton({
  onDelete,
  confirmMessage,
  label = "삭제",
  pendingLabel = "삭제 중…",
  className = "",
}: {
  onDelete: () => Promise<void>;
  confirmMessage: string;
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  // 아래로 열 자리가 모자라면 위로 뒤집는다 — 목록 맨 끝 행에서 팝오버가 화면 밖으로 나간다.
  useLayoutEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    const wrap = wrapRef.current;
    if (!pop || !wrap) return;
    const below = window.innerHeight - wrap.getBoundingClientRect().bottom;
    setFlipUp(below < pop.offsetHeight + 12);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // preventScroll — 팝오버는 방금 누른 버튼 옆이라 이미 보인다. 초점 때문에 페이지가 튀면 안 된다.
    okRef.current?.focus({ preventScroll: true });

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleConfirm() {
    setOpen(false);
    setPending(true);
    try {
      await onDelete();
    } finally {
      setPending(false);
    }
  }

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        className={className}
      >
        {pending ? pendingLabel : label}
      </button>

      {open ? (
        <div
          ref={popRef}
          role="dialog"
          className={`absolute right-0 z-50 w-max max-w-[18rem] rounded-sm border border-line bg-background p-2 text-left shadow-md ${
            flipUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <p className="whitespace-normal font-sans text-[11px] leading-snug text-ink">
            {confirmMessage}
          </p>
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey hover:bg-line hover:text-ink"
            >
              취소
            </button>
            <button
              ref={okRef}
              type="button"
              onClick={handleConfirm}
              className="rounded-sm bg-red-tint px-1.5 py-0.5 font-mono text-[10px] text-red-text hover:bg-red-fill hover:text-white"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
