-- timeline_events에 "숨김" 시각 컬럼 추가.
-- 관리페이지의 사건 삭제를 실제 DELETE에서 숨김으로 바꾸기 위한 것. 사건 행도, 사건에
-- 붙어 있던 연결선(links)·인물/장소 연결도 그대로 남고 화면에서만 빠진다 —
-- 되살리면 붙어 있던 사료가 함께 돌아온다.
--
-- 2026-08-15 원격 DB(egqcxbjdzlqddmxjsvff)에 적용 완료.
-- null = 보이는 사건. 기존 행은 전부 null이라 마이그레이션 전후 화면이 같다.

alter table public.timeline_events add column if not exists hidden_at timestamptz;

create index if not exists timeline_events_hidden_at_idx
  on public.timeline_events (hidden_at)
  where hidden_at is not null;
