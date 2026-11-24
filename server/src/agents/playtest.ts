import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentId } from '@pixel/shared';
import { REPO_ROOT } from '../config.js';
import { mimeFor, resolveInside, toPosixRel } from '../workspace/workspace.js';
import { errorMessage, nowIso, truncate } from '../util.js';

/**
 * Real playtesting without a shell: the studio serves the project workspace on 127.0.0.1 only, opens it in a
 * headless Chromium, blocks every request that leaves that local server, drives the game with the requested
 * input and reports exactly what happened (console, page errors, failed/blocked requests, probe values,
 * screenshots). The agent cannot run arbitrary commands through this; it can only load its own project.
 */

export interface PlaytestAction {
  type: 'wait' | 'key' | 'click' | 'probe' | 'screenshot';
  ms?: number;
  key?: string;
  x?: number;
  y?: number;
  expression?: string;
  name?: string;
}

export interface PlaytestReport {
  ok: boolean;
  entry: string;
  url: string;
  startedAt: string;
  durationMs: number;
  loaded: boolean;
  title: string;
  canvas: { width: number; height: number } | null;
  consoleErrors: string[];
  consoleWarnings: string[];
  consoleLog: string[];
  pageErrors: string[];
  failedRequests: string[];
  blockedExternalRequests: string[];
  steps: { action: string; result: string }[];
  screenshots: string[];
  error: string;
}

/** Serve one workspace, read-only, on an ephemeral 127.0.0.1 port. */
export function serveWorkspace(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
      if (rel.endsWith('/')) rel += 'index.html';
      const abs = resolveInside(root, rel);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${rel}`);
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeFor(abs), 'Cache-Control': 'no-store' });
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end(errorMessage(e));
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(() => r())) });
    }),
  );
}

/* Minimal structural types: Playwright is an optional runtime dependency of the studio server. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type PwPage = any;
interface Playwright {
  chromium: { launch(o: { headless: boolean; executablePath?: string }): Promise<{ newContext(o: object): Promise<any>; close(): Promise<void> }> };
}
/** Playwright is optional: resolved from the repo, then NODE_PATH. Missing → a clear, honest error. */
/**
 * Can the studio really launch a game? Checked once at startup (a real headless Chromium launch) so a broken
 * test browser is visible to the owner up front instead of surfacing as BLOCKED test reports later.
 */
export const playtestHealth: { state: 'unchecked' | 'ready' | 'unavailable'; detail: string; checkedAt: string | null } = {
  state: 'unchecked',
  detail: 'Not checked yet',
  checkedAt: null,
};
export async function checkPlaytest() {
  try {
    const b = await loadPlaywright().chromium.launch({ headless: true, executablePath: process.env.PIXEL_CHROMIUM || undefined });
    await b.close();
    Object.assign(playtestHealth, { state: 'ready', detail: 'Headless Chromium launched', checkedAt: nowIso() });
  } catch (e) {
    Object.assign(playtestHealth, {
      state: 'unavailable',
      detail: `${truncate(errorMessage(e).split('\n')[0], 400)} — games cannot be launched for QA. Install the browser with "npx playwright install chromium" (or set PLAYWRIGHT_BROWSERS_PATH / PIXEL_CHROMIUM) and restart the server.`,
      checkedAt: nowIso(),
    });
  }
  return { ...playtestHealth };
}

function loadPlaywright(): Playwright {
  const req = createRequire(path.join(REPO_ROOT, 'package.json'));
  const tries = ['playwright', ...(process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean).map((p) => path.join(p, 'playwright'))];
  for (const t of tries) {
    try {
      return req(t) as Playwright;
    } catch {
      /* next */
    }
  }
  throw new Error(
    'Playwright is not installed on the studio server, so games cannot be launched for testing. The owner can install it with: npm i -D playwright && npx playwright install chromium (then restart the server).',
  );
}

export async function runPlaytest(
  root: string,
  o: { entry?: string; actions?: PlaytestAction[]; screenshotDir: string; viewport?: { width: number; height: number }; label?: string },
): Promise<PlaytestReport> {
  const entry = (o.entry ?? 'index.html').replace(/^\/+/, '');
  const startedAt = nowIso();
  const t0 = Date.now();
  const report: PlaytestReport = {
    ok: false, entry, url: '', startedAt, durationMs: 0, loaded: false, title: '', canvas: null,
    consoleErrors: [], consoleWarnings: [], consoleLog: [], pageErrors: [], failedRequests: [], blockedExternalRequests: [],
    steps: [], screenshots: [], error: '',
  };
  resolveInside(root, entry);
  if (!fs.existsSync(path.join(root, entry))) {
    report.error = `Entry file ${entry} does not exist in the workspace.`;
    return report;
  }
  const srv = await serveWorkspace(root);
  report.url = srv.url + entry;
  let browser: { close(): Promise<void>; newContext(o: object): Promise<any> } | null = null;
  const deadline = t0 + 60_000;
  const shot = async (page: PwPage, name: string) => {
    const dir = resolveInside(root, o.screenshotDir);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${startedAt.replace(/[:.]/g, '-')}-${(name || 'shot').replace(/[^a-z0-9-_]/gi, '_').slice(0, 40)}.png`);
    await page.screenshot({ path: file });
    const rel = toPosixRel(root, file);
    report.screenshots.push(rel);
    return rel;
  };
  try {
    const pw = loadPlaywright();
    browser = await pw.chromium.launch({ headless: true, executablePath: process.env.PIXEL_CHROMIUM || undefined });
    const ctx = await browser.newContext({ viewport: o.viewport ?? { width: 960, height: 640 }, serviceWorkers: 'block' });
    await ctx.route('**/*', (route: any) => {
      const u = route.request().url();
      if (u.startsWith(srv.url)) return route.continue();
      report.blockedExternalRequests.push(u);
      return route.abort('blockedbyclient');
    });
    const page = await ctx.newPage();
    page.on('console', (m: any) => {
      const line = truncate(m.text(), 400);
      if (m.type() === 'error') report.consoleErrors.push(line);
      else if (m.type() === 'warning') report.consoleWarnings.push(line);
      else if (report.consoleLog.length < 40) report.consoleLog.push(line);
    });
    page.on('pageerror', (e: Error) => report.pageErrors.push(truncate(`${e.name}: ${e.message}`, 600)));
    page.on('requestfailed', (r: any) => {
      if (!r.url().startsWith(srv.url)) return;
      report.failedRequests.push(`${r.url().slice(srv.url.length)} (${r.failure()?.errorText ?? 'failed'})`);
    });
    page.on('response', (r: any) => {
      if (r.url().startsWith(srv.url) && r.status() >= 400) report.failedRequests.push(`${r.url().slice(srv.url.length)} (HTTP ${r.status()})`);
    });
    await page.goto(report.url, { waitUntil: 'load', timeout: 20_000 });
    report.loaded = true;
    report.title = await page.title();
    await page.waitForTimeout(1200);
    report.canvas = await page.evaluate(
      '(() => { const c = document.querySelector("canvas"); return c ? { width: c.width, height: c.height } : null; })()',
    );
    if (report.canvas) await page.locator('canvas').first().focus().catch(() => undefined);
    for (const a of (o.actions ?? []).slice(0, 40)) {
      if (Date.now() > deadline) {
        report.steps.push({ action: a.type, result: 'skipped: 60 s playtest limit reached' });
        continue;
      }
      try {
        if (a.type === 'wait') {
          await page.waitForTimeout(Math.min(a.ms ?? 500, 10_000));
          report.steps.push({ action: `wait ${a.ms ?? 500}ms`, result: 'ok' });
        } else if (a.type === 'key') {
          const ms = Math.min(a.ms ?? 100, 5000);
          await page.keyboard.down(a.key ?? 'ArrowRight');
          await page.waitForTimeout(ms);
          await page.keyboard.up(a.key ?? 'ArrowRight');
          report.steps.push({ action: `hold ${a.key} ${ms}ms`, result: 'ok' });
        } else if (a.type === 'click') {
          const box = report.canvas ? await page.locator('canvas').first().boundingBox() : null;
          const x = (box?.x ?? 0) + (a.x ?? 0);
          const y = (box?.y ?? 0) + (a.y ?? 0);
          await page.mouse.click(x, y);
          report.steps.push({ action: `click (${a.x ?? 0}, ${a.y ?? 0}) on canvas`, result: 'ok' });
        } else if (a.type === 'probe') {
          const expr = String(a.expression ?? 'null').slice(0, 2000);
          const v = await page.evaluate(
            `(() => { try { const r = (${expr}); return JSON.stringify(r === undefined ? null : r); } catch (e) { return 'THROWN: ' + e; } })()`,
          );
          report.steps.push({ action: `probe ${truncate(String(a.expression), 120)}`, result: truncate(String(v), 1500) });
        } else if (a.type === 'screenshot') {
          report.steps.push({ action: `screenshot ${a.name ?? ''}`, result: await shot(page, a.name ?? 'step') });
        }
      } catch (e) {
        report.steps.push({ action: a.type, result: `ERROR: ${truncate(errorMessage(e), 500)}` });
      }
    }
    await shot(page, o.label ?? 'final');
    report.ok = report.loaded && report.pageErrors.length === 0 && report.consoleErrors.length === 0 && report.failedRequests.length === 0;
  } catch (e) {
    report.error = truncate(errorMessage(e), 1200);
  } finally {
    await browser?.close().catch(() => undefined);
    await srv.close();
    report.durationMs = Date.now() - t0;
  }
  return report;
}

/** Library files the studio can copy into a project (local copies; no network, no package manager). */
function vendorable(): Record<string, { version: string; file: string; dest: string }> {
  const out: Record<string, { version: string; file: string; dest: string }> = {};
  try {
    const req = createRequire(path.join(REPO_ROOT, 'client', 'package.json'));
    const pkg = req.resolve('phaser/package.json');
    const version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version as string;
    out.phaser = { version, file: path.join(path.dirname(pkg), 'dist', 'phaser.min.js'), dest: `public/vendor/phaser-${version}.min.js` };
  } catch {
    /* not installed */
  }
  return out;
}

const PLAYTEST_DIR: Partial<Record<AgentId, string>> = { qa: 'qa/playtests', programmer: 'tests/playtests' };

/** MCP tools for agents that test (QA) or build (Programmer) playable code. */
export function playtestServer(ctx: { agentId: AgentId; root: string; onFile: (rel: string) => void; onReport?: (r: PlaytestReport) => void }) {
  const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
  const tools = [
    tool(
      'run_game',
      'Launch the project in a real headless Chromium browser (served from the project workspace on localhost; all external network is blocked), optionally drive it with keyboard/mouse input and JavaScript probes, and get back the console output, page errors, failed requests, probe results and screenshot paths. This actually runs the game: use it to verify that it loads and plays. Report its findings honestly.',
      {
        entry: z.string().max(200).default('index.html').describe('HTML file to open, relative to the project root'),
        actions: z
          .array(
            z.object({
              type: z.enum(['wait', 'key', 'click', 'probe', 'screenshot']),
              ms: z.number().int().min(0).max(10000).optional().describe('wait: duration; key: how long to hold the key'),
              key: z.string().max(30).optional().describe('Playwright key name, e.g. ArrowLeft, ArrowUp, Space, KeyR, Enter'),
              x: z.number().optional().describe('click: x in canvas pixels'),
              y: z.number().optional().describe('click: y in canvas pixels'),
              expression: z.string().max(2000).optional().describe('probe: a JavaScript expression evaluated in the page, e.g. window.game.scene.scenes[0].score'),
              name: z.string().max(40).optional().describe('screenshot: label'),
            }),
          )
          .max(40)
          .default([]),
        label: z.string().max(40).optional(),
      },
      async (a) => {
        const r = await runPlaytest(ctx.root, { entry: a.entry, actions: a.actions as PlaytestAction[], screenshotDir: PLAYTEST_DIR[ctx.agentId] ?? 'qa/playtests', label: a.label });
        r.screenshots.forEach(ctx.onFile);
        ctx.onReport?.(r);
        return ok(`PLAYTEST REPORT (real browser run, ${r.durationMs} ms)\n${JSON.stringify(r, null, 2)}`);
      },
    ),
  ];
  if (ctx.agentId === 'programmer')
    tools.push(
      tool(
        'add_library',
        'Copy a game library that the studio has locally into the project (no network, no package manager). Available: phaser (the studio\'s Phaser 3.90 build). Returns the path to reference from index.html with a <script> tag.',
        { name: z.enum(['phaser']) },
        async (a) => {
          const lib = vendorable()[a.name];
          if (!lib) return { content: [{ type: 'text' as const, text: `${a.name} is not available on this studio server.` }], isError: true };
          const dest = resolveInside(ctx.root, lib.dest);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(lib.file, dest);
          ctx.onFile(lib.dest);
          return ok(`Copied ${a.name} ${lib.version} to ${lib.dest}. Load it with <script src="${lib.dest}"></script> before your game scripts. It defines the global Phaser.`);
        },
      ) as unknown as (typeof tools)[number],
    );
  const names = ['mcp__playtest__run_game', ...(ctx.agentId === 'programmer' ? ['mcp__playtest__add_library'] : [])];
  return { server: createSdkMcpServer({ name: 'playtest', version: '1.0.0', tools }), toolNames: names };
}
