import { HttpError } from '../util.js';

/**
 * Importers for owner-registered external knowledge. Nothing here ever ingests a whole repository or site:
 * only the paths/pages the owner selected, with hard size limits. Imported text is stored as untrusted
 * reference data — it can never become a skill or system instruction.
 */

export const LIMITS = {
  maxFiles: 150,
  maxFileBytes: 300_000,
  maxTotalBytes: 3_000_000,
  maxPages: 25,
};

const TEXT_EXT = /\.(md|mdx|markdown|txt|rst|adoc|cs|ts|tsx|js|mjs|cpp|cc|h|hpp|py|gd|json|ya?ml|ini|uproject|uplugin)$/i;

export type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
  headers: { get(name: string): string | null };
}>;

export interface ImportedDoc {
  path: string;
  title: string;
  content: string;
}

export interface ImportResult {
  docs: ImportedDoc[];
  version?: string;
  license?: string;
  notes?: string[];
}

export function titleFromContent(pathOrName: string, content: string) {
  const h = content.match(/^\s*#\s+(.+)$/m);
  return (h ? h[1] : pathOrName.split('/').pop() || pathOrName).trim().slice(0, 160);
}

function checkSize(docs: ImportedDoc[]) {
  let total = 0;
  for (const d of docs) {
    total += Buffer.byteLength(d.content);
    if (Buffer.byteLength(d.content) > LIMITS.maxFileBytes)
      throw new HttpError(413, `${d.path} is larger than ${LIMITS.maxFileBytes / 1000} KB; select smaller files`);
  }
  if (total > LIMITS.maxTotalBytes) throw new HttpError(413, `Selection exceeds ${LIMITS.maxTotalBytes / 1e6} MB; select fewer paths`);
  if (docs.length > LIMITS.maxFiles) throw new HttpError(413, `Selection has ${docs.length} files; the limit is ${LIMITS.maxFiles}`);
}

// ---------------------------------------------------------------------------
// Markdown / internal documents (uploaded or pasted by the owner)
// ---------------------------------------------------------------------------
export function importMarkdown(files: { path: string; content: string }[]): ImportResult {
  if (!files.length) throw new HttpError(400, 'Provide at least one document');
  const docs = files.map((f) => ({ path: f.path, title: titleFromContent(f.path, f.content), content: f.content }));
  checkSize(docs);
  return { docs };
}

// ---------------------------------------------------------------------------
// PDF guides
// ---------------------------------------------------------------------------
export async function importPdf(name: string, data: Uint8Array): Promise<ImportResult> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  let pdf;
  try {
    pdf = await getDocumentProxy(data);
  } catch (e) {
    throw new HttpError(400, `Could not read PDF: ${(e as Error).message}`);
  }
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t.replace(/[ \t]+\n/g, '\n').trim() })).filter((p) => p.text);
  if (!pages.length) throw new HttpError(422, 'The PDF has no extractable text (scanned images are not supported)');
  // One document per ~10 pages keeps sections retrievable; each page becomes a `##` section.
  const docs: ImportedDoc[] = [];
  for (let i = 0; i < pages.length; i += 10) {
    const chunk = pages.slice(i, i + 10);
    docs.push({
      path: `${name}#pages-${chunk[0].page}-${chunk.at(-1)!.page}`,
      title: `${name} (pages ${chunk[0].page}–${chunk.at(-1)!.page})`,
      content: chunk.map((p) => `## Page ${p.page}\n\n${p.text}`).join('\n\n'),
    });
  }
  checkSize(docs);
  return { docs, notes: [`${totalPages} pages, ${pages.length} with text`] };
}

// ---------------------------------------------------------------------------
// GitHub repositories (selected paths only)
// ---------------------------------------------------------------------------
export function parseGithubUrl(url: string) {
  const m = url.trim().match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/i);
  if (!m) throw new HttpError(400, 'Expected a repository URL like https://github.com/owner/repo');
  return { owner: m[1], repo: m[2], ref: m[3] };
}

export async function importGithub(
  fetcher: Fetcher,
  opts: { url: string; ref?: string; includePaths: string[]; token?: string },
): Promise<ImportResult> {
  const { owner, repo, ref: urlRef } = parseGithubUrl(opts.url);
  const ref = opts.ref || urlRef || 'main';
  const include = opts.includePaths.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean);
  if (!include.length) throw new HttpError(400, 'Select at least one folder or file — whole repositories are not imported');
  for (const p of include) if (p.includes('..')) throw new HttpError(400, `Invalid path ${p}`);
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'pixel-studio' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const notes: string[] = [];

  // Resolve the commit so the import is pinned to an exact version.
  let sha: string | null = null;
  let files: string[] | null = null;
  let license = '';
  try {
    const c = await fetcher(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, { headers });
    if (c.ok) sha = String(((await c.json()) as { sha?: string }).sha ?? '') || null;
    const tree = await fetcher(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha ?? encodeURIComponent(ref)}?recursive=1`, { headers });
    if (tree.ok) {
      const t = (await tree.json()) as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean };
      files = (t.tree ?? [])
        .filter((e) => e.type === 'blob' && TEXT_EXT.test(e.path))
        .filter((e) => include.some((p) => e.path === p || e.path.startsWith(p + '/')))
        .map((e) => e.path);
      if (t.truncated) notes.push('GitHub tree listing was truncated; some files in the selection may be missing');
    }
    const lic = await fetcher(`https://api.github.com/repos/${owner}/${repo}/license`, { headers });
    if (lic.ok) license = String(((await lic.json()) as { license?: { spdx_id?: string } }).license?.spdx_id ?? '');
  } catch {
    /* fall through to explicit paths */
  }
  if (!files) {
    // Without API access (rate limits, restricted networks) only explicitly named files can be fetched.
    files = include.filter((p) => TEXT_EXT.test(p));
    const dirs = include.filter((p) => !TEXT_EXT.test(p));
    notes.push('GitHub API unavailable: imported the explicitly listed files only' + (dirs.length ? `; skipped folders ${dirs.join(', ')} (folder listing needs the API)` : ''));
    if (!files.length) throw new HttpError(502, 'GitHub API unavailable and no explicit file paths were given');
  }
  if (files.length > LIMITS.maxFiles) throw new HttpError(413, `Selection has ${files.length} files; the limit is ${LIMITS.maxFiles}. Narrow the paths.`);
  const at = sha ?? ref;
  const docs: ImportedDoc[] = [];
  for (const f of files) {
    const r = await fetcher(`https://raw.githubusercontent.com/${owner}/${repo}/${at}/${f.split('/').map(encodeURIComponent).join('/')}`);
    if (!r.ok) {
      notes.push(`skipped ${f} (HTTP ${r.status})`);
      continue;
    }
    const content = await r.text();
    docs.push({ path: f, title: titleFromContent(f, content), content: /\.(md|mdx|markdown|txt|rst|adoc)$/i.test(f) ? content : `## ${f}\n\n\`\`\`\n${content}\n\`\`\`` });
  }
  if (!docs.length) throw new HttpError(502, 'No files could be fetched from the selection');
  if (!license) {
    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
      const r = await fetcher(`https://raw.githubusercontent.com/${owner}/${repo}/${at}/${name}`).catch(() => null);
      if (r?.ok) {
        const first = (await r.text()).split('\n').find((l) => l.trim()) ?? '';
        license = `${first.trim().slice(0, 80)} (from ${name}; not machine-verified)`;
        break;
      }
    }
  }
  checkSize(docs);
  return { docs, version: sha ? `${ref} @ ${sha.slice(0, 12)}` : `${ref} (unpinned: commit not resolvable without API)`, license, notes };
}

// ---------------------------------------------------------------------------
// Official documentation websites (specific pages only)
// ---------------------------------------------------------------------------
export function htmlToMarkdown(html: string): string {
  const body = (html.match(/<main[\s\S]*?<\/main>/i) ?? html.match(/<article[\s\S]*?<\/article>/i) ?? html.match(/<body[\s\S]*?<\/body>/i) ?? [html])[0];
  return body
    .replace(/<(script|style|nav|header|footer|svg|noscript|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/<h1[^>]*>/gi, '\n# ')
    .replace(/<h2[^>]*>/gi, '\n## ')
    .replace(/<h[3-6][^>]*>/gi, '\n### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<pre[^>]*>/gi, '\n```\n')
    .replace(/<\/pre>/gi, '\n```\n')
    .replace(/<(br|\/p|\/div|\/tr|\/table|\/ul|\/ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function importPages(fetcher: Fetcher, urls: string[]): Promise<ImportResult> {
  const list = urls.map((u) => u.trim()).filter(Boolean);
  if (!list.length) throw new HttpError(400, 'List the documentation pages to import — whole sites are not crawled');
  if (list.length > LIMITS.maxPages) throw new HttpError(413, `At most ${LIMITS.maxPages} pages per source`);
  const docs: ImportedDoc[] = [];
  const notes: string[] = [];
  for (const u of list) {
    if (!/^https:\/\//i.test(u)) throw new HttpError(400, `Only https URLs are allowed: ${u}`);
    const r = await fetcher(u, { headers: { 'User-Agent': 'pixel-studio', Accept: 'text/html,text/markdown,text/plain' } });
    if (!r.ok) {
      notes.push(`skipped ${u} (HTTP ${r.status})`);
      continue;
    }
    const raw = await r.text();
    const type = r.headers.get('content-type') ?? '';
    const content = /html/i.test(type) || /^\s*</.test(raw) ? htmlToMarkdown(raw) : raw;
    docs.push({ path: u, title: titleFromContent(u, content), content });
  }
  if (!docs.length) throw new HttpError(502, `No pages could be fetched (${notes.join('; ')})`);
  checkSize(docs);
  return { docs, notes };
}
