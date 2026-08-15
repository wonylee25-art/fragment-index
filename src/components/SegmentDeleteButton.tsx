"use client";

import { useState } from "react";
import { deleteSegment } from "@/lib/segment-actions";

// 구술 발췌를 지운다. 연결 끊기(UnlinkButton)는 자료가 보류함으로 돌아갈 뿐이라 두 번
// 누르면 끝이지만, 이쪽은 되돌릴 길이 없어서 무엇이 함께 사라지는지 먼저 보인다.
// 각주 개수를 굳이 세어 말하는 건, 발췌 본문만 지워진다고 생각하고 누르는 일을 막기 위해서다.
export function SegmentDeleteButton({
  segmentId,
  noteCount,
}: {
  segmentId: string;
  noteCount: number;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteSegment(segmentId);
      // 지워진 행은 사라지므로 armed를 되돌릴 필요가 없다 — 실패했을 때만 되돌린다.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
      setArmed(false);
    }
  }

  if (error) {
    return <span className="text-red-600">{error}</span>;
  }

  if (armed) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500">
          이 발췌{noteCount > 0 && `와 각주 ${noteCount}개`}, 붙어 있는 사건 연결이 함께
          사라집니다. 되돌릴 수 없습니다.
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-sm bg-red-600 px-1.5 py-0.5 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "지우는 중…" : "정말 지우기"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={pending}
          className="text-zinc-400 hover:text-zinc-700"
        >
          취소
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setArmed(true)} className="hover:text-red-600">
      지우기
    </button>
  );
}
