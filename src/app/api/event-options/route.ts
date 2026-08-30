import { NextRequest, NextResponse } from "next/server";
import { EVENT_CANDIDATE_LIMIT, rankEventCandidates } from "@/lib/event-candidates";
import { loadEventOptions } from "@/lib/event-options-cache";

// 사건을 고르는 칸이 후보를 물어 오는 자리. 서버 액션으로 두지 않는다 — 액션은 클라이언트
// 하나당 한 줄로 세워 보내는 데다(문서: sequential dispatch), 부를 때마다 지금 화면의 서버
// 트리를 다시 그려 응답에 실어 보낸다. 좁히기 칸에 글자를 치는 일은 아무것도 바꾸지 않는
// 읽기라, 그 두 가지가 다 손해다.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit")) || EVENT_CANDIDATE_LIMIT, 200);

  const rows = await loadEventOptions();
  const result = rankEventCandidates(rows, {
    query: params.get("q") ?? "",
    nearDate: params.get("near") ?? undefined,
    boostQuery: params.get("boost") ?? undefined,
    limit,
  });

  return NextResponse.json(result);
}
