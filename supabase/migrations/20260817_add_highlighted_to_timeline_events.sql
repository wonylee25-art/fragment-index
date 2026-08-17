-- timeline_events에 "밑줄" 컬럼 추가.
-- 연표에서 눈에 띄게 둘 사건을 사람이 직접 짚기 위한 것 — 켜진 사건은 사건명에 노란
-- 밑줄이 그어진다.
--
-- 그전까지 연표에서 바탕색이 깔리는 행은 "구술이 붙어 있는 사건"이었다(초록). 데이터가
-- 스스로 정하는 음영이라 훑을 때 고를 수가 없었고 — 색이 이미 다 칠해져 있으니 — 그 초록을
-- 걷어냈다. 구술이 붙었다는 사실은 구술 칸에 인용이 실제로 실려 있는 것으로 이미 보인다.
--
-- 노랑인 것은 segments.is_important·user_memo·highlights와 같은 갈래이기 때문이다 —
-- "내가 얹은 것"은 전부 노랑(design-tokens.ts의 DOT_MINE).
--
-- false = 안 그은 사건. 기존 행은 전부 false라 마이그레이션 전후 DB 내용이 같다.

alter table public.timeline_events
  add column if not exists highlighted boolean not null default false;

create index if not exists timeline_events_highlighted_idx
  on public.timeline_events (highlighted)
  where highlighted;
