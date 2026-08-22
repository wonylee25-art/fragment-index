"use client";

import { useState } from "react";

// 메모·인용구 한 덩어리를 클립보드로 옮기는 작은 글자 버튼. 논문 한 편을 통째로 옮기는
// CopyPaperButton과 달리 서지를 얹지 않는다 — 옮기는 것이 적어 둔 그 한 덩어리뿐이다.
// 둘 다 이름은 "복사"이고, 무엇이 나가는지는 버튼이 서 있는 자리가 말한다.
// 수정·삭제와 한 줄에 서므로 그 둘과 같은 크기·색을 쓴다.
export function CopyTextButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" onClick={handleCopy} className={className ?? "font-mono text-[10px] text-grey hover:text-ink"}>
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}
