import rows from "./th-timeline.json";

// 국사편찬위원회 "오늘의역사(연표)" 15,577건 검색.
// DB엔 이 중 라디오·방송 키워드로 걸러낸 95건(E026~E120)만 들어있다 — 나머지는
// 이 자료에만 있고 DB엔 없으므로, 다른 주제를 검색할 때를 위해 전체를 즉석에서 훑는다.
// 결과는 화면에만 뜨고 DB에 저장되지 않는다(6-5 정책: 등록 시점에만 캐시).
//
// 원문파일(data/raw/th.xml, 11MB)은 /data/raw/가 .gitignore라 저장소에 없고 배포본에도 없다
// (배포 환경에서 ENOENT: '/var/task/data/raw/th.xml'로 터졌다). 그래서 검색에 쓰는 세 값만
// scripts/build-th-timeline.mjs로 th-timeline.json에 뽑아 커밋해두고 여기서 import한다 —
// import한 것은 번들에 실려 가므로 어디서 돌든 파일이 있다. 원문이 갱신되면 스크립트를 다시 돌린다.

export interface ThTimelineEntry {
  id: string;
  dateValue: string; // EDTF (YYYY-MM-DD)
  title: string;
}

// [id, 날짜, 제목] 3칸짜리 배열 — 키 이름을 15,577번 반복하지 않으려고 이 모양으로 저장했다.
const entries: ThTimelineEntry[] = (rows as [string, string, string][]).map(([id, dateValue, title]) => ({
  id,
  dateValue,
  title,
}));

export async function searchThTimeline(query: string, limit = 10): Promise<ThTimelineEntry[]> {
  const q = query.trim();
  if (!q) return [];
  return entries.filter((e) => e.title.includes(q)).slice(0, limit);
}
