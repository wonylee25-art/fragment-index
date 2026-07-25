"use server";

import { spawn } from "node:child_process";

// "연구 동향" 화면의 새로고침 버튼. scripts/fetch-riss-papers.mjs는 이미 처리된 논문(paper_id)은
// 건너뛰는 재실행 가능한 스크립트라(scripts/fetch-riss-papers.mjs 상단 주석 참고), 매번 전체를
// 다시 긁지 않고 "그 사이 RISS에 새로 올라온 논문"만 상세페이지를 가져온다 — 그래서 보통은
// 목록 조회(몇 분)만으로 끝나고, 새 논문이 있을 때만 건당 10초(robots.txt crawl-delay)가 붙는다.
//
// 요청-응답 주기 안에서 끝내기엔 최악의 경우(논문이 아주 많이 새로 나온 경우) 너무 오래 걸릴 수 있어
// 백그라운드 프로세스로 띄우고 즉시 반환한다 — 끝나는 시점은 화면의 "최신화: ~ 기준" 표시로 확인한다.
export async function refreshResearchData() {
  const child = spawn("sh", ["-c", "npm run fetch:riss && npm run sync"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
