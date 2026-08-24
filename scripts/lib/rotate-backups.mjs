// 스냅샷 보관 규칙 — scripts/backup-db.mjs가 파일을 쓴 뒤 마지막에 부른다.
//
// 최근 7일치는 풀린 채로 두고, 그보다 오래된 것은 달마다 하나의 .tar.gz로 묶는다. 지우지는
// 않는다 — 실수를 알아차리는 것은 대개 며칠 뒤라, 7일에서 잘라 버리면 정작 필요할 때 없다.
// JSON은 같은 구조가 반복돼 5~6배로 줄기 때문에 한 달치를 다 담아도 3MB 안팎이고, 그래서
// 버려서 아낄 것이 사실상 없다(폴더에 보이는 파일 수는 묶는 것만으로 이미 줄어든다).
//
// 묶는 단위를 달로 잡은 것은 되돌릴 때의 손짓 때문이다. 한 해치를 한 덩어리로 묶으면 8월의
// 하루를 보려고 1년을 풀어야 하고, 날짜별로 따로 압축하면 폴더가 도로 빽빽해진다.

import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SNAPSHOT = /^snapshot-(\d{4})-(\d{2})-(\d{2})\.json$/;
const KEEP_DAYS = 7;

// 파일명에 박힌 날짜로만 나이를 센다 — 파일 수정시각(mtime)은 복사·동기화로 쉽게 바뀐다.
function daysOld(name, today) {
  const m = name.match(SNAPSHOT);
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.floor((today - d) / 86_400_000);
}

export function rotateBackups(dir, { today = new Date() } = {}) {
  if (!existsSync(dir)) return [];

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const stale = readdirSync(dir)
    .filter((f) => SNAPSHOT.test(f))
    .filter((f) => daysOld(f, todayUtc) > KEEP_DAYS);
  if (stale.length === 0) return [];

  // 달별로 모은다 — snapshot-2026-06-14.json → "2026-06"
  const byMonth = new Map();
  for (const f of stale) {
    const key = f.slice("snapshot-".length, "snapshot-".length + 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), f]);
  }

  const done = [];
  for (const [month, files] of byMonth) {
    const archive = `${month}.tar.gz`;
    // 그 달 묶음이 이미 있으면 풀어서 함께 다시 묶는다. tar는 gzip 묶음에 이어붙이기(-r)를
    // 지원하지 않아서, 한 달에 한 번 이 경로를 지나며 통째로 다시 만든다.
    if (existsSync(`${dir}/${archive}`)) {
      execFileSync("tar", ["-xzf", archive], { cwd: dir });
      unlinkSync(`${dir}/${archive}`);
    }
    const members = readdirSync(dir).filter(
      (f) => SNAPSHOT.test(f) && f.startsWith(`snapshot-${month}`) && daysOld(f, todayUtc) > KEEP_DAYS,
    );
    execFileSync("tar", ["-czf", archive, ...members.sort()], { cwd: dir });
    for (const f of members) unlinkSync(`${dir}/${f}`);
    done.push({ archive, count: members.length });
  }
  return done;
}
