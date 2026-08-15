import { SiteHeader } from "@/components/SiteHeader";
import { SegmentListClient } from "@/components/SegmentListClient";
import { getOralSegments } from "@/lib/db";

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [{ focus }, oralSegments] = await Promise.all([searchParams, getOralSegments()]);

  return (
    <div className="min-h-full">
      <SiteHeader active="/segments" title="구술 목록" />

      <main className="page-shell py-6">
        <SegmentListClient segments={oralSegments} focusId={focus} />
      </main>
    </div>
  );
}
