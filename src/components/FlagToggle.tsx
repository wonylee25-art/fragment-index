"use client";

import { useState } from "react";
import { CHIP_CLASSNAME, DOT_NONE } from "@/lib/design-tokens";

// 구술 목록/연구 동향 공통 "중요"·"읽음" 클릭 토글. 낙관적으로 먼저 바꾸고, 저장 실패 시 되돌린다.
export function FlagToggle({
  active,
  onToggle,
  activeLabel,
  inactiveLabel,
  dotClassName,
}: {
  active: boolean;
  onToggle: (next: boolean) => Promise<void>;
  activeLabel: string;
  inactiveLabel: string;
  dotClassName: string;
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

  // 색을 배경에 깔지 않고 앞의 점에만 둔다. ★중요(노랑)와 ✓읽음(초록)은 논문 한 줄에
  // 나란히 서는데, 옅은 배경(tint)끼리는 ΔE 6~15로 사실상 같은 색이라 배경으로는
  // 갈리지 않는다. 색이 살아 있는 구간(fill)은 점으로만 쓸 수 있다.
  // 켜지지 않은 동안에도 점자리를 비워 두지 않는 것은, 자리가 생겼다 없어지면 옆의
  // 글자가 좌우로 밀리기 때문이다 — 회색 점으로 자리를 지킨다.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`${CHIP_CLASSNAME} bg-surface disabled:opacity-50 ${
        value ? "hover:opacity-70" : "text-grey hover:text-ink"
      }`}
    >
      <span className={value ? dotClassName : DOT_NONE} aria-hidden />
      {value ? activeLabel : inactiveLabel}
    </button>
  );
}
