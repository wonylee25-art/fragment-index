import Link from "next/link";
import { connection } from "next/server";
import { SiteHeader } from "@/components/SiteHeader";
import { GrainsBoard } from "@/components/GrainsBoard";
import { Summaries } from "@/components/Summaries";
import { getGrainThreads, getSummaries } from "@/lib/grains";
import { DEMO_SUMMARIES, DEMO_THREADS } from "@/lib/grains-demo";

// 텔레그램 봇으로 계속 쌓이는 데이터라 만들어 둔 HTML을 주면 안 된다 — 열 때마다 읽는다.
// ?demo=1 이면 DB를 건드리지 않고 예시 조각을 보여 준다(화면 확인용).
export default async function GrainsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  await connection();
  const demo = (await searchParams).demo === "1";
  const [{ threads, error }, summaries] = demo
    ? [{ threads: DEMO_THREADS, error: null }, DEMO_SUMMARIES]
    : await Promise.all([getGrainThreads(), getSummaries()]);

  return (
    <div className="min-h-full">
      <SiteHeader active="/grains" title="일상 조각" />

      <main className="page-shell py-6">
        {demo && (
          <p className="mb-4 rounded-sm bg-yellow-tint px-3 py-2 font-mono text-xs text-ink">
            예시 데이터입니다. 실제로 쌓인 조각이 아닙니다.
          </p>
        )}
        {error ? (
          <div className="space-y-2 font-mono text-xs">
            <p className="text-red-text">일상 조각을 읽지 못했습니다: {error}</p>
            {/* grains는 public이 아닌 별도 스키마라, API가 열어 주기 전에는 이 오류가 난다. */}
            {error.includes("Invalid schema") && (
              <p className="text-grey">
                아직 연결되지 않았습니다. Supabase 대시보드 → Project Settings → Data API →
                Exposed schemas에 <code>grains</code>를 추가하면 열립니다.{" "}
                <Link href="/grains?demo=1" className="text-ink underline underline-offset-2">
                  예시 화면 보기
                </Link>
              </p>
            )}
          </div>
        ) : (
          <>
            <Summaries summaries={summaries} />
            {/* 예시 화면의 조각은 DB에 없으므로 고칠 수 없다. */}
            <GrainsBoard threads={threads} editable={!demo} demo={demo} />
          </>
        )}
      </main>
    </div>
  );
}
