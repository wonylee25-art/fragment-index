// volume_issue 필드 도입(2026-07-25) 이전에 npm run fetch:riss로 이미 수집된 학술논문에
// 권호사항을 보충한다. data/riss-papers.csv를 그 자리에서 갱신 — 이미 volume_issue가 있는
// 행(재실행 시 이전 진행분)은 건너뛰어 중단돼도 이어서 돌릴 수 있다.
// 실행: node scripts/backfill-volume-issue.mjs
//
// robots.txt Crawl-delay: 10을 지켜 상세페이지 요청 사이 10초씩 기다린다(archives.md "RISS" 참고).

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CRAWL_DELAY_MS = 10_000;
const CSV_PATH = "data/riss-papers.csv";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

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

function parseVolumeIssue(html) {
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

// ---------- CSV I/O (scripts/fetch-riss-papers.mjs와 같은 RFC4180 파서) ----------
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

const HEADER = ["paper_id", "type", "title", "author", "year", "institution", "journal", "volume_issue", "degree_level", "keywords", "riss_url"];

function writeCsv(rows) {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(HEADER.map((h) => csvCell(r[h])).join(","));
  }
  writeFileSync(CSV_PATH, lines.join("\n") + "\n", "utf-8");
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`${CSV_PATH} 없음`);
    process.exit(1);
  }
  const rows = parseCsv(readFileSync(CSV_PATH, "utf-8"));

  const targets = rows.filter((r) => r.type === "학술논문" && !r.volume_issue && r.riss_url);
  console.log(`대상: 학술논문 ${rows.filter((r) => r.type === "학술논문").length}건 중 권호사항 미보충 ${targets.length}건`);

  let done = 0;
  for (const r of targets) {
    done++;
    console.log(`[${done}/${targets.length}] ${r.title}`);
    try {
      const html = await politeFetch(r.riss_url);
      r.volume_issue = parseVolumeIssue(html) || "-"; // 필드 자체가 없는 논문도 있음 — 재실행마다 다시 시도하지 않게 "-"로 표시
    } catch (err) {
      console.warn(`  실패, 건너뜀: ${err.message}`);
      continue;
    }
    writeCsv(rows); // 중간 저장 — 중단돼도 이어서 진행 가능
  }

  writeCsv(rows);
  console.log(`\n완료. npm run sync으로 Supabase에 반영하세요.`);
}

main().catch((err) => {
  console.error("백필 실패:", err);
  process.exit(1);
});
