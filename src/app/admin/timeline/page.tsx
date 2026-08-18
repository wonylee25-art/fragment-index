import { HiddenEventsPanel } from "@/components/EventEditor";
import { EventFinderPanel } from "@/components/EventFinderPanel";
import { TimelineExperience } from "@/components/TimelineExperience";
import { countEvents, getChronicleEvents, getHiddenEvents, getOralSegments } from "@/lib/db";

// 사건 관리. 후보 연결선까지 포함해 가져오고, 사건 추가·수정·숨김과 메모 편집 UI가 열린다.
// 사용자뷰(/)는 같은 컴포넌트를 확정 연결선만으로 읽기전용 렌더한다.
export default async function AdminTimelinePage() {
  const [chronicleEvents, oralSegments, hiddenEvents, eventCounts] = await Promise.all([
    getChronicleEvents({ includeCandidates: true }),
    getOralSegments(),
    getHiddenEvents(),
    countEvents(),
  ]);

  return (
    <>
      {/* 사건 추가 입구는 연표 도구 줄 오른쪽 끝에 있다(TimelineExperience 안) */}
      <TimelineExperience events={chronicleEvents} segments={oralSegments} mode="admin" />
      {/* 위쪽 연표 검색은 연표에 오른 사건을 훑고, 이 칸은 연표 바깥까지 뒤져 꺼내온다 */}
      <EventFinderPanel counts={eventCounts} />
      <HiddenEventsPanel events={hiddenEvents} />
    </>
  );
}
