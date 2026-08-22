"use client";

import { useState } from "react";

// 연표/구술 목록/연구 동향 화면 공통 "메모" 위젯. 저장은 각 화면이 넘겨주는
// onSave(서버 액션을 id로 바인딩한 함수)에 위임한다 — 이 컴포넌트는 테이블을 모른다.
export function MemoField({
  initialValue,
  onSave,
  startEditing = false,
}: {
  initialValue?: string;
  onSave: (memo: string) => Promise<void>;
  // 메뉴에서 "메모"를 골라 들어온 경우처럼, 열리자마자 쓸 칸이 떠 있어야 할 때만 참.
  startEditing?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(initialValue ?? "");
  const [saved, setSaved] = useState(initialValue ?? "");
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    try {
      await onSave(draft.trim());
      setSaved(draft.trim());
      setEditing(false);
    } finally {
      setPending(false);
    }
  }

  function handleCancel() {
    setDraft(saved);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-1.5 rounded-sm border border-line bg-yellow-tint p-2">
        <textarea
          autoFocus
          onFocus={(e) => e.target.select()}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="메모를 입력하세요"
          rows={6}
          className="w-full resize-y bg-transparent font-mono text-xs text-ink placeholder:text-grey focus:outline-none"
        />
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="font-mono text-[11px] text-grey hover:text-ink"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[11px] text-white hover:opacity-80 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1.5 flex w-full items-start gap-1.5 rounded-sm border border-line bg-yellow-tint p-2 text-left hover:bg-yellow-tint"
      >
        <span aria-hidden>📝</span>
        <span className="font-mono text-xs leading-4 whitespace-pre-wrap text-ink">{saved}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-1.5 font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
    >
      + 메모 추가
    </button>
  );
}
