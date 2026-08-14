import { UnlinkedMaterials } from "@/lib/types";
import { edtfYear } from "@/lib/edtf";

// 어느 사건에도 연결선이 붙지 않은 자료·구술 목록.
// 사건 지정 버튼은 매칭·연결 확정 UI를 정한 뒤에 붙인다 — 지금은 쌓인 재고를 보는 용도.
export function UnlinkedMaterialList({ unlinked }: { unlinked: UnlinkedMaterials }) {
  const total = unlinked.materials.length + unlinked.segments.length;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">연결선 없는 자료</h2>
        <p className="text-sm font-medium text-muted">
          어느 사건에도 붙지 않은 자료 {unlinked.materials.length}건, 구술 {unlinked.segments.length}건.
          사건 뼈대를 채울 때 여기 쌓인 것을 재료로 씁니다.
        </p>
      </div>

      {total === 0 ? (
        <p className="border border-dashed border-line px-4 py-10 text-center text-sm font-medium text-muted-2">
          연결선 없는 자료가 없습니다.
        </p>
      ) : (
        <>
          {unlinked.materials.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-bold tracking-tight text-foreground">사료</h3>
              <ul className="flex flex-col gap-px border border-line bg-line">
                {unlinked.materials.map((material) => (
                  <li key={material.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-background px-4 py-3">
                    <span className="font-mono text-[11px] font-bold tracking-wider text-muted-2">
                      {material.type}
                    </span>
                    {material.sourceUrl ? (
                      <a
                        href={material.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[15px] font-bold leading-snug text-foreground hover:underline"
                      >
                        {material.title}
                      </a>
                    ) : (
                      <span className="text-[15px] font-bold leading-snug text-foreground">{material.title}</span>
                    )}
                    {material.sourceOrg && (
                      <span className="text-xs font-medium text-muted">{material.sourceOrg}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {unlinked.segments.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-bold tracking-tight text-foreground">구술</h3>
              <ul className="flex flex-col gap-px border border-line bg-line">
                {unlinked.segments.map((segment) => (
                  <li key={segment.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-background px-4 py-3">
                    <span className="font-mono text-xs font-bold tabular-nums text-muted-2">
                      {edtfYear(segment.dateValue)}
                    </span>
                    <a
                      href={`/segments?focus=${segment.id}`}
                      className="text-[15px] font-bold leading-snug text-foreground hover:underline"
                    >
                      {segment.itemTitle}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
