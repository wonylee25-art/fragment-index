// 국사편찬위원회 "오늘의역사(연표)" 원문파일(data/raw/th.xml, 11MB)에서 검색에 쓰는
// 세 값(id·날짜·제목)만 뽑아 src/lib/th-timeline.json으로 줄여 쓴다.
// 실행: node scripts/build-th-timeline.mjs
//
// 원문파일은 /data/raw/가 .gitignore라 저장소에 없고, 그래서 배포된 함수에는 파일이 없다
// (ENOENT: '/var/task/data/raw/th.xml'). 검색이 쓰는 건 XML 전체가 아니라 세 값뿐이라
// 그것만 뽑아 커밋해두고, 앱은 이 JSON을 import해서 번들에 실려 가게 한다.
// 덤으로 요청마다 11MB XML을 파싱하던 일이 없어진다.
//
// 키 이름이 15,577번 반복되지 않도록 [id, 날짜, 제목] 3칸짜리 배열의 배열로 쓴다.
// **id는 날짜에서 유도하지 않고 원문 그대로 옮긴다** — th_1999_03_30_0030 한 건은
// id 안의 연도(1999)와 실제 날짜(1990-03-30)가 어긋나는데, 원문의 오류지 우리가 고칠 몫이 아니다.

import { readFile, writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const XML_PATH = "data/raw/th.xml";
const OUT_PATH = "src/lib/th-timeline.json";

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

const xml = await readFile(XML_PATH, "utf-8");
const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }).parse(xml);

const rows = [];
for (const level1 of asArray(parsed?.item?.level1)) {
  const year = level1["@_value"];
  for (const level2 of asArray(level1.level2)) {
    const month = level2["@_value"];
    for (const level3 of asArray(level2.level3)) {
      const day = level3["@_value"];
      for (const level4 of asArray(level3.level4)) {
        const title = level4?.front?.biblioData?.title?.mainTitle;
        if (!title) continue;
        rows.push([
          level4["@_id"] ?? `${year}-${month}-${day}-${rows.length}`,
          `${year}-${month}-${day}`,
          String(title),
        ]);
      }
    }
  }
}

// 한 줄에 한 건씩 둬야 나중에 원문을 다시 받았을 때 diff로 무엇이 달라졌는지 보인다.
const json = `[\n${rows.map((row) => JSON.stringify(row)).join(",\n")}\n]\n`;
await writeFile(OUT_PATH, json);
console.log(`${rows.length}건 → ${OUT_PATH} (${(Buffer.byteLength(json) / 1e6).toFixed(2)}MB)`);
