"use client";

import { useState } from "react";
import { PaperData } from "@/lib/types";
import { formatNotionExport } from "@/lib/citation";

// 인용(출처 형식) + 인용구를 노션에 붙여넣기 좋은 마크다운(블록쿼트)으로 클립보드에 복사.
// 노션 API 연동 없이 단방향 내보내기만 지원 — 실제 붙여넣기는 이용자가 노션에서 직접 한다.
//
// chapters: 단행본 행에서 누르면 그 아래 수록글의 메모·인용구까지 함께 나간다.
// parent: 수록글 행에서 누르면 서지의 절반(연도·출판사)이 부모에 있으므로 함께 넘긴다.
export function CopyForNotionButton({
  paper,
  parent,
  chapters,
}: {
  paper: PaperData;
  parent?: PaperData;
  chapters?: PaperData[];
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatNotionExport(paper, { parent, chapters }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-1 font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
    >
      {copied ? "복사됨 ✓" : "노션에 복사"}
    </button>
  );
}
