import { HiddenEventsPanel } from "@/components/EventEditor";
import { TimelineExperience } from "@/components/TimelineExperience";
import { getChronicleEvents, getHiddenEvents, getOralSegments } from "@/lib/db";

// 사건 관리. 후보 연결선까지 포함해 가져오고, 사건 추가·수정·숨김과 메모 편집 UI가 열린다.
// 연표에 안 떠 있는 사건(국편 오늘의역사에서 들여온 것, 숨긴 것)은 맨 위 검색칸에 치면
// 표 바로 위에 띠로 나온다 — TimelineExperience 안의 OffTimelineFinder가 맡는다.
// 사용자뷰(/)는 같은 컴포넌트를 확정 연결선만으로 읽기전용 렌더한다.
export default async function AdminTimelinePage() {
  const [chronicleEvents, oralSegments, hiddenEvents] = await Promise.all([
    getChronicleEvents({ includeCandidates: true }),
    getOralSegments(),
    getHiddenEvents(),
  ]);

  return (
    <>
      {/* 사건 추가 입구는 연표 도구 줄 오른쪽 끝에 있다(TimelineExperience 안) */}
      <TimelineExperience events={chronicleEvents} segments={oralSegments} mode="admin" />
      <HiddenEventsPanel events={hiddenEvents} />
    </>
  );
}
