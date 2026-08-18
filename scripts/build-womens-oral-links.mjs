// 국립여성사전시관 "구술영상기록" 게시판(bbsId=tell_info_main)을 훑어
// 게시글 번호(nttId) ↔ 유튜브 영상 ID / 제목 대응표를 src/lib/womens-oral-links.json에 쓴다.
// 실행: node scripts/build-womens-oral-links.mjs
//
// data.go.kr 구술자료 API(womens-oral-archive.ts)는 자료마다 유튜브 iframe만 주고
// 전시관 원문 페이지 주소는 주지 않는다. 그런데 API의 영상 링크는 실제로 신뢰할 수 없다
// (예: "닭똥까지 주워 먹었던 보릿고개 이야기"에 "한 땀 한 땀 자긍심을 바느질하다"의 영상이 붙어 있다).
// 그래서 제목이 가리키는 곳을 링크로 삼으려면 전시관 게시판 쪽을 기준으로 삼아야 한다.
// 게시판 상세는 POST 폼으로 열리지만 같은 파라미터를 GET으로 붙여도 열린다 — 그 주소를 쓴다.

import { writeFile } from "node:fs/promises";

const BOARD = "https://eherstory.mogef.go.kr/cop/bbs/selectBoardList.do?bbsId=tell_info_main&menuNo=050300";
const ARTICLE = "https://eherstory.mogef.go.kr/cop/bbs/selectBoardArticle.do?bbsId=tell_info_main&menuNo=050300&nttId=";

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// 목록 한 장에서 nttId·카테고리·제목을 뽑는다. 제목은 <em class="ctg">카테고리</em> 뒤에 온다.
function parseList(html) {
  const rows = [];
  const re =
    /fn_inqire_notice\('(\d+)','tell_info_main'\)[\s\S]*?<em class="ctg">([^<]*)<\/em>\s*([^<]*)/g;
  let m;
  while ((m = re.exec(html))) {
    rows.push({ nttId: m[1], category: m[2].trim(), title: m[3].trim() });
  }
  return rows;
}

const rows = [];
for (let page = 1; page <= 6; page += 1) {
  const html = await getText(`${BOARD}&pageIndex=${page}`);
  const parsed = parseList(html);
  console.log(`목록 ${page}쪽: ${parsed.length}건`);
  rows.push(...parsed);
}

const entries = [];
for (const row of rows) {
  const html = await getText(`${ARTICLE}${row.nttId}`);
  const videoId =
    html.match(/<iframe[^>]*\ssrc="https:\/\/www\.youtube\.com\/embed\/([\w-]{11})/)?.[1] ?? "";
  if (!videoId) console.warn(`영상 없음: ${row.nttId} ${row.title}`);
  entries.push({ ...row, videoId, url: `${ARTICLE}${row.nttId}` });
}

entries.sort((a, b) => Number(a.nttId) - Number(b.nttId));
await writeFile("src/lib/womens-oral-links.json", `${JSON.stringify(entries, null, 2)}\n`);
console.log(`총 ${entries.length}건 저장 (영상 ID 확보 ${entries.filter((e) => e.videoId).length}건)`);
