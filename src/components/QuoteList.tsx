"use client";

import { useState } from "react";
import { PaperQuote } from "@/lib/types";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

// 텍스트+페이지 입력 폼 — 새 인용구 추가와 기존 인용구 수정에서 공유한다.
function QuoteEditor({
  initialText = "",
  initialPage = "",
  onSave,
  onCancel,
}: {
  initialText?: string;
  initialPage?: string;
  onSave: (quoteText: string, page: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [page, setPage] = useState(initialPage);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setPending(true);
    try {
      await onSave(text, page);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-sm border border-line bg-yellow-tint p-2">
      <textarea
        autoFocus
        onFocus={(e) => e.target.select()}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="인용구를 입력하세요"
        rows={6}
        className="w-full resize-y bg-transparent font-mono text-xs text-ink placeholder:text-grey focus:outline-none"
      />
      <input
        type="text"
        value={page}
        onChange={(e) => setPage(e.target.value)}
        placeholder="페이지 (선택)"
        className="mt-1 w-24 border-b border-line bg-transparent font-mono text-[11px] text-ink placeholder:text-grey focus:outline-none"
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
          disabled={pending || !text.trim()}
          className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[11px] text-white hover:opacity-80 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

// 논문당 여러 개 쌓이는 인용구 목록 + 추가/수정 폼. MemoField(논문당 메모 한 덩어리)와 달리
// 항목별로 페이지 번호를 붙여 개별 수정·삭제할 수 있다.
export function QuoteList({
  quotes,
  onAdd,
  onEdit,
  onDelete,
}: {
  quotes: PaperQuote[];
  onAdd: (quoteText: string, page: string) => Promise<void>;
  onEdit: (id: string, quoteText: string, page: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {quotes.map((q) =>
        editingId === q.id ? (
          <QuoteEditor
            key={q.id}
            initialText={q.quoteText}
            initialPage={q.page ?? ""}
            onSave={async (quoteText, page) => {
              await onEdit(q.id, quoteText, page);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={q.id} className="flex items-start gap-1.5 rounded-sm border border-line bg-yellow-tint p-2">
            <span aria-hidden className="text-grey">
              “
            </span>
            <div className="flex-1">
              <p className="font-mono text-xs leading-4 whitespace-pre-wrap text-ink">{q.quoteText}</p>
              {q.page && <p className="mt-0.5 font-mono text-[10px] text-grey">p.{q.page}</p>}
            </div>
            <button
              type="button"
              onClick={() => setEditingId(q.id)}
              className="font-mono text-[10px] text-grey hover:text-ink"
            >
              수정
            </button>
            <ConfirmDeleteButton
              onDelete={() => onDelete(q.id)}
              confirmMessage="이 인용구를 삭제할까요? 되돌릴 수 없습니다."
              label="삭제"
              pendingLabel="삭제 중…"
              className="font-mono text-[10px] text-grey hover:text-red-text"
            />
          </div>
        ),
      )}

      {adding ? (
        <QuoteEditor
          onSave={async (quoteText, page) => {
            await onAdd(quoteText, page);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start font-mono text-[11px] text-line underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          + 인용구 추가
        </button>
      )}
    </div>
  );
}
