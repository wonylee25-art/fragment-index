// data/riss-papers.csv(scripts/fetch-riss-papers.mjs가 생성, scripts/backfill-volume-issue.mjs가
// 보충, scripts/sync-csv.mjs가 읽어감) 스키마를 공통으로 다루는 읽기/쓰기 헬퍼.

import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv, csvCell } from "./csv.mjs";

export const RISS_PAPERS_CSV_PATH = "data/riss-papers.csv";

const HEADER = ["paper_id", "type", "title", "author", "year", "institution", "journal", "volume_issue", "degree_level", "keywords", "riss_url"];

export function readRissPapersCsv(path = RISS_PAPERS_CSV_PATH) {
  return parseCsv(readFileSync(path, "utf-8"));
}

// rows는 배열이든 Map#values()든 상관없다(둘 다 이터러블).
export function writeRissPapersCsv(rows, path = RISS_PAPERS_CSV_PATH) {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(HEADER.map((h) => csvCell(r[h])).join(","));
  }
  writeFileSync(path, lines.join("\n") + "\n", "utf-8");
}
