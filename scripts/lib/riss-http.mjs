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
