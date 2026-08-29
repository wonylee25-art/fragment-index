import Link from "next/link";
import { getSavedIds, getSuggestedKeywords, searchLocal } from "@/lib/db";
import { searchArchiveRecords } from "@/lib/national-archives";
import { searchMuseumRelicsDetailed } from "@/lib/museum-relics";
import { searchWomensOralArchive } from "@/lib/womens-oral-archive";
import { formatEdtfToKorean, edtfYear } from "@/lib/edtf";
import { EventOption, MaterialGroup, MaterialWorkbench } from "./MaterialWorkbench";
import { DbMaterialCard } from "./DbMaterialCard";
import { AddMaterialForm } from "./AddMaterialForm";

// 기획 정리노트 8-8 "검색창(직접 키워드 입력) 화면". 수집·검토 작업이라 편집 「사료」 안에 둔다.
// 검색 → 내용 확인 → 저장+연결이 한 화면에서 끝나야 하므로, 자료 카드에는 원문을 열지 않고도
// 판단할 수 있을 만큼(썸네일·설명·크기·공개여부) 싣는다.
// 연결 후보 사건은 DB(연표)의 사건 전체다. 예전에는 "같은 검색어로 걸린 사건"만 후보로 두었는데,
// 사료의 검색어와 사건명이 겹치는 경우가 드물어 후보가 비고 연결 자체를 못 하는 일이 잦았다.
// 대신 검색어로 걸린 사건을 목록 맨 위로 올려 관련도 높은 것부터 눈에 들어오게 한다.

async function externalSearch(query: string) {
  const [archives, relics, womensOral] = await Promise.allSettled([
    searchArchiveRecords(query, 9),
    searchMuseumRelicsDetailed(query, 9),
    searchWomensOralArchive(query, 9),
  ]);

  return {
    archives: archives.status === "fulfilled" ? archives.value : [],
    archivesError: archives.status === "rejected" ? String(archives.reason) : null,
    relics: relics.status === "fulfilled" ? relics.value : [],
    relicsError: relics.status === "rejected" ? String(relics.reason) : null,
    womensOral: womensOral.status === "fulfilled" ? womensOral.value : [],
    womensOralError: womensOral.status === "rejected" ? String(womensOral.reason) : null,
  };
}

// 찾던 말과 얼마나 겹치는지를 0~3으로 셈한다 — 카드 종이의 짙기가 된다. 표제에 든 것을
// 설명에 든 것보다 무겁게 치는 것은, 표제에 그 말이 있으면 그 자료가 그 주제를 다룬 것이고
// 설명에만 있으면 스쳐 지나간 것일 때가 많아서다.
function matchStrength(query: string, title: string, description?: string): number {
  const q = query.trim();
  if (!q) return 0;
  const inTitle = title.includes(q) ? 2 : 0;
  const body = description ?? "";
  const inBody = body.includes(q) ? 1 : 0;
  return inTitle + inBody;
}

// allEvents는 DB에 있는 사건 전체다 — 직접 추가 폼과 아래 검색 결과 카드가 함께 쓴다.
export async function MaterialSearch({
  query,
  allEvents,
}: {
  query: string;
  allEvents: EventOption[];
}) {
  const [local, external, saved, suggestedKeywords] = await Promise.all([
    query ? searchLocal(query) : Promise.resolve({ events: [], segments: [], materials: [] }),
    query ? externalSearch(query) : Promise.resolve(null),
    query
      ? getSavedIds()
      : Promise.resolve({ eventIds: new Set<string>(), archiveItemIds: new Set<string>() }),
    query ? Promise.resolve<string[]>([]) : getSuggestedKeywords(),
  ]);

  // 검색어로 걸린 사건을 앞에, 나머지 연표 전체를 뒤에. 목록이 길어지므로 좁히기 칸을 함께 쓴다.
  const matchedIds = new Set(local.events.map((e) => e.id));
  const matchedOptions: EventOption[] = local.events.map((e) => ({
    id: e.id,
    year: edtfYear(e.dateValue),
    eventName: e.eventName,
  }));
  const eventOptions: EventOption[] = [
    ...matchedOptions,
    ...allEvents.filter((e) => !matchedIds.has(e.id)),
  ];

  // Set은 서버→클라이언트 경계를 넘지 못하므로, 저장 여부는 여기서 판정해 boolean으로 넘긴다.
  const groups: MaterialGroup[] = external
    ? [
        {
          label: "국가기록원",
          error: external.archivesError,
          results: external.archives.map((a) => ({
            draft: {
              id: a.id,
              itemType: "문서" as const,
              title: a.title,
              sourceOrg: a.producer,
              sourceUrl: a.detailUrl,
              // 생산연도는 네 자리 해뿐이다("1943") — EDTF에서도 해만 아는 날짜의 표기가
              // 그것과 같아서 그대로 싣는다. 그 밖의 값(빈 값·범위)은 싣지 않는다.
              dateValue: /^\d{4}$/.test(a.productionYear) ? a.productionYear : undefined,
            },
            metaLine: `문서 · ${a.producer} · ${a.productionYear}`,
            dateText: a.productionYear || undefined,
            strength: matchStrength(query, a.title),
            badges: [
              ...(a.onlineReading ? ["원문 온라인 열람"] : []),
              ...(a.isOpen ? [] : ["비공개"]),
            ],
            saved: saved.archiveItemIds.has(a.id),
          })),
        },
        {
          label: "국립중앙박물관 유물정보",
          error: external.relicsError,
          results: external.relics.map((r) => ({
            draft: {
              id: r.id,
              // 유물정보가 주는 것은 유물 자체(실물)다 — 딸려오는 사진이 아니라 박물로 넣는다
              itemType: "박물" as const,
              title: r.name,
              sourceOrg: r.museumName,
              sourceUrl: r.detailUrl,
              imageUrl: r.imageUrl,
              description: r.description,
            },
            metaLine: [r.purposeName ?? "박물", r.museumName, r.materialName, r.sizeInfo]
              .filter(Boolean)
              .join(" · "),
            strength: matchStrength(query, r.name, r.description),
            badges: [],
            saved: saved.archiveItemIds.has(r.id),
          })),
        },
        {
          label: "여성사전시관 구술자료",
          error: external.womensOralError,
          results: external.womensOral.map((w) => ({
            draft: {
              id: w.id,
              itemType: "구술" as const,
              title: w.title,
              sourceOrg: `여성사전시관 (${w.category})`,
              // API의 유튜브 링크는 제목과 어긋나는 자료가 있어, 제목으로 맞춘 전시관 원문 페이지를 건다
              sourceUrl: w.detailUrl,
              description: w.excerpt.length > 300 ? `${w.excerpt.slice(0, 300)}…` : w.excerpt,
            },
            metaLine: `구술 · 여성사전시관 · ${w.category} · ${w.registeredDate}`,
            dateText: w.registeredDate || undefined,
            strength: matchStrength(query, w.title, w.excerpt),
            badges: w.videoUrl ? ["영상 있음"] : [],
            saved: saved.archiveItemIds.has(w.id),
          })),
        },
      ]
    : [];

  return (
    <section className="border-b border-line pb-10">
      {/* 폼이 열리면 이 줄의 w-full 자식으로 흘러 다음 줄을 차지한다(연표의 AddEventPanel과 같은 방식) */}
      <div className="mb-7 flex flex-wrap items-baseline gap-3">
        {/* 이름은 위 탭 줄이 이미 말한다 — 같은 말을 두 번 적으면 어느 것이 제목인지 흐려진다.
            화면에서는 빼고 소리로 읽는 차례에만 남긴다. */}
        <h2 className="sr-only">사료 검색</h2>
        <span className="mr-auto text-sm font-medium text-grey">
          DB · 국가기록원 · 국립중앙박물관 · 여성사전시관
        </span>
        {/* 이 목록에 없는 자료 — 직접 찍은 사진, 종이 스크랩 — 는 여기서 손으로 넣는다 */}
        <AddMaterialForm events={allEvents} />
      </div>

      <form action="/admin/review" method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="인물, 사건, 키워드로 검색"
          className="w-full border border-line bg-background px-3.5 py-2.5 text-[15px] text-ink placeholder:text-grey focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 border border-ink bg-ink px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-surface hover:text-ink"
        >
          검색
        </button>
      </form>

      {!query && (
        <div className="mt-5">
          <p className="mb-2.5 text-[13px] text-grey">
            검색어를 입력하거나, 아래 키워드로 둘러보세요.
          </p>
          {suggestedKeywords.length === 0 ? (
            <p className="text-[13px] text-grey">아직 등록된 키워드가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {suggestedKeywords.map((kw) => (
                <Link
                  key={kw}
                  href={`/admin/review?q=${encodeURIComponent(kw)}`}
                  className="border border-line px-2 py-0.5 font-mono text-xs font-medium text-grey transition-colors hover:border-ink hover:text-ink"
                >
                  {kw}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {query && external && (
        <div className="mt-8 flex flex-col gap-10">
          <MaterialWorkbench events={eventOptions} groups={groups} />

          {/* 이미 DB에 있는 사료 중 걸린 것. 밖에서 더 찾기 전에 "이미 갖고 있는지"를 먼저
              보여준다 — 같은 자료를 두 번 저장하는 일을 막고, 신문기사처럼 본문을 통째로
              들고 있는 사료는 검색어가 기사 중간에 있어도 여기 걸린다.
              위의 검색 결과와 같은 카드로 세운다 — 같은 자료가 한 화면에서 두 모양으로 서면
              무엇이 이미 있는 것이고 무엇이 새로 걸린 것인지 되레 헷갈린다. */}
          {local.materials.length > 0 && (
            <section>
              <p className="mb-1 font-mono text-[11px] font-semibold text-grey">
                DB 사료 — {local.materials.length}건
              </p>
              <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-start gap-4">
                {local.materials.map((m) => (
                  <li key={m.id}>
                    <DbMaterialCard
                      material={m}
                      strength={matchStrength(query, m.title, m.fullText || m.description)}
                      events={eventOptions}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 검색어로 걸린 구술 — 연결 대상 사건 목록(왼쪽)과 짝이 되는 참고 정보 */}
          {local.segments.length > 0 && (
            <section>
              <p className="mb-1 font-mono text-[11px] font-semibold text-grey">
                DB 구술 — {local.segments.length}건
              </p>
              <ul>
                {local.segments.map((s) => (
                  <li key={s.id} className="border-t border-line">
                    <Link
                      href={`/segments?focus=${s.id}`}
                      className="flex items-baseline gap-2.5 py-2 text-[13px] text-ink hover:bg-surface"
                    >
                      <span className="font-mono text-xs tabular-nums text-grey">
                        {formatEdtfToKorean(s.dateValue)}
                      </span>
                      <span className="font-semibold">{s.itemTitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
