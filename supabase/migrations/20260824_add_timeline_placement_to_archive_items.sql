-- 사료를 사건 없이도 연표에 세운다.
--
-- 그전까지 사료가 연표에 나오는 길은 하나뿐이었다 — 사건에 붙어서, 그 사건 행의 사료 칸에.
-- 그런데 신문기사는 그 자체로 "언제 무슨 일이 있었나"를 증언한다. 붙일 사건이 아직 없다는
-- 것은 그 기사에 연표에 설 값이 없다는 뜻이 아니라, 사건 쪽 정리가 아직 안 됐다는 뜻일
-- 뿐이다. 그래서 사건을 거치지 않고 자료가 제 이름으로 한 행을 차지할 수 있게 한다.
--
-- 칸 셋을 더한다.
--
--   adopted_at         — "연표에 올림" 딱지. timeline_events의 같은 이름 칸과 같은 뜻이다
--                        (20260818_add_adopted_at_to_timeline_events.sql): 있으면 연표에
--                        나오고, 없으면 보류함에만 있다. 날짜가 있다고 저절로 올라가지는
--                        않는다 — 올릴지는 사람이 정한다.
--   timeline_date_value — 연표에서 이 자료가 설 날짜(EDTF).
--   highlighted        — 내가 그은 표시. 사건의 같은 이름 칸과 같다.
--
-- date_value(발행일)를 연표 날짜로 그대로 쓰지 않는 이유가 이 마이그레이션의 핵심이다.
-- 신문의 date_value는 "이 기사가 실린 날"이지 "이 기사가 말하는 일이 일어난 날"이 아니다.
-- 1961-09-20자 「그저 한산하기만-추석대목 서울의 상가」는 본문이 "앞으로 나흘이면 추석"이라
-- 증언하는 것은 9월 24일 무렵의 대목 경기다. 1983-08-05자 동대문시장 기사는 78~79년의
-- 형성 과정을 적고 있어 한 점이 아니라 구간으로 서야 맞다. 그래서 연표에 설 날짜는 따로
-- 받는다 — 딱지를 찍을 때 발행일로 채워두고, 거기서부터 사람이 조정한다. 발행일은 자료의
-- 사실이므로 그대로 둔다(화면은 둘을 나란히 보여준다).
--
-- EDTF라서 "1961-09-24"뿐 아니라 "1961-09", "1978~1983"처럼 폭을 가진 값도 그대로 쓴다.
--
-- 이 길로 서는 것은 옮겨 적어 둔 본문이 있는 사료뿐이다(지금은 신문기사 90건). 본문이 없으면
-- 내용 칸이 비어 날짜 하나만 놓인 빈 행이 된다 — 사진·유물은 사건에 붙어 그 행의 사료 칸에
-- 설 때 제 몫을 한다. 구술도 이 길로는 서지 않는다: 발췌는 사건에 붙어 구술 칸에 선다.
-- 그 잣대는 코드 한 곳(types.ts의 hasTimelineBody)에 두고 화면·서버·질의가 함께 쓴다.

alter table public.archive_items
  add column if not exists adopted_at timestamptz,
  add column if not exists timeline_date_value text,
  add column if not exists highlighted boolean not null default false;

-- 연표는 늘 "딱지 찍힌 것 전부"를 묻는다.
create index if not exists archive_items_adopted_at_idx
  on public.archive_items (adopted_at)
  where adopted_at is not null;
