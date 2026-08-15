import Link from "next/link";

const NAV_ITEMS = [
  // 연표가 곧 메인화면이라 "홈" 항목은 따로 두지 않는다.
  // "자료 찾기"는 수집·검토 작업이라 관리 안(검토함)에 있다.
  { href: "/", label: "연표" },
  { href: "/segments", label: "구술 목록" },
  { href: "/research", label: "연구 동향" },
  { href: "/oral-history-projects", label: "구술사업 지도" },
  // 관리페이지 입구. 안에서 [연표 관리][검토함] 탭으로 갈린다.
  { href: "/admin/timeline", label: "관리" },
] as const;

export function SiteHeader({
  active,
  title,
}: {
  active: "/" | "/segments" | "/research" | "/oral-history-projects" | "/admin/timeline";
  title: string;
}) {
  return (
    <header className="border-b border-line">
      <div className="page-shell flex flex-wrap items-end justify-between gap-6 py-6">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted-2">
            FRAGMENT INDEX
          </span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        <nav className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                active === item.href
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
