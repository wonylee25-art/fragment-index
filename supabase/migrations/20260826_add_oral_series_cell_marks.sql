-- 구술 사업 라벨에서 내가 켠 칸을 담는다. 뜻은 하나 — "여기는 더 볼 일 없다".
--
-- 라벨은 두 겹이다. 왼쪽 글리프는 docs/oral_history_projects.md에서 자동으로 찍히므로
-- DB에 둘 것이 없다 — 문서와 두 곳이 되면 조사하다 문서만 고치는 순간 갈린다.
-- 이 표에 담기는 것은 문서에 없던 정보, 곧 조사자의 작업 상태뿐이라 겹칠 것이 없다.
-- is_important·highlighted와 같은 갈래다("내가 얹은 표시").
--
-- 켠 것만 행으로 남긴다. 끄면 행을 지운다 — 상태가 켜짐/꺼짐 하나뿐이라(재확인 필요 같은
-- 둘째 상태를 두지 않기로 했다) 참·거짓 칸을 따로 둘 이유가 없다.
--
-- 주인을 참조코드(KR-OHP-1.01.1)로 잡지 않는 이유: 그 코드는 문서에 기관이 나오는 순서로
-- 매겨져서, 가운데에 기관 하나가 끼면 뒤엣것이 전부 밀린다. 밀리면 표시가 엉뚱한 사업에
-- 붙는다. 기관명과 사업명은 문서를 고치지 않는 한 그대로라 이쪽이 덜 흔들린다
-- (한 카테고리 안에서 이 조합이 유일하다는 것은 지금 문서에서 확인됨).
create table if not exists oral_series_cell_marks (
  institution text not null,
  project_name text not null,
  -- overview = 사업 개요 6칸, policy = 활용정책 9칸
  axis text not null check (axis in ('overview', 'policy')),
  -- 개요는 "언제"..."어떻게", 정책은 "1"~"9"
  cell_key text not null,
  marked_at timestamptz not null default now(),
  primary key (institution, project_name, axis, cell_key)
);

-- 화면은 늘 "이 사업의 켠 칸 전부"를 묻고, 첫 그림에서는 52건을 통째로 읽는다.
create index if not exists oral_series_cell_marks_series_idx
  on oral_series_cell_marks (institution, project_name);

-- 읽기는 열고 쓰기는 서비스 키로만 — user_memos와 같다.
alter table oral_series_cell_marks enable row level security;
drop policy if exists "public read" on oral_series_cell_marks;
create policy "public read" on oral_series_cell_marks for select using (true);
