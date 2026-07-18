import { readFile } from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

// 국사편찬위원회 "오늘의역사(연표)" 원문파일(data/raw/th.xml, 15,579건) 검색.
// DB엔 이 중 라디오·방송 키워드로 걸러낸 95건(E026~E120)만 들어있다 — 나머지는
// 파일에만 있고 DB엔 없으므로, 다른 주제를 검색할 때를 위해 파일 전체를 즉석에서 훑는다.
// 결과는 화면에만 뜨고 DB에 저장되지 않는다(6-5 정책: 등록 시점에만 캐시).

const XML_PATH = path.join(process.cwd(), "data", "raw", "th.xml");

export interface ThTimelineEntry {
  id: string;
  dateValue: string; // EDTF (YYYY-MM-DD)
  title: string;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

let cachedEntries: ThTimelineEntry[] | null = null;

async function loadEntries(): Promise<ThTimelineEntry[]> {
  if (cachedEntries) return cachedEntries;

  const xml = await readFile(XML_PATH, "utf-8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);

  const entries: ThTimelineEntry[] = [];
  for (const level1 of asArray(parsed?.item?.level1)) {
    const year = level1["@_value"];
    for (const level2 of asArray(level1.level2)) {
      const month = level2["@_value"];
      for (const level3 of asArray(level2.level3)) {
        const day = level3["@_value"];
        for (const level4 of asArray(level3.level4)) {
          const title = level4?.front?.biblioData?.title?.mainTitle;
          if (!title) continue;
          entries.push({
            id: level4["@_id"] ?? `${year}-${month}-${day}-${entries.length}`,
            dateValue: `${year}-${month}-${day}`,
            title: String(title),
          });
        }
      }
    }
  }

  cachedEntries = entries;
  return entries;
}

export async function searchThTimeline(query: string, limit = 10): Promise<ThTimelineEntry[]> {
  const entries = await loadEntries();
  const q = query.trim();
  if (!q) return [];
  return entries.filter((e) => e.title.includes(q)).slice(0, limit);
}
