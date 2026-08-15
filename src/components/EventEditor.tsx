"use client";

import { useState } from "react";
import { TimelineEventData } from "@/lib/types";
import {
  EventInput,
  countEventAttachments,
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/lib/event-actions";

// 연표 사건을 사람이 직접 만들고 고치고 지우는 UI. 관리페이지(mode="admin")에서만 열린다.
// 폼 하나를 추가(빈 값)와 수정(기존 값)이 함께 쓴다.

const EMPTY: EventInput = {
  eventName: "",
  dateValue: "",
  summary: "",
  sourceReference: "",
  keywords: [],
};

function toInput(event: TimelineEventData): EventInput {
  return {
    eventName: event.eventName,
    dateValue: event.dateValue,
    summary: event.summary,
    sourceReference: event.sourceReference,
    keywords: event.keywordTags,
  };
}

const FIELD_CLASSNAME =
  "w-full rounded-sm border border-zinc-300 bg-white px-2 py-1 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none";
const LABEL_CLASSNAME = "font-mono text-[10px] font-bold tracking-wider text-zinc-500";

function EventForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: EventInput;
  submitLabel: string;
  onSubmit: (input: EventInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  // 키워드는 DB에선 배열이지만 입력은 쉼표로 구분한 한 줄이 편하다 — 문자열로 따로 들고 있는다.
  const [keywordLine, setKeywordLine] = useState(initial.keywords.join(", "));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setPending(true);
    setError(null);
    try {
      await onSubmit({ ...draft, keywords: keywordLine.split(",") });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-sm border border-zinc-300 bg-zinc-50 p-3">
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASSNAME}>사건명</label>
        <input
          autoFocus
          value={draft.eventName}
          onChange={(e) => setDraft({ ...draft, eventName: e.target.value })}
          placeholder="예: 청계천 복개 및 판자촌 철거"
          className={FIELD_CLASSNAME}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASSNAME}>날짜 (EDTF)</label>
        <input
          value={draft.dateValue}
          onChange={(e) => setDraft({ ...draft, dateValue: e.target.value })}
          placeholder="1963 · 1963-05 · 1963-05-18 · 1945~1948 · 1960s · 1936?"
          className={`${FIELD_CLASSNAME} font-mono`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASSNAME}>내용</label>
        <textarea
          value={draft.summary}
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          rows={3}
          placeholder="사건에 대한 한두 문장 설명"
          className={`${FIELD_CLASSNAME} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASSNAME}>출처</label>
        <input
          value={draft.sourceReference}
          onChange={(e) => setDraft({ ...draft, sourceReference: e.target.value })}
          placeholder="예: 서울역사박물관 『동대문시장』(2011)"
          className={FIELD_CLASSNAME}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASSNAME}>키워드 (쉼표로 구분)</label>
        <input
          value={keywordLine}
          onChange={(e) => setKeywordLine(e.target.value)}
          placeholder="청계천, 재개발, 도시계획"
          className={FIELD_CLASSNAME}
        />
      </div>

      {error && <p className="font-mono text-[11px] text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="font-mono text-[11px] text-zinc-400 hover:text-zinc-700"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-sm bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

// 사건 행마다 붙는 [수정][삭제]. 삭제는 딸린 연결선 수를 먼저 세어 보여주고 확인을 받는다.
export function EventRowControls({ event }: { event: TimelineEventData }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<{
    releasedMaterials: number;
    releasedSegments: number;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleAskDelete() {
    setPending(true);
    try {
      setConfirming(await countEventAttachments(event.id));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    try {
      await deleteEvent(event.id);
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <EventForm
        initial={toInput(event)}
        submitLabel="수정 저장"
        onSubmit={async (input) => {
          await updateEvent(event.id, input);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (confirming) {
    const nothingAttached = confirming.releasedMaterials + confirming.releasedSegments === 0;
    return (
      <div className="mt-2 rounded-sm border border-red-200 bg-red-50 p-2.5">
        <p className="font-mono text-[11px] leading-5 text-zinc-700">
          <strong className="font-bold">{event.eventName}</strong> 사건을 지웁니다.
          <br />
          {nothingAttached
            ? "붙어 있는 자료·구술이 없습니다."
            : `연결된 사료 ${confirming.releasedMaterials}건 · 구술 ${confirming.releasedSegments}건은 지워지지 않고 보류함으로 돌아갑니다.`}
        </p>
        <div className="mt-1.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(null)}
            disabled={pending}
            className="font-mono text-[11px] text-zinc-400 hover:text-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-sm bg-red-600 px-2 py-0.5 font-mono text-[11px] text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-mono text-[11px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-700"
      >
        수정
      </button>
      <button
        type="button"
        onClick={handleAskDelete}
        disabled={pending}
        className="font-mono text-[11px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-red-600 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}

// 연표 위쪽에 놓는 "새 사건 추가" 입구.
export function NewEventPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {open ? (
          <EventForm
            initial={EMPTY}
            submitLabel="사건 추가"
            onSubmit={async (input) => {
              await createEvent(input);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-sm border border-zinc-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-zinc-700 hover:border-zinc-500"
          >
            + 새 사건 추가
          </button>
        )}
      </div>
    </div>
  );
}
