import { SiteHeader } from "@/components/SiteHeader";
import { getSavedIds, searchLocal } from "@/lib/db";
import { searchArchiveRecords } from "@/lib/national-archives";
import { searchMuseumRelics } from "@/lib/museum-relics";
import { searchThTimeline } from "@/lib/th-timeline";
import { formatEdtfToKorean } from "@/lib/edtf";
import { saveArchiveRecord, saveMuseumRelic, saveThEvent } from "./actions";

function SaveButton({ saved }: { saved: boolean }) {
  if (saved) {
    return <span className="font-mono text-[11px] text-emerald-600">✓ 저장됨</span>;
  }
  return (
    <button
      type="submit"
      className="rounded-sm bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-white hover:bg-zinc-700"
    >
      저장
    </button>
  );
}

// 기획 정리노트 8-8 "검색창(직접 키워드 입력) 화면 누락"을 채우는 화면.
// DB(이미 확정된 사료)와 외부 소스(국가기록원·박물관·국사편찬위 오늘의역사 원문)를 동시에 검색한다.
// 외부 소스는 검토 전 후보일 뿐이라 DB에 저장하지 않고 화면에만 보여준다 — "미저장" 배지로 구분.

async function externalSearch(query: string) {
  const [archives, relics, thEntries] = await Promise.allSettled([
    searchArchiveRecords(query, 6),
    searchMuseumRelics(query, 6),
    searchThTimeline(query, 6),
  ]);

  return {
    archives: archives.status === "fulfilled" ? archives.value : [],
    archivesError: archives.status === "rejected" ? String(archives.reason) : null,
    relics: relics.status === "fulfilled" ? relics.value : [],
    relicsError: relics.status === "rejected" ? String(relics.reason) : null,
    thEntries: thEntries.status === "fulfilled" ? thEntries.value : [],
    thError: thEntries.status === "rejected" ? String(thEntries.reason) : null,
  };
}

function ExternalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 ring-1 ring-inset ring-amber-200">
      미저장 · 외부 검색
    </span>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [local, external, saved] = query
    ? await Promise.all([searchLocal(query), externalSearch(query), getSavedIds()])
    : [{ events: [], segments: [] }, null, { eventIds: new Set<string>(), archiveItemIds: new Set<string>() }];

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/search" title="검색" />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <form action="/search" method="GET" className="mb-8">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="인물, 사건, 키워드로 검색"
            className="w-full rounded-sm border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            autoFocus
          />
        </form>

        {!query && <p className="font-mono text-xs text-zinc-400">검색어를 입력하세요.</p>}

        {query && (
          <div className="space-y-10">
            <section>
              <h2 className="mb-3 font-mono text-xs text-zinc-400">DB(확정된 사료) — 사건 {local.events.length}건 · 구술 {local.segments.length}건</h2>

              {local.events.length === 0 && local.segments.length === 0 && (
                <p className="text-sm text-zinc-400">일치하는 항목이 없습니다.</p>
              )}

              {local.events.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {local.events.map((e) => (
                    <li key={e.id} className="border-b border-zinc-100 pb-2">
                      <a href={`/timeline`} className="text-sm text-zinc-900 hover:underline">
                        {e.eventName}
                      </a>
                      <span className="ml-2 font-mono text-xs text-zinc-400">{formatEdtfToKorean(e.dateValue)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {local.segments.length > 0 && (
                <ul className="space-y-2">
                  {local.segments.map((s) => (
                    <li key={s.id} className="border-b border-zinc-100 pb-2">
                      <a href={`/?focus=${s.id}`} className="text-sm text-zinc-900 hover:underline">
                        {s.itemTitle}
                      </a>
                      <span className="ml-2 font-mono text-xs text-zinc-400">{formatEdtfToKorean(s.dateValue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {external && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-mono text-xs text-zinc-400">외부 검색 결과</h2>
                  <ExternalBadge />
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="mb-2 font-mono text-[11px] text-zinc-400">
                      국사편찬위원회 오늘의역사(원문 15,579건) — {external.thEntries.length}건
                    </p>
                    {external.thError && <p className="text-xs text-red-600">오류: {external.thError}</p>}
                    <ul className="space-y-1">
                      {external.thEntries.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm text-zinc-700">
                          <span>
                            <span className="mr-2 font-mono text-xs text-zinc-400">{formatEdtfToKorean(t.dateValue)}</span>
                            {t.title}
                          </span>
                          <form action={saveThEvent.bind(null, t)}>
                            <SaveButton saved={saved.eventIds.has(t.id)} />
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 font-mono text-[11px] text-zinc-400">국가기록원 — {external.archives.length}건</p>
                    {external.archivesError && <p className="text-xs text-red-600">오류: {external.archivesError}</p>}
                    <ul className="space-y-1">
                      {external.archives.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 text-sm text-zinc-700">
                          <span>
                            <a href={a.detailUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {a.title}
                            </a>
                            <span className="ml-2 font-mono text-xs text-zinc-400">
                              {a.producer} · {a.productionYear}
                            </span>
                          </span>
                          <form action={saveArchiveRecord.bind(null, a)}>
                            <SaveButton saved={saved.archiveItemIds.has(a.id)} />
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 font-mono text-[11px] text-zinc-400">국립중앙박물관 유물정보 — {external.relics.length}건</p>
                    {external.relicsError && <p className="text-xs text-red-600">오류: {external.relicsError}</p>}
                    <ul className="space-y-1">
                      {external.relics.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-sm text-zinc-700">
                          <span>
                            <a href={r.detailUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {r.name}
                            </a>
                            <span className="ml-2 font-mono text-xs text-zinc-400">{r.museumName}</span>
                          </span>
                          <form action={saveMuseumRelic.bind(null, r)}>
                            <SaveButton saved={saved.archiveItemIds.has(r.id)} />
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
