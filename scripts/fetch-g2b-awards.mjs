// 나라장터(조달청) 낙찰정보서비스에서 "구술"·"채록" 같은 낱말이 든 용역의 개찰·낙찰 결과를 훑는다.
// 실행: node --env-file=.env.local scripts/fetch-g2b-awards.mjs [낱말...] [--months=20] [--json]
//
// 짝: search-g2b-bids.mjs는 **공고**(누가 얼마에 뭘 발주했나)를, 이 스크립트는 그 공고의
// **결과**(누가 얼마에 땄나·유찰됐나)를 훑는다. docs/oral_history_bids.md의 입찰 표는 "담당자"
// 칸까지만 차 있고 낙찰자 칸이 비어 있는데, 그 칸을 메우는 자료가 여기서 나온다.
//
// 서비스: "조달청_나라장터 낙찰정보서비스"(공공데이터포털 15129397), /1230000/as/ScsbidInfoService.
// 활용신청 승인이 있어야 한다 — 없으면 SERVICE_KEY_IS_NOT_REGISTERED_ERROR. 키는 입찰공고정보서비스와
// 같은 data.go.kr 일반 인증키를 쓴다(scripts/lib/g2b.mjs의 resolveKey).
//
// 두 오퍼레이션을 같이 부른다:
//   getScsbidListSttusServcPPSSrch    낙찰현황(용역) — 낙찰업체·대표자·낙찰금액·낙찰률·참여업체수
//   getOpengResultListInfoServcPPSSrch 개찰결과(용역) — 진행상태(유찰/개찰완료/재입찰)
// **반드시 PPSSrch(조달청 통합검색) 쪽을 쓴다.** 접미사 없는 …Servc 는 bidNtceNm 검색어를 무시하고
// 전 부처 용역을 다 돌려준다(한 달 1만~2만 건). PPSSrch는 검색어가 먹어 한 달 5~10건으로 좁혀진다.
// opengCorpInfo 필드는 참여업체 전체가 아니라 **낙찰업체 한 곳**만 담는다("업체명^사업자번호^대표자^금액^순위").
// 참여업체 명단·투찰금액 순위는 이 목록 API에 없다 — 나라장터 본화면 「개찰결과분류조회」를 봐야 한다.
//
// inqryDiv=1은 **등록일시** 기준이고 낙찰 결과는 개찰 뒤 며칠~몇 주 지나 등록된다. 그래서 개찰월이
// 아니라 넉넉한 기간(기본 20개월)을 훑어야 봄에 개찰한 건까지 빠짐없이 잡힌다.
//
// 결과는 문서에 자동 반영하지 않는다(search-g2b-bids.mjs·match-museum-relics.mjs와 같은 원칙).
// 사람이 보고 대장(oral_history_bids.md)의 빈 칸을 채우거나 새 계열인지 가린다. 대장에 이미 있는
// 공고번호는 ★, 처음 보는 것은 ＋로 표시한다.

import { readFileSync } from "node:fs";
import { resolveKey, parseArgs, sweep } from "./lib/g2b.mjs";

const BASE = "https://apis.data.go.kr/1230000/as/ScsbidInfoService";
const key = resolveKey();
const { months, keywords, flags } = parseArgs(process.argv.slice(2), { defaultMonths: 20 });
const asJson = flags.has("--json");

const keep = (r) => keywords.some((w) => (r.bidNtceNm ?? "").includes(w));
const onFatal = (err) => {
  console.error(`\n나라장터 낙찰정보 API가 거절했습니다 — ${err.message}`);
  if (err.message.includes("NOT_REGISTERED")) {
    console.error('data.go.kr에서 "조달청_나라장터 낙찰정보서비스"(15129397) 활용신청 후 다시 실행하세요.');
  }
};

// 대장에 이미 실린 공고번호 (docs/oral_history_bids.md 의 bidPbancNo= 링크에서 뽑는다)
function knownBidNos() {
  try {
    const md = readFileSync(new URL("../docs/oral_history_bids.md", import.meta.url), "utf8");
    return new Set([...md.matchAll(/bidPbancNo=([A-Za-z0-9]+)/g)].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

const winners = await sweep({ base: BASE, operation: "getScsbidListSttusServcPPSSrch", key, keywords, months, keep, onFatal });
const openings = await sweep({ base: BASE, operation: "getOpengResultListInfoServcPPSSrch", key, keywords, months, keep, onFatal });

// 두 결과를 공고번호-차수로 합친다.
const merged = new Map();
for (const [id, r] of winners) merged.set(id, { ...r });
for (const [id, r] of openings) merged.set(id, { ...(merged.get(id) ?? {}), ...r });

// 낙찰현황에 없고 개찰결과에만 있는 건은 opengCorpInfo에서 낙찰업체를 뽑아 채운다.
for (const r of merged.values()) {
  if (!r.bidwinnrNm && r.opengCorpInfo && r.opengCorpInfo.includes("^")) {
    const [nm, bizno, ceo, amt] = r.opengCorpInfo.split("^");
    Object.assign(r, { bidwinnrNm: nm, bidwinnrBizno: bizno, bidwinnrCeoNm: ceo, sucsfbidAmt: r.sucsfbidAmt || amt });
  }
}

const known = knownBidNos();
const rows = [...merged.values()].sort((a, b) =>
  String(b.rlOpengDt ?? b.opengDt ?? "").localeCompare(String(a.rlOpengDt ?? a.opengDt ?? "")),
);

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

// 금액을 대장 표기(억·만)에 맞춘다. 89,450,000 → "8,945만", 646,800,000 → "6억 4,680만".
function won(n) {
  if (n === undefined || n === null || n === "") return "";
  const man = Math.round(Number(n) / 1e4);
  const eok = Math.floor(man / 1e4);
  const rest = man % 1e4;
  if (eok && rest) return `${eok}억 ${rest.toLocaleString("ko-KR")}만`;
  if (eok) return `${eok}억`;
  return `${rest.toLocaleString("ko-KR")}만`;
}

const inLedger = rows.filter((r) => known.has(r.bidNtceNo)).length;
const failed = rows.filter((r) => (r.progrsDivCdNm ?? "").includes("유찰")).length;

console.log(`\n낱말 ${keywords.join("·")} · 최근 ${months}개월(등록일 기준) · 개찰·낙찰 ${rows.length}건`);
console.log(`★ 대장에 있는 공고 ${inLedger} · ＋ 대장에 없는 공고 ${rows.length - inLedger} · 유찰 ${failed}\n`);
console.log("| 개찰 | 공고번호 | 공고명 | 참여 | 진행 | 낙찰업체(대표) | 낙찰금액 | 낙찰률 | 대장 |");
console.log("|---|---|---|--:|---|---|--:|--:|:-:|");
for (const r of rows) {
  const openg = String(r.rlOpengDt ?? r.opengDt ?? "").slice(0, 10);
  const no = `${r.bidNtceNo}-${r.bidNtceOrd}`;
  const status = r.progrsDivCdNm ?? (r.bidwinnrNm ? "개찰완료" : "");
  const winner = r.bidwinnrNm ? `${r.bidwinnrNm}${r.bidwinnrCeoNm ? `(${r.bidwinnrCeoNm})` : ""}` : "";
  const rate = r.sucsfbidRate ? `${r.sucsfbidRate}%` : "";
  const mark = known.has(r.bidNtceNo) ? "★" : "＋";
  const name = (r.bidNtceNm ?? "").replace(/\s+/g, " ").trim();
  console.log(`| ${openg} | ${no} | ${name} | ${r.prtcptCnum ?? ""} | ${status} | ${winner} | ${won(r.sucsfbidAmt)} | ${rate} | ${mark} |`);
}
