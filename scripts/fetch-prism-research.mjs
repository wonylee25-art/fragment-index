// PRISM(정책연구관리시스템) 정책연구 과제에서 구술 관련 과제를 뽑는다.
// 실행: node --env-file=.env.local scripts/fetch-prism-research.mjs [낱말...] [--from=2007] [--to=2026] [--rows=1000] [--refresh]
//
// API는 「행정안전부_정책연구 과제정보」(data.go.kr 15080254), 게이트웨이는
// apis.data.go.kr/1741000/prism_v2. 행안부는 PRISM 운영주체일 뿐이고 자료는 등록된 전 기관 과제다.
//
// **낱말 검색 파라미터가 없다.** getResearchList_v2가 받는 것은 기관코드와 연구기간뿐이라,
// 기간으로 전량을 훑어 내려받은 뒤 과제명을 이쪽에서 거른다. 그래서 호출이 많이 든다 —
// 개발계정 하루 1,000건 제한에 걸리기 쉬우므로 목록은 data/raw/prism-research-list.json에
// 캐시해 두고, 다시 돌릴 때는 캐시를 쓴다(--refresh로 다시 받는다).
//
// 계약금액·수행연구원·계약방식은 목록에 없고 getResearchDetail_v2에만 있다. 그래서
// 제목이 걸린 것만 골라 상세를 한 번 더 부른다(걸린 건수만큼 호출이 는다).
//
// curl을 쓰는 이유는 scripts/lib/g2b.mjs와 같다 — data.go.kr 게이트웨이가 Node fetch를
// TLS 지문으로 걸러 차단 페이지를 돌려주는 일이 있다.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataGoKrKey } from "./lib/data-go-kr.mjs";

const execFileAsync = promisify(execFile);

const BASE = "https://apis.data.go.kr/1741000/prism_v2";
const CACHE = path.join("data", "raw", "prism-research-list.json");
const OUT = path.join("data", "raw", "prism-research.json");

// 나라장터 쪽 다섯과 달리 셋만 쓴다 — 「증언」·「기록화」는 정책연구 과제명에서
// 법정 증언·전산화 사업을 대량으로 끌고 들어온다.
const DEFAULT_KEYWORDS = ["구술", "채록", "생애사"];

function resolveKey() {
  const key = dataGoKrKey();
  if (!key) {
    console.error("DATA_GO_KR_API_KEY가 비어 있습니다. .env.local의 값을 채우고 --env-file=.env.local로 실행하세요.");
    process.exit(1);
  }
  return key;
}

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const words = argv.filter((a) => !a.startsWith("--"));
const keywords = words.length ? words : DEFAULT_KEYWORDS;
const fromYear = Number(flag("from", 2007));
const toYear = Number(flag("to", new Date().getFullYear()));
const rows = flag("rows", "1000");
const refresh = argv.includes("--refresh");

let calls = 0;

async function call(operation, params) {
  const url = `${BASE}/${operation}?${new URLSearchParams(params)}`;
  calls += 1;
  const { stdout } = await execFileAsync("curl", ["-s", "-m", "120", url], { maxBuffer: 128 * 1024 * 1024 });
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`JSON이 아닌 응답:\n${stdout.slice(0, 600)}`);
  }
  // 게이트웨이 오류는 HTTP 200 + 정상 JSON 껍데기로 온다(키 없음·활용신청 전 등).
  const gate = payload?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (gate) {
    console.error(`\n나라 게이트웨이가 거절했습니다 — ${gate.errMsg} (${gate.returnAuthMsg})`);
    if (String(gate.errMsg).includes("NOT_REGISTERED")) {
      console.error("공공데이터포털 15080254에서 활용신청(자동승인) 여부를 확인하세요.");
    }
    if (String(gate.errMsg).includes("IS_NULL")) {
      console.error(".env.local의 DATA_GO_KR_API_KEY 값이 비어 있는지 확인하세요.");
    }
    process.exit(1);
  }
  const body = payload?.response ?? payload;
  const code = String(body?.resultCode ?? body?.header?.resultCode ?? "00");
  if (code !== "00" && code !== "0") {
    throw new Error(`${code} ${body?.resultMsg ?? body?.header?.resultMsg ?? ""}`);
  }
  return body;
}

// 명세는 research를 객체로 적어 두었지만 실제로는 건수에 따라 객체 하나이거나 배열이다.
function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// 연구기간으로 한 해씩 끊어 전량을 훑는다. 한 해 안에서 페이지를 넘긴다.
async function sweepList() {
  const key = resolveKey();
  const all = new Map();
  for (let year = toYear; year >= fromYear; year--) {
    let pageNo = 1;
    for (;;) {
      let body;
      try {
        body = await call("getResearchList_v2", {
          serviceKey: key,
          start_date: `${year}0101`,
          end_date: `${year}1231`,
          numOfRows: rows,
          pageNo: String(pageNo),
        });
      } catch (err) {
        console.error(`  ! ${year}년 p${pageNo} 실패 — ${err.message}`);
        break;
      }
      const items = asArray(body?.research);
      for (const item of items) {
        if (item?.research_id) all.set(String(item.research_id), item);
      }
      const total = Number(body?.totalCount ?? 0);
      process.stdout.write(`\r  ${year}년 p${pageNo} — ${items.length}건 (누적 ${all.size})    `);
      if (items.length === 0 || pageNo * Number(rows) >= total) break;
      pageNo += 1;
    }
  }
  process.stdout.write("\n");
  return [...all.values()];
}

async function loadList() {
  if (!refresh) {
    try {
      const cached = JSON.parse(await readFile(CACHE, "utf8"));
      if (Array.isArray(cached) && cached.length) {
        console.log(`목록 캐시 ${cached.length}건을 씁니다 (${CACHE}). 다시 받으려면 --refresh.`);
        return cached;
      }
    } catch {
      // 캐시가 없으면 그냥 받는다.
    }
  }
  console.log(`목록을 받습니다 — ${fromYear}~${toYear}년, 한 쪽 ${rows}건.`);
  const list = await sweepList();
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(list, null, 2));
  console.log(`목록 ${list.length}건을 ${CACHE}에 담았습니다.`);
  return list;
}

function matched(item) {
  const title = String(item?.research_name ?? "");
  return keywords.filter((word) => title.includes(word));
}

async function main() {
  const key = resolveKey();
  const list = await loadList();
  const hits = list
    .map((item) => ({ item, hit: matched(item) }))
    .filter(({ hit }) => hit.length > 0);
  console.log(`\n과제명에 ${keywords.join("·")}가 걸린 것 — ${hits.length}건 / 전체 ${list.length}건`);

  const out = [];
  for (const [i, { item, hit }] of hits.entries()) {
    process.stdout.write(`\r  상세 ${i + 1}/${hits.length}    `);
    let detail = null;
    try {
      detail = await call("getResearchDetail_v2", { serviceKey: key, research_id: item.research_id });
    } catch (err) {
      console.error(`\n  ! ${item.research_id} 상세 실패 — ${err.message}`);
    }
    const contract = asArray(detail?.contract)[0] ?? {};
    const research = asArray(detail?.research)[0] ?? {};
    const report = asArray(detail?.reportInfo)[0] ?? {};
    out.push({
      research_id: item.research_id,
      title: item.research_name,
      // 목록의 organ_name은 발주처(등록 기관)이고, 수행기관은 계약정보 쪽에 있다.
      ordering_agency: item.organ_name ?? research.organ_name ?? null,
      // research_organName은 명세에 없지만 목록 응답에 실제로 온다 — 수행기관 이름이라 그대로 받는다.
      performer_name: item.research_organName ?? null,
      performer_id: contract.research_organ_id ?? null,
      performer_type: contract.research_organ_type_name ?? null,
      researcher: contract.researcher_name ?? item.researcher_name ?? null,
      contract_date: contract.contract_date ?? null,
      contract_type: contract.contract_type_name ?? null,
      contract_cost: contract.contract_cost ?? null,
      period_start: research.research_start_date ?? null,
      period_end: research.research_end_date ?? null,
      research_year: item.research_date ?? null,
      issued_year: item.issued_year ?? report.issuedYear ?? null,
      field: research.brm_biz_name ?? item.biz_name ?? null,
      outline: research.research_outline ?? null,
      abstract: report.summary ?? null,
      keyword: report.keyword ?? null,
      report_open: item.report_open_yn ?? null,
      report_files: asArray(report.url).map((f) => ({
        name: f?.file_name ?? null,
        url: f?.file_url ?? null,
        size: f?.file_size ?? null,
        type: f?.file_type ?? null,
      })),
      // 손으로 뽑은 목록(docs/oral_history_performers.md)과 대조하려면 사람이 볼 화면이 필요하다.
      prism_url: `https://www.prism.go.kr/homepage/asmt/popup/${item.research_id}`,
      matched_keywords: hit,
    });
  }
  process.stdout.write("\n");

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`\n${out.length}건을 ${OUT}에 담았습니다. API 호출 ${calls}회.`);

  const byAgency = new Map();
  for (const row of out) byAgency.set(row.ordering_agency, (byAgency.get(row.ordering_agency) ?? 0) + 1);
  console.log("\n발주처별 —");
  for (const [agency, count] of [...byAgency].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(count).padStart(3)}건  ${agency ?? "(미상)"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
