"use client";

import { useState } from "react";
import { PaperData } from "@/lib/types";
import { formatNotionExport } from "@/lib/citation";

// 논문 한 편을 통째로 — 서지(인용 형식) + 메모 + 인용구 — 클립보드에 옮긴다. 붙여넣으면
// 노션에서 인용문이 블록쿼트로 잡히는 마크다운이지만, 이름에 "노션"을 넣지 않는다. 노션에
// 매인 기능이 아니라 어디에 붙여도 되는 복사이고, 메모·인용구 낱개에 붙은 「복사」와도 같은
// 말로 읽혀야 한다 — 서 있는 자리(논문 머리줄 / 덩어리 옆)가 무엇을 옮기는지를 말해 준다.
//
// chapters: 단행본 행에서 누르면 그 아래 수록글의 메모·인용구까지 함께 나간다.
// parent: 수록글 행에서 누르면 서지의 절반(연도·출판사)이 부모에 있으므로 함께 넘긴다.
export function CopyPaperButton({
  paper,
  parent,
  chapters,
  className,
}: {
  paper: PaperData;
  parent?: PaperData;
  chapters?: PaperData[];
  className?: string;
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
      title="서지·메모·인용구를 통째로 복사"
      className={className}
    >
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}
