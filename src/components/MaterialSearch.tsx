import Link from "next/link";
import { getSavedIds, getSuggestedKeywords, searchLocal } from "@/lib/db";
import { searchArchiveRecords } from "@/lib/national-archives";
import { searchMuseumRelicsDetailed } from "@/lib/museum-relics";
import { searchThTimeline } from "@/lib/th-timeline";
import { searchWomensOralArchive } from "@/lib/womens-oral-archive";
import { formatEdtfToKorean, edtfYear } from "@/lib/edtf";
import { saveThEvent } from "@/app/actions";
import { EventOption, MaterialGroup, MaterialWorkbench } from "./MaterialWorkbench";

// 기획 정리노트 8-8 "검색창(직접 키워드 입력) 화면". 수집·검토 작업이라 관리(검토함) 안에 둔다.
// 검색 → 내용 확인 → 저장+연결이 한 화면에서 끝나야 하므로, 자료 카드에는 원문을 열지 않고도
// 판단할 수 있을 만큼(썸네일·설명·크기·공개여부) 싣는다.
// 연결 후보 사건은 "같은 검색어로 걸린 DB 사건"이다 — 209건 전체를 훑는 것보다 정확하고,
// 같은 키워드로 잡혔다는 건 애초에 관련도가 높다는 뜻이다.

async function externalSearch(query: string) {
  const [archives, relics, thEntries, womensOral] = await Promise.allSettled([
    searchArchiveRecords(query, 6),
    searchMuseumRelicsDetailed(query, 6),
    searchThTimeline(query, 6),
    searchWomensOralArchive(query, 6),
  ]);

  return {
    archives: archives.status === "fulfilled" ? archives.value : [],
    archivesError: archives.status === "rejected" ? String(archives.reason) : null,
    relics: relics.status === "fulfilled" ? relics.value : [],
    relicsError: relics.status === "rejected" ? String(relics.reason) : null,
    thEntries: thEntries.status === "fulfilled" ? thEntries.value : [],
    thError: thEntries.status === "rejected" ? String(thEntries.reason) : null,
    womensOral: womensOral.status === "fulfilled" ? womensOral.value : [],
    womensOralError: womensOral.status === "rejected" ? String(womensOral.reason) : null,
  };
}

export async function MaterialSearch({ query }: { query: string }) {
  const [local, external, saved, suggestedKeywords] = await Promise.all([
    query ? searchLocal(query) : Promise.resolve({ events: [], segments: [] }),
    query ? externalSearch(query) : Promise.resolve(null),
    query
      ? getSavedIds()
      : Promise.resolve({ eventIds: new Set<string>(), archiveItemIds: new Set<string>() }),
    query ? Promise.resolve<string[]>([]) : getSuggestedKeywords(),
  ]);

  const eventOptions: EventOption[] = local.events.map((e) => ({
    id: e.id,
    year: edtfYear(e.dateValue),
    eventName: e.eventName,
  }));

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
            },
            metaLine: `문서 · ${a.producer} · ${a.productionYear}`,
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
              itemType: "사진" as const,
              title: r.name,
              sourceOrg: r.museumName,
              sourceUrl: r.detailUrl,
              imageUrl: r.imageUrl,
              description: r.description,
            },
            metaLine: [r.purposeName ?? "사진", r.museumName, r.materialName, r.sizeInfo]
              .filter(Boolean)
              .join(" · "),
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
              sourceUrl: w.videoUrl,
              description: w.excerpt.length > 300 ? `${w.excerpt.slice(0, 300)}…` : w.excerpt,
            },
            metaLine: `구술 · 여성사전시관 · ${w.category} · ${w.registeredDate}`,
            badges: w.videoUrl ? ["영상 있음"] : [],
            saved: saved.archiveItemIds.has(w.id),
          })),
        },
      ]
    : [];

  return (
    <section className="border-b border-line pb-10">
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">사료 검색</h2>
        <span className="text-sm font-medium text-muted-2">
          DB · 국가기록원 · 국립중앙박물관 · 국사편찬위 · 여성사전시관
        </span>
      </div>

      <form action="/admin/review" method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="인물, 사건, 키워드로 검색"
          className="w-full border border-line-strong bg-background px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-2 focus:border-foreground focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 border border-foreground bg-foreground px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-surface hover:text-foreground"
        >
          검색
        </button>
      </form>

      {!query && (
        <div className="mt-5">
          <p className="mb-2.5 text-[13px] text-muted">
            검색어를 입력하거나, 아래 키워드로 둘러보세요.
          </p>
          {suggestedKeywords.length === 0 ? (
            <p className="text-[13px] text-muted-2">아직 등록된 키워드가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {suggestedKeywords.map((kw) => (
                <Link
                  key={kw}
                  href={`/admin/review?q=${encodeURIComponent(kw)}`}
                  className="border border-line px-2 py-0.5 font-mono text-xs font-medium text-muted transition-colors hover:border-foreground hover:text-foreground"
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

          {/* 오늘의역사는 사료가 아니라 사건 후보다 — 연결 대상이 아니라 연표에 편입된다 */}
          <section>
            <p className="mb-1 font-mono text-[11px] font-semibold text-muted-2">
              국사편찬위원회 오늘의역사 (사건 후보) — {external.thEntries.length}건
            </p>
            {external.thError && (
              <p className="mt-1 text-xs text-flag-attention">오류: {external.thError}</p>
            )}
            <ul>
              {external.thEntries.map((t, i) => (
                <li
                  key={`${t.id}-${i}`}
                  className="flex items-start justify-between gap-3 border-t border-line py-2"
                >
                  <span className="text-[13px] leading-relaxed text-muted">
                    <span className="mr-2 font-mono text-xs tabular-nums text-muted-2">
                      {formatEdtfToKorean(t.dateValue)}
                    </span>
                    {t.title}
                  </span>
                  <form action={saveThEvent.bind(null, t)}>
                    {saved.eventIds.has(t.id) ? (
                      <span className="font-mono text-[11px] font-semibold text-flag-marked">
                        ✓ 저장됨
                      </span>
                    ) : (
                      <button
                        type="submit"
                        className="shrink-0 border border-line-strong px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground hover:bg-foreground hover:text-background"
                      >
                        사건으로 저장
                      </button>
                    )}
                  </form>
                </li>
              ))}
            </ul>
          </section>

          {/* 검색어로 걸린 구술 — 연결 대상 사건 목록(왼쪽)과 짝이 되는 참고 정보 */}
          {local.segments.length > 0 && (
            <section>
              <p className="mb-1 font-mono text-[11px] font-semibold text-muted-2">
                DB 구술 — {local.segments.length}건
              </p>
              <ul>
                {local.segments.map((s) => (
                  <li key={s.id} className="border-t border-line">
                    <Link
                      href={`/segments?focus=${s.id}`}
                      className="flex items-baseline gap-2.5 py-2 text-[13px] text-foreground hover:bg-surface"
                    >
                      <span className="font-mono text-xs tabular-nums text-muted-2">
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
