"use client";

import { useState } from "react";
import { TimelineEventData } from "@/lib/types";
import { ADD_BUTTON_CLASSNAME } from "@/lib/design-tokens";
import {
  EventInput,
  countEventAttachments,
  createEvent,
  hideEvent,
  unhideEvent,
  updateEvent,
} from "@/lib/event-actions";

// 연표 사건을 사람이 직접 만들고 고치고 숨기는 UI. 관리페이지(mode="admin")에서만 열린다.
// 폼 하나를 추가(빈 값)와 수정(기존 값)이 함께 쓴다.
// 지우는 버튼은 없다 — 숨김은 DB를 건드리지 않고 화면에서만 내리며, 아래 "숨긴 사건" 목록에서
// 언제든 되돌린다.

const EMPTY: EventInput = {
  eventName: "",
  dateValue: "",
  summary: "",
  sourceReference: "",
  sourceUrl: "",
  keywords: [],
};

function toInput(event: TimelineEventData): EventInput {
  return {
    eventName: event.eventName,
    dateValue: event.dateValue,
    summary: event.summary,
    sourceReference: event.sourceReference,
    sourceUrl: event.sourceUrl,
    keywords: event.keywordTags,
  };
}

const FIELD_CLASSNAME =
  "w-full rounded-sm border border-line bg-background px-2 py-1 text-[13px] text-ink placeholder:text-grey focus:border-green-text focus:outline-none";
const LABEL_CLASSNAME = "font-mono text-[10px] font-bold tracking-wider text-grey";

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
    <div className="mt-2 flex flex-col gap-2 rounded-sm border border-line bg-surface p-3">
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
        <label className={LABEL_CLASSNAME}>출처 URL</label>
        <input
          value={draft.sourceUrl}
          onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
          placeholder="https://… (비워두면 링크 없음)"
          className={`${FIELD_CLASSNAME} font-mono`}
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

      {error && <p className="font-mono text-[11px] text-red-text">{error}</p>}

      <div className="flex justify-end gap-2">
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
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[11px] text-white hover:opacity-80 disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

// 사건 행마다 붙는 [수정][숨김]. 숨김은 함께 안 보이게 될 연결선 수를 먼저 세어 보여준다.
export function EventRowControls({ event }: { event: TimelineEventData }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<{
    hiddenMaterials: number;
    hiddenSegments: number;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleAskHide() {
    setPending(true);
    try {
      setConfirming(await countEventAttachments(event.id));
    } finally {
      setPending(false);
    }
  }

  async function handleHide() {
    setPending(true);
    try {
      await hideEvent(event.id);
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
    const nothingAttached = confirming.hiddenMaterials + confirming.hiddenSegments === 0;
    return (
      <div className="mt-2 rounded-sm border border-line bg-yellow-tint p-2.5">
        <p className="font-mono text-[11px] leading-5 text-ink">
          <strong className="font-bold">{event.eventName}</strong> 사건을 연표에서 숨깁니다.
          <br />
          {nothingAttached
            ? "DB에서는 지워지지 않습니다 — 아래 “숨긴 사건”에서 되돌릴 수 있습니다."
            : `연결된 사료 ${confirming.hiddenMaterials}건 · 구술 ${confirming.hiddenSegments}건도 함께 화면에서 빠집니다. DB에서는 아무것도 지워지지 않고, 되돌리면 연결도 그대로 돌아옵니다.`}
        </p>
        <div className="mt-1.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(null)}
            disabled={pending}
            className="font-mono text-[11px] text-grey hover:text-ink"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleHide}
            disabled={pending}
            className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[11px] text-white hover:opacity-80 disabled:opacity-50"
          >
            {pending ? "숨기는 중…" : "숨김"}
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
        className="font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        수정
      </button>
      <button
        type="button"
        onClick={handleAskHide}
        disabled={pending}
        className="font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink disabled:opacity-50"
      >
        숨김
      </button>
    </div>
  );
}

// 연표 아래쪽에 접어두는 "숨긴 사건" 목록. 되돌리는 길이 없으면 숨김은 삭제와 다르지 않다.
export function HiddenEventsPanel({
  events,
}: {
  events: { id: string; eventName: string; dateValue: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (events.length === 0) return null;

  return (
    <div className="border-t border-line bg-surface">
      <div className="page-shell py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="font-mono text-[11px] font-bold text-grey hover:text-ink"
        >
          {open ? "▾" : "▸"} 숨긴 사건 {events.length}건
        </button>

        {open && (
          <ul className="mt-2 flex flex-col gap-1">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-3 border-t border-line py-1.5"
              >
                <span className="text-[13px] text-grey">
                  <span className="mr-2 font-mono text-[11px] tabular-nums text-grey">
                    {event.dateValue || "—"}
                  </span>
                  {event.eventName}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    setPendingId(event.id);
                    try {
                      await unhideEvent(event.id);
                    } finally {
                      setPendingId(null);
                    }
                  }}
                  disabled={pendingId === event.id}
                  className="shrink-0 rounded-sm border border-line bg-background px-2 py-0.5 font-mono text-[11px] text-ink hover:border-green-text disabled:opacity-50"
                >
                  {pendingId === event.id ? "되돌리는 중…" : "되돌리기"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// 사건을 새로 만드는 입구. 연표 도구 줄(검색·연도·정렬)의 오른쪽 끝에 붙는 flex 자식이다.
// 표 아래에 뒀더니 사건이 200건 넘는 화면에서는 사실상 닿지 않는 자리가 됐다.
// 폼은 줄 안에 들어갈 수 없어 w-full로 다음 줄에 흘려보낸다 — 열렸을 때만 자리를 쓴다.
export function AddEventPanel() {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <div className="w-full pt-1">
        <EventForm
          initial={EMPTY}
          submitLabel="사건 추가"
          onSubmit={async (input) => {
            await createEvent(input);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className={`ml-auto ${ADD_BUTTON_CLASSNAME}`}
    >
      + 사건 추가
    </button>
  );
}
