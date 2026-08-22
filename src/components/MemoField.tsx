"use client";

import { useState } from "react";
import { CopyTextButton } from "./CopyTextButton";
import { formatMemoMark } from "@/lib/citation";

// 메모는 옅은 회색(surface), 인용구는 노랑(yellow-tint)이다. 노랑은 원문에서 옮겨 온 남의
// 말에 남기고, 내가 쓴 말은 색을 뺀 자리에 둔다 — 한 열에 둘이 쌓일 때 어느 것이 인용인지가
// 글을 읽기 전에 보인다.
//
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
      <div className="mt-1.5 rounded-sm border border-line bg-surface p-2">
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
    // 적어 둔 메모는 눌러서 고치는 것이 여전히 빠른 길이라, 글 자체를 누르면 편집으로 간다.
    // 다만 옮겨 적을 자리가 필요해져서(복사) 버튼 하나를 곁에 세운다 — 버튼 안에 버튼을
    // 넣을 수는 없으니, 바깥은 상자(div)로 두고 글만 누르는 자리로 남긴다.
    return (
      <div className="mt-1.5 flex items-start gap-1.5 rounded-sm border border-line bg-surface p-2">
        <span aria-hidden>📝</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left font-mono text-xs leading-4 whitespace-pre-wrap text-ink"
        >
          {saved}
        </button>
        {/* 인용구와 같은 차례·같은 방향(세로)으로 둔다. 메모에는 삭제가 없다 — 지우는 것은
            수정해서 비우는 것과 같은 일이라, 칸을 비우고 저장하면 된다. */}
        <div className="ml-2 flex flex-col items-end gap-0.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-[10px] text-grey hover:text-ink"
          >
            수정
          </button>
          <CopyTextButton text={formatMemoMark(saved)} />
        </div>
      </div>
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
