-- segments에 구술 본문 하이라이트 컬럼 추가.
-- 발췌 전체에 붙는 표시(is_important)나 자유 메모(user_memo)와 달리, 본문 안의
-- 특정 구절에 형광펜을 긋는 기능이다. 셋 다 "내가 얹은 것"이라 화면에서는 같은
-- 노랑을 쓴다(design-tokens.ts의 DOT_MINE 참고).
--
-- 구조: [{"line": 0, "start": 12, "end": 34}, ...]
--   line  segment_text를 줄바꿈으로 쪼갠 발화 배열의 인덱스 (segment-text.ts의 parseSegmentText)
--   start·end  그 발화의 text 안 문자 위치. 줄머리("구술자: ")를 떼어낸 뒤의 문자열 기준이라
--              화면에 그려지는 글자와 그대로 대응한다.
--
-- 위치를 문자 오프셋으로 잡는 이상 본문이 바뀌면 어긋난다. 그래서 발췌를 고쳐 저장할 때
-- 하이라이트를 함께 지운다(segment-actions.ts). 엉뚱한 구절이 노랗게 남는 것보다,
-- 사라졌다는 걸 분명히 아는 편이 낫다.
--
-- null = 그은 것 없음. 기존 행은 전부 null이라 마이그레이션 전후 화면이 같다.

alter table public.segments add column if not exists highlights jsonb;
