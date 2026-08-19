#!/bin/bash
# launchd(com.fragment-index.research-sync)가 매주 월요일 08:00에 실행.
# 그 시각에 노트북이 잠들어 있었다면 launchd가 깨어날 때, 완전히 꺼져 있었다면 다음 로그인 때
# RunAtLoad로 따라잡아 실행한다 — 그래서 "이미 이번 주에 돌았으면 건너뛰기" 가드가 필요하다.
#
# 하는 일: DB 스냅샷(npm run backup) → RISS 논문 수집 → Supabase 반영.

PROJECT_DIR="/Users/wonylee/01_WORK_PROJECT/WEB_CONTENT/Fragment-index_2026"
STATE_FILE="$HOME/Library/Application Support/fragment-index/last-research-sync"
LOG_FILE="$HOME/Library/Logs/fragment-index-research-sync.log"
MIN_INTERVAL_DAYS=6

export PATH="/usr/local/bin:$PATH"

mkdir -p "$(dirname "$STATE_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

now=$(date +%s)
if [ -f "$STATE_FILE" ]; then
  last=$(cat "$STATE_FILE")
  elapsed_days=$(( (now - last) / 86400 ))
  if [ "$elapsed_days" -lt "$MIN_INTERVAL_DAYS" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') skip (last run ${elapsed_days}d ago)" >> "$LOG_FILE"
    exit 0
  fi
fi

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') start ====="
  cd "$PROJECT_DIR" || exit 1
  # 백업을 맨 앞에 둔다 — 몇 초면 끝나고, 아래 동기화가 DB를 건드리기 직전 상태가 남는다.
  # 뒤에 두면 논문 수집(길면 수십 분)이 실패한 주에는 백업까지 통째로 건너뛴다.
  # 백업이 실패해도 동기화는 계속한다 — 안전망이지 전제가 아니다. 대신 로그에 남긴다.
  npm run backup || echo "!!! 백업 실패 — 동기화는 그대로 진행합니다"
  npm run fetch:riss && npm run sync
} >> "$LOG_FILE" 2>&1
status=$?

echo "===== $(date '+%Y-%m-%d %H:%M:%S') end (exit $status) =====" >> "$LOG_FILE"

if [ "$status" -eq 0 ]; then
  echo "$now" > "$STATE_FILE"
fi

exit $status
