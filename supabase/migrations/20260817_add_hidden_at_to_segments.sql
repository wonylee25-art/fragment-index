-- 비활성 구술함. 사료(archive_items.hidden_at)·사건(timeline_events.hidden_at)과 같은 규칙이다 —
-- 화면에서만 내리고 행도 연결선도 그대로 두어, 되돌리면 붙어 있던 사건으로 함께 돌아온다.
--
-- 구술은 사료보다 더 조심스럽다. CSV 동기화로 들어온 발췌는 화면에서 지울 수 없다는 규칙이
-- 이미 있어(segment-actions.deleteSegment), 비활성 구술함에서도 "완전 삭제"는 화면에서 직접
-- 넣은 발췌(manual-)에만 열린다. 나머지는 비활성으로 내려두는 것이 마지막 단계다.
alter table segments
  add column if not exists hidden_at timestamptz;
