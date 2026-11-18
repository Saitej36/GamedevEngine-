import type { ReactNode } from 'react';

/** Tiny, safe Markdown subset: fenced code, inline code, bold, italics, headings, bullets. No raw HTML. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="md">
      {blocks.map((b, i) =>
        i % 2 === 1 ? (
          <pre key={i}>
            <code>{b.replace(/^[a-z]*\n/i, '')}</code>
          </pre>
        ) : (
          <Lines key={i} text={b} />
        ),
      )}
    </div>
  );
}

function Lines({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`ul${out.length}`}>{list}</ul>);
    list = [];
  };
  lines.forEach((line, i) => {
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (bullet) {
      list.push(<li key={i}>{inline(bullet[1])}</li>);
      return;
    }
    flush();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) out.push(<div key={i} className={`md-h md-h${h[1].length}`}>{inline(h[2])}</div>);
    else if (line.trim()) out.push(<p key={i}>{inline(line)}</p>);
  });
  flush();
  return <>{out}</>;
}

function inline(s: string): ReactNode[] {
  const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 3) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const STATUS_COLOR: Record<string, string> = {
  idle: 'var(--muted)',
  walking: 'var(--muted)',
  working: 'var(--green)',
  reading: 'var(--blue)',
  meeting: 'var(--yellow)',
  celebrating: 'var(--pink)',
  blocked: 'var(--orange)',
  error: 'var(--red)',
};
