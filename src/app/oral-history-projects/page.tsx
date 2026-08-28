import { SiteHeader } from "@/components/SiteHeader";
import { OralHistoryDiagram } from "@/components/OralHistoryDiagram";
import { getOralHistoryProjectsDoc } from "@/lib/oral-history-projects";
import { loadCellMarks } from "@/lib/oral-marks";

export default async function OralHistoryProjectsPage() {
  const [doc, marks] = await Promise.all([getOralHistoryProjectsDoc(), loadCellMarks()]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/oral-history-projects" title="구술 사업" />
      {/* 탭 띠와 본문 껍데기는 컴포넌트가 함께 낸다 — 띠가 화면 너비로 깔려야 편집과 같아진다. */}
      <OralHistoryDiagram doc={doc} marks={marks} />
    </div>
  );
}
