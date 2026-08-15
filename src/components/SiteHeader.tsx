import Link from "next/link";

const NAV_ITEMS = [
  // 연표가 곧 메인화면이라 "홈" 항목은 따로 두지 않는다.
  // "자료 찾기"는 수집·검토 작업이라 관리 안(사료 연결)에 있다.
  { href: "/", label: "연표" },
  { href: "/segments", label: "구술 목록" },
  { href: "/research", label: "연구 동향" },
  { href: "/oral-history-projects", label: "구술 사업" },
  // 관리페이지 입구. 안에서 [연표 관리][사료 연결] 탭으로 갈린다.
  { href: "/admin/timeline", label: "관리" },
] as const;

// 조각(fragment)이 색인(index)의 행으로 정렬되는 모습을 단순한 도형으로만 그린다.
function LogoMark() {
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden="true"
      className="h-7 w-7 shrink-0 text-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="1.5" y="1.5" width="25" height="25" rx="2" className="text-line-strong" />
      <path d="M6 8h9M6 14h16M6 20h6" strokeLinecap="square" />
      <rect x="17.5" y="5.5" width="5" height="5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SiteHeader({
  active,
  title,
}: {
  active: "/" | "/segments" | "/research" | "/oral-history-projects" | "/admin/timeline";
  title: string;
}) {
  return (
    <header className="border-b border-line">
      <div className="page-shell flex flex-wrap items-center justify-between gap-6 py-6">
        {/* 좌상단은 페이지마다 바뀌지 않는 고정 표제. 페이지 제목은 화면에 감춰 문서 구조로만 남긴다. */}
        <Link href="/" className="flex items-center gap-3" aria-label="FRAGMENT INDEX 홈">
          <LogoMark />
          <span className="font-mono text-[13px] font-semibold leading-[1.15] tracking-[0.2em] text-foreground">
            FRAGMENT
            <br />
            INDEX
          </span>
        </Link>
        <h1 className="sr-only">{title}</h1>
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
