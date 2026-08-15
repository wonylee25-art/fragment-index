"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_TABS = [
  { href: "/admin/timeline", label: "연표 관리" },
  { href: "/admin/review", label: "검토함" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-zinc-200 bg-zinc-50">
      <nav className="page-shell flex gap-1">
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
    </div>
  );
}
