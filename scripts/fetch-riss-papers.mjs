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
// - 학술논문: "구술사" + "구술생애사" + "생애사" 정확검색 합집합 중 제목에 "구술"이나 "생애사"가
//   들어가고 발행 학술지·학회가 인문학·사회과학·복합학 계열인 것 (아래 isCollectedArticle 참고)
//   — "생애사" 단독은 학위논문 쪽엔 안 붙인다(사회복지·평생교육 등 다른 분야로 너무 넓게 퍼져
//   노이즈가 큼, 2026-07-25 사용자와 합의)

import { existsSync } from "node:fs";
import { politeFetch, parseListItems, parseVolumeIssue, stripTags } from "./lib/riss-http.mjs";
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

// 2026-08-19까지 학술논문은 이 두 발행물만 받았다. 이제는 조건을 통과 못 해도 무조건 넣는
// "구술사 전문지" 목록으로 남는다 — 제목에 구술·생애사가 없는 방법론 논문도 여기 실린 건 다 받는다.
// 2026-08-19에 과거분 수집을 한 번에 끝냈다. 그 뒤로 매주 도는 자동 수집(weekly-research-sync.sh)은
// 새로 발간된 것만 받으면 되므로, 이 연도보다 오래된 논문은 아예 상세페이지를 요청하지 않는다.
// - 이미 data/riss-papers.csv에 있는 논문은 이 값과 무관하게 그대로 남는다(버리는 장치가 아니다).
// - 대신 RISS 색인이 늦어 예전 논문이 뒤늦게 검색에 뜨는 경우는 이 컷에 걸려 안 들어온다.
//   과거분을 다시 훑고 싶으면 이 값을 낮춰서 한 번 돌리면 된다.
const MIN_PUBLICATION_YEAR = 2026;

const ALWAYS_ALLOWED_JOURNALS = new Set(["구술사연구", "한국구술사학회 학술대회"]);

// 학술논문 수집 범위를 위 두 발행물 밖으로 넓히면서 붙인 분야 제한(2026-08-19 사용자와 합의).
// 원래는 DBpia의 주제분류(인문학·사회과학·복합학) 필터를 쓰려 했으나 DBpia 검색 API가 일회성
// 토큰을 요구해 자동 수집이 막혔고(docs/archives.md 참고), RISS 목록에는 주제분류가 없어서
// 발행 학술지·학회 이름으로 예술체육·의약학·공학·종교 계열을 걸러내는 방식으로 대신한다.
const JOURNAL_FIELD_BLOCKLIST = [
  "체육", "스포츠", "무용", "태권도", "골프", "무도", "레저", "여가",
  "신학", "선교", "목회", "교회", "종교", "기독", "불교", "가톨릭",
  "간호", "의학", "재활", "치의학", "한의", "약학", "수의",
  "공학", "건축", "디자인", "미술",
];

// 학술논문을 수집 대상으로 볼지 판정한다. RISS 정확검색은 제목뿐 아니라 초록·주제어까지 걸리므로,
// DBpia의 "논문명" 검색에 해당하는 좁힘(제목 조건)을 여기서 따로 건다.
function isCollectedArticle(item) {
  if (ALWAYS_ALLOWED_JOURNALS.has(item.journalName)) return true;
  if (!/구술|생애사/.test(item.title)) return false;
  const field = `${item.journalName} ${item.institution}`;
  return !JOURNAL_FIELD_BLOCKLIST.some((word) => field.includes(word));
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
      // 연도를 못 읽은 건(year === null)은 컷에 안 걸리게 둔다 — 몰라서 버리는 것보다 받아서
      // 화면에서 쳐내는 편이 낫다.
      if (item.year !== null && item.year < MIN_PUBLICATION_YEAR) continue;
      if (item.kind === "학위논문") {
        if (isExcludedInstitution(item.institution)) continue;
        theses.set(item.controlNo, item);
      } else {
        if (!isCollectedArticle(item)) continue;
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
