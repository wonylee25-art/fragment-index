-- 쳐낸 논문. 사료(archive_items.hidden_at)·사건(timeline_events.hidden_at)·구술(segments.hidden_at)과
-- 같은 규칙이다 — 화면에서만 내리고 행은 그대로 두어, 되돌리면 주제어·메모까지 함께 돌아온다.
--
-- 논문은 특히 이 장치가 필요하다. 원본이 data/riss-papers.csv이고 매주 월요일 동기화가 그 행을
-- 통째로 다시 밀어넣기 때문에, 행을 지우는 방식으로는 쳐낸 논문이 계속 되살아난다.
-- scripts/sync-csv.mjs의 syncPapers가 이 칸이 채워진 id를 건너뛴다.
alter table papers
  add column if not exists hidden_at timestamptz;
