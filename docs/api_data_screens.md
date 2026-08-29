# API 데이터가 화면에 어떻게 서는가

바깥에서 받아 온 것이 어느 화면의 어느 자리에 어떤 이름으로 서는지를 한 장으로 적는다.
받아 오는 방법(스크립트·인증키·호출 조건)은 [README](../README.md)와 [docs/archives.md](archives.md)에 있고,
이 문서는 **그 다음** — 받은 값이 화면에서 무엇이 되는지를 맡는다.

마지막 손질: 2026-08-29.

---

## 0. 두 갈래

바깥 자료가 화면에 닿는 길은 둘뿐이다. 어느 쪽인지가 곧 "지금 화면에 뜬 것이 언제 것이냐"를 가른다.

| | **즉석** | **적재** |
|---|---|---|
| 언제 부르나 | 화면을 열 때마다(요청 안에서) | 사람이 스크립트를 돌릴 때 |
| 어디 남나 | 아무 데도 — 화면에만 뜬다 | Supabase 또는 `docs/*.md` |
| 쓰는 곳 | 사료 검색(`/admin/review`) | 그 밖의 모든 화면 |
| 늦으면 | 그 무리만 빈다(다른 무리는 뜬다) | 화면은 멀쩡하다, 옛 값이 뜬다 |
| 원본 | data.go.kr 셋 | RISS·PRISM·나라장터·국편·서울기록원·시트 |

즉석 쪽이 저장되지 않는 것은 **6-5 정책** 때문이다 — 남의 원문을 우리가 들고 있지 않는다.
사람이 [연결하고 저장]을 누른 그 한 건만 `archive_items`에 앉고, 그때 옮겨 적히는 것도
메타데이터와 링크뿐이다.

---

## 1. 원본 → 화면 한눈

| 원본 | 서비스 ID | 부르는 자리 | 거쳐가는 곳 | 화면 |
|---|---|---|---|---|
| 국가기록원 나라기록물정보 | 15158780 | `src/lib/national-archives.ts` | — (즉석) | `/admin/review` 사료 검색 |
| 국립중앙박물관 전국 박물관 유물정보 | 15159017 | `src/lib/museum-relics.ts` | — (즉석) | `/admin/review` 사료 검색 |
| 성평등가족부 여성사전시관 구술자료 | 15078220 | `src/lib/womens-oral-archive.ts` | — (즉석) | `/admin/review` 사료 검색 |
| 행안부 정책연구 과제정보(PRISM) | 15080254 | `scripts/fetch-prism-research.mjs` | `data/raw/prism-research.json` → `papers` | `/research` 연구 동향 |
| 조달청 나라장터 입찰공고 | 15129394 | `scripts/search-g2b-bids.mjs` | `docs/oral_history_bids.md` | (아직 화면 없음) |
| 조달청 나라장터 낙찰정보 | 15129397 | `scripts/fetch-g2b-awards.mjs` | 같은 문서의 빈 칸 | (아직 화면 없음) |
| 국사편찬위 오늘의역사 | 원문 XML | `scripts/import-th-timeline.mjs` | `timeline_events` | `/`·`/admin/timeline` |
| 서울기록원 사진아카이브 컬렉션 | 15134917 | `scripts/import-seoul-photo-collections.mjs` | `archive_items` | `/admin/review` 함들·연표 |
| RISS 논문 메타데이터 | (크롤링) | `scripts/fetch-riss-papers.mjs` | `data/riss-papers.csv` → `papers` | `/research` 연구 동향 |
| 신문기사 시트 | (구글 시트) | `scripts/import-newspaper-articles.mjs` | `archive_items` | `/admin/review` 함들·연표 |
| PRISM·나라장터에서 사람이 읽어 옮긴 것 | — | 손 | `docs/oral_history_projects.md` | `/oral-history-projects` 구술 사업 |

---

## 2. 화면별로 무엇이 뜨는가

### 2-1. 사료 검색 — `/admin/review?tab=search`

한 검색어로 넷을 한꺼번에 부른다(`MaterialSearch`). 셋은 바깥 API, 하나는 우리 DB다.
`Promise.allSettled`라 **한 곳이 죽어도 나머지는 뜬다** — 죽은 무리 자리에는 카드 대신 오류 줄이 선다.
카드에 원문을 열지 않고도 판단할 만큼을 싣는 것이 이 화면의 규칙이라, 목록 API가 모자라면 상세를 한 번 더 부른다.

**국가기록원** (제목·생산기관·연도·공개 여부가 전부 — 상세 API가 없다)

| API 필드 | 화면 |
|---|---|
| `title` | 카드 표제 |
| `prod_name` | 메타 줄 `문서 · {생산기관} · {연도}`, 저장 시 소장기관 |
| `prod_year` | 같은 줄 · 네 자리일 때만 EDTF 날짜로 옮겨 담는다 |
| `online_reading = Y` | 뱃지 「원문 온라인 열람」 |
| `is_open ≠ 1` | 뱃지 「비공개」 |
| `link` | 카드의 출처 링크 |
| — | 유형은 **문서**로 고정 |

**국립중앙박물관** (목록에 설명이 없어 유물마다 상세를 한 번 더 부른다 — 검색 한 번에 호출 일곱 번)

| API 필드 | 화면 |
|---|---|
| `name` | 카드 표제 |
| `imgThumUriL`(없으면 M·원본) | 카드 그림 |
| `desc`(상세) | 카드 본문 — 저장하면 설명 칸 |
| `purposeName3`·`museumName2`·`materialName1`·`sizeInfo` | 메타 줄에 점으로 이어 붙인다 |
| `id` | e뮤지엄 상세 링크 |
| — | 유형은 **박물** — 딸려온 사진이 아니라 실물이 자료다 |

**여성사전시관 구술자료** (문서의 필드 설명과 실제 값이 어긋나는 곳이다 — 이름은 뜻을 기준으로 붙였다)

| API 필드 | 실제 뜻 | 화면 |
|---|---|---|
| `vdoUrlAddr` | 인터뷰 제목 | 카드 표제 |
| `dctnDataNm` | 시리즈 이름 | 메타 줄·소장기관 `여성사전시관 ({카테고리})` |
| `vdoSbttlIfmtn` 안 `<textarea>` | 구술 요약 | 카드 본문(300자에서 끊는다) |
| `vdoSbttlIfmtn` 안 `<iframe src>` | 유튜브 주소 | 뱃지 「영상 있음」에만 쓴다 |
| `regYmd` | 등록일 | 메타 줄 |
| — | — | 출처 링크는 **API의 유튜브가 아니라** 제목으로 맞춘 전시관 게시판 상세 페이지(`womens-oral-links.json`) |

세 무리 위에는 검색어와 얼마나 겹치는지(표제 2점·본문 1점)가 카드 종이의 짙기로 앉고,
이미 저장한 것에는 저장 표시가 붙어 같은 자료를 두 번 담지 않게 한다.
아래에는 DB에서 걸린 사료·구술이 같은 모양의 카드로 선다.

### 2-2. 연표 — `/`, 사건 관리 — `/admin/timeline`

국편 오늘의역사 6,436건(1900년 이후)은 **미리 통째로 `timeline_events`에 들어와 있다**.
들어온 사건은 `adopted_at`이 비어 있어 창고에만 있고 연표에는 안 뜬다 — 사료·구술이 붙는 순간 딱지가 붙어 올라온다.
그래서 이 자료가 화면에서 처음 보이는 자리는 연표 표가 아니라 **도구 줄 검색어에 걸려 표 위에 붙는 띠**(`OffTimelineFinder`)다.

> 옛 길 하나가 코드에만 남아 있다. `src/lib/th-timeline.ts`의 `searchThTimeline`과
> `actions.ts`의 `saveThEvent`는 XML을 즉석에서 훑어 한 건씩 담던 자리인데, 통째로 적재하는
> 방식으로 바꾼 뒤 부르는 데가 없다. 화면 동작에는 영향이 없지만, 다음에 손댈 때 걷을 것.

### 2-3. 연구 동향 — `/research`

`papers` 한 표에 네 유형이 함께 산다(정렬 옆 칩으로 가른다). 그중 둘이 바깥에서 온다.

- **학술논문·학위논문** — RISS. 화면의 [새로고침]은 `fetch:riss && sync`를 백그라운드로 띄우고 바로 돌아온다.
  끝난 때는 「최신화: ~ 기준」 줄로 확인한다.
- **보고서** — PRISM 정책연구 과제. 이 API에는 낱말 검색이 없어 기간으로 전량을 훑고 제목을 이쪽에서 거른다.

보고서 한 줄이 화면에서 서는 모양:

| PRISM | `papers` 칸 | 화면 |
|---|---|---|
| 과제명 | `title` | 표제 |
| 수행기관 | `institution` | 메타 줄 앞 — 인용 형식이 "수행기관 연구보고서"라 이 자리를 쓴다 |
| 발주 기관 | `ordering_agency` | 메타 줄 `· 발주: …` |
| 연구기간 | `research_period` | 메타 줄 |
| 수행연구원 | `research_team` | 메타 줄 `· 연구진: …` |
| 초록 또는 과업 개요 | `research_summary` | 펼친 본문 — **화면에서만** 겹치는 머리(용역명·기간·용역사·금액)를 걷는다(`report-summary.ts`). DB에는 원문이 남고 검색도 원문을 훑는다 |
| 계약금액·계약방식 | (칸 없음) | 안 뜬다 — `data/raw/prism-research.json`과 `docs/oral_history_performers.md`에만 있다 |

### 2-4. 구술 사업 — `/oral-history-projects`

여기만 길이 다르다. **API → 스크립트 → 사람 → 문서 → 화면**이다.
PRISM·나라장터에서 훑은 것은 자동으로 등재되지 않는다. 사람이 읽고 새 계열인지 빈칸인지 가려
`docs/oral_history_projects.md`에 옮겨 적고, 화면은 요청마다 그 문서를 다시 파싱해 세운다(`oral-history-projects.ts`).
문서만 고치면 화면이 따라 바뀐다.

- 기술 칸은 ISAD 32칸(기술 23 + 정책 9)이고, 칸마다 확인·일부·못찾음·안봄 넷 중 하나를 진다 — "못 찾았다"와 "아직 안 봤다"는 다른 정보다.
- 사업 하나가 계열 하나이고, 확인 수준은 ●●●·●●○·●○○로 적는다. 모자란다고 등재를 미루지 않는다.
- 보기 넷: 기록물 박스 / 기록물 대장 / 수행기관(축이 달라 표로 눕힌다) / 정책.

### 2-5. 연결함·보류함·미연결함 — `/admin/review?tab=…`

적재로 들어온 사료가 사는 자리다. 서울기록원 사진 컬렉션과 신문기사 시트가 여기 섞여 있고,
바깥에서 즉석으로 검색해 저장한 것도 같은 함으로 떨어진다. 함을 가르는 것은 출처가 아니라
**사건에 붙었느냐**(연결/보류/미연결)다. 메타 줄은 `유형 · 소장기관 · 날짜`로 통일한다 —
무엇이냐, 어디 것이냐, 언제 것이냐 순서다.

---

## 3. 아직 화면에 없는 것

| 자료 | 지금 있는 곳 | 왜 화면에 없나 |
|---|---|---|
| 나라장터 입찰·발주 103건 | `docs/oral_history_bids.md` | 공고는 사업의 그림자다 — 사업 계열로 정리되기 전이라 어느 상자에 얹을지 아직 못 정했다 |
| 낙찰자·낙찰금액 | 같은 문서(빈 칸이 많다) | `fetch:awards`가 메우는 중. 참여업체 명단은 API에 아예 없다 |
| 계약금액·계약방식 | `prism-research.json`·`oral_history_performers.md` | `papers`에 칸이 없다. 넣으려면 이관(migration)이 먼저 |
| 국가기록원 상세 정보 | 없음 | 상세 API가 없다. 카드에는 네 값이 한계 |

붙일 계획을 세운다면 순서는 이렇다 — ① 낙찰 결과로 대장의 빈 칸을 메우고, ② 공고를 사업 계열에 붙여
`oral_history_projects.md`의 「누가 얼마에」 칸으로 흡수하고, ③ 그래도 남는 계약 정보는 그때 `papers`에 칸을 낸다.
새 화면을 세우기 전에 **이미 선 화면의 빈 칸부터 메운다**.

---

## 4. 지키는 것

1. **원문을 다시 호스팅하지 않는다** — 메타데이터와 링크까지다. 영상·이미지·기록물 원본은 남의 자리에 둔다.
2. **자동으로 등재하지 않는다** — 스크립트가 훑은 것은 후보다. 문서와 DB에 앉히는 것은 사람이다.
3. **모르는 것은 모르는 채로 세운다** — 확인이 모자라면 등재를 미루는 게 아니라 ●○○로, 안봄으로 세운다.
4. **한 곳이 죽어도 화면은 산다** — 즉석 호출은 무리마다 따로 감싸고, 실패는 그 무리 자리에 글로 적는다.
5. **인증키는 서버에만** — data.go.kr 일반 인증키 한 줄(`DATA_GO_KR_API_KEY`)이고, 갈리는 것은 키가 아니라 서비스별 활용신청 승인이다.

## 5. 다시 받는 법

```bash
npm run fetch:riss      # RISS 논문 → data/riss-papers.csv
npm run sync            # 그 CSV → papers
npm run fetch:prism     # PRISM 과제 → data/raw/prism-research.json
npm run import:prism    # 그 JSON → papers(보고서)
npm run search:bids     # 나라장터 공고 훑기(문서에 자동 반영 안 함)
npm run fetch:awards    # 나라장터 낙찰 결과 훑기(자동 반영 안 함)
npm run import:th       # 오늘의역사 → timeline_events
```

즉석 셋(국가기록원·국립중앙박물관·여성사전시관)은 받는 절차가 없다 — 화면을 열면 그때가 최신이다.
