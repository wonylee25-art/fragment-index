// RISS(riss.kr)에서 "구술사"/"구술생애사" 정확검색으로 학위논문·학술논문 메타데이터(제목/저자/연도/
// 주제어)를 긁어와 data/riss-papers.csv를 생성한다. 실행: npm run fetch:riss
//
// 주의: 이 CSV는 다른 data/*.csv(구글시트 수기 export)와 달리 이 스크립트가 생성하는 파일이다 —
// 손으로 수정하지 말 것. 다시 받고 싶으면 스크립트를 재실행하면 된다(이미 처리된 paper_id는 건너뜀).
//
// robots.txt에 명시된 "Crawl-delay: 10"을 지키기 위해 모든 요청(목록·상세) 사이 10초를 기다린다.
// 그래서 전체 실행에 수십 분이 걸린다 — 백그라운드로 돌리는 걸 권장.
//
// 범위(사용자와 합의):
// - 학위논문: "구술사" + "구술생애사" 정확검색 합집합, 단 교육/종교/스포츠 계열 기관 제외
// - 학술논문: "구술사" + "구술생애사" + "생애사" 정확검색 합집합 중 "구술사연구"(한국구술사학회지) +
//   "한국구술사학회 학술대회" 발행물만 — "생애사" 단독은 학위논문 쪽엔 안 붙임(사회복지·평생교육 등
//   다른 분야로 너무 넓게 퍼져 노이즈가 큼, 2026-07-25 사용자와 합의)

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CRAWL_DELAY_MS = 10_000;
const CSV_PATH = "data/riss-papers.csv";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const QUERIES = [
  { colName: "bib_t", phrase: "구술사", kind: "학위논문" },
  { colName: "bib_t", phrase: "구술생애사", kind: "학위논문" },
  { colName: "re_a_kor", phrase: "구술사", kind: "학술논문" },
  { colName: "re_a_kor", phrase: "구술생애사", kind: "학술논문" },
  { colName: "re_a_kor", phrase: "생애사", kind: "학술논문" },
];

const INSTITUTION_BLOCKLIST = [
  "교육대학원", "신학", "목회", "선교", "종교학", "불교학", "교회사",
  "체육", "스포츠", "무용", "태권도", "골프", "무도",
];

const ALLOWED_JOURNALS = new Set(["구술사연구", "한국구술사학회 학술대회"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;
async function politeFetch(url) {
  const wait = CRAWL_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#0*34;/g, '"')
    .replace(/&apos;|&#0*39;/g, "'")
    .replace(/&#0*46;/g, ".")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

// 검색결과 목록 HTML에서 <li>...</li> 항목들을 파싱한다.
function parseListItems(html, kind) {
  const items = [];
  const liBlocks = html.split('<div class="cont ml60">').slice(1);
  for (const block of liBlocks) {
    const end = block.indexOf('<div class="btnW">');
    const chunk = end > -1 ? block.slice(0, end) : block.slice(0, 2000);

    const titleMatch = chunk.match(/<p class="title"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/p>/);
    if (!titleMatch) continue;
    const href = titleMatch[1].replace(/&amp;/g, "&");
    const title = stripTags(titleMatch[2]);

    const controlNoMatch = href.match(/control_no=([a-f0-9]+)/);
    const matTypeMatch = href.match(/p_mat_type=([a-f0-9]+)/);
    if (!controlNoMatch || !matTypeMatch) continue;

    const writerMatch = chunk.match(/class="writer"><a[^>]*>([\s\S]*?)<\/a>/);
    const assignedMatch = chunk.match(/class="assigned"><a[^>]*>([\s\S]*?)<\/a>/);
    const author = writerMatch ? stripTags(writerMatch[1]) : "";
    const institution = assignedMatch ? stripTags(assignedMatch[1]) : "";

    // <p class="etc"> 안에서 assigned 다음에 오는 태그 없는 <span>들 — 연도, (학위유형 또는 학술지명)
    const etcMatch = chunk.match(/<p class="etc">([\s\S]*?)<\/p>/);
    let year = null;
    let extra = ""; // 학위유형(국내석사 등) 또는 학술지명
    if (etcMatch) {
      const spanTexts = [...etcMatch[1].matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) => stripTags(m[1]));
      const plain = spanTexts.filter((t) => t);
      const yearEntry = plain.find((t) => /^\d{4}$/.test(t));
      if (yearEntry) year = parseInt(yearEntry, 10);
      // 학술지명은 <span><a>...</a></span> 형태라 위 정규식엔 안 잡힘 — 별도로 추출
      const journalMatch = etcMatch[1].match(/<span><a[^>]*DetailView\.do[^>]*>([\s\S]*?)<\/a><\/span>/);
      extra = journalMatch ? stripTags(journalMatch[1]) : plain.find((t) => t !== yearEntry) || "";
    }

    items.push({
      controlNo: controlNoMatch[1],
      matType: matTypeMatch[1],
      title,
      author,
      institution,
      year,
      kind,
      degreeLevel: kind === "학위논문" ? extra : "",
      journalName: kind === "학술논문" ? extra : "",
    });
  }
  return items;
}

async function fetchAllListPages(colName, phrase, kind) {
  const query = encodeURIComponent(`"${phrase}"`);
  const all = [];
  let start = 0;
  for (;;) {
    const url = `https://www.riss.kr/search/Search.do?isDetailSearch=N&searchGubun=true&viewYn=OP&query=${query}&colName=${colName}&pageScale=100&iStartCount=${start}`;
    console.log(`[목록] ${kind} "${phrase}" iStartCount=${start} 요청 중...`);
    const html = await politeFetch(url);
    const items = parseListItems(html, kind);
    all.push(...items);
    if (items.length < 100) break;
    start += 100;
  }
  console.log(`[목록] ${kind} "${phrase}" 총 ${all.length}건`);
  return all;
}

function isExcludedInstitution(institution) {
  return INSTITUTION_BLOCKLIST.some((word) => institution.includes(word));
}

// 상세페이지에서 주제어(한글만)와 riss.kr/link 영구링크를 추출한다.
async function fetchDetail(item) {
  const url = `https://www.riss.kr/search/detail/DetailView.do?p_mat_type=${item.matType}&control_no=${item.controlNo}`;
  const html = await politeFetch(url);

  const linkMatch = html.match(/riss\.kr\/link\?id=([A-Za-z0-9]+)/);
  const rissUrl = linkMatch ? `https://www.riss.kr/link?id=${linkMatch[1]}` : url;

  const subjectIdx = html.indexOf('class="strong">주제어');
  let keywords = [];
  if (subjectIdx > -1) {
    const divStart = html.indexOf("<div", subjectIdx);
    const liEnd = html.indexOf("</li>", divStart);
    const block = html.slice(divStart, liEnd > -1 ? liEnd : divStart + 3000);
    keywords = [...block.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => stripTags(m[1]).replace(/^["']+|["']+$/g, "").trim())
      .filter((k) => k && /[가-힣]/.test(k));
  }

  return { rissUrl, keywords };
}

// ---------- CSV I/O (기존 scripts/sync-csv.mjs와 같은 RFC4180 파서 재사용) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") continue;
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

function csvCell(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADER = ["paper_id", "type", "title", "author", "year", "institution", "journal", "degree_level", "keywords", "riss_url"];

function loadExisting() {
  if (!existsSync(CSV_PATH)) return new Map();
  const rows = parseCsv(readFileSync(CSV_PATH, "utf-8"));
  return new Map(rows.map((r) => [r.paper_id, r]));
}

function writeCsv(rowsByid) {
  const rows = [...rowsByid.values()];
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(HEADER.map((h) => csvCell(r[h])).join(","));
  }
  writeFileSync(CSV_PATH, lines.join("\n") + "\n", "utf-8");
}

async function main() {
  const existing = loadExisting();
  console.log(`기존 data/riss-papers.csv: ${existing.size}건 확인됨 (있으면 상세페이지 재요청 생략)`);

  // 1. 목록 수집 + 학위논문/학술논문 필터링
  const theses = new Map();
  const journalArticles = new Map();
  for (const q of QUERIES) {
    const items = await fetchAllListPages(q.colName, q.phrase, q.kind);
    for (const item of items) {
      if (item.kind === "학위논문") {
        if (isExcludedInstitution(item.institution)) continue;
        theses.set(item.controlNo, item);
      } else {
        if (!ALLOWED_JOURNALS.has(item.journalName)) continue;
        journalArticles.set(item.controlNo, item);
      }
    }
  }
  console.log(`\n필터링 후 대상: 학위논문 ${theses.size}건, 학술논문 ${journalArticles.size}건`);

  const targets = [...theses.values(), ...journalArticles.values()];

  // 2. 상세페이지(주제어) 수집 — 이미 CSV에 있는 건 건너뜀
  let fetched = 0;
  for (const item of targets) {
    const paperId = `riss-${item.controlNo}`;
    // 이미 상세페이지를 시도한 적 있으면 건너뜀 — 주제어가 원래 없는 논문(빈 keywords)도
    // 재실행마다 다시 요청하지 않는다(어차피 매번 똑같이 없음).
    if (existing.has(paperId)) {
      continue;
    }
    fetched++;
    console.log(`[상세 ${fetched}/${targets.length - existing.size}] ${item.title}`);
    let detail;
    try {
      detail = await fetchDetail(item);
    } catch (err) {
      console.warn(`  실패, 건너뜀: ${err.message}`);
      continue;
    }
    existing.set(paperId, {
      paper_id: paperId,
      type: item.kind,
      title: item.title,
      author: item.author,
      year: item.year ?? "",
      institution: item.institution,
      journal: item.journalName,
      degree_level: item.degreeLevel,
      keywords: detail.keywords.join(";"),
      riss_url: detail.rissUrl,
    });
    // 중간 저장 — 중단돼도 이어서 진행 가능하게
    writeCsv(existing);
  }

  writeCsv(existing);
  console.log(`\n완료: data/riss-papers.csv에 총 ${existing.size}건 기록됨`);
}

main().catch((err) => {
  console.error("스크래핑 실패:", err);
  process.exit(1);
});
