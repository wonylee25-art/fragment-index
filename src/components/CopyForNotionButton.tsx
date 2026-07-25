"use client";

import { useState } from "react";
import { PaperData } from "@/lib/types";
import { formatNotionExport } from "@/lib/citation";

// 인용(출처 형식) + 인용구를 노션에 붙여넣기 좋은 마크다운(블록쿼트)으로 클립보드에 복사.
// 노션 API 연동 없이 단방향 내보내기만 지원 — 실제 붙여넣기는 이용자가 노션에서 직접 한다.
export function CopyForNotionButton({ paper }: { paper: PaperData }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatNotionExport(paper));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-1 font-mono text-[11px] text-zinc-300 underline decoration-dotted underline-offset-4 hover:text-zinc-600"
    >
      {copied ? "복사됨 ✓" : "노션에 복사"}
    </button>
  );
}
