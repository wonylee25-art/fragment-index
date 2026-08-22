"use client";

import { useState } from "react";
import { PaperData, PaperType } from "@/lib/types";
import { addPaper, updatePaper } from "@/lib/paper-actions";

// "수록글"은 여기 없다 — 단행본 행의 「+ 수록글 추가」로만 생긴다(PaperChapters).
const PAPER_TYPES: PaperType[] = ["학술논문", "학위논문", "단행본", "보고서"];

const EMPTY_FORM = {
  paperType: "학술논문" as PaperType,
  title: "",
  author: "",
  year: "",
  institution: "",
  journalName: "",
  volumeIssue: "",
  degreeLevel: "",
  publisherLocation: "",
  translator: "",
  editor: "",
  researchPeriod: "",
  researchTeam: "",
  researchSummary: "",
  keywords: "",
  rissUrl: "",
};

function formFromPaper(paper: PaperData): typeof EMPTY_FORM {
  return {
    paperType: paper.paperType,
    title: paper.title,
    author: paper.author,
    year: paper.year ? String(paper.year) : "",
    institution: paper.institution,
    journalName: paper.journalName ?? "",
    volumeIssue: paper.volumeIssue ?? "",
    degreeLevel: paper.degreeLevel ?? "",
    publisherLocation: paper.publisherLocation ?? "",
    translator: paper.translator ?? "",
    editor: paper.editor ?? "",
    researchPeriod: paper.researchPeriod ?? "",
    researchTeam: paper.researchTeam ?? "",
    researchSummary: paper.researchSummary ?? "",
    keywords: paper.keywords.join(", "),
    rissUrl: paper.rissUrl,
  };
}

const INPUT_CLASSNAME =
  "w-full rounded-sm border border-line px-2 py-1.5 text-sm focus:border-green-text focus:outline-none";

// RISS 자동 수집(scripts/fetch-riss-papers.mjs) 범위 밖의 논문을 이용자가 직접 등록·수정하는 폼.
// paper가 주어지면 수정 모드(기존 값으로 채워서 updatePaper 호출), 없으면 신규 등록 모드(addPaper).
// 목록 화면 자체가 client component라 여기 결과는 addPaper/updatePaper 안의 revalidatePath("/research")로 반영된다.
// 열림/닫힘은 부모(ResearchTrends)가 갖는다 — 헤더의 토글 버튼과 이 폼(전체 너비 블록)의 레이아웃이 서로 달라서다.
export function AddPaperForm({ paper, onClose }: { paper?: PaperData; onClose: () => void }) {
  const isEdit = paper !== undefined;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(paper ? formFromPaper(paper) : EMPTY_FORM);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
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
      const input = {
        paperType: form.paperType,
        title: form.title,
        author: form.author,
        year: form.year ? parseInt(form.year, 10) : null,
        institution: form.institution,
        journalName: form.journalName,
        volumeIssue: form.volumeIssue,
        degreeLevel: form.degreeLevel,
        publisherLocation: form.publisherLocation,
        translator: form.translator,
        editor: form.editor,
        researchPeriod: form.researchPeriod,
        researchTeam: form.researchTeam,
        researchSummary: form.researchSummary,
        keywords: form.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        rissUrl: form.rissUrl,
      };
      if (isEdit) {
        await updatePaper(paper.id, input);
      } else {
        await addPaper(input);
        setForm(EMPTY_FORM);
      }
      onClose();
    } catch {
      setError(isEdit ? "수정에 실패했습니다." : "추가에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 flex flex-col gap-2 rounded-sm border border-line bg-surface p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={form.paperType}
          onChange={(e) => update("paperType", e.target.value as PaperType)}
          className={INPUT_CLASSNAME}
        >
          {PAPER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {form.paperType === "보고서" ? (
          <input
            type="text"
            value={form.researchPeriod}
            onChange={(e) => update("researchPeriod", e.target.value)}
            placeholder="연구기간 (예: 2023.03~2023.12)"
            className={INPUT_CLASSNAME}
          />
        ) : (
          <input
            type="text"
            value={form.year}
            onChange={(e) => update("year", e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="연도 (예: 2023)"
            inputMode="numeric"
            className={INPUT_CLASSNAME}
          />
        )}
      </div>

      <input
        type="text"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
        placeholder={form.paperType === "보고서" ? "연구 과제명 *" : "제목 *"}
        autoFocus
        className={INPUT_CLASSNAME}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={form.author}
          onChange={(e) => update("author", e.target.value)}
          placeholder={form.paperType === "보고서" ? "연구책임자" : "저자"}
          className={INPUT_CLASSNAME}
        />
        <input
          type="text"
          value={form.institution}
          onChange={(e) => update("institution", e.target.value)}
          placeholder={
            form.paperType === "단행본"
              ? "출판사"
              : form.paperType === "보고서"
                ? "수행기관 / 발주처"
                : "학위수여기관 / 발행 학회"
          }
          className={INPUT_CLASSNAME}
        />
      </div>

      {form.paperType === "학술논문" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
          <input
            type="text"
            value={form.journalName}
            onChange={(e) => update("journalName", e.target.value)}
            placeholder="학술지명"
            className={INPUT_CLASSNAME}
          />
          <input
            type="text"
            value={form.volumeIssue}
            onChange={(e) => update("volumeIssue", e.target.value)}
            placeholder="권(호) 예: 25(1)"
            className={INPUT_CLASSNAME}
          />
        </div>
      )}

      {form.paperType === "학위논문" && (
        <input
          type="text"
          value={form.degreeLevel}
          onChange={(e) => update("degreeLevel", e.target.value)}
          placeholder="학위 (예: 국내석사, 국내박사)"
          className={INPUT_CLASSNAME}
        />
      )}

      {form.paperType === "단행본" && (
        // 한국문화인류학회 인용 형식(저자, 발행연도, 제목, 출판지: 출판사) 참고 — https://koanth.org/?page_id=1048
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={form.publisherLocation}
            onChange={(e) => update("publisherLocation", e.target.value)}
            placeholder="출판지 (예: 서울)"
            className={INPUT_CLASSNAME}
          />
          <input
            type="text"
            value={form.translator}
            onChange={(e) => update("translator", e.target.value)}
            placeholder="역자 (역서일 때만)"
            className={INPUT_CLASSNAME}
          />
          {/* 엮은이는 저자와 다를 때만 적는다 — 수록글 인용의 "OOO 편"이 여기서 온다(citation.ts).
              저서라면 비워 두면 되고, 그러면 인용에서 그 자리가 통째로 빠진다. */}
          <input
            type="text"
            value={form.editor}
            onChange={(e) => update("editor", e.target.value)}
            placeholder="엮은이 (논문집일 때만)"
            className={INPUT_CLASSNAME}
          />
        </div>
      )}

      {form.paperType === "보고서" && (
        <>
          <input
            type="text"
            value={form.researchTeam}
            onChange={(e) => update("researchTeam", e.target.value)}
            placeholder="연구진 (쉼표로 구분, 연구책임자 제외)"
            className={INPUT_CLASSNAME}
          />
          <textarea
            value={form.researchSummary}
            onChange={(e) => update("researchSummary", e.target.value)}
            placeholder="연구요약"
            rows={3}
            className={INPUT_CLASSNAME}
          />
        </>
      )}

      <input
        type="text"
        value={form.keywords}
        onChange={(e) => update("keywords", e.target.value)}
        placeholder="주제어 (쉼표로 구분)"
        className={INPUT_CLASSNAME}
      />

      <input
        type="url"
        value={form.rissUrl}
        onChange={(e) => update("rissUrl", e.target.value)}
        placeholder="원문 링크 (RISS 등)"
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
          {pending ? (isEdit ? "저장 중…" : "추가 중…") : isEdit ? "저장" : "추가"}
        </button>
      </div>
    </form>
  );
}
