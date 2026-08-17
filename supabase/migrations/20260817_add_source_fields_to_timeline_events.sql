-- 출처가 책·학술지·간행물이면 제목만으로는 다시 찾아갈 수 없다 — 저자와 쪽수가 있어야
-- 인용이 검증 가능해진다. 유형은 그 두 칸을 언제 물을지 정하는 열쇠이자, 출처 표기를
-- 어떤 서지 형식으로 조립할지의 근거다.
alter table timeline_events
  add column if not exists source_type text,
  add column if not exists source_author text,
  add column if not exists source_pages text;
