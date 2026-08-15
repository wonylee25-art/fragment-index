import { MaterialSearch } from "@/components/MaterialSearch";
import { UnlinkedBoard, UnlinkedEntry } from "@/components/UnlinkedBoard";
import { EventOption } from "@/components/EventPicker";
import { getChronicleEvents, getUnlinkedMaterials } from "@/lib/db";
import { edtfSortKey, edtfYear, formatEdtfToKorean } from "@/lib/edtf";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";

// 검토함. 사료를 찾아 담는 일(수집)과 담긴 것을 붙이는 일(검토)이 같은 작업의 앞뒤라 한 화면에 둔다.
// 위: 외부 소스 검색 → 사건 고르고 [연결하고 저장]. 아래 보류함: 아직 안 붙은 것들을 같은 방식으로 연결.
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, unlinked, events] = await Promise.all([
    searchParams,
    getUnlinkedMaterials(),
    getChronicleEvents(),
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
  }));

  const segments: UnlinkedEntry[] = unlinked.segments.map((s) => ({
    id: s.id,
    targetType: "segment",
    title: s.itemTitle,
    metaLine: `구술 · ${formatEdtfToKorean(s.dateValue)}`,
    sourceUrl: `/segments?focus=${s.id}`,
  }));

  return (
    <main className="page-shell flex flex-col gap-10 py-8">
      <MaterialSearch query={q?.trim() ?? ""} />
      <UnlinkedBoard events={eventOptions} materials={materials} segments={segments} />
    </main>
  );
}
