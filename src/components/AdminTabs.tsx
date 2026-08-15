"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NewEventForm } from "./EventEditor";
import { ADD_BUTTON_CLASSNAME } from "@/lib/design-tokens";

const ADMIN_TABS = [
  { href: "/admin/timeline", label: "연표 관리" },
  { href: "/admin/review", label: "사료 연결" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();
  const [addingEvent, setAddingEvent] = useState(false);
  const onTimeline = pathname === "/admin/timeline";

  return (
    <div className="border-b border-zinc-200 bg-zinc-50">
      {/* 사건 추가 버튼은 탭 줄 오른쪽 끝에 얹는다 — 버튼만 있는 줄을 따로 두면 연표가 한 칸 밀린다 */}
      <div className="page-shell flex items-center justify-between gap-4">
        <nav className="flex gap-1">
          {ADMIN_TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs font-bold transition-colors ${
                  active
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {onTimeline && !addingEvent && (
          <button
            type="button"
            onClick={() => setAddingEvent(true)}
            className={ADD_BUTTON_CLASSNAME}
          >
            + 새 사건 추가
          </button>
        )}
      </div>

      {/* 폼은 탭 줄만큼 좁힐 수 없어 아래 전체 너비로 편다 — 열렸을 때만 자리를 쓴다 */}
      {onTimeline && addingEvent && (
        <div className="page-shell pb-3">
          <NewEventForm onClose={() => setAddingEvent(false)} />
        </div>
      )}
    </div>
  );
}
