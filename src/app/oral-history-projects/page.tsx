import { SiteHeader } from "@/components/SiteHeader";
import { OralHistoryDiagram } from "@/components/OralHistoryDiagram";
import { getOralHistoryProjectsDoc } from "@/lib/oral-history-projects";
import { loadCellMarks } from "@/lib/oral-marks";

export default async function OralHistoryProjectsPage() {
  const [doc, marks] = await Promise.all([getOralHistoryProjectsDoc(), loadCellMarks()]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/oral-history-projects" title="구술 사업" />
      <main className="page-shell py-6">
        <OralHistoryDiagram doc={doc} marks={marks} />
      </main>
    </div>
  );
}
