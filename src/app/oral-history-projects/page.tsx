import { SiteHeader } from "@/components/SiteHeader";
import { OralHistoryDiagram } from "@/components/OralHistoryDiagram";
import { getOralHistoryProjectsDoc } from "@/lib/oral-history-projects";

export default async function OralHistoryProjectsPage() {
  const doc = await getOralHistoryProjectsDoc();

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/oral-history-projects" title="구술채록 사업 지도" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <OralHistoryDiagram doc={doc} />
      </main>
    </div>
  );
}
