-- timeline_events에 출처 URL 컬럼 추가.
-- 관리페이지에서 사건을 직접 만들 때 출처 문헌(source_reference)만 적을 수 있었다 —
-- 원문이 웹에 있는 경우가 대부분인데 링크를 붙일 자리가 없었다.
-- archive_items.source_url과 같은 이름·같은 뜻을 쓴다.
--
-- null = 링크 없는 사건. 기존 행은 전부 null이라 마이그레이션 전후 화면이 같다.

alter table public.timeline_events add column if not exists source_url text;
