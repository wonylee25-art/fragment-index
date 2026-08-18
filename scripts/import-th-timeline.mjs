// 국사편찬위원회 "오늘의역사(연표)" 원문파일(data/raw/th.xml)에서 1900년 이후 사건을
// timeline_events에 들여온다. 실행: npm run import:th (미리보기: npm run import:th -- --dry-run)
//
// 왜 통째로 넣는가 — 그전까지 "+ 사건 연결"이 고를 수 있는 사건은 DB에 손으로 넣어둔 것뿐이라,
// 파일에 있어도 넣지 않은 사건에는 사료를 붙일 방법이 아예 없었다. 검색어를 바꿔도 후보 목록이
// 그대로인 게 그 때문이다. 그래서 재고를 먼저 쌓아둔다.
//
// 들여온 사건은 adopted_at이 비어 있다 — 창고에만 있고 연표에는 안 나온다. 사료·구술에 붙는
// 순간(link-actions.ts의 adoptEvent) 딱지가 붙어 연표로 올라온다.
//
// 1900년 컷 — 파일 전체는 15,580건(고려 태조부터)이고 1900년 이후는 6,436건이다. 이 프로젝트가
// 다루는 것(라디오·방송·동대문)이 전부 20세기라, 그 앞은 후보 목록을 무겁게 할 뿐이다.
// 나중에 필요해지면 --from 으로 낮춰 다시 돌리면 된다 — 이미 있는 것은 건너뛴다.

import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const XML_PATH = "data/raw/th.xml";
const SOURCE_REFERENCE = "오늘의역사(국사편찬위원회)";
const CHUNK = 500;
const CHUNK_READ = 1000; // PostgREST가 응답당 잘라내는 행 수

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fromArg = args.find((a) => a.startsWith("--from="));
const fromYear = fromArg ? Number(fromArg.slice("--from=".length)) : 1900;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

// 자식이 하나면 객체, 여럿이면 배열로 오는 파서 특성을 지운다(src/lib/xml.ts와 같은 헬퍼).
function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// 사건명은 같은 사실이 다른 출처로 두 번 들어오는 것을 막는 열쇠로 쓴다. 띄어쓰기·괄호 차이로
// 다른 것처럼 보이는 일이 많아, 견줄 때만 공백을 지운다(저장은 원문 그대로).
function dedupeKey(dateValue, title) {
  return `${dateValue}|${title.replace(/\s+/g, "")}`;
}

// 날짜는 항목이 스스로 적은 dateOccured에서 읽는다. 바깥의 연/월/일 트리를 믿었더니 한 건이
// 어긋났다 — 문화방송 표절 사과(1999-03-30)가 파일에서 1990년 아래에 잘못 들어가 있어, 그
// 트리를 그대로 옮기면 아홉 해 이른 사건이 된다. 6,436건 중 어긋난 것은 그 하나뿐이지만,
// 항목이 직접 적은 값이 바깥 자리보다 믿을 만하다.
//
// 값에는 음력 표시가 붙기도 한다("0918-06-15L0") — 앞 열 글자만 쓴다.
function readDate(biblio) {
  const occured = biblio?.date?.dateOccured;
  const raw = String((occured && typeof occured === "object" ? occured["@_date"] : occured) ?? "");
  const matched = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return matched ? matched[1] : null;
}

function readEntries() {
  const xml = readFileSync(XML_PATH, "utf-8");
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }).parse(xml);

  const entries = [];
  const seenIds = new Set(); // 파일 안에도 같은 id가 두 번 나오는 항목이 하나 있다
  // 연도 컷은 트리로 먼저 훑고(파일이 그렇게 묶여 있다), 담을 때 원문 날짜로 한 번 더 본다.
  for (const level1 of asArray(parsed?.item?.level1)) {
    const year = level1["@_value"];
    if (Number(year) < fromYear) continue;
    for (const level2 of asArray(level1.level2)) {
      const month = level2["@_value"];
      for (const level3 of asArray(level2.level3)) {
        const day = level3["@_value"];
        for (const level4 of asArray(level3.level4)) {
          const biblio = level4?.front?.biblioData;
          const title = biblio?.title?.mainTitle;
          const id = level4["@_id"];
          if (!title || !id || seenIds.has(id)) continue;
          seenIds.add(id);
          const dateValue = readDate(biblio) ?? `${year}-${month}-${day}`;
          if (Number(dateValue.slice(0, 4)) < fromYear) continue;
          entries.push({ id, dateValue, title: String(title).trim() });
        }
      }
    }
  }
  return entries;
}

// PostgREST가 응답 하나를 1000행에서 자른다 — 1000건씩 나눠 받는다. 이걸 안 하면 두 번째로
// 돌릴 때 이미 넣은 사건을 못 보고 같은 것을 또 넣으려 든다.
async function fetchExistingEvents() {
  const rows = [];
  for (let from = 0; ; from += CHUNK_READ) {
    const { data, error } = await supabase
      .from("timeline_events")
      .select("id, event_name, date_value")
      .order("id")
      .range(from, from + CHUNK_READ - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < CHUNK_READ) break;
  }
  return rows;
}

async function main() {
  const entries = readEntries();
  console.log(`${XML_PATH}: ${fromYear}년 이후 ${entries.length}건`);

  const existing = await fetchExistingEvents();
  const existingIds = new Set(existing.map((e) => e.id));
  const existingKeys = new Set(existing.map((e) => dedupeKey(e.date_value ?? "", e.event_name ?? "")));
  console.log(`DB에 이미 있는 사건: ${existing.length}건`);

  const rows = [];
  let skippedById = 0;
  let skippedByName = 0;
  for (const entry of entries) {
    if (existingIds.has(entry.id)) { skippedById++; continue; }
    // 같은 사실이 "대한민국사 연표" 출처로 이미 들어와 있는 것이 85건 있다 — 쌍둥이를 안 만든다.
    if (existingKeys.has(dedupeKey(entry.dateValue, entry.title))) { skippedByName++; continue; }
    rows.push({
      id: entry.id,
      event_name: entry.title,
      date_value: entry.dateValue,
      summary: entry.title, // 파일이 주는 것은 한 줄짜리 제목뿐이다 — 요약도 같은 문장이 된다
      source_reference: SOURCE_REFERENCE,
      has_discrepancy: false,
      keywords: [],
      user_saved: false,
      adopted_at: null, // 창고행 — 붙이는 순간 연표로 올라온다
    });
  }

  console.log(`건너뜀: id 중복 ${skippedById}건, 같은 날짜·사건명 ${skippedByName}건`);
  console.log(`넣을 것: ${rows.length}건`);
  if (dryRun) {
    console.log("--dry-run 이라 여기서 멈춥니다. 넣었을 첫 3건:");
    for (const r of rows.slice(0, 3)) console.log(`  ${r.date_value}  ${r.event_name}`);
    return;
  }
  if (rows.length === 0) return;

  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // 혹시 사이에 끼어든 행이 있어도 덮어쓰지 않는다 — 있으면 그냥 지나간다.
    const { error } = await supabase
      .from("timeline_events")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    done += chunk.length;
    console.log(`  ${done} / ${rows.length}`);
  }
  console.log("끝났습니다. 연표 화면은 그대로이고, “+ 사건 연결” 목록에서만 늘어납니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
