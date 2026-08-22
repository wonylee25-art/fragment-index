import { PaperData } from "@/lib/types";

// 같은 논문이 목록에 두 번 서는 일이 잦다. RISS가 한 논문에 등록번호를 둘 발급하거나,
// 학술대회 발표집과 학술지 게재본이 따로 잡히거나, 손으로 넣은 것과 RISS판이 겹친다.
// 저자 표기만 다른 경우도 있다(「Park, Christian Joon」과 「박준규」).
//
// 제목(공백 무시)과 유형이 같으면 한 편으로 본다. 학위논문과 그것을 줄여 낸 학술논문은
// 유형이 달라 저절로 갈라진다 — 인용할 때 구분해야 하는 것들이다.
//
// 주제어 별칭과 마찬가지로 읽을 때만 접는다. hidden_at을 건드리지 않으니 「쳐냄」과 섞이지
// 않고, 예외에서 한 줄 지우면 도로 갈라진다.

function titleKey(title: string): string {
  return title.replace(/\s+/g, "").toLowerCase();
}

// 규칙에는 걸리지만 합치면 안 되는 것.
const DUPLICATE_EXCEPTIONS = new Set(
  [
    // 제목만 같고 저자가 다른 남남
    "생애사 연구를 통한 노년기 삶의 이해", // 한경혜 2004 / 김태성 2012
    "라이프코스 자료 수집 방법으로서 생애사 달력(Life History Calendar)", // 마경희 / 신경아
    // 해마다 같은 꼭지가 실리는 연간지 — 호가 다르면 다른 글이다
    "[Our Vision] 경북여성 구술생애사 채록사업", // 소식지 희망창 2017호 / 2018호
    "「전남여성생애구술사」", // 전남여성가족 2022 / 2023
  ].map(titleKey),
);

function groupKey(paper: PaperData): string {
  return `${titleKey(paper.title)} ${paper.paperType}`;
}

// 내가 손댄 흔적. 접었다가 메모나 인용구가 화면에서 사라지면 안 되므로 이런 논문을 먼저 살린다.
//
// 매달아 둔 수록글도 그 흔적에 든다. 같은 책이 RISS에 두 번 잡혀 있을 때, 장을 달아둔 판이
// 접히는 쪽으로 걸리면 그 장들이 목록에서 통째로 사라진다 — 장은 부모 아래에서만 서기 때문이다.
function hasMyMarks(paper: PaperData, withChildren: Set<string>): boolean {
  return (
    Boolean(paper.userMemo) ||
    paper.isImportant ||
    paper.isRead ||
    paper.quotes.length > 0 ||
    withChildren.has(paper.id)
  );
}

// 적힌 항목이 많은 쪽 — 같은 논문이면 서지가 더 채워진 판을 남기는 편이 낫다.
function richness(paper: PaperData): number {
  const fields = [
    paper.author,
    paper.journalName,
    paper.volumeIssue,
    paper.institution,
    paper.degreeLevel,
    paper.publisherLocation,
    paper.translator,
    paper.researchPeriod,
    paper.researchTeam,
    paper.researchSummary,
    paper.rissUrl,
  ];
  return fields.filter(Boolean).length + paper.keywords.length;
}

// 같은 논문이 저자 이름만 달리 잡히기도 한다(「Park, Christian Joon」과 「박준규」). 국내
// 논문 목록이니 한글로 적힌 판을 남긴다 — 인용할 때 그대로 쓸 수 있는 쪽이다.
const HANGUL = /[가-힣]/;

function hasHangulAuthor(paper: PaperData): boolean {
  return HANGUL.test(paper.author ?? "");
}

// 한 묶음에서 남길 한 편을 고른다. 내가 손댄 것 > 한글 저자명 > 항목이 많은 것 > 먼저 들어온 것.
// 내가 손댄 것이 맨 앞인 이유는, 접힌 쪽에 붙은 메모와 인용구가 화면에서 사라지기 때문이다.
function pickSurvivor(a: PaperData, b: PaperData, withChildren: Set<string>): PaperData {
  if (hasMyMarks(a, withChildren) !== hasMyMarks(b, withChildren)) return hasMyMarks(a, withChildren) ? a : b;
  if (hasHangulAuthor(a) !== hasHangulAuthor(b)) return hasHangulAuthor(a) ? a : b;
  const diff = richness(a) - richness(b);
  if (diff !== 0) return diff > 0 ? a : b;
  return a.createdAt <= b.createdAt ? a : b;
}

export interface DuplicateFolding {
  folded: Set<string>; // 접혀서 목록에 서지 않는 논문 id
  foldedUnder: Map<string, PaperData[]>; // 남은 논문 id → 그 아래로 접힌 논문들
}

export function buildDuplicateFolding(papers: PaperData[]): DuplicateFolding {
  const withChildren = new Set(papers.map((p) => p.parentId).filter((id): id is string => Boolean(id)));

  const groups = new Map<string, PaperData[]>();
  for (const paper of papers) {
    // 수록글은 여기서 다루지 않는다. 제목이 「서론」·「머리말」처럼 짧고 흔해서, 제목으로 묶으면
    // 다른 책의 같은 이름 장끼리 한 편으로 접힌다. 애초에 목록에 낱개로 서지도 않는다.
    if (paper.parentId) continue;
    if (DUPLICATE_EXCEPTIONS.has(titleKey(paper.title))) continue;
    const key = groupKey(paper);
    const bucket = groups.get(key);
    if (bucket) bucket.push(paper);
    else groups.set(key, [paper]);
  }

  const folded = new Set<string>();
  const foldedUnder = new Map<string, PaperData[]>();
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const survivor = bucket.reduce((a, b) => pickSurvivor(a, b, withChildren));
    const others = bucket.filter((p) => p.id !== survivor.id);
    for (const other of others) folded.add(other.id);
    foldedUnder.set(survivor.id, others);
  }
  return { folded, foldedUnder };
}
