// 조달청 나라장터 공공데이터 API 공통 유틸 —
// scripts/search-g2b-bids.mjs(입찰공고정보서비스 15129394)와
// scripts/fetch-g2b-awards.mjs(낙찰정보서비스 15129397)가 함께 쓴다.
//
// 두 서비스는 같은 게이트웨이(apis.data.go.kr/1230000)에 있고, 조회 방식도 같다 —
// inqryDiv=1(등록/게시일시 기준) + 한 달씩 끊은 inqryBgnDt~inqryEndDt + bidNtceNm 검색어.
// 한 달을 넘기면 resultCode 07(입력범위값 초과)이 오므로 monthRanges로 잘라 훑는다.
//
// 키: data.go.kr은 계정마다 **일반 인증키(Decoding)를 하나만** 준다 — 서비스별로 키가 갈리지 않고,
// 서비스마다 갈리는 것은 활용신청 승인뿐이다(승인 전에는 SERVICE_KEY_IS_NOT_REGISTERED_ERROR).
// 그래서 .env.local에는 DATA_GO_KR_API_KEY 한 줄만 두고, 재발급하면 그 한 줄만 고친다.
// 옛 이름들은 이미 값이 들어 있는 .env.local이 안 깨지도록 뒤에서 받는다.
//
// curl을 쓰는 이유는 match-museum-relics.mjs와 같다 — data.go.kr 게이트웨이가 Node의
// fetch(undici)를 TLS 지문으로 걸러 차단 페이지를 돌려주는 일이 있다.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dataGoKrKey } from "./data-go-kr.mjs";

const execFileAsync = promisify(execFile);

// 낱말 하나가 사업 하나를 가린다(자세한 건 search-g2b-bids.mjs 머리말) — 기본 다섯.
export const DEFAULT_KEYWORDS = ["구술", "채록", "생애사", "증언", "기록화"];

// 키·서비스 문제는 낱말을 바꿔 다시 물어도 똑같이 실패하므로 즉시 멈춘다.
export class FatalApiError extends Error {}

export function resolveKey() {
  const key = dataGoKrKey();
  if (!key) {
    console.error("DATA_GO_KR_API_KEY가 없습니다. .env.local에 넣고 --env-file=.env.local로 실행하세요.");
    process.exit(1);
  }
  return key;
}

// 낱말들 + --months=N + 나머지 --플래그. 낱말을 안 주면 DEFAULT_KEYWORDS.
export function parseArgs(argv = process.argv.slice(2), { defaultMonths = 12 } = {}) {
  const monthsArg = argv.find((a) => a.startsWith("--months="));
  const months = monthsArg ? Number(monthsArg.slice("--months=".length)) : defaultMonths;
  const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.startsWith("--months=")));
  const words = argv.filter((a) => !a.startsWith("--"));
  return { months, keywords: words.length ? words : DEFAULT_KEYWORDS, flags };
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

// 현재 달부터 과거로 count개. 각 원소는 [YYYYMMDDHHmm 시작, 끝].
export function monthRanges(count) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const begin = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59);
    out.push([stamp(begin), stamp(end)]);
  }
  return out;
}

// 한 번 호출. payload(JSON) 반환. 키·활용신청 문제는 FatalApiError, 그 밖의 오류는 Error.
export async function callG2b(url) {
  const { stdout } = await execFileAsync("curl", ["-s", "-m", "90", url], {
    maxBuffer: 64 * 1024 * 1024,
  });
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    // 차단 페이지 등은 HTML로 온다. 원문을 그대로 보여주는 편이 낫다.
    throw new Error(`JSON이 아닌 응답:\n${stdout.slice(0, 600)}`);
  }
  // 게이트웨이 오류는 HTTP 200 + 정상 JSON 껍데기로 온다. 두 가지 꼴이 있다.
  // ① 옛 꼴: OpenAPI_ServiceResponse.cmmMsgHeader   ② 새 꼴: "nkoneps.com.response.ResponseError".header
  const legacy = payload?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (legacy) throw new FatalApiError(`${legacy.errMsg} — ${legacy.returnAuthMsg}`);
  const modern = payload?.["nkoneps.com.response.ResponseError"]?.header;
  if (modern) {
    const msg = `${modern.resultCode} ${modern.resultMsg}`;
    // 07(입력범위값 초과)는 그 달만 건너뛰면 되는 일시적 오류.
    if (String(modern.resultCode) === "07") throw new Error(msg);
    throw new FatalApiError(msg);
  }
  const header = payload?.response?.header;
  if (header && String(header.resultCode) !== "00") {
    throw new FatalApiError(`${header.resultCode} ${header.resultMsg}`);
  }
  return payload;
}

export function rowsOf(payload) {
  const items = payload?.response?.body?.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (items.item) return Array.isArray(items.item) ? items.item : [items.item];
  return [];
}

export function totalOf(payload) {
  return Number(payload?.response?.body?.totalCount ?? 0);
}

// operation 하나를 낱말 × 월범위로 훑어 공고번호-차수로 묶은 Map을 돌려준다.
//   keep(row)  — false면 버린다(느슨한 검색 대비 재확인용)
//   onFatal(err) — FatalApiError를 만났을 때 안내를 찍는다. 그다음 process.exit(1).
export async function sweep({ base, operation, key, keywords, months, extraParams = {}, keep, onFatal }) {
  const seen = new Map();
  for (const keyword of keywords) {
    for (const [begin, end] of monthRanges(months)) {
      let pageNo = 1;
      for (;;) {
        const params = new URLSearchParams({
          serviceKey: key,
          type: "json",
          numOfRows: "100",
          pageNo: String(pageNo),
          inqryDiv: "1",
          inqryBgnDt: begin,
          inqryEndDt: end,
          bidNtceNm: keyword,
          ...extraParams,
        });
        let payload;
        try {
          payload = await callG2b(`${base}/${operation}?${params}`);
        } catch (err) {
          if (err instanceof FatalApiError) {
            onFatal?.(err);
            process.exit(1);
          }
          console.error(`  ! ${operation} · ${keyword} · ${begin.slice(0, 6)} p${pageNo} 실패 — ${err.message}`);
          break;
        }
        const rows = rowsOf(payload);
        for (const r of rows) {
          if (keep && !keep(r)) continue;
          const id = `${r.bidNtceNo}-${r.bidNtceOrd}`;
          if (seen.has(id)) Object.assign(seen.get(id), r); // 뒤에 온 필드로 보강
          else seen.set(id, { ...r });
        }
        if (rows.length === 0 || pageNo * 100 >= totalOf(payload)) break;
        pageNo += 1;
      }
    }
  }
  return seen;
}
