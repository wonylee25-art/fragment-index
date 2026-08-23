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
// 수록글:   저자, 연도, "글 제목," 엮은이 편, 『책 제목』, 45-72쪽, 출판지: 출판사.
//
// 수록글은 서지의 절반이 제 행에 없다 — 연도·출판사·출판지는 매달린 책의 것이라 부모를
// 함께 받는다(paper-actions.addChapter가 그 칸들을 일부러 비워 두는 이유). 부모 없이
// 부르면 책 쪽 정보가 빠진 채로 나온다.
export function formatCitation(p: PaperData, parent?: PaperData): string {
  if (p.paperType === "수록글") return formatChapterCitation(p, parent);

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

// "45-72"처럼 숫자만 적어둔 쪽수에만 "쪽"을 붙인다 — 연표 출처 칸(formatEventSource)과 같은 규칙.
function withPageUnit(pages: string): string {
  return /^[\d\s\-–~,]+$/.test(pages) ? `${pages}쪽` : pages;
}

// 수록글에는 두 갈래가 있고, 가르는 것은 저자가 적혀 있느냐다.
//
// 저자가 있으면 남의 책에 실린 제 글이라 독립된 인용 단위다 — 글 제목을 앞에 세우고
// 책을 뒤에 놓는다. 저자가 없으면 책 저자가 쓴 한 장이고, 장은 그 자체로 인용되지 않는다 —
// 책의 인용 뒤에 쪽수와 장 제목을 덧붙이는 꼴로 둔다.
function formatChapterCitation(p: PaperData, parent?: PaperData): string {
  const year = parent?.year ?? p.year ?? "연도 미상";
  const book = parent ? `『${parent.title}』` : "『(단행본 미상)』";
  const publisher = [parent?.publisherLocation, parent?.institution].filter(Boolean).join(": ");
  const pages = p.pages?.trim() ? withPageUnit(p.pages.trim()) : "";

  if (!p.author.trim()) {
    const bookAuthor = parent?.translator ? `${parent.author} (${parent.translator} 역)` : (parent?.author ?? "");
    const head = [bookAuthor, String(year)].filter(Boolean).join(", ");
    const tail = [publisher, pages].filter(Boolean).join(", ");
    return `${head}, ${book}${tail ? `, ${tail}` : ""} ("${p.title}").`;
  }

  // 엮은이가 비어 있으면 그 자리를 통째로 뺀다 — 논문집이 아니라 저서라면 "OOO 편"이 틀린 말이 된다.
  const editor = parent?.editor?.trim() ? `${parent.editor.trim()} 편` : "";
  return `${[p.author, String(year)].filter(Boolean).join(", ")}, "${p.title}," ${[editor, book, pages, publisher]
    .filter(Boolean)
    .join(", ")}.`;
}

// 노션에 붙여넣으면 인용문이 블록쿼트로 인식되도록 마크다운으로 조립한다.
// 서지정보는 항상 포함, 메모·인용구는 있을 때만 각각 덧붙는다.
//
// 단행본을 복사하면 그 아래 수록글의 메모·인용구까지 따라 나온다. 장별로 챙겨둔 것을
// 옮기려고 행마다 따로 누르게 하면 이 버튼의 뜻이 없어져서다 — 다만 뭉뚱그리지 않고
// 수록글마다 제 서지를 머리로 얹은 덩어리로 나눠 붙인다. 어느 글에서 옮긴 인용구인지가
// 노션에 붙여넣은 뒤에도 남아야 한다.
export function formatNotionExport(
  p: PaperData,
  { parent, chapters = [] }: { parent?: PaperData; chapters?: PaperData[] } = {},
): string {
  const parts = [formatCitation(p, parent), ...marks(p)];
  for (const c of chapters) {
    const chapter = [formatCitation(c, p), ...marks(c)];
    if (chapter.length === 1) continue; // 적어둔 것이 없는 수록글은 서지만 늘어놓지 않는다
    parts.push(`— ${chapter.join("\n\n")}`);
  }
  return parts.join("\n\n");
}

// 메모·인용구 한 덩어리의 꼴. 논문을 통째로 옮길 때(formatNotionExport)와 덩어리 하나만
// 옮길 때(CopyTextButton)가 같은 모양으로 나가야, 노션에 섞여 붙어도 한 종류로 읽힌다.
export function formatMemoMark(memo: string): string {
  return `📝 ${memo}`;
}

export function formatQuoteMark(quote: { quoteText: string; page?: string }): string {
  return `> "${quote.quoteText}"${quote.page ? ` (p.${quote.page})` : ""}`;
}

function marks(p: PaperData): string[] {
  const parts: string[] = [];
  for (const m of p.memos) {
    parts.push(formatMemoMark(m.memoText));
  }
  for (const q of p.quotes) {
    parts.push(formatQuoteMark(q));
  }
  return parts;
}
