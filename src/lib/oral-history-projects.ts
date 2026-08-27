import { readFile } from "node:fs/promises";
import path from "node:path";

// docs/oral_history_projects.md("국내 구술채록 사업 정리")를 파싱해 구조화된 데이터로 만든다.
// 이 문서는 계속 항목이 추가되는 living document라, 화면에 옮겨 적는 대신
// 매 요청마다 원문을 다시 읽어 파싱한다 — 문서만 고치면 화면도 같이 바뀐다.

const MD_PATH = path.join(process.cwd(), "docs", "oral_history_projects.md");

export type ConfirmationLevel = "●●●" | "●●○" | "●○○";

export interface OralHistoryNote {
  label: string;
  value: string;
  subItems: string[];
}

// 기술 칸 하나의 상태. 넷을 가르는 것이 이 화면의 핵심이다 —
// "봤는데 기관이 공개를 안 한다"(못찾음)와 "아직 안 봤다"(안봄)는 전혀 다른 정보다.
// 앞은 조사의 결과이고 뒤는 다음 조사 대상이다.
export type CellState = "확인" | "일부" | "못찾음" | "안봄";

export interface DescriptionCell {
  key: string; // 기술 축은 "군-번호"(예: "주체-4"), 정책 축은 "1"~"9"
  label: string;
  element: string; // ISAD(G) 요소 번호. "L1"·"L2"는 규칙 밖의 로컬 칸
  state: CellState;
  value: string | null; // 안봄이면 null
}

// 칸을 묶어 읽는 단위. 군은 ISAD 영역과 꼭 같지 않다 — 읽기 위한 묶음이고,
// 정본 번호는 칸마다 붙는다(docs/oral_description_schema.md).
export interface DescriptionGroup {
  id: string;
  label: string;
  cells: DescriptionCell[];
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
  // ISAD(G) 3.1.1 참조코드. 갈래·생산자·계열 세 자리를 고정으로 쓴다 — 계열이 하나뿐인
  // 기관도 .1을 붙이는 것은, 나중에 둘로 갈릴 때 코드가 흔들리면 안 되기 때문이다.
  referenceCode: string;
  // 기술 축 21칸을 네 군으로 나눠 담는다. 정책 축 9칸은 따로 선다.
  groups: DescriptionGroup[];
  policyCells: DescriptionCell[];
}

export interface OralHistoryCategory {
  // 문서의 머리표 그대로 — 주제 카테고리는 "1"~"7", 축이 다른 카테고리는 "A"처럼 글자를 쓴다.
  label: string;
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

// 문서가 "누구를 / 무엇을"로 합쳐 적은 항목이 7건 있다. 필드 유무만 보면 그 일곱이
// 조사가 안 된 것으로 잘못 찍히므로, 합친 키를 따로 받아 두 칸에 같은 값을 넣는다.
const MERGED_WHO_WHAT_KEY = "누구를 / 무엇을";

// 기술 축의 칸 정의. docs/oral_description_schema.md가 정본이고 이쪽은 그 옮김이다.
//
// legacy는 아직 옛 육하원칙으로 적힌 항목에서 값을 끌어올 필드 이름이다. 문서를 새 꼴로
// 옮기는 동안 두 꼴이 섞이므로, 새 필드가 있으면 그것을 쓰고 없으면 옛 필드로 채운다 —
// 그러지 않으면 옮기지 않은 항목이 전부 빈칸으로 찍혀 화면이 죽는다.
interface CellDef {
  label: string;
  element: string;
  legacy?: string;
}

interface GroupDef {
  id: string;
  label: string;
  cells: CellDef[];
}

const GROUP_DEFS: GroupDef[] = [
  {
    id: "사업",
    label: "사업",
    cells: [
      { label: "사업 기간", element: "3.1.3", legacy: "언제" },
      { label: "규모와 매체", element: "3.1.5" },
    ],
  },
  {
    id: "주체",
    label: "주체",
    cells: [
      { label: "생산자", element: "3.2.1", legacy: "어디서" },
      { label: "행정연혁", element: "3.2.2" },
      { label: "기록물 이력", element: "3.2.3" },
      { label: "사업의 지향", element: "L1", legacy: "왜" },
      { label: "권리 귀속", element: "3.4.2" },
    ],
  },
  {
    id: "내용",
    label: "내용과 결과",
    cells: [
      { label: "범위와 내용", element: "3.3.1", legacy: "무엇을" },
      { label: "구술자", element: "3.3.1", legacy: "누구를" },
      { label: "수집 절차", element: "3.3.4", legacy: "어떻게" },
      { label: "결과물", element: "3.5.4" },
      { label: "추가수집 예상", element: "3.3.3" },
    ],
  },
  {
    id: "활용",
    label: "활용",
    cells: [
      { label: "공개", element: "3.5.2" },
      { label: "배포", element: "3.5.2" },
      { label: "전시·행사", element: "3.5.3" },
      { label: "교육", element: "3.5.3" },
      { label: "파생 제작물", element: "3.5.3" },
      { label: "후속 연구", element: "3.5.3" },
      { label: "정책·행정 근거", element: "3.6.1" },
      { label: "역량·방법론 확산", element: "L2" },
      { label: "그 외", element: "3.6.1" },
    ],
  },
];

// 활용정책 아홉 칸. 문서에서 "- **구술 활용 정책**:" 아래 "(N) 라벨: 값" 꼴로 적힌다.
// 순서와 이름이 52건 전부 같은 것을 확인하고 고정값으로 둔다.
const POLICY_CELLS: CellDef[] = [
  { label: "동의서", element: "3.2.4" },
  { label: "저작권", element: "3.4.2" },
  { label: "공개등급", element: "3.4.1" },
  { label: "열람절차", element: "3.4.1" },
  { label: "2차활용 승인", element: "3.4.2" },
  { label: "인용표기", element: "3.6.1" },
  { label: "사망 시 처리", element: "3.4.1" },
  { label: "철회·삭제", element: "3.3.2" },
  { label: "권리자 연락 중개", element: "3.4.2" },
];

const POLICY_NOTE_LABEL = "구술 활용 정책";
const SUB_ITEM_RE = /^\((\d)\)\s*([^:]{1,16}?)\s*:\s*(.*)$/;

// 값 하나를 넷 중 하나로 판정한다.
//   "확인 못함"으로 시작   → 봤는데 못 찾았다(못찾음)
//   문장 안에 섞여 있음     → 일부만 확인했다(일부)
//   그 밖                  → 확인
// 문장 안에 섞인 것을 "일부"로 보는 근거는 문서의 실제 서술이다 — 예컨대
// "별도 명칭의 등급 체계는 확인 못함. …이분 구조만 확인됨"처럼, 못 찾은 것과 찾은 것이
// 한 칸에 함께 적혀 있다.
const NOT_FOUND_MARKS = ["확인 못함", "확인 안 됨", "확인하지 못함"];

function judgeCell(value: string | null): CellState {
  if (value === null) return "안봄";
  const v = value.trim();
  if (!v) return "안봄";
  if (/^(불명|불확실)/.test(v)) return "못찾음";
  const hit = NOT_FOUND_MARKS.find((m) => v.includes(m));
  if (!hit) return "확인";
  return v.startsWith(hit) ? "못찾음" : "일부";
}

// "(N) 이름: 값" 꼴 하위 항목을 번호로 색인한다. 활용정책과 새 기술 군이 같은 꼴을 쓴다.
function indexSubItems(subItems: string[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const raw of subItems) {
    const m = SUB_ITEM_RE.exec(raw.trim());
    if (m) found.set(m[1], m[3].trim());
  }
  return found;
}

// 활용정책 블록이 통째로 없는 사업이 37건이다. 그 경우 아홉 칸 전부 "안봄"이 되어야지
// "못찾음"이 되면 안 된다 — 조사하지 않은 것을 조사해도 없는 것으로 적으면 안 되므로.
function parsePolicyCells(notes: OralHistoryNote[]): DescriptionCell[] {
  const note = notes.find((n) => n.label === POLICY_NOTE_LABEL);
  const found = note ? indexSubItems(note.subItems) : new Map<string, string>();
  return POLICY_CELLS.map((def, i) => {
    const key = String(i + 1);
    const value = found.get(key) ?? null;
    return { key, label: def.label, element: def.element, state: judgeCell(value), value };
  });
}

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

// 「사업 기간」(3.1.3) 서술은 자유문이라 완벽한 정답은 없다 — 다이어그램에 쓸 근사 연도 하나를
// 뽑아내는 휴리스틱: ①조사 시점 표기 제거 ②저자가 **굵게** 강조한 연도가 있으면 그걸 우선(예:
// 대구시사편찬위원회처럼 배경 설명 중간에 진짜 연도만 굵게 표시한 경우) ③"실제 사업은" 이후에
// 진짜 실행 시점이 나오는 경우(경기도여성가족재단) 그 구간을 우선 ④그래도 없으면 첫 4자리 연도.
//
// "최소 N년부터"·"N년경"·"최초 시작 연도는 확인 못함"은 그 이전이 있을 수 있다는 표기라
// (규격서 「연도 표기」 규약) 근사로 찍는다 — "N년 시작"과 달리 시작 연도를 확인한 것이 아니다.
function extractRepresentativeYear(when: string | null): { year: number | null; yearApprox: boolean } {
  if (!when) return { year: null, yearApprox: true };
  const yearApprox = /불명|불확실|추정|최소|확인 못함|년경/.test(when);
  const cleaned = when.replace(CITATION_DATE_RE, "");

  const actualIdx = cleaned.indexOf("실제 사업은");
  const primary = actualIdx >= 0 ? cleaned.slice(actualIdx) : cleaned;

  const year = firstBoldYear(primary) ?? firstBoldYear(cleaned) ?? firstYearToken(primary) ?? firstYearToken(cleaned);
  return { year, yearApprox: yearApprox || year === null };
}


// 기술 축 네 군을 짓는다. 새 꼴(군 필드 + "(N) 이름: 값" 하위 항목)이 있으면 그것을 쓰고,
// 없으면 옛 육하원칙 필드에서 끌어온다. 새 칸에 대응하는 옛 필드가 없는 자리는 "안봄"이
// 되는데, 그것이 이 규격이 드러내려는 바다 — 칸이 없으면 안 본 것을 적을 데조차 없다.
function buildGroups(
  getSubItems: (key: string) => string[] | null,
  getValue: (key: string) => string | null,
): DescriptionGroup[] {
  const merged = getValue(MERGED_WHO_WHAT_KEY);
  return GROUP_DEFS.map((group) => {
    const sub = getSubItems(group.label);
    const found = sub ? indexSubItems(sub) : null;
    return {
      id: group.id,
      label: group.label,
      cells: group.cells.map((def, i) => {
        const fresh = found?.get(String(i + 1)) ?? null;
        const legacy = def.legacy
          ? getValue(def.legacy) ??
            (def.legacy === "누구를" || def.legacy === "무엇을" ? merged : null)
          : null;
        const value = fresh ?? legacy;
        return {
          key: `${group.id}-${i + 1}`,
          label: def.label,
          element: def.element,
          state: judgeCell(value),
          value,
        };
      }),
    };
  });
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
    .filter(
      (f) =>
        f.key !== "확인 수준" &&
        f.key !== "하위구분" &&
        f.key !== MERGED_WHO_WHAT_KEY &&
        !CORE_FIELD_KEYS.has(f.key),
    )
    .map((f) => ({ label: f.key, value: f.value, subItems: f.subItems }));

  const whenField = get("언제");

  // 값이 필드 줄에 없고 아래 하위 항목으로만 적힌 자리가 있다(대구 중구의 "누구를 / 무엇을"이
  // 그렇다 — 열전과 가게생애사를 두 줄로 나눠 적었다). 인라인 값만 보면 내용이 있는데도
  // "안 봄"으로 찍히므로, 비었으면 하위 항목을 이어 붙여 값으로 삼는다.
  const getValue = (key: string): string | null => {
    const field = get(key);
    if (!field) return null;
    if (field.value.trim()) return field.value;
    const joined = field.subItems.join(" · ").trim();
    return joined || null;
  };
  const getSubItems = (key: string): string[] | null => get(key)?.subItems ?? null;
  const groups = buildGroups(getSubItems, getValue);
  const policyCells = parsePolicyCells(notes);

  // 대표 연도는 「사업 기간」 칸에서 뽑는다. 이 칸은 새 꼴이면 「사업」 (1)이고 아직 안 옮긴
  // 항목이면 옛 「언제」라, buildGroups가 이미 고른 값을 그대로 쓰면 두 꼴을 다 받는다.
  const { year, yearApprox } = extractRepresentativeYear(groups[0].cells[0].value);

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
    // 참조코드는 갈래를 알아야 지을 수 있다 — 항목 파싱 단계에서는 자리만 비워 두고
    // 카테고리를 훑는 쪽(parseCategoryEntries)에서 채운다.
    referenceCode: "",
    groups,
    policyCells,
  };
}

function parseCategoryEntries(body: string[], categoryLabel: string): OralHistoryEntry[] {
  const text = body.join("\n");
  const parts = text.split(/^###\s+/m).slice(1);
  const entries = parts
    .map((p) => parseEntryBlock("### " + p.trim()))
    .filter((e): e is OralHistoryEntry => e !== null);

  // KR-OHP-{갈래}.{생산자}.{계열}. 생산자 번호는 갈래 안에서 처음 나온 순서고, 계열 번호는
  // 같은 생산자가 다시 나올 때만 올라간다(문서 정제 전이라 지금은 전부 .1이다).
  const producerNo = new Map<string, number>();
  const seriesNo = new Map<string, number>();
  for (const entry of entries) {
    const inst = entry.institution;
    if (!producerNo.has(inst)) producerNo.set(inst, producerNo.size + 1);
    const series = (seriesNo.get(inst) ?? 0) + 1;
    seriesNo.set(inst, series);
    const producer = String(producerNo.get(inst)).padStart(2, "0");
    entry.referenceCode = `KR-OHP-${categoryLabel}.${producer}.${series}`;
  }
  return entries;
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
    // "확인했으나 정보 불충분" 섹션은 카테고리가 아니라 미해결 목록이다. 예전에는 번호(8번)로
    // 구분했는데, 카테고리가 늘면 번호가 밀려서 제목으로 판정하도록 바꿨다 — 이 섹션은
    // 문서에서 번호 없이 둔다.
    if (section.title.startsWith("확인했으나")) {
      unresolvedTitle = section.title;
      unresolvedSubsections = parseUnresolvedSection(section.body);
      continue;
    }

    // 머리표는 숫자("1.")뿐 아니라 글자("A.")도 받는다 — 주제와 축이 다른 카테고리는
    // 번호 대열에 끼우지 않고 글자를 준다.
    const headMatch = /^([0-9]+|[A-Z])\.\s+(.*)$/.exec(section.title);
    if (headMatch) {
      categories.push({ label: headMatch[1], title: headMatch[2].trim(), entries: parseCategoryEntries(section.body, headMatch[1]) });
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
