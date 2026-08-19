// RISS(riss.kr) 크롤링 공통 유틸 — scripts/fetch-riss-papers.mjs, scripts/backfill-volume-issue.mjs가
// 공통으로 쓴다. robots.txt의 "Crawl-delay: 10"을 지키기 위해 요청 사이 10초를 기다린다.

const CRAWL_DELAY_MS = 10_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;
export async function politeFetch(url) {
  const wait = CRAWL_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#0*34;/g, '"')
    .replace(/&apos;|&#0*39;/g, "'")
    .replace(/&#0*46;/g, ".")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

// 상세페이지의 "권호사항" 필드("Vol.25 No.1 [1988]" 형태)를 koanth.org 인용 형식의
// 권(호) 표기("25(1)")로 변환한다. 호가 없으면("No.-") 권만 반환.
export function parseVolumeIssue(html) {
  const idx = html.indexOf("권호사항");
  if (idx === -1) return "";
  const aStart = html.indexOf("<a", idx);
  const aEnd = html.indexOf("</a>", aStart);
  if (aStart === -1 || aEnd === -1) return "";
  const text = stripTags(html.slice(aStart, aEnd));
  const volMatch = text.match(/Vol\.(\S+)/);
  const noMatch = text.match(/No\.(\S+)/);
  const vol = volMatch ? volMatch[1] : "";
  const no = noMatch ? noMatch[1] : "";
  if (!vol) return "";
  if (!no || no === "-") return vol;
  return `${vol}(${no})`;
}

// 검색결과 목록 HTML에서 <li>...</li> 항목들을 파싱한다.
export function parseListItems(html, kind) {
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
