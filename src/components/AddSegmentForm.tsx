"use client";

import { useState } from "react";
import { addSegment } from "@/lib/segment-actions";

const EMPTY_FORM = {
  itemTitle: "",
  dateValue: "",
  segmentText: "",
  page: "",
  notes: "",
  keywords: "",
};

const INPUT_CLASSNAME =
  "w-full rounded-sm border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none";

// CSV 동기화(scripts/sync-csv.mjs) 범위 밖의 구술 발췌를 이용자가 화면에서 직접 등록하는 폼.
// AddPaperForm과 같은 자리(목록 위 전체 너비 블록)에 열리고, 열림/닫힘은 부모(SegmentListClient)가 갖는다.
// 인물·장소 태그는 persons 전거와 엮여 있어 여기서는 받지 않는다 — CSV 동기화 쪽에서만 붙는다.
export function AddSegmentForm({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.segmentText.trim()) {
      setError("구술 본문을 입력하세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addSegment({
        itemTitle: form.itemTitle,
        dateValue: form.dateValue,
        segmentText: form.segmentText,
        page: form.page,
        notes: form.notes,
        keywords: form.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      setForm(EMPTY_FORM);
      onClose();
    } catch {
      setError("추가에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 flex flex-col gap-2 rounded-sm border border-zinc-200 bg-zinc-50/60 p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <input
          type="text"
          value={form.itemTitle}
          onChange={(e) => update("itemTitle", e.target.value)}
          placeholder="제목 (예: 홍길동(1932) 구술)"
          autoFocus
          className={INPUT_CLASSNAME}
        />
        <input
          type="text"
          value={form.dateValue}
          onChange={(e) => update("dateValue", e.target.value)}
          placeholder="연도 EDTF (예: 1950-06)"
          className={INPUT_CLASSNAME}
        />
        <input
          type="text"
          value={form.page}
          onChange={(e) => update("page", e.target.value)}
          placeholder="쪽 (예: 12–15)"
          className={INPUT_CLASSNAME}
        />
      </div>

      {/* 화자 구분은 줄 앞의 "면담자:"/"구술자:" 접두사로 한다 — parseSegmentText가 그대로 읽는다 */}
      <textarea
        value={form.segmentText}
        onChange={(e) => update("segmentText", e.target.value)}
        placeholder={"구술 본문 *\n면담자: 그때 이야기를 좀 해주세요.\n구술자: 그해 여름에는…"}
        rows={6}
        className={`${INPUT_CLASSNAME} font-mono leading-relaxed`}
      />

      <input
        type="text"
        value={form.keywords}
        onChange={(e) => update("keywords", e.target.value)}
        placeholder="주제어 (쉼표로 구분)"
        className={INPUT_CLASSNAME}
      />

      <textarea
        value={form.notes}
        onChange={(e) => update("notes", e.target.value)}
        placeholder="각주 (원본 자료에 딸린 보충 설명·정정)"
        rows={2}
        className={INPUT_CLASSNAME}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            onClose();
          }}
          disabled={pending}
          className="font-mono text-[11px] text-zinc-400 hover:text-zinc-700"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-zinc-900 px-2.5 py-1 font-mono text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "추가 중…" : "추가"}
        </button>
      </div>
    </form>
  );
}
