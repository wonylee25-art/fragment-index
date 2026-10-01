-- 연구 동향에 신문·잡지 글을 들인다 — 유형 "신문잡지" 하나(기자의 기사도 외부 기고도 같은 유형).
-- papers_paper_type_check가 다섯만 허용하고 있어서, 이걸 고치지 않으면 새 유형으로 저장할 때
-- 제약 위반으로 막힌다. 수록글 ↔ parent_id 짝 제약(papers_chapter_has_parent)은 그대로 둔다.

alter table papers drop constraint if exists papers_paper_type_check;

alter table papers
  add constraint papers_paper_type_check
  check (paper_type = any (array['학위논문', '학술논문', '단행본', '보고서', '신문잡지', '수록글']));
