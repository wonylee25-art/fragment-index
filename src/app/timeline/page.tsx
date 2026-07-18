import { SiteHeader } from "@/components/SiteHeader";
import { TimelineExperience } from "@/components/TimelineExperience";
import { getChronicleEvents, getOralSegments } from "@/lib/db";

export default async function TimelinePage() {
  const [chronicleEvents, oralSegments] = await Promise.all([getChronicleEvents(), getOralSegments()]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/timeline" title="연표" />
      <TimelineExperience events={chronicleEvents} segments={oralSegments} />
    </div>
  );
}
