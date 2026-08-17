-- 보류함에서 치운 사료. 사건(timeline_events.hidden_at)과 같은 규칙이다 — 화면에서만
-- 내리고 행도 연결선도 그대로 두어, 되살리면 붙어 있던 사건에 그대로 돌아온다.
--
-- 지우는 길을 아주 없애지는 않았다. 검색하다 저장해 둔 부스러기는 실제로 비울 수 있어야
-- 하기 때문이다. 대신 한 단계 뒤로 물렸다: 보류함에서는 치우기만 하고, 완전 삭제는
-- "치운 사료" 목록 안에서 한 번 더 물은 뒤에만 이뤄진다.
alter table archive_items
  add column if not exists hidden_at timestamptz;
