import { OralLinkBoard } from "@/components/OralLinkBoard";
import { InactiveBoxes } from "@/components/InactiveBoxes";
import { getEventOptions, getInactiveSegments, getPersons, getSegmentLinkRows, getSourceOptions } from "@/lib/db";

// 편집 「구술」 탭. 넣어 둔 구술을 사건에 붙이고, 새 구술을 넣는 입구도 함께 둔다 — 붙일 것이
// 없다는 걸 아는 자리가 여기라서, 알아차린 자리에서 바로 넣을 수 있어야 한다.
// 폼은 구술 목록(/segments)이 쓰는 것과 같은 OralIntakeForm이다.
export default async function AdminOralPage() {
  const [rows, eventOptions, inactiveSegments, persons, sources] = await Promise.all([
    getSegmentLinkRows(),
    getEventOptions(),
    getInactiveSegments(),
    getPersons(),
    getSourceOptions(),
  ]);

  return (
    <main className="page-shell flex flex-col gap-10 py-8">
      <OralLinkBoard rows={rows} events={eventOptions} persons={persons} sources={sources} />
      {/* 비활성으로 내린 구술은 구술 목록에도 연표에도 없다 — 이 함이 닿는 유일한 길이다 */}
      <InactiveBoxes segments={inactiveSegments} />
    </main>
  );
}
