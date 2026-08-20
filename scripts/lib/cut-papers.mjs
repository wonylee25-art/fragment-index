// 쳐낸 논문 명부 — 다시 긁어오지 않을 RISS 등록번호(control_no)를 모아 둔다.
//
// 두 곳에서 적힌다.
// 1. 화면에서 손으로 쳐낸 것 — papers.hidden_at(paper-actions.hidePaper). npm run dump:cut이
//    DB에서 읽어 이 파일로 옮긴다.
// 2. 수집 규칙이 거른 것 — fetch-riss-papers.mjs가 상세페이지 주제어를 보고 버릴 때 적는다.
//    적어 두지 않으면 다음 실행 때 CSV에 없다는 이유로 상세페이지를 또 요청한다(건당 10초).
//
// 되살리려면 이 파일에서 해당 줄을 지우면 된다 — 다음 수집 때 다시 들어온다.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CUT_PAPERS_PATH = fileURLToPath(new URL("../../data/cut-papers.json", import.meta.url));

export function readCutPapers() {
  if (!existsSync(CUT_PAPERS_PATH)) return {};
  return JSON.parse(readFileSync(CUT_PAPERS_PATH, "utf-8"));
}

// 제목을 함께 적는 건 사람이 읽고 되살릴 판단을 하기 위해서다 — 등록번호만 있으면 무엇을
// 막고 있는지 알 수 없다.
export function writeCutPapers(entries) {
  const sorted = Object.fromEntries(
    Object.entries(entries).sort((a, b) => (a[1].title ?? "").localeCompare(b[1].title ?? "", "ko")),
  );
  writeFileSync(CUT_PAPERS_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");
}
