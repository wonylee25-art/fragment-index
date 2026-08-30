import { MaterialSearch } from "@/components/MaterialSearch";
import Link from "next/link";
import { UnlinkedBoard, UnlinkedEntry } from "@/components/UnlinkedBoard";
import { boxOf, MaterialBox } from "@/lib/material-box";
import { InactiveBoxes } from "@/components/InactiveBoxes";
import {
  getInactiveMaterials,
  getUnlinkedMaterials,
  materialMatchesQuery,
} from "@/lib/db";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";

// 편집 「사료」 탭. 사료를 찾아 담는 일(수집)과 담긴 것을 붙이는 일(검토)이 같은 작업의 앞뒤라 한 화면에 둔다.
// 위: 외부 소스 검색 → 사건 고르고 [연결하고 저장]. 아래 보류함: 담긴 사료를 사건에 붙었느냐로
// 갈라 보여준다. 구술은 [구술] 탭이 따로 맡는다 — 여기서는 사료만 다룬다.
// 화면 안의 네 갈래. 한 화면에 검색과 세 함을 다 세워두니 아래 함까지 내려가는 데만
// 스크롤이 한참이었다 — 하는 일이 다른 자리들이라 갈라 세운다.
//   search 밖에서 찾아 담는 자리
//   linked 붙은 것 · hold 아직 안 정한 것 · nolink 붙이지 않기로 한 것
const TABS = [
  { id: "search", label: "사료 검색" },
  { id: "linked", label: "연결함" },
  { id: "hold", label: "보류함" },
  { id: "nolink", label: "미연결함" },
] as const;

type ReviewTab = (typeof TABS)[number]["id"];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const [{ q, tab }, unlinked, inactiveMaterials] = await Promise.all([
    searchParams,
    getUnlinkedMaterials(),
    getInactiveMaterials(),
  ]);

  // 붙일 사건 명단은 이 화면이 나르지 않는다. 사건 6,431건을 카드마다 실어 보내던 자리라,
  // 「사료」를 누를 때마다 그 무게를 그대로 기다려야 했다 — 고르는 칸이 열릴 때 서버에
  // 물어 간다(/api/event-options).
  // 검색어와 얽힌 사건을 첫 쪽에 세우는 일은 그대로다. 명단 대신 검색어를 내려보내고,
  // 자리를 올리는 일은 후보를 고르는 쪽이 한다(event-candidates.ts의 boostQuery).
  const query = q?.trim() ?? "";

  // 보류함도 검색어로 좁힌다. 위의 "DB 사료"와 같은 규칙(materialMatchesQuery)을 쓴다 —
  // 한 화면에서 같은 말을 쳤는데 위에서는 걸리고 아래에서는 안 걸리면, 보류함에 그 자료가
  // 없다고 읽게 된다. 실제로는 아흔 건 중 넷째 쪽에 있어 눈에 안 띈 것뿐이다.
  // 좁힌 동안에도 붙었느냐로 가른 두 무리는 그대로다 — 그래야 "이 말로 걸린 것 중 아직
  // 할 일이 남은 것"이 바로 보인다.
  const matched = query ? unlinked.materials.filter((m) => materialMatchesQuery(m, query)) : unlinked.materials;

  const materials: UnlinkedEntry[] = matched.map((m) => ({
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
    onTimeline: m.onTimeline,
    noLink: m.noLink,
  }));

  const active: ReviewTab = TABS.some((t) => t.id === tab) ? (tab as ReviewTab) : "search";
  // 함마다 몇 건인지 탭에 적는다 — 넘어가 보고서야 비어 있는 것을 아는 일이 없게.
  const countOf = (box: MaterialBox) => materials.filter((m) => boxOf(m) === box).length;
  const counts: Record<string, number | null> = {
    search: null,
    linked: countOf("linked"),
    hold: countOf("hold"),
    nolink: countOf("nolink"),
  };

  return (
    <main className="page-shell flex flex-col gap-8 py-8">
      {/* 네 갈래를 고르는 줄. 크기로는 위의 [사건|사료|구술]보다 한 단 아래여야
          한다 — 그 안에 든 갈래이므로. 대신 모양으로 갈린다: 그쪽은 밑줄, 이쪽은 칠한 칩이다.
          예전에는 이 줄 아래에 같은 말("보류함")을 20px 제목으로 한 번 더 적었는데, 그러면
          고르는 손잡이가 제 이름표보다 작아 위아래가 뒤집혀 보였다. 이제 제목은 따로 두지
          않는다 — 칠해진 칩이 곧 지금 보고 있는 함의 이름이다.
          검색어는 탭을 옮겨도 따라간다 — 같은 말로 걸린 것을 함마다 짚어 보는 일이 잦다. */}
      <nav aria-label="사료 갈래" className="flex flex-wrap items-center gap-1.5 border-b border-line pb-2">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/admin/review?tab=${t.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              aria-current={on ? "page" : undefined}
              className={`flex items-baseline gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${
                on ? "border-ink bg-ink text-background" : "border-line text-grey hover:border-ink hover:text-ink"
              }`}
            >
              {t.label}
              {counts[t.id] !== null && (
                <span className={`tabular-nums ${on ? "text-background/70" : "text-grey"}`}>
                  {counts[t.id]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {active === "search" ? (
        /* eventOptions는 검색 결과와 "직접 사료 추가"가 함께 쓴다 — 둘 다 사건 전체가 후보다 */
        <MaterialSearch query={query} />
      ) : (
        <UnlinkedBoard
          materials={materials}
          query={query}
          totalCount={unlinked.materials.length}
          box={active}
        />
      )}

      {/* 비활성으로 내린 것은 연표에도 세 함에도 없다 — 이 함이 그것들에 닿는 유일한 길이다.
          미연결함 아래에 둔다: 둘 다 "치워 둔 것"이라 찾을 때 같은 자리를 뒤지게 된다. */}
      {active === "nolink" && <InactiveBoxes materials={inactiveMaterials} />}
    </main>
  );
}
