-- 사료에도 날짜·키워드·본문 칸을 준다.
--
-- date_value: 사건(timeline_events)과 구술(segments)은 진작부터 EDTF 날짜를 갖고 있었는데
--   사료만 없었다. "언제 것이냐"는 사료의 기본 정보이고, 세 테이블이 같은 표기를 쓰면
--   시대를 가로질러 훑는 일도 한 번에 된다.
-- keywords: 사건·구술·논문에 이미 있는 text[] 칸. 사료만 빠져 있던 예외를 없앤다.
--   검색 적중률보다, 날짜·키워드가 겹치는 사건을 후보로 제안해 연결을 돕는 쪽이 본래 목적이다.
-- full_text: description은 "호버 미리보기에 쓰는 짧은 설명"이라 150자쯤에서 자른다(types.ts).
--   신문기사 전문은 1,500자를 넘기도 해서 그 칸에 들어갈 수 없다. 구술이 segment_text를
--   따로 두는 것과 같은 갈래 — 요약과 원문은 다른 칸에 산다.
alter table archive_items
  add column if not exists date_value text,
  add column if not exists keywords text[],
  add column if not exists full_text text;
