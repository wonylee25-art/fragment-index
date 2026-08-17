import { PaperData, TimelineEventData } from "./types";

// 연표 사건의 출처 유형. 책·학술지·간행물은 쪽을 넘겨 찾아가는 자료라 저자·쪽수를 함께 묻고,
// 나머지(웹·영상 등)는 쪽이라는 것이 없어 묻지 않는다.
export const CITED_SOURCE_TYPES = ["도서", "학술지", "간행물"] as const;
export const SOURCE_TYPES = [...CITED_SOURCE_TYPES, "웹", "영상", "구술자료", "기타"] as const;

export function isCited(sourceType: string): boolean {
  return (CITED_SOURCE_TYPES as readonly string[]).includes(sourceType.trim());
}

// 연표 출처 칸 한 줄. 한국문화인류학회 형식을 그대로 따르기에는 사건의 출처가 문헌만이
// 아니라(웹·영상·구술자료도 온다) 무리라, 있는 것만 "저자, 출처, 112쪽"으로 잇는다.
export function formatEventSource(event: TimelineEventData): string {
  const pages = event.sourcePages.trim();
  return [
    event.sourceAuthor.trim(),
    // 화면에 내보이는 것은 번호가 풀린 쪽이다 — 원본(sourceReference)은 수정 폼의 몫.
    event.sourceLabel.trim(),
    // "112", "112-118"처럼 숫자만 적어둔 경우에만 "쪽"을 붙인다 — "112쪽", "p.112"로 적어
    // 넣은 값에 또 붙이면 "112쪽쪽"이 된다.
    pages && /^[\d\s\-–~,]+$/.test(pages) ? `${pages}쪽` : pages,
  ]
    .filter(Boolean)
    .join(", ");
}

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
