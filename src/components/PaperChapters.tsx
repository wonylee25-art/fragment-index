"use client";

import { useState } from "react";
import { PaperData } from "@/lib/types";
import { DOT_CONFIRMED, DOT_MINE } from "@/lib/design-tokens";
import { MemoList } from "./MemoList";
import { QuoteList } from "./QuoteList";
import { CopyPaperButton } from "./CopyPaperButton";
import { FlagToggle } from "./FlagToggle";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { addPaperMemo, deleteMemo, updateMemo } from "@/lib/memo-actions";
import { togglePaperImportant, togglePaperRead } from "@/lib/flag-actions";
import { addChapter, ChapterInput, hidePaper, restorePaper, updateChapter } from "@/lib/paper-actions";
import { addQuote, deleteQuote, updateQuote } from "@/lib/quote-actions";

const CHIP_CLASSNAME = "rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-grey";
const INPUT_CLASSNAME =
  "w-full rounded-sm border border-line px-2 py-1.5 text-sm focus:border-green-text focus:outline-none";

// 한 책 안의 순서는 쪽수로 잡는다 — 장은 스스로 발행연도를 갖지 않아 목록의 정렬축(연도)이
// 여기서는 아무 일도 하지 않는다. 쪽수가 비어 있거나 "iv" 같은 표기면 맨 뒤로 보내고,
// 그 안에서는 넣은 순서를 지킨다.
function startPage(paper: PaperData): number {
  const match = paper.pages?.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
}

export function sortChapters(chapters: PaperData[]): PaperData[] {
  return [...chapters].sort((a, b) => startPage(a) - startPage(b) || a.createdAt.localeCompare(b.createdAt));
}

// 단행본 행 아래에 매달리는 장·수록글. 목록을 훑을 때 필요한 것은 책 제목이라 평소에는
// 접어 두고, 그 책을 들여다보기로 한 순간에만 편다 — 장마다 메모칸·인용구·토글이 붙어서,
// 다 펼쳐 두면 행 하나가 열댓 개가 된다(ResearchTrends의 PAGE_SIZE 주석과 같은 이유).
//
// 목차가 아니라 따로 챙긴 것들이다. 1장과 5장만 있어도 빠진 게 아니라서 번호를 새로 매기지
// 않고, 적어 둔 쪽수를 그대로 보인다.
//
// 여닫는 칩(ChapterControls)과 펼쳐지는 목록(ChapterPanel)이 갈라져 있는 것은 둘이 서는
// 자리가 달라서다. 칩은 책 서지 바로 아래(왼쪽 열)에 붙어야 하고, 펼친 목록은 장마다 메모칸을
// 들고 있어 두 열을 가로질러야 한다. 한 덩어리로 두면 칩까지 격자의 다음 줄로 밀려 나가,
// 오른쪽 메모칸이 긴 만큼 책 제목과 「+ 수록글 추가」 사이에 빈 자리가 생겼다.
// 여닫힌 상태는 그래서 부모(ResearchTrends)가 든다.

// 책 서지 아래에 서는 칩 두 개. 매단 것이 없는 책에는 「+ 수록글 추가」만 뜬다.
export function ChapterControls({
  chapters,
  open,
  adding,
  onToggle,
  onStartAdd,
}: {
  chapters: PaperData[];
  open: boolean;
  adding: boolean;
  onToggle: () => void;
  onStartAdd: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chapters.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`${CHIP_CLASSNAME} hover:bg-line hover:text-ink`}
        >
          {open ? "▾" : "▸"} 수록글 {chapters.length}편
        </button>
      )}
      {!adding && (
        <button
          type="button"
          onClick={onStartAdd}
          className="font-mono text-[10px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          + 수록글 추가
        </button>
      )}
    </div>
  );
}

// 펼친 수록글 목록과 새로 매다는 폼. 보일 것이 없으면 아무것도 그리지 않는다 —
// 빈 칸을 남기면 그것만으로 격자에 줄이 하나 더 생겨 책 행이 그만큼 두꺼워진다.
export function ChapterPanel({
  book,
  chapters,
  open,
  adding,
  onCloseAdd,
}: {
  book: PaperData;
  chapters: PaperData[];
  open: boolean;
  adding: boolean;
  onCloseAdd: () => void;
}) {
  const sorted = sortChapters(chapters);
  if (!adding && !(open && sorted.length > 0)) return null;

  return (
    <div className="sm:col-span-2">
      {adding && <ChapterForm parentId={book.id} onClose={onCloseAdd} />}

      {open && sorted.length > 0 && (
        <ul className="mt-1 flex flex-col border-l-2 border-line">
          {sorted.map((chapter) => (
            <ChapterRow key={chapter.id} chapter={chapter} book={book} />
          ))}
        </ul>
      )}
    </div>
  );
}

// 장 한 줄. 책 행과 같은 것들이 붙지만(메모·인용구·읽음·중요·노션 복사) 서지 칸은 없다 —
// 연도·출판사는 책의 것이고, 여기 있는 것은 제목·저자·쪽수뿐이다.
//
// bookTitle을 켜면 어느 책의 글인지 함께 보인다. 「★ 중요만」·「쳐냄」으로 좁혀서 장이
// 부모 없이 낱개로 설 때 쓴다 — 그 자리에서는 책 제목이 없으면 어디서 온 글인지 알 수 없다.
export function ChapterRow({
  chapter,
  book,
  showBookTitle = false,
}: {
  chapter: PaperData;
  book?: PaperData;
  showBookTitle?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="border-t border-line py-2 pl-3 first:border-t-0">
        <ChapterForm chapter={chapter} onClose={() => setEditing(false)} />
      </li>
    );
  }

  return (
    // 책 행은 적은 것이 없으면 오른쪽을 좁게 뗀다. 장은 그렇게 하지 않는다 — 책 바로 아래에
    // 붙어 있어서, 메모칸이 행마다 다른 자리에서 시작하면 두 열이 어긋나 보인다. 늘 반씩 나눠
    // 부모의 오른쪽 열과 같은 축에 세운다.
    //
    // 들여쓰기(왼쪽 세로선)는 ul이 긋고 여백은 왼쪽 칸만 진다. ul에 여백을 주면 격자 전체가
    // 밀려서 오른쪽 열이 그만큼 부모와 어긋난다.
    <li className="grid grid-cols-1 gap-4 border-t border-line py-2 first:border-t-0 sm:grid-cols-2">
      <div className="min-w-0 pl-3">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={CHIP_CLASSNAME}>{chapter.author.trim() ? "수록글" : "장"}</span>
          {chapter.pages && <span className="font-mono text-[11px] text-grey">{chapter.pages}쪽</span>}
          <FlagToggle
            active={chapter.isImportant}
            onToggle={(next) => togglePaperImportant(chapter.id, next)}
            activeLabel="중요"
            inactiveLabel="중요"
            dotClassName={DOT_MINE}
          />
          <FlagToggle
            active={chapter.isRead}
            onToggle={(next) => togglePaperRead(chapter.id, next)}
            activeLabel="읽음"
            inactiveLabel="안 읽음"
            dotClassName={DOT_CONFIRMED}
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${CHIP_CLASSNAME} hover:bg-line hover:text-ink`}
          >
            수정
          </button>
          {/* 수정 · 복사 · 삭제 — 메모·인용구 옆의 차례와 같게 둔다. 여기 것은 이 글을 통째로
              (서지·메모·인용구) 옮긴다. */}
          <CopyPaperButton paper={chapter} parent={book} className={`${CHIP_CLASSNAME} hover:bg-line hover:text-ink`} />
          {chapter.hiddenAt ? (
            <button
              type="button"
              onClick={() => restorePaper(chapter.id)}
              className={`${CHIP_CLASSNAME} hover:bg-line hover:text-ink`}
            >
              되돌리기
            </button>
          ) : (
            <ConfirmDeleteButton
              onDelete={() => hidePaper(chapter.id)}
              confirmMessage={`"${chapter.title}"을(를) 목록에서 뺄까요? 「쳐냄」에서 되돌릴 수 있습니다.`}
              label="삭제"
              pendingLabel="빼는 중…"
              className={`${CHIP_CLASSNAME} hover:bg-red-tint hover:text-red-text disabled:opacity-50`}
            />
          )}
        </div>

        {chapter.rissUrl ? (
          <a
            href={chapter.rissUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm leading-6 text-ink underline decoration-dotted underline-offset-4"
          >
            {chapter.title} <span className="text-line">↗</span>
          </a>
        ) : (
          <p className="text-sm leading-6 text-ink">{chapter.title}</p>
        )}

        {(chapter.author || (showBookTitle && book)) && (
          <p className="mt-0.5 font-mono text-[11px] text-grey">
            {[chapter.author, showBookTitle && book ? `『${book.title}』 수록` : ""].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div>
        <MemoList
          memos={chapter.memos}
          onAdd={(memo) => addPaperMemo(chapter.id, memo)}
          onEdit={(id, memo) => updateMemo(id, memo)}
          onDelete={(id) => deleteMemo(id)}
        />
        <QuoteList
          quotes={chapter.quotes}
          onAdd={(quoteText, page) => addQuote(chapter.id, quoteText, page)}
          onEdit={(id, quoteText, page) => updateQuote(id, quoteText, page)}
          onDelete={(id) => deleteQuote(id)}
        />
      </div>
    </li>
  );
}

// 장이 받는 것은 넉 줄뿐이다. 연도·출판사·출판지·주제어를 여기서 다시 묻지 않는 이유는
// 앞의 셋이 책의 것이고(paper-actions.addChapter), 주제어는 RISS가 준 것들과 성격이
// 달라 클라우드에 섞지 않기로 했기 때문이다 — 장을 가르는 말은 메모에 적는다.
function ChapterForm({
  parentId,
  chapter,
  onClose,
}: {
  parentId?: string;
  chapter?: PaperData;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ChapterInput>({
    title: chapter?.title ?? "",
    author: chapter?.author ?? "",
    pages: chapter?.pages ?? "",
    rissUrl: chapter?.rissUrl ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ChapterInput>(key: K, value: ChapterInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (chapter) await updateChapter(chapter.id, form);
      else await addChapter(parentId!, form);
      onClose();
    } catch {
      setError(chapter ? "수정에 실패했습니다." : "추가에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 rounded-sm border border-line bg-surface p-3">
      <input
        type="text"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
        placeholder="장·수록글 제목 *"
        autoFocus
        className={INPUT_CLASSNAME}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
        {/* 저자를 비우면 책 저자가 쓴 「장」으로 보고 인용 형식이 갈린다(citation.ts) */}
        <input
          type="text"
          value={form.author}
          onChange={(e) => update("author", e.target.value)}
          placeholder="저자 (책 저자와 같으면 비워 두세요)"
          className={INPUT_CLASSNAME}
        />
        <input
          type="text"
          value={form.pages}
          onChange={(e) => update("pages", e.target.value)}
          placeholder="쪽수 (예: 45-72)"
          className={INPUT_CLASSNAME}
        />
      </div>
      <input
        type="url"
        value={form.rissUrl}
        onChange={(e) => update("rissUrl", e.target.value)}
        placeholder="원문 링크 (있을 때만)"
        className={INPUT_CLASSNAME}
      />

      {error && <p className="text-xs text-red-text">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            onClose();
          }}
          disabled={pending}
          className="font-mono text-[11px] text-grey hover:text-ink"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-ink px-2.5 py-1 font-mono text-xs text-white hover:opacity-80 disabled:opacity-50"
        >
          {pending ? (chapter ? "저장 중…" : "추가 중…") : chapter ? "저장" : "추가"}
        </button>
      </div>
    </form>
  );
}
