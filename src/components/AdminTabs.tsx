"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_TABS = [
  { href: "/admin/timeline", label: "연표 관리" },
  { href: "/admin/review", label: "사료 연결" },
  { href: "/admin/oral", label: "구술 연결" },
] as const;

// 탭 줄에는 탭만 둔다 — 사건 추가 입구는 연표 표 아래(AddEventPanel)로 내려갔다.
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-line bg-surface">
      <div className="page-shell">
        <nav className="flex gap-1">
          {ADMIN_TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs font-bold transition-colors ${
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-grey hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
