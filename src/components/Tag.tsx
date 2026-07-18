import { TAG_CLASSNAME } from "@/lib/design-tokens";

export function Tag({
  label,
  variant,
  href,
}: {
  label: string;
  variant: keyof typeof TAG_CLASSNAME;
  href?: string;
}) {
  const className = `inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-mono text-[11px] ${TAG_CLASSNAME[variant]}`;

  // href가 있으면(예: 좌표가 있는 장소 → OpenStreetMap) 새 탭으로 연결되는 태그가 된다.
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} underline decoration-dotted underline-offset-2 hover:brightness-95`}
      >
        {label}
        <span aria-hidden className="text-[9px]">
          ↗
        </span>
      </a>
    );
  }

  return <span className={className}>{label}</span>;
}
