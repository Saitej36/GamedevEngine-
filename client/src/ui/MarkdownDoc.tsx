import { useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Resolve a link/image target written inside a workspace Markdown file to a
 * workspace-relative path. Returns null for anything that is not a plain relative
 * path or that would escape the workspace root.
 */
export function resolveWorkspacePath(fromFile: string, href: string): string | null {
  const target = href.split(/[?#]/)[0];
  if (!target || SCHEME.test(target) || target.startsWith('//')) return null;
  const base = target.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
  const parts = [...base];
  for (const seg of target.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(decodeURIComponent(seg));
  }
  return parts.length ? parts.join('/') : null;
}

interface DocProps {
  source: string;
  /** Workspace path of the file being shown; relative links resolve against it. */
  filePath: string;
  /** Open another workspace file in the explorer. */
  onOpenFile?: (path: string) => void;
  /** URL for a workspace asset (images referenced by relative path). */
  assetUrl?: (path: string) => string;
}

/**
 * GitHub-flavoured Markdown (tables, task lists, strikethrough, autolinks) rendered
 * with react-markdown. Raw HTML in the file is shown as text, never executed, and
 * unsafe URL schemes are stripped by react-markdown's default URL transform.
 */
export function MarkdownDoc({ source, filePath, onOpenFile, assetUrl }: DocProps) {
  const components: Components = {
    a({ href = '', children }) {
      if (!href) return <span>{children}</span>;
      if (href.startsWith('#')) return <a href={href}>{children}</a>;
      if (SCHEME.test(href) || href.startsWith('//'))
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      const resolved = resolveWorkspacePath(filePath, href);
      if (!resolved || !onOpenFile) return <span className="md-dead-link" title={href}>{children}</span>;
      return (
        <button type="button" className="link" data-path={resolved} onClick={() => onOpenFile(resolved)}>
          {children}
        </button>
      );
    },
    img({ src, alt }) {
      const s = typeof src === 'string' ? src : '';
      if (/^https:\/\//i.test(s)) return <img src={s} alt={alt ?? ''} loading="lazy" />;
      const resolved = resolveWorkspacePath(filePath, s);
      if (!resolved || !assetUrl) return <span className="muted">[image: {alt || s}]</span>;
      return <img src={assetUrl(resolved)} alt={alt ?? ''} loading="lazy" />;
    },
    table({ children }) {
      return (
        <div className="md-table-wrap">
          <table>{children}</table>
        </div>
      );
    },
  };
  return (
    <div className="markdown-doc">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </Markdown>
    </div>
  );
}

/** Rendered / Source toggle. Source mode shows the file byte-for-byte. */
export function MarkdownFile(props: DocProps & { initialMode?: 'rendered' | 'source' }) {
  const [mode, setMode] = useState(props.initialMode ?? 'rendered');
  return (
    <div className="md-file">
      <div className="seg" role="tablist" aria-label="Preview mode">
        <button type="button" role="tab" aria-selected={mode === 'rendered'} className={mode === 'rendered' ? 'active' : ''} onClick={() => setMode('rendered')}>
          Rendered
        </button>
        <button type="button" role="tab" aria-selected={mode === 'source'} className={mode === 'source' ? 'active' : ''} onClick={() => setMode('source')}>
          Source
        </button>
      </div>
      {mode === 'rendered' ? <MarkdownDoc {...props} /> : <pre className="code-preview md-source">{props.source}</pre>}
    </div>
  );
}
