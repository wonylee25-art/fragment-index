"use client";

import { useState } from "react";
import { UserMemo } from "@/lib/types";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { CopyTextButton } from "./CopyTextButton";
import { formatMemoMark } from "@/lib/citation";

// 메모는 옅은 회색(surface), 인용구는 노랑(yellow-tint)이다. 노랑은 원문에서 옮겨 온 남의
// 말에 남기고, 내가 쓴 말은 색을 뺀 자리에 둔다 — 한 열에 둘이 쌓일 때 어느 것이 인용인지가
// 글을 읽기 전에 보인다.

// 쓰는 칸 — 새 메모와 이미 적어 둔 메모 고치기가 함께 쓴다.
function MemoEditor({
  initialValue = "",
  onSave,
  onCancel,
}: {
  initialValue?: string;
  onSave: (memo: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    if (!draft.trim()) return;
    setPending(true);
    try {
      await onSave(draft);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-2">
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
          onClick={onCancel}
          disabled={pending}
          className="font-mono text-[11px] text-grey hover:text-ink"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !draft.trim()}
          className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[11px] text-white hover:opacity-80 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

// 연표/구술 목록/연구 동향 화면 공통 "메모" 위젯. 한 사건·발췌·논문에 여러 개 쌓이며,
// 저장은 각 화면이 넘겨주는 함수(서버 액션을 주인 id로 바인딩한 것)에 위임한다 —
// 이 컴포넌트는 어느 표에 적히는지를 모른다.
//
// 인용구 목록(QuoteList)과 같은 꼴로 서고, 다른 것은 색과 페이지 칸의 유무뿐이다.
export function MemoList({
  memos,
  onAdd,
  onEdit,
  onDelete,
  startEditing = false,
}: {
  memos: UserMemo[];
  onAdd: (memo: string) => Promise<void>;
  onEdit: (id: string, memo: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  // 메뉴에서 "메모"를 골라 들어온 경우처럼, 열리자마자 쓸 칸이 떠 있어야 할 때만 참.
  startEditing?: boolean;
}) {
  const [adding, setAdding] = useState(startEditing);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {memos.map((m) =>
        editingId === m.id ? (
          <MemoEditor
            key={m.id}
            initialValue={m.memoText}
            onSave={async (memo) => {
              await onEdit(m.id, memo);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          // 적어 둔 메모는 눌러서 고치는 것이 여전히 빠른 길이라, 글 자체를 누르면 편집으로
          // 간다. 버튼 안에 버튼을 넣을 수는 없으니 바깥은 상자(div)로 두고 글만 누르는
          // 자리로 남긴다.
          <div key={m.id} className="flex items-start gap-1.5 rounded-sm border border-line bg-surface p-2">
            <span aria-hidden>📝</span>
            <button
              type="button"
              onClick={() => setEditingId(m.id)}
              className="flex-1 text-left font-mono text-xs leading-4 whitespace-pre-wrap text-ink"
            >
              {m.memoText}
            </button>
            {/* 인용구와 같은 차례·같은 방향(세로)으로 둔다. 메모가 낱개로 쌓이면서
                「지우기」가 생겼다 — 예전에는 칸을 비워 저장하는 것이 곧 지우는 일이었지만,
                이제 비어 있는 메모는 아예 저장되지 않는다. */}
            <div className="ml-2 flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={() => setEditingId(m.id)}
                className="font-mono text-[10px] text-grey hover:text-ink"
              >
                수정
              </button>
              <CopyTextButton text={formatMemoMark(m.memoText)} />
              <ConfirmDeleteButton
                onDelete={() => onDelete(m.id)}
                confirmMessage="이 메모를 삭제할까요? 되돌릴 수 없습니다."
                label="삭제"
                pendingLabel="삭제 중…"
                className="font-mono text-[10px] text-grey hover:text-red-text"
              />
            </div>
          </div>
        ),
      )}

      {adding ? (
        <MemoEditor
          onSave={async (memo) => {
            await onAdd(memo);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          + 메모 추가
        </button>
      )}
    </div>
  );
}
