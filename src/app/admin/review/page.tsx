import { UnlinkedMaterialList } from "@/components/UnlinkedMaterialList";
import { getUnlinkedMaterials } from "@/lib/db";

// 검토함. 지금은 ②번 칸 — 연결선이 하나도 안 붙은 자료 — 만 있다.
// ①번 칸(사건은 정해졌지만 미확정인 후보 연결)은 매칭 기능이 붙은 뒤에 추가한다.
export default async function ReviewPage() {
  const unlinked = await getUnlinkedMaterials();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <UnlinkedMaterialList unlinked={unlinked} />
    </main>
  );
}
