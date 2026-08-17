"use client";

import { useState } from "react";
import { LinkTargetType, unlinkTargetFromEvent } from "@/lib/link-actions";

// 연표 관리에서 사건에 붙은 사료·구술의 연결선을 끊는다. 자료 자체는 지워지지 않고
// 보류함(연결선 없는 자료)으로 돌아간다 — 그래서 삭제만큼 무겁게 확인받지 않고 두 번 누르기로 끝낸다.
export function UnlinkButton({
  eventId,
  targetType,
  targetId,
}: {
  eventId: string;
  targetType: LinkTargetType;
  targetId: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleUnlink() {
    setPending(true);
    try {
      await unlinkTargetFromEvent(eventId, targetType, targetId);
    } finally {
      setPending(false);
      setArmed(false);
    }
  }

  if (armed) {
    return (
      <span className="mt-1 flex items-center gap-2 font-mono text-[10px]">
        <button
          type="button"
          onClick={handleUnlink}
          disabled={pending}
          className="rounded-sm bg-red-fill px-1.5 py-0.5 text-white hover:opacity-80 disabled:opacity-50"
        >
          {pending ? "끊는 중…" : "정말 끊기"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={pending}
          className="text-grey hover:text-ink"
        >
          취소
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title="이 연결선만 끊습니다 — 자료는 보류함으로 돌아갑니다"
      className="mt-1 font-mono text-[10px] text-line underline decoration-dotted underline-offset-2 hover:text-red-text"
    >
      연결 끊기
    </button>
  );
}
