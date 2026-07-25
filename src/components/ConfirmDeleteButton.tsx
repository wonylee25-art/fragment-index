"use client";

import { useState } from "react";

// 삭제처럼 되돌릴 수 없는 동작 공통 버튼 — confirm으로 한 번 더 확인한 뒤에만 onDelete를 호출한다.
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

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    try {
      await onDelete();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
