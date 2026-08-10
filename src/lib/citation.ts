import { PaperData } from "./types";

// 한국문화인류학회 참고문헌 형식 — https://koanth.org/?page_id=1048
// 학위논문: 저자, 연도, "제목," 학위수여기관 학위종류.
// 학술논문: 저자, 연도, "제목," 『학술지명』권(호).
// 단행본:   저자(역자), 연도, 『제목』, 출판지: 출판사.
// 보고서:   연구책임자, 연도, "연구 과제명," 수행기관 연구보고서.
export function formatCitation(p: PaperData): string {
  const year = p.year ?? "연도 미상";
  const author = p.translator ? `${p.author} (${p.translator} 역)` : p.author;

  switch (p.paperType) {
    case "단행본": {
      const publisher = [p.publisherLocation, p.institution].filter(Boolean).join(": ");
      return `${author}, ${year}, 『${p.title}』, ${publisher}.`;
    }
    case "학위논문":
      return `${author}, ${year}, "${p.title}," ${[p.institution, p.degreeLevel].filter(Boolean).join(" ")}.`;
    case "학술논문":
      return `${author}, ${year}, "${p.title}," 『${p.journalName ?? p.institution}』${p.volumeIssue ?? ""}.`;
    case "보고서":
      return `${author}, ${year}, "${p.title}," ${p.institution} 연구보고서.`;
  }
}

// 노션에 붙여넣으면 인용문이 블록쿼트로 인식되도록 마크다운으로 조립한다.
// 서지정보는 항상 포함, 메모·인용구는 있을 때만 각각 덧붙는다.
export function formatNotionExport(p: PaperData): string {
  const parts = [formatCitation(p)];
  if (p.userMemo) {
    parts.push(`📝 ${p.userMemo}`);
  }
  for (const q of p.quotes) {
    parts.push(`> "${q.quoteText}"${q.page ? ` (p.${q.page})` : ""}`);
  }
  return parts.join("\n\n");
}
