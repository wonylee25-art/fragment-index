-- 정책연구보고서의 발주처 — 연구를 맡긴 행정기관(PRISM의 organ_name).
-- institution은 인용 형식이 "수행기관 연구보고서"라 부르는 자리라 수행기관이 차지하므로,
-- 발주·수행의 두 주체를 가르려면 칸이 따로 있어야 한다(docs/oral_history_performers.md).
-- 보고서 유형에만 값이 들어간다.
alter table public.papers add column if not exists ordering_agency text;
