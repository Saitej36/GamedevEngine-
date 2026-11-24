import fs from 'node:fs';
import http from 'node:http';
import { log } from '../util.js';
import { mimeFor, resolveInside, workspaceRoot } from './workspace.js';

/**
 * Game preview on its own origin (a separate port, bound to 127.0.0.1). Agent-written HTML/JS runs here, never on
 * the studio app's origin, so a generated game cannot read the studio API. Read-only; no directory listings.
 * URL shape: http://localhost:<previewPort>/<projectId>/<path inside the workspace>
 */
export function startPreviewServer(port: number) {
  const server = http.createServer((req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      const u = new URL(req.url ?? '/', 'http://localhost');
      const [, projectId, ...rest] = decodeURIComponent(u.pathname).split('/');
      if (!projectId) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Pixel Studio game preview: open /<projectId>/index.html');
        return;
      }
      const root = workspaceRoot(projectId);
      let rel = rest.join('/') || 'index.html';
      if (rel.endsWith('/')) rel += 'index.html';
      const abs = resolveInside(root, rel);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found in the project workspace: ${rel}`);
        return;
      }
      res.writeHead(200, {
        'Content-Type': mimeFor(abs),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        // Games may load their own files; nothing may be fetched from the studio API or the internet.
        'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; form-action 'none'; frame-ancestors 'none'",
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(abs).pipe(res);
    } catch (e) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end(String((e as Error).message));
    }
  });
  server.on('error', (e) => log.error(`Game preview server could not start on port ${port}`, e));
  server.listen(port, '127.0.0.1', () => log.info(`Game preview on http://localhost:${port}/<projectId>/index.html`));
  return server;
}
