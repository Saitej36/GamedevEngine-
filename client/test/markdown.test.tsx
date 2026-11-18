import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownDoc, MarkdownFile, resolveWorkspacePath } from '../src/ui/MarkdownDoc';

const SAMPLE = `# LANTERNFALL — Mini GDD

## Base stats

| Stat | Base | Min / Max |
|---|---|---|
| Max HP | 6 pips | 3 / 12 |
| Move speed | 90 px/s | 60 / 140 |

### Lists
- one
- two
  - nested

1. first
2. second

- [x] done item

\`\`\`ts
const hp = 6;
\`\`\`

Inline \`code\`, **bold**, *em*, ~~struck~~.

[Style guide](../docs/art/STYLE_GUIDE.md) · [Anthropic](https://www.anthropic.com) · [anchor](#base-stats)
[bad](javascript:alert(1)) · [escape](../../etc/passwd)

<script>alert('x')</script>
`;

const render = (src = SAMPLE, extra = {}) =>
  renderToStaticMarkup(<MarkdownDoc source={src} filePath="design/levels.md" onOpenFile={() => {}} {...extra} />);

test('markdown: renders GFM tables with header and body cells', () => {
  const html = render();
  assert.match(html, /<table>/);
  assert.match(html, /<th>Stat<\/th>/);
  assert.match(html, /<td>Max HP<\/td><td>6 pips<\/td><td>3 \/ 12<\/td>/);
  assert.match(html, /md-table-wrap/);
});

test('markdown: renders headings, lists, task lists and inline formatting', () => {
  const html = render();
  assert.match(html, /<h1>LANTERNFALL — Mini GDD<\/h1>/);
  assert.match(html, /<h2>Base stats<\/h2>/);
  assert.match(html, /<h3>Lists<\/h3>/);
  assert.match(html, /<ul>[\s\S]*<li>one<\/li>/);
  assert.match(html, /<li>nested<\/li>/);
  assert.match(html, /<ol>[\s\S]*<li>first<\/li>/);
  assert.match(html, /<input type="checkbox" disabled="" checked=""\/>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>em<\/em>/);
  assert.match(html, /<del>struck<\/del>/);
  assert.match(html, /<code>code<\/code>/);
});

test('markdown: renders fenced code blocks with their language', () => {
  assert.match(render(), /<pre><code class="language-ts">const hp = 6;\n<\/code><\/pre>/);
});

test('markdown: external links open safely, relative links open workspace files', () => {
  const html = render();
  assert.match(html, /<a href="https:\/\/www\.anthropic\.com" target="_blank" rel="noopener noreferrer">Anthropic<\/a>/);
  assert.match(html, /<button type="button" class="link" data-path="docs\/art\/STYLE_GUIDE\.md">Style guide<\/button>/);
  assert.match(html, /<a href="#base-stats">anchor<\/a>/);
});

test('markdown: unsafe links and raw HTML are never active', () => {
  const html = render();
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /<script>/);
  // A path escaping the workspace is shown as inert text.
  assert.match(html, /<span class="md-dead-link" title="..\/..\/etc\/passwd">escape<\/span>/);
});

test('markdown: relative images use the workspace file URL', () => {
  const html = render('![hero](../assets/hero.svg)', { assetUrl: (p: string) => `/files/${p}` });
  assert.match(html, /<img src="\/files\/assets\/hero.svg" alt="hero" loading="lazy"\/>/);
});

test('markdown: source mode shows the original file byte-for-byte', () => {
  const html = renderToStaticMarkup(<MarkdownFile source={SAMPLE} filePath="docs/GDD.md" initialMode="source" />);
  const pre = html.match(/<pre class="code-preview md-source">([\s\S]*)<\/pre>/)![1];
  const decoded = pre.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  assert.equal(decoded, SAMPLE);
});

test('markdown: resolveWorkspacePath stays inside the workspace', () => {
  assert.equal(resolveWorkspacePath('docs/GDD.md', 'art/STYLE_GUIDE.md'), 'docs/art/STYLE_GUIDE.md');
  assert.equal(resolveWorkspacePath('docs/GDD.md', '../src/main.js#L3'), 'src/main.js');
  assert.equal(resolveWorkspacePath('docs/GDD.md', '/qa/TEST_PLAN.md'), 'qa/TEST_PLAN.md');
  assert.equal(resolveWorkspacePath('docs/GDD.md', '../../secret'), null);
  assert.equal(resolveWorkspacePath('docs/GDD.md', 'https://x.y'), null);
});
