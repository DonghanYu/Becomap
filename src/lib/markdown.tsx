import type { ReactNode } from "react";

/** 동의 문구용 최소 마크다운 렌더러(제목·목록·인용·문단만 지원) */
export function renderSimpleMarkdown(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul${out.length}`} className="ml-5 list-disc space-y-1">
          {list.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) out.push(<h3 key={out.length} className="mt-4 font-semibold">{line.slice(3)}</h3>);
    else if (line.startsWith("# ")) out.push(<h2 key={out.length} className="text-lg font-bold">{line.slice(2)}</h2>);
    else if (line.startsWith("> "))
      out.push(
        <p key={out.length} className="rounded bg-accent-soft px-3 py-2 text-sm">
          {line.slice(2)}
        </p>,
      );
    else out.push(<p key={out.length}>{line}</p>);
  }
  flush();
  return out;
}
