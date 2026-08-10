import { readFile } from "node:fs/promises";
import path from "node:path";

// oral_history_projects.md("국내 구술채록 사업 정리")를 파싱해 구조화된 데이터로 만든다.
// 이 문서는 계속 항목이 추가되는 living document라, 화면에 옮겨 적는 대신
// 매 요청마다 원문을 다시 읽어 파싱한다 — 문서만 고치면 화면도 같이 바뀐다.

const MD_PATH = path.join(process.cwd(), "oral_history_projects.md");

export type ConfirmationLevel = "●●●" | "●●○" | "●○○";

export interface OralHistoryNote {
  label: string;
  value: string;
  subItems: string[];
}

export interface OralHistoryEntry {
  institution: string;
  projectName: string;
  confirmationLevel: ConfirmationLevel;
  confirmationNote: string | null;
  subgroup: string | null; // 카테고리 안의 하위 구분(예: "국가 단위 기관") — 있으면 패널을 더 잘게 쪼갠다
  year: number | null; // "언제" 서술에서 뽑아낸 대표 연도(다이어그램 배치용) — 근사치
  yearApprox: boolean;
  when: string | null;
  whenSubItems: string[];
  where: string | null;
  who: string | null;
  what: string | null;
  why: string | null;
  how: string | null;
  notes: OralHistoryNote[];
  sources: string | null;
}

export interface OralHistoryCategory {
  number: number;
  title: string;
  entries: OralHistoryEntry[];
}

export interface OralHistoryLevelLegend {
  level: ConfirmationLevel;
  label: string;
  description: string;
}

export interface OralHistorySubsectionItem {
  text: string;
  isBullet: boolean;
}

export interface OralHistorySubsection {
  id: string;
  title: string;
  items: OralHistorySubsectionItem[];
}

export interface OralHistoryPlanGroup {
  title: string;
  items: string[];
}

export interface OralHistoryDoc {
  title: string;
  introParagraphs: string[];
  levelLegend: OralHistoryLevelLegend[];
  categories: OralHistoryCategory[];
  unresolvedTitle: string;
  unresolvedSubsections: OralHistorySubsection[];
  planTitle: string;
  planGroups: OralHistoryPlanGroup[];
  totalEntries: number;
}

const CORE_FIELD_KEYS = new Set(["언제", "어디서", "누구를", "무엇을", "왜", "어떻게", "출처"]);

const YEAR_TOKEN_RE = /(19|20)\d{2}/;
// "2026-08 기준"·"2025-04-02 기준"·"2026년 기준"처럼 조사 시점을 가리키는 날짜는
// 사업의 실제 연도가 아니므로 후보에서 제외한다.
const CITATION_DATE_RE = /(19|20)\d{2}(-\d{2}){0,2}(\.\d{1,2}){0,2}년?\s*기준/g;

function firstYearToken(text: string): number | null {
  const m = YEAR_TOKEN_RE.exec(text);
  return m ? Number(m[0]) : null;
}

function firstBoldYear(text: string): number | null {
  for (const m of text.matchAll(/\*\*([^*]*?)\*\*/g)) {
    const y = firstYearToken(m[1]);
    if (y !== null) return y;
  }
  return null;
}

// "언제" 서술은 자유문이라 완벽한 정답은 없다 — 다이어그램에 쓸 근사 연도 하나를 뽑아내는
// 휴리스틱: ①조사 시점 표기 제거 ②저자가 **굵게** 강조한 연도가 있으면 그걸 우선(예: 대구시사
// 편찬위원회처럼 배경 설명 중간에 진짜 연도만 굵게 표시한 경우) ③"실제 사업은" 이후에 진짜 실행
// 시점이 나오는 경우(경기도여성가족재단) 그 구간을 우선 ④그래도 없으면 첫 4자리 연도.
function extractRepresentativeYear(when: string | null): { year: number | null; yearApprox: boolean } {
  if (!when) return { year: null, yearApprox: true };
  const yearApprox = /불명|불확실|추정/.test(when);
  const cleaned = when.replace(CITATION_DATE_RE, "");

  const actualIdx = cleaned.indexOf("실제 사업은");
  const primary = actualIdx >= 0 ? cleaned.slice(actualIdx) : cleaned;

  const year = firstBoldYear(primary) ?? firstBoldYear(cleaned) ?? firstYearToken(primary) ?? firstYearToken(cleaned);
  return { year, yearApprox: yearApprox || year === null };
}

function splitTopSections(md: string): { title: string; body: string[] }[] {
  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;
  for (const line of md.split("\n")) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      current = { title: m[1].trim(), body: [] };
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }
  return sections;
}

function parseIntro(md: string): { title: string; paragraphs: string[] } {
  const lines = md.split("\n");
  const titleLine = lines.find((l) => l.startsWith("# "));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : "";

  const paragraphs: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (line.startsWith("##")) break;
    if (line.startsWith(">")) {
      const content = line.replace(/^>\s?/, "");
      if (content.trim() === "") {
        if (buf.length) {
          paragraphs.push(buf.join(" "));
          buf = [];
        }
      } else {
        buf.push(content);
      }
    }
  }
  if (buf.length) paragraphs.push(buf.join(" "));
  return { title, paragraphs };
}

function parseLevelLegend(body: string[]): OralHistoryLevelLegend[] {
  const legend: OralHistoryLevelLegend[] = [];
  const re = /^-\s+\*\*(●●●|●●○|●○○)([^*]*)\*\*\s+—\s+(.*)$/;
  for (const raw of body) {
    const m = re.exec(raw.trim());
    if (m) {
      legend.push({ level: m[1] as ConfirmationLevel, label: m[2].trim(), description: m[3].trim() });
    }
  }
  return legend;
}

function parseEntryBlock(block: string): OralHistoryEntry | null {
  const lines = block.split("\n");
  const headerLine = lines.shift();
  if (!headerLine) return null;
  const header = headerLine.replace(/^###\s*/, "").trim();
  const sepIdx = header.indexOf(" — ");
  const institution = sepIdx === -1 ? header : header.slice(0, sepIdx).trim();
  const projectName = sepIdx === -1 ? "" : header.slice(sepIdx + 3).trim();

  type Field = { key: string; value: string; subItems: string[] };
  const fields: Field[] = [];
  let current: Field | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "---") continue;
    // 들여쓰기된 줄(하위 항목)은 "- **...**:" 모양이어도 새 필드로 취급하지 않는다 —
    // 그래야 언제 필드 아래 중첩된 하위 목록(예: 5·18기념재단 항목)이 그대로 붙는다.
    const isIndented = /^\s/.test(raw);
    const m = isIndented ? null : /^-\s+\*\*([^*]+)\*\*:\s?(.*)$/.exec(trimmed);
    if (m) {
      current = { key: m[1].trim(), value: m[2].trim(), subItems: [] };
      fields.push(current);
    } else if (current) {
      current.subItems.push(trimmed.replace(/^-\s*/, ""));
    }
  }

  const get = (key: string) => fields.find((f) => f.key === key) ?? null;

  const levelField = get("확인 수준");
  let confirmationLevel: ConfirmationLevel = "●○○";
  let confirmationNote: string | null = null;
  if (levelField) {
    const lm = /^(●●●|●●○|●○○)\s*(.*)$/.exec(levelField.value);
    if (lm) {
      confirmationLevel = lm[1] as ConfirmationLevel;
      const rest = lm[2].trim();
      confirmationNote = rest ? rest.replace(/^\(|\)$/g, "").trim() : null;
    }
  }

  const notes: OralHistoryNote[] = fields
    .filter((f) => f.key !== "확인 수준" && f.key !== "하위구분" && !CORE_FIELD_KEYS.has(f.key))
    .map((f) => ({ label: f.key, value: f.value, subItems: f.subItems }));

  const whenField = get("언제");
  const { year, yearApprox } = extractRepresentativeYear(whenField?.value ?? null);

  return {
    institution,
    projectName,
    confirmationLevel,
    confirmationNote,
    subgroup: get("하위구분")?.value || null,
    year,
    yearApprox,
    when: whenField?.value || null,
    whenSubItems: whenField?.subItems ?? [],
    where: get("어디서")?.value || null,
    who: get("누구를")?.value || null,
    what: get("무엇을")?.value || null,
    why: get("왜")?.value || null,
    how: get("어떻게")?.value || null,
    notes,
    sources: get("출처")?.value || null,
  };
}

function parseCategoryEntries(body: string[]): OralHistoryEntry[] {
  const text = body.join("\n");
  const parts = text.split(/^###\s+/m).slice(1);
  return parts
    .map((p) => parseEntryBlock("### " + p.trim()))
    .filter((e): e is OralHistoryEntry => e !== null);
}

function parseUnresolvedSection(body: string[]): OralHistorySubsection[] {
  const text = body.join("\n");
  const parts = text.split(/^####\s+/m).slice(1);
  return parts.map((part) => {
    const lines = part.split("\n");
    const rawTitle = (lines.shift() ?? "").trim();
    const idMatch = /^(\d+-\d+)\.\s*(.*)$/.exec(rawTitle);
    const id = idMatch ? idMatch[1] : rawTitle;
    const title = idMatch ? idMatch[2] : rawTitle;

    const items: OralHistorySubsectionItem[] = [];
    let currentIdx = -1;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line === "---") continue;
      if (line.startsWith("- ")) {
        items.push({ text: line.slice(2).trim(), isBullet: true });
        currentIdx = items.length - 1;
      } else if (currentIdx >= 0) {
        items[currentIdx].text += " " + line;
      } else {
        items.push({ text: line, isBullet: false });
        currentIdx = items.length - 1;
      }
    }
    return { id, title, items };
  });
}

function parsePlanSection(body: string[]): OralHistoryPlanGroup[] {
  const groups: OralHistoryPlanGroup[] = [];
  let current: OralHistoryPlanGroup | null = null;
  let currentItem: string | null = null;

  const flush = () => {
    if (current && currentItem !== null) current.items.push(currentItem);
    currentItem = null;
  };

  for (const raw of body) {
    const line = raw.trim();
    if (!line || line === "---") continue;

    const boldOnly = /^\*\*(.+)\*\*$/.exec(line);
    if (boldOnly) {
      flush();
      current = { title: boldOnly[1], items: [] };
      groups.push(current);
      continue;
    }

    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      flush();
      currentItem = numbered[1];
    } else if (currentItem !== null) {
      currentItem += " " + line;
    }
  }
  flush();
  return groups;
}

export async function getOralHistoryProjectsDoc(): Promise<OralHistoryDoc> {
  const md = await readFile(MD_PATH, "utf-8");
  const { title, paragraphs } = parseIntro(md);
  const sections = splitTopSections(md);

  const levelSection = sections.find((s) => s.title === "확인 수준 표시 기준");
  const levelLegend = levelSection ? parseLevelLegend(levelSection.body) : [];

  const categories: OralHistoryCategory[] = [];
  let unresolvedTitle = "";
  let unresolvedSubsections: OralHistorySubsection[] = [];
  let planTitle = "";
  let planGroups: OralHistoryPlanGroup[] = [];

  for (const section of sections) {
    const numMatch = /^(\d+)\.\s+(.*)$/.exec(section.title);
    if (numMatch) {
      const number = Number(numMatch[1]);
      if (number === 8) {
        unresolvedTitle = numMatch[2].trim();
        unresolvedSubsections = parseUnresolvedSection(section.body);
      } else {
        categories.push({ number, title: numMatch[2].trim(), entries: parseCategoryEntries(section.body) });
      }
    } else if (section.title === "다음으로 고려할 것") {
      planTitle = section.title;
      planGroups = parsePlanSection(section.body);
    }
  }

  const totalEntries = categories.reduce((sum, c) => sum + c.entries.length, 0);

  return {
    title,
    introParagraphs: paragraphs,
    levelLegend,
    categories,
    unresolvedTitle,
    unresolvedSubsections,
    planTitle,
    planGroups,
    totalEntries,
  };
}
