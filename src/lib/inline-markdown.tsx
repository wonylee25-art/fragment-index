import { Fragment, type ReactNode } from "react";

// oral_history_projects.md 등 손으로 쓴 마크다운 문서의 **굵게**·`코드`·[링크](url)만
// 처리하는 최소 인라인 렌더러. 리스트·헤딩 등 블록 문법은 다루지 않는다.
type Token =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; url: string };

const INLINE_RE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > lastIndex) tokens.push({ type: "text", value: text.slice(lastIndex, m.index) });
    if (m[1] !== undefined) tokens.push({ type: "bold", value: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: "code", value: m[2] });
    else if (m[3] !== undefined && m[4] !== undefined) tokens.push({ type: "link", value: m[3], url: m[4] });
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
  return tokens;
}

export function Inline({ text }: { text: string }): ReactNode {
  return tokenize(text).map((t, i) => {
    switch (t.type) {
      case "bold":
        return (
          <strong key={i} className="font-semibold text-zinc-900">
            {t.value}
          </strong>
        );
      case "code":
        return (
          <code key={i} className="rounded-sm bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-zinc-700">
            {t.value}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-700 underline decoration-dotted underline-offset-2 hover:text-zinc-950"
          >
            {t.value}
            <span aria-hidden className="text-[9px] text-zinc-300">
              {" "}
              ↗
            </span>
          </a>
        );
      default:
        return <Fragment key={i}>{t.value}</Fragment>;
    }
  });
}
