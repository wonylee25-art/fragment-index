import { MaterialSearch } from "@/components/MaterialSearch";
import { UnlinkedBoard, UnlinkedEntry } from "@/components/UnlinkedBoard";
import { InactiveBoxes } from "@/components/InactiveBoxes";
import { EventOption } from "@/components/EventPicker";
import {
  getChronicleEvents,
  getInactiveMaterials,
  getUnlinkedMaterials,
} from "@/lib/db";
import { edtfSortKey, edtfYear } from "@/lib/edtf";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";

// 사료 연결. 사료를 찾아 담는 일(수집)과 담긴 것을 붙이는 일(검토)이 같은 작업의 앞뒤라 한 화면에 둔다.
// 위: 외부 소스 검색 → 사건 고르고 [연결하고 저장]. 아래 보류함: 담긴 사료를 사건에 붙었느냐로
// 갈라 보여준다. 구술은 [구술 연결] 탭이 따로 맡는다 — 여기서는 사료만 다룬다.
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, unlinked, events, inactiveMaterials] = await Promise.all([
    searchParams,
    getUnlinkedMaterials(),
    getChronicleEvents(),
    getInactiveMaterials(),
  ]);

  // 보류함은 검색어가 없어 사건 전체가 후보다. 최근 사건부터 보이게 역순으로 둔다.
  const eventOptions: EventOption[] = [...events]
    .sort((a, b) => edtfSortKey(b.dateValue) - edtfSortKey(a.dateValue))
    .map((e) => ({ id: e.id, year: edtfYear(e.dateValue), eventName: e.eventName }));

  const materials: UnlinkedEntry[] = unlinked.materials.map((m) => ({
    id: m.id,
    targetType: "archive_item",
    title: m.title,
    metaLine: [ARCHIVE_ITEM_ICON[m.type], m.type, m.sourceOrg].filter(Boolean).join(" · "),
    description: m.description,
    imageUrl: m.imageUrl,
    sourceUrl: m.sourceUrl || undefined,
    links: m.links,
  }));

  return (
    <main className="page-shell flex flex-col gap-10 py-8">
      {/* eventOptions는 보류함과 "직접 사료 추가"가 함께 쓴다 — 둘 다 검색어 없이 연표 전체가 후보다 */}
      <MaterialSearch query={q?.trim() ?? ""} allEvents={eventOptions} />
      <UnlinkedBoard events={eventOptions} materials={materials} />
      {/* 비활성으로 내린 것은 연표에도 보류함에도 없다 — 이 함이 그것들에 닿는 유일한 길이다 */}
      <InactiveBoxes materials={inactiveMaterials} />
    </main>
  );
}
