import { SiteHeader } from "@/components/SiteHeader";
import { TimelineExperience } from "@/components/TimelineExperience";
import { getChronicleEvents, getOralSegments } from "@/lib/db";

// 연표(사용자뷰)가 곧 메인화면이다 — 별도의 홈 화면은 두지 않는다.
// 확정 연결선만 담긴 데이터를 읽기전용으로 보여주고, 관리용 조작은 /admin/timeline에 있다.
export default async function Home() {
  const [chronicleEvents, oralSegments] = await Promise.all([
    getChronicleEvents(),
    getOralSegments(),
  ]);

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/" title="연표" />
      <TimelineExperience events={chronicleEvents} segments={oralSegments} mode="read" />
    </div>
  );
}
