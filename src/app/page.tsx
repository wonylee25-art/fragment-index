import { SiteHeader } from "@/components/SiteHeader";
import { SegmentListClient } from "@/components/SegmentListClient";
import { getOralSegments } from "@/lib/db";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [{ focus }, oralSegments] = await Promise.all([searchParams, getOralSegments()]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/" title="구술 목록" />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <SegmentListClient segments={oralSegments} focusId={focus} />
      </main>
    </div>
  );
}
