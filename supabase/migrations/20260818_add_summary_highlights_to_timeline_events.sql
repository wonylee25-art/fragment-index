-- timeline_events 내용 칸(summary)에 그은 형광펜.
--
-- 사건 전체를 짚는 highlighted(사건명 행에 음영)와는 갈래가 다르다 — 저쪽은 "이 사건이
-- 눈에 띄어야 한다"이고, 이쪽은 내용 두어 문장 안에서 어느 구절이 걸렸는지를 가리킨다.
-- 구술 본문의 segments.highlights와 같은 일이라 저장 모양도 같게 둔다.
--
-- 구조: [{"line": 0, "start": 12, "end": 34}, ...]
--   line  내용은 한 덩이 글이라 늘 0이다. 구술(여러 발화)과 모양을 맞추려고 남겨 둔다 —
--         읽는 코드(sanitizeHighlights·normalize)를 두 벌로 갈라놓지 않기 위해서다.
--   start·end  summary 안의 문자 위치. 화면에 그려지는 글자와 그대로 대응한다.
--
-- 문자 위치로 잡는 이상 내용이 바뀌면 어긋난다. 그래서 사건을 고칠 때 내용이 달라졌으면
-- 형광펜을 함께 지운다(event-actions.ts의 updateEvent). 엉뚱한 구절이 노랗게 남는 것보다
-- 사라졌다는 걸 분명히 아는 편이 낫다 — 구술에서 정한 것과 같은 방식이다.
--
-- null = 그은 것 없음. 기존 행은 전부 null이라 마이그레이션 전후 화면이 같다.

alter table public.timeline_events add column if not exists summary_highlights jsonb;
