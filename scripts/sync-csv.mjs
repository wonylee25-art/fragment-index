// data/의 CSV 4개(chronicle, oral segments, persons_authority, sources_authority)를
// Supabase에 반영한다. 실행: npm run sync
//
// 병합 정책 — "새 행/바뀐 행만 반영":
// - CSV에 없던 id는 새로 insert.
// - 이미 있는 id는 "CSV 칸이 비어있지 않은 필드만" 덮어쓴다. 예를 들어 chronicle.csv의
//   content(요약) 칸은 원래 항상 비어있고, DB의 summary는 예전에 사람이 따로 다듬어 넣은
//   문장이라 — CSV가 비어있으면 그 다듬어진 문장을 그대로 둔다. 빈 칸으로 덮어써서
//   기존 큐레이션을 지우는 사고를 막기 위함.
// - segment_text가 비어있는 구술 행(예: mkoha에서 메타데이터만 옮겨오고 아직 인용문을
//   못 채운 행)은 건너뛴다 — 인용문 없는 발췌구간은 성립하지 않는다는 원칙(5-2-1 참고).
// - 5-2-1의 "CSV 오류 처리" 미결정 사항에 대한 답: 행 단위로 검증해서, 문제 있는 행만
//   건너뛰고 사유를 출력한 뒤 나머지는 계속 진행한다(전체 차단 아님).

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const supabase = createClient(url, key);

// ---------- CSV 파서 (RFC4180, 따옴표 안 줄바꿈 지원) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") continue;
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

function readCsv(path) {
  return parseCsv(readFileSync(path, "utf-8"));
}

function splitMulti(value) {
  return String(value ?? "").split(";").map((v) => v.trim()).filter(Boolean);
}

// CSV 값이 실질적으로 "비어있지 않을 때만" 기존 DB 값을 덮어쓴다.
function mergeValue(existing, incoming) {
  if (incoming === null || incoming === undefined) return existing;
  if (typeof incoming === "string" && incoming.trim() === "") return existing;
  if (Array.isArray(incoming) && incoming.length === 0) return existing;
  return incoming;
}

async function fetchExisting(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw error;
  return new Map(data.map((row) => [row.id, row]));
}

const report = {};
function log(table, action) {
  report[table] ??= { new: 0, updated: 0, skipped: 0 };
  report[table][action]++;
}

// ---------- persons ----------
async function syncPersons() {
  const rows = readCsv("data/fragments_index - persons_authority.csv");
  const existing = await fetchExisting("persons", "id, title, date_value, coverage, subject, description");
  const upserts = [];
  for (const r of rows) {
    if (!r.persons_id || !r.title) { log("persons", "skipped"); console.warn(`[persons] title 없음, 건너뜀: ${r.persons_id}`); continue; }
    const ex = existing.get(r.persons_id);
    upserts.push({
      id: r.persons_id,
      title: mergeValue(ex?.title, r.title),
      date_value: mergeValue(ex?.date_value, r.date),
      coverage: mergeValue(ex?.coverage, r.coverage),
      subject: mergeValue(ex?.subject, splitMulti(r.subject)),
      description: mergeValue(ex?.description, r.description),
    });
    log("persons", ex ? "updated" : "new");
  }
  if (upserts.length) {
    const { error } = await supabase.from("persons").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }
  return new Map(upserts.map((p) => [p.id, p]));
}

// ---------- sources ----------
async function syncSources() {
  const rows = readCsv("data/fragments_index - sources_authority.csv");
  const existing = await fetchExisting("sources", "id, type, title, creator, publisher, relation, date_value, identifier, description");
  const upserts = [];
  for (const r of rows) {
    if (!r.source_id || !r.title) { log("sources", "skipped"); console.warn(`[sources] title 없음, 건너뜀: ${r.source_id}`); continue; }
    const ex = existing.get(r.source_id);
    upserts.push({
      id: r.source_id,
      type: mergeValue(ex?.type, r.type),
      title: mergeValue(ex?.title, r.title),
      creator: mergeValue(ex?.creator, r.creator),
      publisher: mergeValue(ex?.publisher, r.publisher),
      relation: mergeValue(ex?.relation, r.relation),
      date_value: mergeValue(ex?.date_value, r.date),
      identifier: mergeValue(ex?.identifier, r.identifier),
      description: mergeValue(ex?.description, r.description),
    });
    log("sources", ex ? "updated" : "new");
  }
  if (upserts.length) {
    const { error } = await supabase.from("sources").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }
}

// ---------- timeline_events + event_persons ----------
async function syncChronicle() {
  const rows = readCsv("data/fragments_index - chronicle.csv").filter((r) => r.event_name);
  const existing = await fetchExisting("timeline_events", "id, event_name, date_value, summary, source_reference, keywords");
  const upserts = [];
  const eventPersonPairs = [];
  for (const r of rows) {
    if (!r.event_id || !r.event_name) { log("timeline_events", "skipped"); continue; }
    const ex = existing.get(r.event_id);
    upserts.push({
      id: r.event_id,
      event_name: mergeValue(ex?.event_name, r.event_name),
      date_value: mergeValue(ex?.date_value, r["date_value(EDTF)"]),
      summary: mergeValue(ex?.summary, r.content), // content는 시트에서 대개 비어있음 — 기존 요약 보존
      source_reference: mergeValue(ex?.source_reference, r.event_sources),
      keywords: mergeValue(ex?.keywords, splitMulti(r.keywords)),
    });
    log("timeline_events", ex ? "updated" : "new");
    for (const pid of splitMulti(r.related_persons_id)) eventPersonPairs.push({ event_id: r.event_id, person_id: pid });
  }
  if (upserts.length) {
    const { error } = await supabase.from("timeline_events").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }
  if (eventPersonPairs.length) {
    const { error } = await supabase.from("event_persons").upsert(eventPersonPairs, { onConflict: "event_id,person_id" });
    if (error) throw error;
  }
}

// ---------- segments + segment_persons ----------
function synthesizeItemTitle(narratorId, page, personsById) {
  const person = personsById.get(narratorId);
  if (!person) return null;
  const year = person.date_value ? String(person.date_value).match(/^\d{4}/)?.[0] : null;
  const nameWithYear = year ? `${person.title}(${year})` : person.title;
  const pageLabel = page ? ` (${page.replace("-", "–")}쪽)` : "";
  return `${nameWithYear} 구술${pageLabel}`;
}

async function syncSegments(personsById) {
  const rows = readCsv("data/fragments_index - oral segments.csv");
  const existing = await fetchExisting(
    "segments",
    "id, item_title, date_value, source_id, page, narrator_id, interviewer_id, event_id, segment_text, notes, keywords",
  );
  const upserts = [];
  const segmentPersonPairs = [];
  for (const r of rows) {
    if (!r.segment_id) continue;
    if (!r.segment_text || !r.segment_text.trim()) {
      log("segments", "skipped");
      console.warn(`[segments] segment_text 없음, 건너뜀: ${r.segment_id} (${r.item_title || "제목 없음"})`);
      continue;
    }
    const ex = existing.get(r.segment_id);
    const itemTitle = r.item_title || (ex ? undefined : synthesizeItemTitle(r.narrator_id, r.page, personsById));
    upserts.push({
      id: r.segment_id,
      item_title: mergeValue(ex?.item_title, itemTitle),
      date_value: mergeValue(ex?.date_value, r["date_value(EDTF)"]),
      source_id: mergeValue(ex?.source_id, r.source_id),
      page: mergeValue(ex?.page, r.page),
      narrator_id: mergeValue(ex?.narrator_id, r.narrator_id),
      interviewer_id: mergeValue(ex?.interviewer_id, r.interviewer_id),
      event_id: mergeValue(ex?.event_id, r.event_id),
      segment_text: r.segment_text, // 필수값 — 항상 CSV 값 사용
      notes: mergeValue(ex?.notes, r.notes),
      keywords: mergeValue(ex?.keywords, splitMulti(r.keywords)),
      review_status: ex?.review_status ?? "사람 확정",
    });
    log("segments", ex ? "updated" : "new");
    for (const pid of splitMulti(r.related_persons_id)) segmentPersonPairs.push({ segment_id: r.segment_id, person_id: pid });
  }
  if (upserts.length) {
    const { error } = await supabase.from("segments").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }
  if (segmentPersonPairs.length) {
    const { error } = await supabase.from("segment_persons").upsert(segmentPersonPairs, { onConflict: "segment_id,person_id" });
    if (error) throw error;
  }
}

// ---------- papers (data/riss-papers.csv, scripts/fetch-riss-papers.mjs가 생성) ----------
async function syncPapers() {
  if (!existsSync("data/riss-papers.csv")) {
    console.warn("[papers] data/riss-papers.csv 없음 — npm run fetch:riss 먼저 실행하세요. 건너뜀.");
    return;
  }
  const rows = readCsv("data/riss-papers.csv");
  const upserts = [];
  for (const r of rows) {
    if (!r.paper_id || !r.title) { log("papers", "skipped"); continue; }
    upserts.push({
      id: r.paper_id,
      paper_type: r.type,
      title: r.title,
      author: r.author || null,
      year: r.year ? parseInt(r.year, 10) : null,
      institution: r.institution || null,
      journal_name: r.journal || null,
      // "-"는 backfill-volume-issue.mjs가 "권호사항 필드 자체가 없음을 확인함"을 표시하는
      // 값이라 재시도 스킵용일 뿐, 실제 DB/화면에는 null로 들어가야 한다.
      volume_issue: r.volume_issue && r.volume_issue !== "-" ? r.volume_issue : null,
      degree_level: r.degree_level || null,
      keywords: splitMulti(r.keywords),
      riss_url: r.riss_url || null,
    });
    log("papers", "new");
  }
  if (upserts.length) {
    const { error } = await supabase.from("papers").upsert(upserts, { onConflict: "id" });
    if (error) throw error;
  }

  // "연구 동향" 화면에 "이 목록은 언제 기준인지" 보여주기 위한 타임스탬프.
  const { error: statusError } = await supabase
    .from("sync_status")
    .upsert({ id: "papers", last_synced_at: new Date().toISOString() }, { onConflict: "id" });
  if (statusError) throw statusError;
}

async function main() {
  const personsById = await syncPersons();
  await syncSources();
  await syncChronicle();
  await syncSegments(personsById);
  await syncPapers();

  console.log("\n동기화 결과:");
  for (const [table, r] of Object.entries(report)) {
    console.log(`  ${table}: 신규 ${r.new} · 갱신 ${r.updated} · 건너뜀 ${r.skipped}`);
  }
}

main().catch((err) => {
  console.error("동기화 실패:", err);
  process.exit(1);
});
