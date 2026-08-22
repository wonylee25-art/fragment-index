-- 단행본 아래에 장·수록글을 매단다. 책 한 권을 통째로 한 줄로 두면, 그 안의 한 장에만
-- 걸린 메모·인용구·읽음 표시를 적을 자리가 없다 — 장을 papers의 행으로 두면 그 넷이
-- 이미 있는 그대로(id 하나로 붙는 user_memo·paper_quotes·is_read·is_important) 따라온다.
--
-- 자기참조 한 칸이면 되는 이유는 id가 텍스트라서다("riss-<번호>" / "manual-<uuid>").
-- 장은 언제나 손으로 넣는 것이라 id가 manual-로 시작하고, RISS 동기화(scripts/sync-csv.mjs)는
-- riss- 행만 upsert하므로 서로 닿지 않는다. hidden_at이 매주 동기화를 견디는 것과 같은 이치다.
--
-- 깊이는 2단까지만 쓴다(책 > 항목). 컬럼 자체는 더 깊이 매달 수 있지만 목록 화면이
-- 그걸 못 견딘다 — 소제목은 항목 안의 글로 적는다.
alter table papers
  add column if not exists parent_id text references papers(id) on delete cascade;

-- 자식을 찾는 질의는 없다(getPapers가 전 행을 받아 화면에서 묶는다). 이 인덱스는
-- 위 외래키가 부모를 지울 때 자식을 훑기 위한 것이다.
create index if not exists papers_parent_id_idx on papers (parent_id);

-- 엮은이. 수록글 인용에 "OOO 편"이 들어가는데, 논문집이면 부모의 author가 곧 엮은이지만
-- 저서의 한 장이면 그 사람은 저자다 — 두 경우를 author 하나로는 가를 수 없다.
-- 비어 있으면 인용에서 이 자리를 아예 빼고, 역자(translator)와 같은 자리에서 입력받는다.
alter table papers
  add column if not exists editor text;

-- 수록 쪽수("45-72"). 장은 스스로 발행연도를 갖지 않아 year로는 순서가 잡히지 않는다 —
-- 한 책 안의 순서는 이 값의 첫 숫자로 세운다. 인용의 "45-72쪽"도 여기서 온다.
-- 숫자가 아니라 글자인 것은 "iv-xii", "45-" 같은 표기를 그대로 받기 위해서다.
alter table papers
  add column if not exists pages text;

-- 유형에 "수록글"을 들인다. papers_paper_type_check가 넷만 허용하고 있어서, 이걸 고치지 않으면
-- 장을 넣는 순간 23514로 튕긴다.
--
-- 함께, 수록글과 parent_id는 언제나 짝이라는 것을 DB에 적어 둔다. 한쪽만 있는 행은 화면에서
-- 갈 곳이 없다 — 부모 없는 수록글은 아무 데도 안 서고, 부모가 있는 학술논문은 책 아래에
-- 학술논문으로 선다.
alter table papers drop constraint if exists papers_paper_type_check;
alter table papers
  add constraint papers_paper_type_check
  check (paper_type = any (array['학위논문', '학술논문', '단행본', '보고서', '수록글']));

alter table papers drop constraint if exists papers_chapter_has_parent;
alter table papers
  add constraint papers_chapter_has_parent
  check ((paper_type = '수록글') = (parent_id is not null));
