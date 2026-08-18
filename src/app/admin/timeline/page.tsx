import { HiddenEventsPanel } from "@/components/EventEditor";
import { WarehousePanel } from "@/components/WarehousePanel";
import { TimelineExperience } from "@/components/TimelineExperience";
import { countWarehouseEvents, getChronicleEvents, getHiddenEvents, getOralSegments } from "@/lib/db";

// 연표 관리. 후보 연결선까지 포함해 가져오고, 사건 추가·수정·숨김과 메모 편집 UI가 열린다.
// 사용자뷰(/)는 같은 컴포넌트를 확정 연결선만으로 읽기전용 렌더한다.
export default async function AdminTimelinePage() {
  const [chronicleEvents, oralSegments, hiddenEvents, warehouseCount] = await Promise.all([
    getChronicleEvents({ includeCandidates: true }),
    getOralSegments(),
    getHiddenEvents(),
    countWarehouseEvents(),
  ]);

  return (
    <>
      {/* 사건 추가 입구는 연표 도구 줄 오른쪽 끝에 있다(TimelineExperience 안) */}
      <TimelineExperience events={chronicleEvents} segments={oralSegments} mode="admin" />
      {/* 창고와 숨긴 사건은 뜻이 다르다 — 창고는 "아직 안 꺼냈다", 숨김은 "꺼냈다가 치웠다" */}
      <WarehousePanel total={warehouseCount} />
      <HiddenEventsPanel events={hiddenEvents} />
    </>
  );
}
