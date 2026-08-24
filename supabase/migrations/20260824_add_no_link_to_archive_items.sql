-- 사료 연결 화면이 세 함으로 갈렸다 — 연결함 · 보류함 · 미연결함.
-- 앞의 둘은 links로 판별되지만(붙었느냐), 셋째는 "붙이지 않기로 했다"는 사람의 판단이라
-- 자료 자신에 적어야 한다. links가 없는 것과 뜻이 다르다: 아직 안 본 것과 보고 안 붙인 것.
-- 시각을 적는 것은 hidden_at·adopted_at과 같은 방식이다 — 언제 그렇게 정했는지가 남는다.
alter table archive_items add column if not exists no_link_at timestamptz;

comment on column archive_items.no_link_at is
  '사건에 붙이지 않기로 한 시각. 채워져 있으면 미연결함에 선다. 보류(아직 판단 안 함)와 다르다.';
