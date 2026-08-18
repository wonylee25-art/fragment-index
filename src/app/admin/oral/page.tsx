import { OralLinkBoard } from "@/components/OralLinkBoard";
import { InactiveBoxes } from "@/components/InactiveBoxes";
import { EventOption } from "@/components/EventPicker";
import { getChronicleEvents, getInactiveSegments, getSegmentLinkRows } from "@/lib/db";
import { edtfSortKey, edtfYear } from "@/lib/edtf";

// 구술 연결. 구술을 넣는 일은 구술 목록(/segments)에서 하고, 관리에서는 넣어 둔 구술을
// 사건에 붙인다 — 관리 화면이 하는 일은 자료를 모으는 게 아니라 그물망을 짜는 것이다.
export default async function AdminOralPage() {
  const [rows, events, inactiveSegments] = await Promise.all([
    getSegmentLinkRows(),
    getChronicleEvents(),
    getInactiveSegments(),
  ]);

  const eventOptions: EventOption[] = [...events]
    .sort((a, b) => edtfSortKey(b.dateValue) - edtfSortKey(a.dateValue))
    .map((e) => ({ id: e.id, year: edtfYear(e.dateValue), eventName: e.eventName }));

  return (
    <main className="page-shell flex flex-col gap-10 py-8">
      <OralLinkBoard rows={rows} events={eventOptions} />
      {/* 비활성으로 내린 구술은 구술 목록에도 연표에도 없다 — 이 함이 닿는 유일한 길이다 */}
      <InactiveBoxes segments={inactiveSegments} />
    </main>
  );
}
