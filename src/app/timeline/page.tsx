import { SiteHeader } from "@/components/SiteHeader";
import { TimelineExperience } from "@/components/TimelineExperience";
import { chronicleEvents, oralSegments } from "@/lib/real-data";

export default function TimelinePage() {
  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/timeline" title="연표" />
      <TimelineExperience events={chronicleEvents} segments={oralSegments} />
    </div>
  );
}
