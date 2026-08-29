"use client";

import { useState } from "react";
import { createMaterial } from "@/lib/material-actions";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";
import { ArchiveItemType } from "@/lib/types";
import { EventOption, EventPicker } from "./EventPicker";

// 외부 검색에 안 잡히는 사료를 손으로 등록하는 입구. 자리는 "사료 검색" 제목 줄의 오른쪽 끝이다
// — 검색해도 안 나온다는 걸 아는 순간 눈이 이미 그 줄에 있다(연표의 "+ 사건 추가"와 같은 규칙).
// 저장 방식은 검색 결과 카드와 똑같이 둘이다: 사건을 고르면 [연결하고 저장], 안 고르면 [보류].
// 사건 목록은 검색어와 무관하게 전체가 후보라 좁히기 칸을 함께 쓴다(보류함과 같은 조건).

const ITEM_TYPES: ArchiveItemType[] = ["이미지", "문서", "신문", "구술", "학술", "지도", "박물"];

const EMPTY_FORM = {
  itemType: "이미지" as ArchiveItemType,
  title: "",
  sourceOrg: "",
  sourceUrl: "",
  description: "",
  imageUrl: "",
};

const INPUT_CLASSNAME =
  "w-full border border-line bg-background px-2.5 py-1.5 text-[13px] text-ink placeholder:text-grey focus:border-ink focus:outline-none";

const LABEL_CLASSNAME = "mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-grey";

export function AddMaterialForm({ events }: { events: EventOption[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 border border-line px-2.5 py-1 font-mono text-[11px] font-semibold text-ink hover:bg-ink hover:text-background"
      >
        + 사료 추가
      </button>
    );
  }

  return <MaterialFields events={events} onClose={() => setOpen(false)} />;
}

function MaterialFields({ events, onClose }: { events: EventOption[]; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // 연속으로 여러 건 넣는 일이 흔해, 저장 후에도 폼은 닫지 않고 비워서 그대로 둔다.
  // 고른 사건도 유지한다 — 한 사건에 자료 여러 건을 붙이는 게 보통이다.
  async function save(intent: "link" | "hold") {
    if (!form.title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createMaterial(form, intent === "link" ? selectedId : null);
      setSavedNote(
        intent === "link" && selected
          ? `“${form.title.trim()}” — ${selected.eventName}에 연결됨`
          : `“${form.title.trim()}” — 보류함에 저장됨`,
      );
      setForm({ ...EMPTY_FORM, itemType: form.itemType });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 w-full border border-line bg-surface p-4">
      <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
        <EventPicker
          events={events}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filterable
          emptyHint={
            <>
              <p className="text-[12px] leading-relaxed text-grey">연표에 사건이 없습니다.</p>
              <a
                href="/admin/timeline"
                className="mt-2 inline-block font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4"
              >
                「사건」에서 사건 만들기 →
              </a>
            </>
          }
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(selectedId ? "link" : "hold");
          }}
          className="min-w-0"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={LABEL_CLASSNAME}>제목</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="자료의 이름"
                autoFocus
                className={INPUT_CLASSNAME}
              />
            </label>

            <label>
              <span className={LABEL_CLASSNAME}>종류</span>
              <select
                value={form.itemType}
                onChange={(e) => update("itemType", e.target.value as ArchiveItemType)}
                className={INPUT_CLASSNAME}
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ARCHIVE_ITEM_ICON[type]} {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={LABEL_CLASSNAME}>소장기관</span>
              <input
                type="text"
                value={form.sourceOrg}
                onChange={(e) => update("sourceOrg", e.target.value)}
                placeholder="예: 서울역사박물관, 개인 소장"
                className={INPUT_CLASSNAME}
              />
            </label>

            <label>
              <span className={LABEL_CLASSNAME}>원문 주소</span>
              <input
                type="text"
                value={form.sourceUrl}
                onChange={(e) => update("sourceUrl", e.target.value)}
                placeholder="원본이 있는 곳 (없으면 비움)"
                className={INPUT_CLASSNAME}
              />
            </label>

            <label>
              <span className={LABEL_CLASSNAME}>이미지 주소</span>
              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) => update("imageUrl", e.target.value)}
                placeholder="썸네일로 걸 그림 주소"
                className={INPUT_CLASSNAME}
              />
            </label>

            <label className="sm:col-span-2">
              <span className={LABEL_CLASSNAME}>설명</span>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                placeholder="원문을 열지 않고도 무엇인지 알 수 있을 만큼"
                className={`${INPUT_CLASSNAME} resize-y`}
              />
            </label>
          </div>

          {/* 이미지는 재호스팅하지 않고 주소만 거는 구조라, 주소가 살아 있는지 여기서 바로 보인다 */}
          {form.imageUrl.trim() && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imageUrl}
              alt=""
              className="mt-3 h-[118px] w-24 border border-line bg-background object-cover"
            />
          )}

          {error && <p className="mt-3 font-mono text-[11px] text-orange-fill">{error}</p>}
          {savedNote && !error && (
            <p className="mt-3 font-mono text-[11px] font-semibold text-ink">
              ✓ {savedNote} — 이어서 더 넣을 수 있습니다
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending || !selected}
              className="border border-ink bg-ink px-2.5 py-1 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-ink disabled:border-line disabled:bg-surface disabled:text-grey"
            >
              {pending
                ? "저장 중…"
                : selected
                  ? `${selected.year} ${selected.eventName}에 연결하고 저장`
                  : "왼쪽에서 사건을 고르세요"}
            </button>
            <button
              type="button"
              onClick={() => void save("hold")}
              disabled={pending}
              className="border border-line px-2.5 py-1 font-mono text-[11px] font-semibold text-grey hover:border-ink hover:text-ink disabled:text-grey"
            >
              보류
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="font-mono text-[11px] text-grey hover:text-ink"
            >
              닫기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
