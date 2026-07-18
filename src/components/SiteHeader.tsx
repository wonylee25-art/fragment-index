import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "구술 목록" },
  { href: "/timeline", label: "연표" },
  { href: "/search", label: "검색" },
] as const;

export function SiteHeader({
  active,
  title,
}: {
  active: "/" | "/timeline" | "/search";
  title: string;
}) {
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <div>
          <p className="font-mono text-xs text-zinc-400">예시 화면 · {title}</p>
          <h1 className="mt-1 text-xl font-bold text-zinc-900">{title}</h1>
        </div>
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-sm px-3 py-1.5 font-mono text-xs ${
                active === item.href
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
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
