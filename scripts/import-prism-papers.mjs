// PRISM에서 뽑은 정책연구 과제(data/raw/prism-research.json)를 papers에 「보고서」로 넣는다.
// 실행: node --env-file=.env.local scripts/import-prism-papers.mjs [--dry]
//
// 앞 단계는 scripts/fetch-prism-research.mjs다. 그쪽이 과제명으로 거른 것을 여기서 적재한다.
//
// **왜 학술 문헌과 같은 표에 넣나** — 정책연구보고서는 회색문헌이라 학위논문·학술논문과
// 층이 다르지만, papers는 이미 유형 다섯을 지고 있고 「보고서」 칸(research_period·
// research_team·research_summary)과 인용 형식(src/lib/citation.ts)이 이미 서 있다.
// 갈래는 paper_type이 지므로 표를 새로 세울 까닭이 없다.
//
// **발주처는 제 칸을 진다**(20260828_add_ordering_agency_to_papers.sql). institution은
// 인용 형식이 "수행기관 연구보고서"라 부르는 자리라 수행기관이 차지하므로, 연구를 맡긴 쪽을
// 거기 넣을 수 없어서다. 아직 못 담는 것은 **계약금액·계약방식** 둘이고,
// 그 둘은 data/raw/prism-research.json과 docs/oral_history_performers.md에 남는다.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const IN = path.join("data", "raw", "prism-research.json");

// 낱말만 같고 구술채록이 아닌 것 — docs/oral_history_performers.md가 손으로 걷어낸 것과 같은 기준이다.
// 법정 증언·구술심리·항공영어 구술능력은 말하기 능력이나 심리(審理) 절차지 채록이 아니다.
const NOT_ORAL_HISTORY = [/항공영어구술능력/, /구술심리/];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
const dryRun = process.argv.includes("--dry");

// 개요·초록은 PRISM이 <br />을 박은 채로 준다. 태그를 줄바꿈으로 되돌리고 빈 줄을 줄인다.
function plainText(value) {
  if (!value) return null;
  const text = String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

// "2025-03-31" → "2025.03". 화면과 인용 형식이 기대하는 꼴은 연·월이고(AddPaperForm 참고),
// 날짜까지의 정확한 기간은 data/raw/prism-research.json에 그대로 남는다.
function yearMonth(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}` : null;
}

function periodOf(row) {
  const begin = yearMonth(row.period_start);
  const end = yearMonth(row.period_end);
  if (begin && end) return `${begin}~${end}`;
  return begin ?? end ?? null;
}

// paper-actions.extractYearFromPeriod과 같은 규칙 — 기간 문자열의 마지막 4자리 연도를 취한다.
// 정렬(getPapers)과 인용 형식이 모두 year 컬럼에 기댄다.
function yearOf(period, fallback) {
  const matches = period?.match(/(19|20)\d{2}/g);
  if (matches) return Number(matches[matches.length - 1]);
  const alt = String(fallback ?? "").match(/(19|20)\d{2}/);
  return alt ? Number(alt[0]) : null;
}

// PRISM의 초록 칸은 신뢰도가 고르지 않다 — 목차 한 줄만 들어 있는 것이 섞여 있어,
// 40자에 못 미치면 초록으로 치지 않고 과업 개요를 쓴다.
function summaryOf(row) {
  const abstract = plainText(row.abstract);
  if (abstract && abstract.length >= 40) return abstract;
  return plainText(row.outline) ?? abstract;
}

function keywordsOf(row) {
  if (!row.keyword) return [];
  return String(row.keyword)
    .split(/[,;·\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function toRow(row) {
  const period = periodOf(row);
  return {
    // riss-(자동 수집)·manual-(화면 입력)과 겹치지 않는 접두사. 과제ID가 그대로 뒤에 붙어
    // 다시 돌려도 같은 행을 갱신한다.
    id: `prism-${row.research_id}`,
    paper_type: "보고서",
    title: row.title,
    // 인용 형식은 "연구책임자, 연도, 과제명, 수행기관 연구보고서" 꼴이다(src/lib/citation.ts).
    author: row.researcher ?? null,
    institution: row.performer_name ?? null,
    // 목록의 organ_name은 과제를 등록한 행정기관 — 수행기관이 아니라 발주처다.
    ordering_agency: row.ordering_agency ?? null,
    year: yearOf(period, row.issued_year ?? row.research_year),
    research_period: period,
    // 연구진 칸은 "연구책임자를 뺀 공동연구원"인데 PRISM은 책임자 한 명만 준다 — 비워 둔다.
    research_team: null,
    // 초록이 있으면 그쪽이 낫다. 없으면 과업 개요를 싣는다(48건 중 34건만 초록이 있다).
    // 다만 초록 칸에 "[부록] 수집자료 목록"처럼 한 줄만 들어 있는 것이 섞여 있어,
    // 너무 짧으면 초록으로 치지 않고 개요로 넘어간다.
    research_summary: summaryOf(row),
    keywords: keywordsOf(row),
    // 원문은 재호스팅하지 않고 링크로만 건다(저장소 원칙). 보고서 PDF 직링크가 아니라
    // PRISM 과제 화면을 거는 것은 그쪽에 목차·평가결과까지 함께 있기 때문이다.
    riss_url: row.prism_url ?? null,
  };
}

// 제목이 같은 행이 이미 있으면 손으로 넣어 둔 것일 수 있다(src/lib/paper-duplicates.ts와 같은 기준 —
// 공백을 지운 제목 + 유형). 덮지 않고 알리기만 한다.
const normalize = (title) => String(title ?? "").replace(/\s+/g, "");

async function main() {
  const source = JSON.parse(await readFile(IN, "utf8"));
  const dropped = source.filter((row) => NOT_ORAL_HISTORY.some((re) => re.test(row.title)));
  const kept = source.filter((row) => !NOT_ORAL_HISTORY.some((re) => re.test(row.title)));
  console.log(`${IN} — ${source.length}건 중 ${kept.length}건을 넣습니다.`);
  for (const row of dropped) console.log(`  걷어냄 — ${row.title}`);

  const rows = kept.map(toRow);

  const { data: existing, error: readError } = await supabase
    .from("papers")
    .select("id,title,paper_type");
  if (readError) throw readError;
  const byId = new Set(existing.map((r) => r.id));
  const byTitle = new Map(existing.map((r) => [`${normalize(r.title)}|${r.paper_type}`, r.id]));

  const fresh = rows.filter((r) => !byId.has(r.id));
  const updates = rows.filter((r) => byId.has(r.id));
  const clashes = fresh.filter((r) => byTitle.has(`${normalize(r.title)}|보고서`));

  console.log(`  새로 넣을 것 ${fresh.length}건 · 이미 있어 갱신할 것 ${updates.length}건`);
  for (const row of clashes) {
    console.log(`  ! 제목이 같은 보고서가 이미 있습니다 — ${row.title} (기존 ${byTitle.get(`${normalize(row.title)}|보고서`)})`);
  }
  const noAuthor = rows.filter((r) => !r.author).length;
  const noInstitution = rows.filter((r) => !r.institution).length;
  if (noAuthor || noInstitution) {
    console.log(`  · 연구책임자 빈 것 ${noAuthor}건 · 수행기관 빈 것 ${noInstitution}건`);
  }

  if (dryRun) {
    console.log("\n--dry라 쓰지 않았습니다.");
    console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  const { error } = await supabase.from("papers").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`\n${rows.length}건을 papers에 넣었습니다.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
