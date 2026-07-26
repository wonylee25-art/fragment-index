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

import { existsSync } from "node:fs";
import { politeFetch, stripTags, parseVolumeIssue } from "./lib/riss-http.mjs";
import { RISS_PAPERS_CSV_PATH, readRissPapersCsv, writeRissPapersCsv } from "./lib/riss-papers-csv.mjs";

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

// INSTITUTION_BLOCKLIST는 발행기관명만 보므로 못 거르는, 개별 체육인의 생애사(유도·축구·탁구 등
// 인물 중심 스포츠 전기) — 2026-07-25 사용자가 화면에서 직접 삭제해 확인한 값. 재실행 때마다
// 다시 긁히지 않도록 control_no로 고정 제외한다.
const MANUALLY_EXCLUDED_CONTROL_NOS = new Set([
  "76da86f493d49ab0ffe0bdc3ef48d419", // 강원도 유도인의 구술생애사
  "e8184fe5b8914777ffe0bdc3ef48d419", // 체육인 한상준의 생애사
  "adfc3ca865676f16ffe0bdc3ef48d419", // 돈키호테, 체육선생의 삶
  "54432d3847100587ffe0bdc3ef48d419", // 탁구인 윤길중의 생애사
  "93989f0ea07cd072ffe0bdc3ef48d419", // 김왕주 축구감독의 생애사
  "7173d42142b2fbe14884a65323211ff0", // 철원군유도 발전과정 : 개인생애사를 중심으로
]);

const ALLOWED_JOURNALS = new Set(["구술사연구", "한국구술사학회 학술대회"]);

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

// 상세페이지에서 주제어(한글만)·권호사항(학술논문)·riss.kr/link 영구링크를 추출한다.
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

  const volumeIssue = item.kind === "학술논문" ? parseVolumeIssue(html) : "";

  return { rissUrl, keywords, volumeIssue };
}

function loadExisting() {
  if (!existsSync(RISS_PAPERS_CSV_PATH)) return new Map();
  const rows = readRissPapersCsv();
  return new Map(rows.map((r) => [r.paper_id, r]));
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
      if (MANUALLY_EXCLUDED_CONTROL_NOS.has(item.controlNo)) continue;
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
      volume_issue: detail.volumeIssue,
      degree_level: item.degreeLevel,
      keywords: detail.keywords.join(";"),
      riss_url: detail.rissUrl,
    });
    // 중간 저장 — 중단돼도 이어서 진행 가능하게
    writeRissPapersCsv(existing.values());
  }

  writeRissPapersCsv(existing.values());
  console.log(`\n완료: data/riss-papers.csv에 총 ${existing.size}건 기록됨`);
}

main().catch((err) => {
  console.error("스크래핑 실패:", err);
  process.exit(1);
});
