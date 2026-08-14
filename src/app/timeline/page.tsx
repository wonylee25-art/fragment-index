import { SiteHeader } from "@/components/SiteHeader";
import { TimelineExperience } from "@/components/TimelineExperience";
import { getChronicleEvents, getOralSegments } from "@/lib/db";

export default async function TimelinePage() {
  const [chronicleEvents, oralSegments] = await Promise.all([getChronicleEvents(), getOralSegments()]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/timeline" title="연표" />
      {/* 확정 연결선만 담긴 데이터를 읽기전용으로 — 관리용 조작은 /admin/timeline에 있다 */}
      <TimelineExperience events={chronicleEvents} segments={oralSegments} mode="read" />
    </div>
  );
}
