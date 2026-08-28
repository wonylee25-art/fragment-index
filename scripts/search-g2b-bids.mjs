// 나라장터(조달청) 입찰공고정보서비스에서 "구술"·"채록" 같은 낱말이 든 용역 공고를 훑는다.
// 실행: node --env-file=.env.local scripts/search-g2b-bids.mjs [낱말...] [--months=12]
//
// 왜 필요한가: 기관 소개 페이지는 "구술채록을 한다"까지만 말하고, **누가 얼마에 어떤 절차로
// 채록하는지는 발주 공고에만 적힌다.** 실제로 대전문화재단 원로예술인 구술채록사업은 재단 사업
// 소개가 아니라 수행단체 공모 공고에서 찾았고, 대통령기록관·한국영상자료원의 채록 인력도
// 입찰공고로 메워졌다(docs/oral_history_projects.md의 8-9 참고). 일반 검색엔진은 조달 포털
// 색인이 얕아 잘 안 걸리므로 API로 직접 훑는다.
//
// 결과는 자동으로 문서에 반영되지 않는다 — 사람이 눈으로 보고 새 계열인지, 이미 있는 계열의
// 빈칸인지 가려서 직접 옮겨 적는다(match-museum-relics.mjs와 같은 원칙).
//
// 먼저 볼 것: 활용신청 승인을 기다리는 동안에는 조달청 발주계획·입찰공고를 그대로 옮겨 싣는
// 민간 사이트에서 제목 검색이 그대로 먹는다(씬디스 seenthis.kr/bidplan?sfl=wr_subject&stx=구술채록,
// 입찰공고는 seenthis.kr/bid — **두 게시판이 따로다. 중앙조달 건은 발주계획 쪽에 안 실리므로 둘 다 봐야 한다**).
// 2026-08-27에 그 방법으로 21건을 건졌고, 같은 날 2차로 낱말을 넓혀 300여 건을 훑었다 — 다만 미러는
// **2024년 12월이 바닥이라**(실측), 그 이전까지 훑으려면 이 스크립트가 필요하다.
//
// **2020~2024년은 다른 창구로 이미 뚫었다.** PRISM(정책연구관리시스템)이 연도 제한 없이 열려 있고,
// 지자체 정책연구용역이 여기 쌓인다 — 나라장터와 비추는 기관이 다르다(광주광역시·인천광역시 등은
// 나라장터에 없고 PRISM에만 있다). API는 POST https://api.prism.go.kr/prism-be-prtl/search/totalSearch.do,
// body {"query":"구술","collection":"task_inform","startCount":0,"listCount":300}.
// 자세한 건 docs/oral_history_projects.md 8-9의 3차 조사 절. 이 스크립트가 아직 필요한 자리는
// **나라장터에만 있는 2024년 이전 사업 용역**(예: 국가기록원이 성공회대에 준 2014·2016·2018년 발주)이다.
//
// **PRISM은 낱말을 넓히면 2002년까지 내려간다**(2026-08-28 4차 조사). `기록화`·`마을기록`·`생활사`·
// `구술사`·`시사편찬`·`아카이브`·`녹취`를 더해 훑으니 안산 2017 반월·시화 산단 구술채록(40명 60시간),
// 부산 마을 계열의 2014년 시작, 국가기록원 2007·2008년 용역이 나왔다 — 3차에서 "2020~2024년 33건"이라
// 적은 것은 낱말이 넷일 때의 수치다.
//
// **그리고 창구는 조달·정책연구용역 말고 하나 더 있다 — 남이 이미 조사해 둔 표.** 국립중앙도서관
// 「구술자료 수집 타당성 및 제도개선 방안 연구」(2019) §2.2.3에 국편·한국구술사연구소의 2018년
// 47기관 현황표가 통째로 실려 있고, 거기서 울산·청주·전주·수원·충북여성재단·독립기념관·국가기록원이
// 한꺼번에 풀렸다(8-9의 4차 조사 절). 기관을 두드리기 전에 그 기관들을 훑은 보고서를 먼저 찾는다.
//
// **낱말 하나가 사업 하나를 가린다.** 기본 낱말이 다섯인 이유다 — "구술채록"만 걸면
// 국방부 군사편찬연구소의 「해외파병장병 **증언청취**」, 국가기록원의 「**구술기록물 등록**사업」,
// 통일부의 「탈북민 경험(**생애사**) 구술채록」, 국가유산청의 「전승자 **구술자서전 발간**」,
// 민주화운동기념사업회의 「구술 **사료 수집** 사업」이 전부 안 걸린다(docs/oral_history_projects.md
// 8-9의 2차 조사 절).
//
// 키: data.go.kr 일반 인증키(Decoding). "조달청_나라장터 입찰공고정보서비스"(15129394)에
// 활용신청이 승인돼 있어야 한다 — 승인이 없으면 SERVICE_KEY_IS_NOT_REGISTERED_ERROR가 온다.
// .env.local에 G2B_API_KEY로 넣거나, 이미 있는 data.go.kr 키를 그대로 쓴다.
//
// curl을 쓰는 이유는 match-museum-relics.mjs와 같다 — data.go.kr 게이트웨이가 Node의
// fetch(undici)를 TLS 지문으로 걸러 차단 페이지를 돌려주는 일이 있다.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BASE = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";
// 용역(getBidPblancListInfoServc)만 훑는다. 구술채록은 물품·공사로 나가지 않는다.
const OPERATION = "getBidPblancListInfoServc";

const key = process.env.G2B_API_KEY ?? process.env.NATIONAL_ARCHIVES_API_KEY ?? process.env.NATIONAL_MUSEUM_API_KEY;
if (!key) {
  console.error("G2B_API_KEY가 없습니다. .env.local에 넣고 --env-file=.env.local로 실행하세요.");
  process.exit(1);
}

const args = process.argv.slice(2);
const monthsArg = args.find((a) => a.startsWith("--months="));
const months = monthsArg ? Number(monthsArg.slice("--months=".length)) : 12;
const words = args.filter((a) => !a.startsWith("--"));
const KEYWORDS = words.length ? words : ["구술", "채록", "생애사", "증언", "기록화"];

// API가 한 번에 받는 조회 기간이 제한적이라(공고게시일시 기준) 한 달씩 끊어 훑는다.
function monthRanges(count) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59);
    const begin = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0);
    out.push([stamp(begin), stamp(end)]);
  }
  return out;
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

async function fetchPage({ begin, end, keyword, pageNo }) {
  const params = new URLSearchParams({
    serviceKey: key,
    type: "json",
    numOfRows: "100",
    pageNo: String(pageNo),
    inqryDiv: "1", // 1 = 공고게시일시 기준
    inqryBgnDt: begin,
    inqryEndDt: end,
    bidNtceNm: keyword,
  });
  const { stdout } = await execFileAsync("curl", ["-s", "-m", "60", `${BASE}/${OPERATION}?${params}`], {
    maxBuffer: 32 * 1024 * 1024,
  });
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    // 차단 페이지 등은 HTML로 온다. 원문을 그대로 보여주는 편이 낫다.
    throw new Error(`JSON이 아닌 응답:\n${stdout.slice(0, 600)}`);
  }
  // 게이트웨이 오류는 HTTP 200 + 정상 JSON 껍데기로 온다. 이걸 안 가리면 "0건"으로 조용히
  // 끝나버려서, 키가 없는 것과 정말 공고가 없는 것이 구별되지 않는다.
  const err = payload?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (err) throw new FatalApiError(`${err.errMsg} — ${err.returnAuthMsg}`);
  return payload;
}

// 키·서비스 문제는 낱말을 바꿔 다시 물어도 똑같이 실패하므로 즉시 멈춘다.
class FatalApiError extends Error {}

function rowsOf(payload) {
  const body = payload?.response?.body;
  if (!body) return [];
  const items = body.items;
  if (!items) return [];
  return Array.isArray(items) ? items : (items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : []);
}

const seen = new Map();
for (const keyword of KEYWORDS) {
  for (const [begin, end] of monthRanges(months)) {
    let pageNo = 1;
    for (;;) {
      let payload;
      try {
        payload = await fetchPage({ begin, end, keyword, pageNo });
      } catch (err) {
        if (err instanceof FatalApiError) {
          console.error(`\n나라장터 API가 거절했습니다 — ${err.message}`);
          if (err.message.includes("SERVICE_KEY_IS_NOT_REGISTERED")) {
            console.error("키 값 자체는 멀쩡해도 이 서비스에 활용신청이 승인돼 있어야 합니다.");
            console.error("data.go.kr에서 \"조달청_나라장터 입찰공고정보서비스\"(15129394) 활용신청 후 다시 실행하세요.");
          }
          process.exit(1);
        }
        console.error(`  ! ${keyword} ${begin.slice(0, 6)} 요청 실패 — ${err.message}`);
        break;
      }
      const rows = rowsOf(payload);
      for (const r of rows) {
        const name = r.bidNtceNm ?? "";
        if (!KEYWORDS.some((w) => name.includes(w))) continue; // API 검색이 느슨할 때를 대비한 재확인
        const id = `${r.bidNtceNo}-${r.bidNtceOrd}`;
        if (!seen.has(id)) seen.set(id, r);
      }
      const total = Number(payload?.response?.body?.totalCount ?? 0);
      if (rows.length === 0 || pageNo * 100 >= total) break;
      pageNo += 1;
    }
  }
}

const found = [...seen.values()].sort((a, b) => String(b.bidNtceDt).localeCompare(String(a.bidNtceDt)));
console.log(`\n낱말 ${KEYWORDS.join("·")} · 최근 ${months}개월 · 용역 공고 ${found.length}건\n`);
for (const r of found) {
  const budget = r.asignBdgtAmt ? `${Number(r.asignBdgtAmt).toLocaleString("ko-KR")}원` : "예산 미표시";
  console.log(`${r.bidNtceDt ?? ""}  ${r.bidNtceNm}`);
  console.log(`  수요기관 ${r.dminsttNm ?? "미표시"} · 공고기관 ${r.ntceInsttNm ?? "미표시"} · ${budget}`);
  if (r.bidNtceDtlUrl) console.log(`  ${r.bidNtceDtlUrl}`);
  console.log("");
}
