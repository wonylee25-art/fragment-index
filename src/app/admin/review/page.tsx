import { MaterialSearch } from "@/components/MaterialSearch";
import { UnlinkedBoard, UnlinkedEntry } from "@/components/UnlinkedBoard";
import { InactiveBoxes } from "@/components/InactiveBoxes";
import { EventOption } from "@/components/EventPicker";
import {
  getEventOptions,
  getInactiveMaterials,
  getUnlinkedMaterials,
} from "@/lib/db";
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
    getEventOptions(),
    getInactiveMaterials(),
  ]);

  // 후보는 사건 전체다 — 연표에 올린 것뿐 아니라 국편 오늘의역사에서 들여와 창고에 둔 것까지.
  // 검색어가 있으면 그 말이 든 사건을 목록 맨 위로 끌어올린다. 사건이 수천 건이라 순서만으로는
  // 못 찾지만(좁히기 칸을 쓰게 된다), 검색해서 들어온 사람이 첫 쪽에서 바로 만나는 것이
  // 검색어와 얽힌 사건이어야 한다.
  const query = q?.trim() ?? "";
  const eventOptions: EventOption[] = query
    ? [
        ...events.filter((e) => e.eventName.includes(query)),
        ...events.filter((e) => !e.eventName.includes(query)),
      ]
    : events;

  const materials: UnlinkedEntry[] = unlinked.materials.map((m) => ({
    id: m.id,
    targetType: "archive_item",
    title: m.title,
    // 날짜는 소장기관 뒤에 붙인다 — 무엇이냐(유형)·어디 것이냐(기관) 다음에 언제 것이냐가 온다.
    metaLine: [ARCHIVE_ITEM_ICON[m.type], m.type, m.sourceOrg, m.dateValue].filter(Boolean).join(" · "),
    description: m.description,
    fullText: m.fullText,
    itemType: m.type,
    sourceOrg: m.sourceOrg,
    dateValue: m.dateValue,
    imageUrl: m.imageUrl,
    sourceUrl: m.sourceUrl || undefined,
    links: m.links,
  }));

  return (
    <main className="page-shell flex flex-col gap-10 py-8">
      {/* eventOptions는 보류함과 "직접 사료 추가"가 함께 쓴다 — 둘 다 사건 전체가 후보다 */}
      <MaterialSearch query={query} allEvents={eventOptions} />
      <UnlinkedBoard events={eventOptions} materials={materials} />
      {/* 비활성으로 내린 것은 연표에도 보류함에도 없다 — 이 함이 그것들에 닿는 유일한 길이다 */}
      <InactiveBoxes materials={inactiveMaterials} />
    </main>
  );
}
