"use client";

import { useEffect, useRef, useState } from "react";
import { EventCandidates, EventCandidateQuery } from "@/lib/event-candidates";

// 사건 고르는 칸이 후보를 받아 오는 고리. 목록을 통째로 안고 있지 않고, 열려 있는 동안
// 좁히기 칸에 친 말로 그때그때 물어 온다.
//
// 글자마다 한 번씩 부르면 앞선 응답이 뒤늦게 도착해 방금 친 말과 안 맞는 목록을 덮어쓴다.
// 조금 기다렸다 부르고(DEBOUNCE_MS), 부르고 나서도 마지막 것만 받는다.
const DEBOUNCE_MS = 180;

const EMPTY: EventCandidates = { options: [], matched: 0, total: 0 };

export function useEventCandidates({
  query = "",
  nearDate,
  boostQuery,
  limit,
  // 고르는 칸이 닫혀 있으면 묻지 않는다 — 이 고리가 있는 이유가 그것이다.
  enabled = true,
}: EventCandidateQuery & { enabled?: boolean }) {
  const [data, setData] = useState<EventCandidates>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 한 번이라도 받아 봤는지. 첫 응답 전에는 "걸린 사건이 없습니다"를 띄우면 안 된다 —
  // 없는 게 아니라 아직 안 온 것이다.
  const [ready, setReady] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const mine = ++seq.current;
    const controller = new AbortController();

    // 기다리는 표시는 실제로 부르러 나갈 때 켠다 — 이펙트 몸통에서 바로 상태를 건드리면
    // 그린 것을 또 그리는 일이 꼬리를 문다(react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (nearDate) params.set("near", nearDate);
      if (boostQuery?.trim()) params.set("boost", boostQuery.trim());
      if (limit) params.set("limit", String(limit));

      fetch(`/api/event-options?${params}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`사건 목록을 받지 못했습니다 (${r.status})`))))
        .then((json: EventCandidates) => {
          if (mine !== seq.current) return;
          setData(json);
          setError(null);
          setReady(true);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted || mine !== seq.current) return;
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, nearDate, boostQuery, limit, enabled]);

  return { ...data, loading, error, ready };
}
