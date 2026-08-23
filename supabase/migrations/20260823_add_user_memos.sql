-- 메모를 한 덩어리에서 낱개로 바꾼다. 지금까지 메모는 행에 딸린 컬럼 하나였다(user_memo) —
-- 한 논문·한 사건에 적을 것이 둘 이상 생기면 이미 적어 둔 글 아래에 줄을 바꿔 이어 붙이는
-- 수밖에 없었고, 그렇게 붙인 글은 하나로 굳어 따로 고치거나 지울 수 없었다.
-- 인용구(paper_quotes)가 이미 낱개로 쌓이는 것과 같은 꼴로 옮긴다.
--
-- 세 화면(연표·구술·연구동향)이 한 표를 나눠 쓴다. 표를 셋으로 가르지 않는 이유는
-- 메모가 어느 화면에서든 똑같은 것 — 내가 적은 글 한 덩어리 — 이기 때문이다.
-- 대신 주인 칸을 셋으로 두고 그중 하나만 차 있게 못을 박는다. 주인을 (종류, id) 두 칸으로
-- 받으면 외래키를 걸 수 없어, 사건이 지워진 뒤에도 메모가 남는다.
create table if not exists user_memos (
  id uuid primary key default gen_random_uuid(),
  timeline_event_id text references timeline_events(id) on delete cascade,
  segment_id text references segments(id) on delete cascade,
  paper_id text references papers(id) on delete cascade,
  memo_text text not null,
  created_at timestamptz not null default now(),
  constraint user_memos_one_owner check (
    (timeline_event_id is not null)::int
      + (segment_id is not null)::int
      + (paper_id is not null)::int = 1
  )
);

-- 화면은 늘 "이 주인의 메모 전부"를 묻는다. 주인 칸마다 인덱스를 둔다.
create index if not exists user_memos_timeline_event_id_idx on user_memos (timeline_event_id);
create index if not exists user_memos_segment_id_idx on user_memos (segment_id);
create index if not exists user_memos_paper_id_idx on user_memos (paper_id);

-- 읽기는 열고 쓰기는 서비스 키로만 — paper_quotes와 같다.
alter table user_memos enable row level security;
drop policy if exists "public read" on user_memos;
create policy "public read" on user_memos for select using (true);

-- 이미 적어 둔 메모를 옮긴다. 적은 시각을 따로 남겨 둔 적이 없어 created_at은 지금으로
-- 찍힌다 — 옮긴 메모끼리는 순서가 없고, 앞으로 적는 것이 그 뒤에 선다.
insert into user_memos (timeline_event_id, memo_text)
select id, btrim(user_memo) from timeline_events where btrim(coalesce(user_memo, '')) <> '';
insert into user_memos (segment_id, memo_text)
select id, btrim(user_memo) from segments where btrim(coalesce(user_memo, '')) <> '';
insert into user_memos (paper_id, memo_text)
select id, btrim(user_memo) from papers where btrim(coalesce(user_memo, '')) <> '';

-- 옛 칸은 지운다. 남겨 두면 같은 메모가 두 곳에 있게 되고, 둘 중 어느 쪽이 지금 것인지를
-- 읽는 코드마다 다시 정해야 한다.
alter table timeline_events drop column if exists user_memo;
alter table segments drop column if exists user_memo;
alter table papers drop column if exists user_memo;
