# fragment-index (구술 아카이브 웹 서비스)

주제를 중심에 두고, 여러 기관이 공개한 **구술채록사업 결과물**(발췌 구간)과 그 시대적 맥락을 보여주는 **사료**(문서·사진·유물·신문 등)를 인물·장소·사건 기준으로 그물망처럼 연결해 두는 **개인용 시멘틱 아카이브**입니다.

## 왜 만들었나

구술만 보면 개인의 기억이라 파편적이고, 신문·기록물만 보면 개인의 경험이 빠져 있습니다 — 여러 자료를 겹쳐봐야만 그 시절의 맥락이 온전히 보인다는 문제의식에서 출발했습니다(구술사 방법론의 교차 대조(triangulation)와 콘텐츠/의미 매핑 이론 등 학술적 배경 참고).

주제로 직접 논문을 쓰기 위해서는 국내에서 구술기록을 어떻게 관리·활용하고 있는지 선행연구 동향을 계속 파악할 필요가 있었고, 그 필요에서 나온 것이 [연구 동향(`/research`)](#연구-동향-research-상세) 화면입니다.

## 핵심 설계 원칙

- **그물망형 연결** — 발췌 구간·사료·연표 항목 등 어떤 노드든 위계 없이 인물/장소/사건 태그로 서로 연결됩니다. 구술이 화면상 대표 진입점이긴 하지만, 연결 자체가 구술을 반드시 거쳐야 하는 구조는 아닙니다.
- **확인되지 않은 정보는 확인되지 않은 대로 표시** — 추정 연도, 자료 간 사실 충돌(이견) 등을 시스템이 대신 판단하지 않고 있는 그대로 노출합니다.
- **자동화는 가능한 데까지, 확정은 사람이** — 기관 API나 오픈데이터가 있으면 적극 연동하되, 최종 확정은 항상 사람이 검토합니다.
- **유연한 날짜 체계(EDTF)** — 구술은 화자 기억으로 추정 연도만 아는 경우가 많고, 신문기사는 정확한 발행일이 있습니다. 이렇게 정밀도가 제각각인 날짜를 EDTF 형식(`1960s`, `1950~`, `1945~1948` 등)으로 통일 저장해 연표에서 함께 정렬·비교합니다.

## 화면 구성

화면은 **사용자뷰**(읽기 전용)와 **관리**(수집·편집)로 갈립니다. 연표가 곧 메인화면이고, 별도의 홈 화면은 두지 않습니다.

| 경로 | 화면 | 설명 |
|---|---|---|
| `/` | 연표 (메인) | 사료·날짜·사건명·내용·구술 5컬럼 표. 1900–2026 고정 타임라인, 관련도 색상 강조, 표시 밀도 3단계(전체/내용만/제목만), 개인 컬렉션 담기 + CSV 내보내기. 확정된 연결선만 보여줌 |
| `/segments` | 구술 목록 | 발췌 구간을 날짜순 리스트로 보여주고, 검색/키워드 필터/정렬, 이견·원문 각주 표시, 관련자료 미리보기를 지원 |
| `/research` | 연구 동향 | RISS에서 수집한 국내 구술사/생애사 관련 학위논문·학술논문·단행본 메타데이터, 인용구·개인 메모 관리 |
| `/oral-history-projects` | 구술사업 지도 | 국내 구술채록 사업을 지역별로 정리 ([docs/oral_history_projects.md](docs/oral_history_projects.md)를 그대로 읽어 렌더링) |
| `/admin/timeline` | 관리 › 연표 관리 | 후보 연결선까지 포함해 보고, 사건 추가·수정·숨김(되돌리기 가능), 연결선 끊기, 메모 편집 |
| `/admin/review` | 관리 › 검토함 | 사료 검색(외부 소스) → 내용 확인 → 사건에 연결하며 저장. 아래 보류함에는 아직 어느 사건에도 안 붙은 자료가 쌓이고, 거기서도 같은 방식으로 연결 |

`/timeline`은 예전 링크를 살려두기 위해 `/`로 리다이렉트합니다.

### 검토함 (`/admin/review`) — 수집에서 연결까지 한 화면

외부 소스 검색은 **자료를 모으는 편집 작업**이라 사용자뷰가 아니라 관리 안에 둡니다. 화면은 왼쪽에 연결 대상 사건 목록을 계속 펼쳐두고(드롭다운을 쓰지 않아, 자료마다 목록을 다시 띄울 필요가 없음), 오른쪽 사료 카드에서 버튼 한 번으로 **저장과 연결을 동시에** 처리합니다.

- 판단이 서지 않으면 `[보류]`로 자료만 저장 — 연결 없이 아래 보류함에 쌓입니다. `links.status`의 `candidate`는 쓰지 않고, 나중에 자동 매칭이 붙을 때 "기계가 제안한 연결"을 담을 자리로 비워둡니다.
- 연결 후보 사건은 **같은 검색어로 걸린 DB 사건**입니다. 보류함은 검색어가 없어 사건 전체가 후보라 목록에 좁히기 칸이 붙습니다.
- 사건을 지우면 사건과 연결선만 사라지고, 붙어 있던 사료·구술은 지워지지 않고 보류함으로 돌아갑니다.
- 국립중앙박물관 자료는 목록 API에 설명이 없어 유물마다 상세 API를 한 번 더 불러 설명·크기·재질을 카드에 싣습니다(검색 1회당 API 7회). 국가기록원은 상세 API가 없어 제목·생산기관·연도·열람 여부가 전부입니다.

### 연구 동향 (`/research`) 상세

기획(구술+사료 아카이브)과는 별도 축으로, **국내 구술사/구술생애사 연구 동향을 계속 따라가기 위한 개인용 문헌 관리 화면**입니다.

- **주제어 클라우드** — 전체 논문의 키워드를 빈도순으로 크기 차등 표시(2회 이상 등장한 것만, 노이즈 억제). 하나를 클릭하면 같은 논문에서 함께 등장한 연관 주제어가 호박색으로 강조되고, 아래 목록이 해당 주제어로 좁혀집니다.
- **논문 목록** — 유형(학위논문/학술논문/단행본)·연도·저자·학술지(권호)/학위수여기관/출판사 표시, RISS 원문 링크로 연결. 목록에서 바로 ★ 중요, ✓ 읽음 토글과 삭제가 가능하고, `+ 논문 추가`로 수기 등록도 지원합니다.
- **개인 메모 & 인용구** — 논문마다 자유 메모 하나, 그리고 페이지 번호를 붙인 인용구를 여러 개 쌓을 수 있습니다(`quotes`, 논문당 자유 메모와는 별개 개념).
- **인용 형식 자동 생성** — [src/lib/citation.ts](src/lib/citation.ts)가 한국문화인류학회 인용 형식(저자, 연도, "제목," 출처)으로 서지사항을 만들고, `📋 노션으로 복사` 버튼([CopyForNotionButton](src/components/CopyForNotionButton.tsx))으로 서지+메모+인용구를 마크다운 블록쿼트째로 클립보드에 복사할 수 있습니다.
- **원클릭 새로고침** — `🔄 새로고침` 버튼을 누르면 서버에서 `npm run fetch:riss && npm run sync`를 백그라운드로 실행합니다([research-sync-actions.ts](src/lib/research-sync-actions.ts)). 이 두 명령은 논문 목록에만 손댑니다. `fetch-riss-papers.mjs`는 이미 처리한 논문(`paper_id`)은 건너뛰므로, 보통은 새 논문 유무 확인(수 분)만으로 끝나고 새 논문이 있을 때만 건당 10초(robots.txt `Crawl-delay`)가 더 걸립니다. 화면 상단의 "최신화: ~ 기준" 시각으로 완료 여부를 확인합니다.
- **수집 범위**([scripts/fetch-riss-papers.mjs](scripts/fetch-riss-papers.mjs) 참고) — 학위논문은 "구술사"+"구술생애사" 정확검색 합집합(교육/종교/스포츠 계열 기관 제외), 학술논문은 "구술사"+"구술생애사"+"생애사" 정확검색 합집합 중 『구술사연구』(한국구술사학회지)·한국구술사학회 학술대회 발행물만 포함합니다.

## 데이터 구조

실데이터는 **Supabase**(Postgres)에 저장되어 있고, 원본 소스는 두 갈래입니다.

1. **관리 화면(`/admin`)에서 직접 넣고 고친 것** — 구술 발췌, 인물, 사건, 사료 연결이 모두 여기서 Supabase에 바로 쓰입니다. **원본은 Supabase 하나뿐입니다.** 2026-08-19까지는 구글 시트(fragments_index)에서 내보낸 `data/*.csv` 4개를 `npm run sync`로 밀어 넣었으나, 화면에서 고친 값을 시트의 옛 값으로 되돌리는 문제가 있어 걷어냈습니다(걷어낸 CSV는 `data/backup/`).
2. **외부 오픈데이터/API** — 국가기록원, 국립중앙박물관 유물정보, 국사편찬위원회 "오늘의역사" 원문(XML), 서울기록원 사진아카이브, RISS 논문 메타데이터 등. 어떤 아카이브에 접근을 시도했고 자동화가 가능한지는 [docs/archives.md](docs/archives.md)에 전부 기록해 둡니다(성공/실패 무관하게).

`/oral-history-projects` 화면만은 예외로 DB가 아니라 **마크다운 문서를 직접 읽습니다** — [docs/oral_history_projects.md](docs/oral_history_projects.md)를 매 요청마다 파싱하므로([src/lib/oral-history-projects.ts](src/lib/oral-history-projects.ts)), 문서를 고치면 화면이 따라 바뀝니다.

원본 자료는 재호스팅하지 않고 항상 원본 링크로 연결하는 것이 원칙입니다.

## 기술 스택

- **Next.js 16**(App Router) + **React 19** + TypeScript
- **Tailwind CSS v4**
- **Supabase**(`@supabase/supabase-js`) — DB
- `fast-xml-parser` — 국가기록원 등 XML 응답 파싱
- 폰트: Noto Sans KR(본문) · Noto Serif KR(제목·인용구) · IBM Plex Mono(날짜·태그)

> **주의**: 이 저장소의 Next.js는 학습 데이터 기준 버전과 다른 최신 버전(16)입니다. 코드를 작성하기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 확인하세요 ([AGENTS.md](AGENTS.md) 참고).

## 시작하기

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사한 뒤 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

- `NATIONAL_ARCHIVES_API_KEY` — 국가기록원 나라기록물정보 서비스(data.go.kr) 인증키
- `NATIONAL_MUSEUM_API_KEY` — 국립중앙박물관 전국 박물관 유물정보 서비스(data.go.kr) 인증키
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 프로젝트 접속 정보
- `SUPABASE_SERVICE_ROLE_KEY` — `npm run sync` 등 서버 스크립트에서 쓰는 서비스 롤 키(별도 발급 필요, `.env.local`에만 보관)

### 3. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다.

### 주요 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` / `npm run start` | 프로덕션 빌드 / 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run sync` | `data/riss-papers.csv`(논문 목록)를 Supabase에 반영. 새 행은 insert, 기존 행은 갱신. 구술·인물·사건·출처는 여기서 다루지 않습니다 — 관리 화면이 유일한 입구입니다 |
| `npm run fetch:riss` | RISS에서 구술사/구술생애사 관련 논문 메타데이터를 긁어 `data/riss-papers.csv` 생성(요청 간 10초 대기, 수십 분 소요 — 백그라운드 실행 권장). 손으로 수정하지 말고 재실행으로 갱신할 것 |
| `npm run tunnel` | localtunnel로 외부에서 개발 서버 접근 |

그 밖에 `package.json`에 등록하지 않은 1회성·자동화 스크립트가 `scripts/`에 있습니다.

- [scripts/weekly-research-sync.sh](scripts/weekly-research-sync.sh) — launchd(`com.fragment-index.research-sync`)가 매주 월요일 08:00에 `fetch:riss` + `sync`를 실행. 그 시각에 노트북이 꺼져 있었으면 다음 로그인 때 따라잡고, 이미 이번 주에 돌았으면 건너뜁니다
- [scripts/import-seoul-photo-collections.mjs](scripts/import-seoul-photo-collections.mjs) — 서울기록원 사진아카이브 컬렉션 CSV를 `archive_items`에 반영
- [scripts/match-museum-relics.mjs](scripts/match-museum-relics.mjs) — 국립중앙박물관 유물 매칭 후보를 콘솔에 출력(자동 반영하지 않고 사람이 확인)
- [scripts/backfill-volume-issue.mjs](scripts/backfill-volume-issue.mjs) — RISS 논문의 권호 정보 보강(요청 간 10초 대기)

## 저장소 구조

```
src/app/        라우트(App Router) — /, /segments, /research, /oral-history-projects, /admin/*
src/components/ 화면 단위 클라이언트 컴포넌트
src/lib/        DB 접근·서버 액션·도메인 로직(EDTF 날짜, 인용 형식, 외부 API 클라이언트)
scripts/        수집·동기화 스크립트(Node .mjs) + 주간 자동 동기화용 셸 스크립트
data/           구글 시트 export CSV·원본 내려받기(커밋하지 않음, .gitignore)
docs/           기획·조사·진행 기록 문서 (아래)
public/         정적 파일
```

루트에는 설정 파일과 `README.md`·`AGENTS.md`(에이전트용 지침, `CLAUDE.md`가 이를 참조)만 둡니다.

## 프로젝트 문서

조사·기록 문서는 전부 [`docs/`](docs)에 모아뒀습니다.

| 문서 | 내용 |
|---|---|
| [docs/progress.md](docs/progress.md) | 실제로 만든 화면·코드와 그 이유를 정리한 진행 기록 (초기 구현 시점 기준 — 현재 화면 구조는 이 README가 기준) |
| [docs/archives.md](docs/archives.md) | 외부 아카이브별 접근 방식·자동화 가능 여부 조사 기록 (연동 실패한 곳까지 전부) |
| [docs/oral_history_projects.md](docs/oral_history_projects.md) | 국내 구술채록 사업을 5W1H로 정리 — `/oral-history-projects` 화면의 데이터 원본 |
| [docs/international_oral_history_projects.md](docs/international_oral_history_projects.md) | 해외 주요 국가기관의 구술 사업 분류 축 비교 — 국내 목록의 빈 영역을 찾기 위한 대조군 |
| [docs/nrf_oral_history_research_projects.md](docs/nrf_oral_history_research_projects.md) | 한국연구재단(KRM) 구술 관련 연구과제 438건 전수조사 — 상설 사업의 "원형" 가설 검증 |

세 조사 문서(국내 사업 / 해외 비교 / NRF 과제)는 서로 교차 참조하며, **확인 수준을 ●●●·●●○·●○○로 표시**하는 규칙을 공유합니다 — 확인되지 않은 것은 확인되지 않은 대로 남긴다는 원칙에 따른 것입니다.

기획 정리노트(`docs/plan.md`)·로드맵(`docs/roadmap.md`)·선행연구 조사(`docs/literature_review.md`)·파일럿 조사(`docs/pilot1.md`)는 개인 작업 메모라 저장소에는 커밋하지 않고 로컬에만 둡니다(`.gitignore` 참고).
