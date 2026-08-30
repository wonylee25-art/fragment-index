import { SiteHeader } from "@/components/SiteHeader";
import { SegmentListClient } from "@/components/SegmentListClient";
import { getOralSegments, getPersons, getSourceOptions } from "@/lib/db";

// searchParams를 서버에서 받지 않는다 — 그 한 줄 때문에 이 라우트만 빌드 프리렌더에서 빠져
// 목록을 열 때마다 Supabase 왕복(getOralSegments만 해도 쿼리 예닐곱 개)을 기다려야 했다.
// 다른 화면은 만들어둔 HTML을 바로 준다. ?focus= 는 스크롤 위치를 잡는 값일 뿐이라
// SegmentListClient가 브라우저에서 직접 읽는다.
export default async function SegmentsPage() {
  // 구술 추가 폼이 함께 쓰는 재료 — 인물 명단과 이미 등록된 출처.
  // 연결할 사건은 여기서 싣지 않는다: 사건 6,431건이 이 화면 페이로드의 대부분(1.2MB)이었고,
  // 정작 닫혀 있는 폼의 고르는 칸에만 쓰였다. 이제 그 칸이 열릴 때 서버에 물어 간다.
  const [oralSegments, persons, sources] = await Promise.all([
    getOralSegments(),
    getPersons(),
    getSourceOptions(),
  ]);

  return (
    <div className="min-h-full">
      <SiteHeader active="/segments" title="구술 목록" />

      <main className="page-shell py-6">
        <SegmentListClient
          segments={oralSegments}
          persons={persons}
          sources={sources}
        />
      </main>
    </div>
  );
}
