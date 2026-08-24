-- 메모의 주인에 사료를 더한다.
--
-- 사료가 연표에 제 행으로 서게 되면서(20260824_add_timeline_placement_to_archive_items.sql)
-- 그 행에도 메모를 적을 수 있어야 한다 — 사건 행에 적는 것과 같은 일이다. 메모는 어느
-- 화면에서 적든 같은 것이라 표를 나누지 않고 주인 칸만 하나 더 둔다(20260823_add_user_memos.sql).
--
-- 주인은 여전히 정확히 하나여야 한다. 체크 제약은 칸 수가 박혀 있어 고쳐 쓸 수 없으므로
-- 떼고 다시 건다.

alter table public.user_memos
  add column if not exists archive_item_id text references archive_items(id) on delete cascade;

alter table public.user_memos
  drop constraint if exists user_memos_one_owner;

alter table public.user_memos
  add constraint user_memos_one_owner check (
    (timeline_event_id is not null)::int
      + (segment_id is not null)::int
      + (paper_id is not null)::int
      + (archive_item_id is not null)::int = 1
  );

create index if not exists user_memos_archive_item_id_idx on public.user_memos (archive_item_id);
