import { SiteHeader } from "@/components/SiteHeader";
import { TimelineExperience } from "@/components/TimelineExperience";
import { getTimelineRows } from "@/lib/db";

// 연표(사용자뷰)가 곧 메인화면이다 — 별도의 홈 화면은 두지 않는다.
// 확정 연결선만 담긴 데이터를 읽기전용으로 보여주고, 관리용 조작은 /admin/timeline에 있다.
// 행은 사건뿐 아니라, 사건 없이 연표에 올린 사료·구술까지 한 흐름으로 섞여 온다.
export default async function Home() {
  const { rows, segments } = await getTimelineRows();

  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/" title="연표" />
      <TimelineExperience rows={rows} segments={segments} mode="read" />
    </div>
  );
}
