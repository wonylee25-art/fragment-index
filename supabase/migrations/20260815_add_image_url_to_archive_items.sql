-- archive_items에 원본 아카이브 썸네일 URL 컬럼 추가.
-- 국립중앙박물관 유물처럼 이미지가 곧 내용인 자료를, 검토 화면에서 원문을 열지 않고도
-- 판단할 수 있게 하기 위한 것. 이미지는 재호스팅하지 않고 원본 URL만 저장한다.
--
-- 2026-08-15 원격 DB(egqcxbjdzlqddmxjsvff)에 적용 완료.
-- 기존 17건은 null로 남는다 — 이후 저장되는 자료부터 채워진다.

alter table public.archive_items add column if not exists image_url text;
