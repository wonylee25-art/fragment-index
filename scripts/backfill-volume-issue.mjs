// volume_issue 필드 도입(2026-07-25) 이전에 npm run fetch:riss로 이미 수집된 학술논문에
// 권호사항을 보충한다. data/riss-papers.csv를 그 자리에서 갱신 — 이미 volume_issue가 있는
// 행(재실행 시 이전 진행분)은 건너뛰어 중단돼도 이어서 돌릴 수 있다.
// 실행: node scripts/backfill-volume-issue.mjs
//
// robots.txt Crawl-delay: 10을 지켜 상세페이지 요청 사이 10초씩 기다린다(archives.md "RISS" 참고).

import { existsSync } from "node:fs";
import { politeFetch, parseVolumeIssue } from "./lib/riss-http.mjs";
import { RISS_PAPERS_CSV_PATH, readRissPapersCsv, writeRissPapersCsv } from "./lib/riss-papers-csv.mjs";

async function main() {
  if (!existsSync(RISS_PAPERS_CSV_PATH)) {
    console.error(`${RISS_PAPERS_CSV_PATH} 없음`);
    process.exit(1);
  }
  const rows = readRissPapersCsv();

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
    writeRissPapersCsv(rows); // 중간 저장 — 중단돼도 이어서 진행 가능
  }

  writeRissPapersCsv(rows);
  console.log(`\n완료. npm run sync으로 Supabase에 반영하세요.`);
}

main().catch((err) => {
  console.error("백필 실패:", err);
  process.exit(1);
});
