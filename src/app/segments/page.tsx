import { SiteHeader } from "@/components/SiteHeader";
import { SegmentListClient } from "@/components/SegmentListClient";
import { getEventOptions, getOralSegments, getPersons, getSourceOptions } from "@/lib/db";

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  // 구술 추가 폼이 함께 쓰는 재료 — 인물 명단, 이미 등록된 출처, 연결할 사건.
  const [{ focus }, oralSegments, persons, sources, eventOptions] = await Promise.all([
    searchParams,
    getOralSegments(),
    getPersons(),
    getSourceOptions(),
    getEventOptions(),
  ]);

  return (
    <div className="min-h-full">
      <SiteHeader active="/segments" title="구술 목록" />

      <main className="page-shell py-6">
        <SegmentListClient
          segments={oralSegments}
          focusId={focus}
          persons={persons}
          sources={sources}
          events={eventOptions}
        />
      </main>
    </div>
  );
}
