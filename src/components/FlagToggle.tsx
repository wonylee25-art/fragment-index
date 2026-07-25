"use client";

import { useState } from "react";

// 구술 목록/연구 동향 공통 "중요"·"읽음" 클릭 토글. 낙관적으로 먼저 바꾸고, 저장 실패 시 되돌린다.
export function FlagToggle({
  active,
  onToggle,
  activeLabel,
  inactiveLabel,
  activeClassName,
}: {
  active: boolean;
  onToggle: (next: boolean) => Promise<void>;
  activeLabel: string;
  inactiveLabel: string;
  activeClassName: string;
}) {
  const [value, setValue] = useState(active);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const next = !value;
    setValue(next);
    setPending(true);
    try {
      await onToggle(next);
    } catch {
      setValue(!next); // 저장 실패 시 원상복구
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-50 ${
        value ? activeClassName : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
      }`}
    >
      {value ? activeLabel : inactiveLabel}
    </button>
  );
}
