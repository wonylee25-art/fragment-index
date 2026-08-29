// 스냅샷을 저장소 밖 폴더에 한 벌 더 둔다 — scripts/backup-db.mjs가 묶기(rotate)까지 끝낸 뒤 부른다.
//
// 왜 필요한가 — Supabase 무료 플랜에는 자동 백업이 없고, 되돌릴 수단은 data/backup/의 스냅샷
// 하나뿐이다. 그런데 그 폴더는 .gitignore라 저장소에도 안 올라가서, 폴더를 실수로 지우거나
// 저장소를 통째로 다시 받는 순간 되돌릴 것이 함께 사라진다. 값이 싼 쪽부터 막는다 — 같은 맥의
// 다른 폴더에 한 벌.
//
// 무엇을 막고 못 막나 — 실수로 지운 것과 저장소를 날린 것은 막고, **디스크 고장은 못 막는다**.
// 그건 이 폴더를 iCloud Drive나 외장 볼륨 아래로 잡아야 풀린다(BACKUP_MIRROR_DIR만 바꾸면 된다).
//
// 규칙 둘 —
//   담는 것: snapshot-*.json과 달 묶음 *.tar.gz만. backup.log는 기록이지 자료가 아니라 안 담는다.
//   지우는 것: 원본에서 묶여 사라진 스냅샷은, **그 달 묶음이 이 폴더에 실제로 건너온 뒤에만** 지운다.
//             원본의 rotate와 같은 모양으로 따라가되, 담긴 것이 없는 채로 지우는 일은 없게 한다.

import { readdirSync, mkdirSync, copyFileSync, statSync, unlinkSync, existsSync } from "node:fs";

const SNAPSHOT = /^snapshot-(\d{4}-\d{2})-\d{2}\.json$/;
const ARCHIVE = /^(\d{4}-\d{2})\.tar\.gz$/;

// 크기가 같으면 같은 파일로 본다. 스냅샷 이름에는 날짜가 박혀 있어 같은 이름이면 같은 날치이고,
// 달 묶음은 새로 묶일 때마다 크기가 달라진다 — 내용을 다 읽어 견줄 이유가 없다.
function needsCopy(src, dest) {
  if (!existsSync(dest)) return true;
  return statSync(src).size !== statSync(dest).size;
}

export function mirrorBackups(srcDir, destDir) {
  if (!destDir) return null;
  if (!existsSync(srcDir)) return null;

  mkdirSync(destDir, { recursive: true });

  const srcFiles = readdirSync(srcDir).filter((f) => SNAPSHOT.test(f) || ARCHIVE.test(f));
  const copied = [];
  for (const f of srcFiles) {
    if (needsCopy(`${srcDir}/${f}`, `${destDir}/${f}`)) {
      copyFileSync(`${srcDir}/${f}`, `${destDir}/${f}`);
      copied.push(f);
    }
  }

  // 원본에서 묶여 사라진 스냅샷을 이쪽에서도 거둔다 — 그 달 묶음이 여기 있을 때만.
  const srcNames = new Set(srcFiles);
  const pruned = [];
  for (const f of readdirSync(destDir)) {
    const m = f.match(SNAPSHOT);
    if (!m || srcNames.has(f)) continue;
    if (!existsSync(`${destDir}/${m[1]}.tar.gz`)) continue;
    unlinkSync(`${destDir}/${f}`);
    pruned.push(f);
  }

  return { copied, pruned, total: srcFiles.length };
}
