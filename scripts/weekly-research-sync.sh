#!/bin/bash
# launchd(com.fragment-index.research-sync)가 매주 월요일 08:00에 실행.
# 그 시각에 노트북이 잠들어 있었다면 launchd가 깨어날 때, 완전히 꺼져 있었다면 다음 로그인 때
# RunAtLoad로 따라잡아 실행한다 — 그래서 "이미 이번 주에 돌았으면 건너뛰기" 가드가 필요하다.

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
  cd "$PROJECT_DIR" && npm run fetch:riss && npm run sync
} >> "$LOG_FILE" 2>&1
status=$?

echo "===== $(date '+%Y-%m-%d %H:%M:%S') end (exit $status) =====" >> "$LOG_FILE"

if [ "$status" -eq 0 ]; then
  echo "$now" > "$STATE_FILE"
fi

exit $status
