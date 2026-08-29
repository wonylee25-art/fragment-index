"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_TABS = [
  { href: "/admin/timeline", label: "사건" },
  { href: "/admin/review", label: "사료" },
  { href: "/admin/oral", label: "구술" },
] as const;

// 탭 이름은 하는 일이 아니라 다루는 것으로 짓는다 — 「편집」 화면 안이라 행위어가 없어도
// 뜻이 서고, 사용자뷰의 「구술 사업」과 글자가 안 겹친다.
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
