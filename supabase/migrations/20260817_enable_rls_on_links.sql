-- links만 RLS가 꺼진 채 남아 있었다. 공개된 anon 키로 사건-사료 연결선을 누구나 고치고
-- 지울 수 있는 상태라, 다른 열다섯 테이블과 같은 모양으로 맞춘다.
--
-- 읽기만 열어 둔다: 화면(anon 키)은 연결선을 읽어야 연표에 사료·구술이 함께 뜬다.
-- 쓰기 정책은 두지 않는다 — 서버 액션이 쓰는 service_role 키는 RLS를 지나치므로,
-- 정책이 없다는 것이 곧 "내 서버를 거치지 않으면 못 고친다"가 된다.
alter table links enable row level security;

create policy "public read" on links for select using (true);
