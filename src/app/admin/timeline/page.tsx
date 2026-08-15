import { NewEventPanel } from "@/components/EventEditor";
import { TimelineExperience } from "@/components/TimelineExperience";
import { getChronicleEvents, getOralSegments } from "@/lib/db";

// 연표 관리. 후보 연결선까지 포함해 가져오고, 사건 추가·수정·삭제와 메모 편집 UI가 열린다.
// 사용자뷰(/)는 같은 컴포넌트를 확정 연결선만으로 읽기전용 렌더한다.
export default async function AdminTimelinePage() {
  const [chronicleEvents, oralSegments] = await Promise.all([
    getChronicleEvents({ includeCandidates: true }),
    getOralSegments(),
  ]);

  return (
    <>
      <NewEventPanel />
      <TimelineExperience events={chronicleEvents} segments={oralSegments} mode="admin" />
    </>
  );
}
