import { SiteHeader } from "@/components/SiteHeader";
import { ResearchTrends } from "@/components/ResearchTrends";
import { getPapers, getResearchSyncedAt } from "@/lib/db";

export default async function ResearchPage() {
  const [papers, syncedAt] = await Promise.all([getPapers(), getResearchSyncedAt()]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/research" title="연구 동향" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ResearchTrends papers={papers} syncedAt={syncedAt} />
      </main>
    </div>
  );
}
