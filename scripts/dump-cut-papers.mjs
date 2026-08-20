// 화면에서 쳐낸 논문(papers.hidden_at)을 data/cut-papers.json으로 옮긴다. 실행: npm run dump:cut
//
// sync-csv.mjs가 쳐낸 논문을 DB에 되살리지 않으므로 목록 화면은 이미 깨끗하다. 이 명부는 그
// 앞단 — RISS 수집(fetch-riss-papers.mjs)이 같은 논문을 다시 긁지 않게 하는 자리다. CSV를
// 새로 만들거나 MIN_PUBLICATION_YEAR를 낮춰 과거분을 다시 훑을 때 차이가 난다.
//
// 손으로 쳐낼 때마다 돌리면 된다(수집 전에 한 번 돌리는 것으로 충분하다).

import { createClient } from "@supabase/supabase-js";
import { readCutPapers, writeCutPapers, CUT_PAPERS_PATH } from "./lib/cut-papers.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

const PAGE = 1000;
const entries = readCutPapers();
let added = 0;

for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from("papers")
    .select("id, title")
    .not("hidden_at", "is", null)
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) throw error;
  for (const row of data) {
    // 화면에서 손으로 넣은 논문(manual-)은 RISS에서 오지 않으므로 명부에 적을 것이 없다.
    if (!row.id.startsWith("riss-")) continue;
    const controlNo = row.id.slice("riss-".length);
    if (entries[controlNo]) continue;
    entries[controlNo] = { title: row.title, reason: "손으로 쳐냄" };
    added++;
  }
  if (data.length < PAGE) break;
}

writeCutPapers(entries);
console.log(`${CUT_PAPERS_PATH}: 총 ${Object.keys(entries).length}건 (새로 적은 것 ${added}건)`);
