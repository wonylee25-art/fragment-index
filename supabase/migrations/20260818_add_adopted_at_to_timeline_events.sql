-- timeline_events에 "연표에 올림" 딱지 추가.
--
-- 그전까지 사건은 사람이 하나씩 손으로 넣은 것뿐이라 "DB에 있다 = 연표에 올린다"가 같은
-- 말이었다. 국사편찬위원회 오늘의역사 파일(data/raw/th.xml)에서 1900년 이후 6천여 건을
-- 통째로 들여오면 그 등식이 깨진다 — 들여온 것은 붙일 사건을 "찾기 위한" 재고이지, 그 자체로
-- 연표에 실릴 사건이 아니다. 그래서 두 가지를 가른다:
--
--   adopted_at 있음 — 내가 연표에 올리기로 한 사건. 연표(/, /admin/timeline)에 나온다.
--   adopted_at 없음 — 창고에만 있는 사건. "+ 사건 연결" 후보 목록에서만 검색되고,
--                     사료·구술에 붙이는 순간 딱지가 붙어 연표로 올라온다.
--
-- hidden_at과 뜻이 겹치지 않는다: 숨김은 "꺼냈다가 도로 치웠다", 미채택은 "아직 안 꺼냈다".
--
-- 기존 행은 전부 채택으로 채운다 — 마이그레이션 전후로 화면에 보이는 연표가 같다.

alter table public.timeline_events
  add column if not exists adopted_at timestamptz;

update public.timeline_events
  set adopted_at = now()
  where adopted_at is null;

create index if not exists timeline_events_adopted_at_idx
  on public.timeline_events (adopted_at)
  where adopted_at is not null;
