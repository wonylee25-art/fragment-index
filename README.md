# FRAGMENT INDEX (구술 아카이브 웹 서비스)

아카이브즈의 **구술채록사업 결과물**과 그 시대적 맥락을 보여주는 **사료**(문서·사진·유물·신문 등)를 주제·인물·장소·사건 기준으로 연결해 두는 **개인용 시멘틱 아카이브**

## 왜 만들었나

- **사료 연결** — 구술, 사진, 신문기사 등 여러 자료를 겹쳐 사건의 맥락을 파악하기 위해 [연표](#연표)
- **관리 활용** — 국내 아카이브즈의 구술기록 관리·활용 동향을 파악하기 위해 [연구 동향](#연구-동향) · [구술 사업](#구술-사업)

## 핵심 설계 원칙

- **그물망형 연결** — 어떤 노드든 인물/장소/사건 태그로 서로 연결
- **자동화는 가능한 데까지, 확정은 사람이** — 기관 API나 오픈데이터가 있으면 적극 연동하되, 추정 연도·자료 간 사실 충돌(이견)은 시스템이 대신 판단하지 않고 있는 그대로 노출. 최종 확정은 항상 사람이 검토
- **유연한 날짜 체계(EDTF)** — 구술과 사료에는 추정연도가 있을 수 있어 EDTF 형식(`1960s`, `1950~`, `1945~1948` 등)으로 저장

## 용어

- **사건** — `timeline_events`. 연표 한 행의 기본 단위. 사람이 만들고 숨김
- **사료** — `archive_items`. 기관이 공개한 낱장 하나(**건**) — 문서·사진·유물·신문
- **구술** — `segments`. 구술문에서 잘라 낸 발췌 구간
- **계열** — 구술 사업 하나가 낳은 한 벌. 층위는 규칙어(**기록물군 → 계열 → 철 → 건**, ISAD(G) 2판), 묶음은 규칙 밖이라 **카테고리**

## 화면 구성

화면은 **사용자뷰**(읽기 전용)와 **편집**(수집·편집)으로 구분.

| 경로 | 화면 | 설명 |
|---|---|---|
| `/` | [연표](#연표) (메인) | 사료·날짜·사건명·내용·구술 5컬럼 표 |
| `/segments` | [구술 목록](#구술-목록) | 구술문의 발췌 구간 정리 |
| `/research` | [연구 동향](#연구-동향) | RISS·PRISM에서 모은 논문·보고서 정리 |
| `/oral-history-projects` | [구술 사업](#구술-사업) | 국내 아카이브즈의 구술채록 사업 정리 |
| `/admin/timeline` | [편집](#편집) > 사건 | 사건 추가·수정·숨김 |
| `/admin/review` | [편집](#편집) > 사료 | 사료 검색과 사건 연결(미연결/보류) |
| `/admin/oral` | [편집](#편집) > 구술 | 구술 발췌문-사건 연결 |

`/timeline` → `/` 리다이렉트 — 예전 링크 유지.

### 연표

- 5컬럼 표 — 사료·날짜·사건명·내용·구술
- 1900–2026 고정 타임라인 · 중요도/관련도 색상 강조 · 표시 밀도 3단계(전체/내용만/제목만)
- 개인 컬렉션 담기 + CSV 내보내기 — CSV에는 구분·자료 칸이 따로 있어 사건과 자료가 안 섞임
- **올림(`adopted_at`)과 연결(`links`)은 다른 판단** — 본문이 있는 사료는 사건 없이도 제 행으로 섬. 잣대는 [types.ts](src/lib/types.ts)의 `hasTimelineBody` 한 곳
- 연표에 설 날짜를 따로 받음(`timeline_date_value`, EDTF) — 신문 발행일은 자료의 사실이라 안 고침
- 사료 행은 사건명 칸을 비움 — 비어 있다는 것 자체가 "아직 사건으로 안 묶임"

### 구술 목록

- 발췌 구간 날짜순 정렬 · 검색/키워드 필터 · 출처·이견·원문 각주
- 구술 넣는 입구(`OralIntakeForm`)가 여기에도 있음 — 사용자뷰의 유일한 예외

### 연구 동향

- RISS·PRISM에서 모은 학위논문·학술논문·단행본·보고서. 유형·연도·저자·지면 표시, 원문 링크로 연결
- 주제어 클라우드 — 2회 이상 등장한 것만. 누르면 연관 주제어 강조 + 목록 좁힘
- 논문마다 자유 메모 하나 + 페이지 붙인 인용구 여럿(`quotes`)
- 인용 형식 자동 생성([citation.ts](src/lib/citation.ts), 한국문화인류학회) · 노션으로 복사
- `🔄 새로고침` — `npm run fetch:riss && npm run sync`를 백그라운드 실행([research-sync-actions.ts](src/lib/research-sync-actions.ts)). 완료는 화면 위 "최신화: ~ 기준"으로 확인
- 수집 범위 정본은 [scripts/fetch-riss-papers.mjs](scripts/fetch-riss-papers.mjs) · 쳐낸 논문 명부는 [data/cut-papers.json](data/cut-papers.json)

### 구술 사업

- 탭 셋 — `기록물 박스`(주제 카테고리 여섯의 113건을 상자로, 카테고리마다 선반 하나) · `기록물 대장`(같은 113건을 눕혀 한 칸을 세로로 견줌) · `수행기관`(축이 다른 4건을 표로)
- 상자·줄을 누르면 그 자리에서 기술지가 펴짐. 대장에서 누르면 그 계열이 켜진 채 박스로 건너감
- 라벨은 ISAD(G) 2판 필수 6요소 — 참조코드·기술계층·생산자·제목·일자·규모. 나머지는 열었을 때
- 칸은 두 축 32칸 — 기술 축 23칸(사업·주체·내용과 결과·활용) + 활용정책 축 9칸. 정본은 [기술 칸 규격](docs/oral_description_schema.md), 서술 사례는 [파일럿](docs/oral_description_pilot.md)
- 라벨 두 겹 — 왼쪽 글리프(`● ◐ ╱ ·`)는 문서에서 파생, 오른쪽 노란 획은 내가 **검토**한 표시
- 빈칸이 곧 다음 조사 목록 — 「권리 귀속」은 117건 중 확인 0건, 「공개」는 57건이 안 봄
- 화면은 DB가 아니라 [docs/oral_history_projects.md](docs/oral_history_projects.md)를 매 요청 파싱 — 문서를 고치면 화면이 따라 바뀜
- 조사 현황·다음 대상은 그 문서의 「확인했으나 정보 불충분」·「다음으로 고려할 것」

### 편집

- 탭 셋은 하는 일이 아니라 **다루는 것**으로 이름 지음 — 「편집」 안이라 행위어가 없어도 뜻이 서고, 사용자뷰 「구술 사업」과 글자가 안 겹침

- **사건**(`/admin/timeline`)
  - 사건 추가·수정
  - 사건 숨김·되돌리기, 연결선 끊기, 메모 편집
  - 후보 연결선까지 포함해 봄 — 사용자뷰는 확정된 것만
- **사료**(`/admin/review`)
  - 사료 검색 | 국가기록원 · 국립중앙박물관 · 여성사전시관
  - 사건 연결 — 왼쪽 사건 목록을 펼쳐 둔 채 버튼 한 번으로 저장과 연결을 동시에
  - 보류 — 연결 없이 보류함에 쌓임. 사건을 지워도 사료·구술은 보류함으로 돌아감
  - 본문이 있는 사료는 보류함에서 바로 연표에 올림
- **구술**(`/admin/oral`)
  - 구술 발췌문-사건 연결
  - 비활성 구술 함 — 내려 둔 구술이 닿는 유일한 길

## 데이터 구조

- 실데이터는 **Supabase**(Postgres). **원본은 Supabase 하나뿐** — 구글 시트 CSV 동기화는 2026-08-19에 걷어냄
- 입구는 편집 화면(`/admin/*`) — 구술·인물·사건·사료 연결이 여기서 바로 쓰임
- 외부 오픈데이터/API — 국가기록원 · 국립중앙박물관 · 국사편찬위원회 · 서울기록원 · 여성사전시관 · RISS · PRISM · 나라장터
- 어느 값이 어느 화면 어느 자리에 서는지는 [docs/api_data_screens.md](docs/api_data_screens.md), 접근 방식과 자동화 가능 여부는 [docs/archives.md](docs/archives.md)
- 예외 — `/oral-history-projects`만 DB가 아니라 마크다운 문서를 매 요청 파싱([oral-history-projects.ts](src/lib/oral-history-projects.ts))
- 그 화면에서 DB로 가는 것은 노란 획 하나뿐(`oral_series_cell_marks`) — 문서에서 파생되는 값은 DB에 안 둠(두 곳에 두면 갈림)
- 스키마 변경은 [supabase/migrations/](supabase/migrations)에 SQL로 쌓음
- 백업은 `npm run backup`뿐 — 무료 플랜에 자동 백업 없음. 복원은 파일을 보고 사람이 판단해 넣음(자동 복원 스크립트 없음)
- 원본 자료는 재호스팅하지 않고 항상 원본 링크로 연결

## 기술 스택

- **Next.js 16**(App Router) + **React 19** + TypeScript
- **Tailwind CSS v4**
- **Supabase**(`@supabase/supabase-js`) — DB
- `fast-xml-parser` — 국가기록원 등 XML 응답 파싱
- 폰트: Noto Sans KR(본문) · Noto Serif KR(제목·인용구) · IBM Plex Mono(날짜·태그)

> **주의**: 이 저장소의 Next.js는 학습 데이터 기준 버전과 다른 최신 버전(16). 코드를 작성하기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 확인할 것([AGENTS.md](AGENTS.md) 참고).

## 시작하기

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.local.example .env.local
```

- `DATA_GO_KR_API_KEY` — data.go.kr 일반 인증키(Decoding) **하나**. 계정마다 하나뿐이라 서비스별로 안 갈림
  - 갈리는 것은 키가 아니라 **활용신청 승인** — 승인 전에는 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`
  - 쓰는 서비스: 국가기록원 나라기록물정보 · 국립중앙박물관 유물정보(15159017) · 여성사전시관 구술자료(15078220) · 나라장터 입찰공고(15129394)·낙찰정보(15129397) · PRISM 정책연구 과제정보(15080254)
  - 옛 이름(`NATIONAL_ARCHIVES_API_KEY`·`G2B_API_KEY` 등)도 여전히 읽음 — 새 줄이 있으면 그쪽이 이김
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 접속 정보
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 스크립트용 서비스 롤 키(별도 발급, `.env.local`에만 보관)

### 3. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인.

### 주요 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` / `npm run start` | 프로덕션 빌드 / 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run sync` | `data/riss-papers.csv`(논문 목록)를 Supabase에 반영 — 구술·인물·사건·출처는 안 건드림 |
| `npm run fetch:riss` | RISS 논문 메타데이터 수집(요청 간 10초, 수십 분 — 백그라운드 권장). 손으로 고치지 말고 재실행으로 갱신 |
| `npm run fetch:prism` | PRISM 정책연구 과제에서 `구술`·`채록`·`생애사` 과제를 뽑아 계약정보·보고서 URL까지 — 낱말 검색이 없어 기간 전량을 훑고 제목을 이쪽에서 거름 |
| `npm run import:prism` | 위 결과를 `papers`에 「보고서」로 넣음(id `prism-<과제ID>`) — 발주처·계약금액·계약방식은 `papers`에 자리가 없어 문서에만 남음 |
| `npm run backup` | 사람이 만든 것만 골라 `data/backup/snapshot-<날짜>.json`으로 떠냄. 같은 날 다시 돌리면 덮어쓰고, 알맹이가 같으면 안 만듦 |
| `npm run tunnel` | localtunnel로 외부에서 개발 서버 접근 |

자동화(launchd, 저장소 바깥의 `~/Library/LaunchAgents/`):

- `com.fragment-index.backup` — 매일 14:00에 `npm run backup`. 로그는 `data/backup/backup.log`. 끄려면 `launchctl bootout gui/$UID/com.fragment-index.backup`
- `com.fragment-index.research-sync` — 매주 월요일 08:00에 `backup` → `fetch:riss` → `sync`([weekly-research-sync.sh](scripts/weekly-research-sync.sh))
- 7일 지난 스냅샷은 달마다 하나의 `YYYY-MM.tar.gz`로 묶음([rotate-backups.mjs](scripts/lib/rotate-backups.mjs)) — 지우지는 않음

그 밖에 `package.json`에 없는 1회성 스크립트:

- [import-seoul-photo-collections.mjs](scripts/import-seoul-photo-collections.mjs) — 서울기록원 사진아카이브 CSV를 `archive_items`에 반영
- [match-museum-relics.mjs](scripts/match-museum-relics.mjs) — 국립중앙박물관 유물 매칭 후보를 콘솔에 출력(자동 반영 없음)
- [backfill-volume-issue.mjs](scripts/backfill-volume-issue.mjs) — RISS 논문 권호 보강(요청 간 10초)

## 저장소 구조

```
src/app/        라우트(App Router) — /, /segments, /research, /oral-history-projects, /admin/*
src/components/ 화면 단위 클라이언트 컴포넌트
src/lib/        DB 접근·서버 액션·도메인 로직(EDTF 날짜, 인용 형식, 외부 API 클라이언트)
scripts/        수집·동기화 스크립트(Node .mjs) + 주간 자동 동기화용 셸 스크립트
supabase/       마이그레이션 SQL — 스키마 변경 이력
data/           외부 자료 원본·중간 CSV(커밋하지 않음, .gitignore)
docs/           기획·조사·진행 기록 문서 (아래)
public/         정적 파일. `_demo-*.html`은 화면을 정하며 브라우저에서 견준 종이 — dev 서버 주소로 직접 엶
```

루트에는 설정 파일과 `README.md`·`AGENTS.md`(에이전트용 지침, `CLAUDE.md`가 이를 참조)만 둠.

## 프로젝트 문서

| 문서 | 내용 |
|---|---|
| [docs/manual.md](docs/manual.md) | 화면 사용설명서 — 처음 여는 사람이 읽는 안내서 |
| [docs/progress.md](docs/progress.md) | 진행 기록 — 화면을 왜 그 꼴로 세웠는지의 판단 근거 |
| [docs/api_data_screens.md](docs/api_data_screens.md) | 바깥에서 받아 온 값이 어느 화면 어느 자리에 서는지 |
| [docs/archives.md](docs/archives.md) | 외부 아카이브별 접근 방식·자동화 가능 여부(연동 실패한 곳까지) |
| [docs/oral_description_schema.md](docs/oral_description_schema.md) | 기술 칸 32칸 규격 — 구술 사업 기술의 정본 |
| [docs/oral_description_pilot.md](docs/oral_description_pilot.md) | 규격을 실제 서술에 대 본 파일럿 |
| [docs/oral_history_projects.md](docs/oral_history_projects.md) | 국내 구술채록 사업 117건 — `/oral-history-projects`의 데이터 원본 |
| [docs/oral_history_performers.md](docs/oral_history_performers.md) | PRISM에서 뽑은 구술 용역 **수행기관** 110건. 화면에는 안 씀 |
| [docs/oral_history_bids.md](docs/oral_history_bids.md) | 나라장터에서 뽑은 **입찰·발주** 103건. **낙찰자는 없음**. 화면에는 안 씀 |
| [docs/international_oral_history_projects.md](docs/international_oral_history_projects.md) | 해외 국가기관의 구술 사업 분류 축 비교 — 국내 목록의 빈 영역을 찾는 대조군 |
| [docs/nrf_oral_history_research_projects.md](docs/nrf_oral_history_research_projects.md) | 한국연구재단(KRM) 구술 관련 연구과제 438건 전수조사 |

- 세 조사 문서(국내 사업 / 해외 비교 / NRF 과제)는 서로 교차 참조하며 **확인 수준 ●●●·●●○·●○○** 규칙을 공유
- 기획 정리노트(`plan.md`)·로드맵(`roadmap.md`)·선행연구 조사(`literature_review.md`)·파일럿 조사(`pilot1.md`)는 개인 메모라 커밋하지 않고 로컬에만 둠
