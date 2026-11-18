import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AgentId, TaskPriority } from '@pixel/shared';
import { AGENTS, isAgentId } from '@pixel/shared';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import type { Hub } from '../events/hub.js';
import type { Studio } from '../orchestrator/studio.js';
import { fileTree, mimeFor, resolveInside, workspaceRoot, writeBrief } from '../workspace/workspace.js';
import { HttpError } from '../util.js';

type Body = Record<string, unknown>;
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

function str(b: Body, key: string, opts: { required?: boolean; max?: number } = {}): string {
  const v = b[key];
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new HttpError(400, `"${key}" is required`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpError(400, `"${key}" must be a string`);
  if (opts.max && v.length > opts.max) throw new HttpError(400, `"${key}" is too long (max ${opts.max})`);
  return v.trim();
}

const wrap =
  (fn: (req: Request, res: Response) => unknown) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (e) {
      next(e);
    }
  };

export function apiRouter(store: Store, studio: Studio, hub: Hub) {
  const r = express.Router();
  r.use(express.json({ limit: '2mb' }));

  r.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  r.get(
    '/info',
    wrap(() => ({
      aiMode: config.aiMode,
      aiReason: config.aiReason,
      model: config.model,
      maxConcurrentAgents: config.maxConcurrentAgents,
      bashEnabled: config.bashEnabled,
      version: config.version,
    })),
  );

  // -- agents ---------------------------------------------------------------
  r.get('/agents', wrap(() => ({ profiles: AGENTS, states: store.listAgentStates(), running: studio.runningTasks() })));
  r.get(
    '/agents/:id',
    wrap((req) => {
      const id = req.params.id;
      if (!isAgentId(id)) throw new HttpError(404, 'Unknown agent');
      return {
        profile: AGENTS[id],
        state: store.listAgentStates().find((s) => s.agentId === id),
        tasks: store.tasksForAgent(id, 30),
        events: store.listEvents({ agentId: id, limit: 60 }),
        permissions: {
          writableDirs: AGENTS[id].writableDirs,
          tools: AGENTS[id].tools,
          bash: AGENTS[id].canUseBash && config.bashEnabled,
        },
      };
    }),
  );

  // -- projects -------------------------------------------------------------
  r.get('/projects', wrap(() => store.listProjects()));
  r.post(
    '/projects',
    wrap((req) => {
      const b = req.body as Body;
      return studio.createProject({
        name: str(b, 'name', { required: true, max: 80 }),
        genre: str(b, 'genre', { max: 80 }),
        brief: str(b, 'brief', { max: 20000 }),
        repoUrl: str(b, 'repoUrl', { max: 400 }),
      });
    }),
  );
  r.get(
    '/projects/:id',
    wrap((req) => {
      const id = String(req.params.id);
      return {
        project: store.getProject(id),
        milestones: store.listMilestones(id),
        tasks: store.listTasks(id),
        approvals: store.listApprovals(id),
        stats: studio.stats(id),
      };
    }),
  );
  r.patch(
    '/projects/:id',
    wrap((req) => {
      const b = req.body as Body;
      const patch: Record<string, string> = {};
      for (const k of ['name', 'genre', 'brief', 'repoUrl', 'status'] as const)
        if (k in b) patch[k] = str(b, k, { max: k === 'brief' ? 20000 : 400 });
      if (patch.status && !['active', 'archived'].includes(patch.status)) throw new HttpError(400, 'Invalid status');
      const p = store.updateProject(String(req.params.id), patch);
      if ('brief' in patch || 'name' in patch || 'genre' in patch || 'repoUrl' in patch) writeBrief(p);
      hub.broadcast({ kind: 'project_updated', project: p });
      return p;
    }),
  );
  r.delete(
    '/projects/:id',
    wrap((req) => {
      const id = String(req.params.id);
      for (const t of store.listTasks(id)) studio.cancelTask(t.id, 'Project deleted');
      store.deleteProject(id);
      return { ok: true };
    }),
  );
  r.get('/projects/:id/stats', wrap((req) => studio.stats(String(req.params.id))));
  r.get(
    '/projects/:id/events',
    wrap((req) => store.listEvents({ projectId: String(req.params.id), limit: Math.min(1000, Number(req.query.limit ?? 300)) })),
  );

  // -- milestones -----------------------------------------------------------
  r.post(
    '/projects/:id/milestones',
    wrap((req) => {
      const b = req.body as Body;
      const m = store.createMilestone({
        projectId: store.getProject(String(req.params.id)).id,
        title: str(b, 'title', { required: true, max: 120 }),
        description: str(b, 'description', { max: 4000 }),
        dueDate: str(b, 'dueDate') || null,
      });
      hub.broadcast({ kind: 'milestone_updated', milestone: m }, m.projectId);
      return m;
    }),
  );
  r.patch(
    '/milestones/:id',
    wrap((req) => {
      const b = req.body as Body;
      const patch: Record<string, unknown> = {};
      if ('title' in b) patch.title = str(b, 'title', { required: true });
      if ('description' in b) patch.description = str(b, 'description');
      if ('dueDate' in b) patch.dueDate = str(b, 'dueDate') || null;
      if ('status' in b) {
        const s = str(b, 'status');
        if (!['planned', 'active', 'done'].includes(s)) throw new HttpError(400, 'Invalid status');
        patch.status = s;
      }
      const m = store.updateMilestone(String(req.params.id), patch);
      hub.broadcast({ kind: 'milestone_updated', milestone: m }, m.projectId);
      return m;
    }),
  );
  r.delete(
    '/milestones/:id',
    wrap((req) => {
      store.deleteMilestone(String(req.params.id));
    }),
  );

  // -- tasks ----------------------------------------------------------------
  r.post(
    '/projects/:id/tasks',
    wrap((req) => {
      const b = req.body as Body;
      const assignee = str(b, 'assignee', { required: true });
      if (!isAgentId(assignee)) throw new HttpError(400, 'Unknown assignee');
      const priority = (str(b, 'priority') || 'medium') as TaskPriority;
      if (!PRIORITIES.includes(priority)) throw new HttpError(400, 'Invalid priority');
      return studio.createTask({
        projectId: String(req.params.id),
        title: str(b, 'title', { required: true, max: 160 }),
        description: str(b, 'description', { required: true, max: 20000 }),
        assignee,
        priority,
        milestoneId: str(b, 'milestoneId') || null,
        requiresApproval: Boolean(b.requiresApproval),
        createdBy: 'user',
      });
    }),
  );
  r.patch(
    '/tasks/:id',
    wrap((req) => {
      const b = req.body as Body;
      const patch: Parameters<Studio['updateTask']>[1] = {};
      if ('title' in b) patch.title = str(b, 'title', { required: true, max: 160 });
      if ('description' in b) patch.description = str(b, 'description', { max: 20000 });
      if ('priority' in b) {
        const p = str(b, 'priority') as TaskPriority;
        if (!PRIORITIES.includes(p)) throw new HttpError(400, 'Invalid priority');
        patch.priority = p;
      }
      if ('assignee' in b) {
        const a = str(b, 'assignee');
        if (!isAgentId(a)) throw new HttpError(400, 'Unknown assignee');
        patch.assignee = a as AgentId;
      }
      if ('requiresApproval' in b) patch.requiresApproval = Boolean(b.requiresApproval);
      if ('milestoneId' in b) patch.milestoneId = str(b, 'milestoneId') || null;
      return studio.updateTask(String(req.params.id), patch);
    }),
  );
  r.post('/tasks/:id/start', wrap((req) => studio.startTask(String(req.params.id))));
  r.post('/tasks/:id/cancel', wrap((req) => studio.cancelTask(String(req.params.id))));
  r.post('/tasks/:id/retry', wrap((req) => studio.retryTask(String(req.params.id))));
  r.delete(
    '/tasks/:id',
    wrap((req) => {
      studio.deleteTask(String(req.params.id));
    }),
  );

  // -- approvals ------------------------------------------------------------
  r.get('/projects/:id/approvals', wrap((req) => store.listApprovals(String(req.params.id))));
  r.post(
    '/approvals/:id/resolve',
    wrap((req) => {
      const b = req.body as Body;
      const decision = str(b, 'decision', { required: true });
      if (decision !== 'approved' && decision !== 'rejected') throw new HttpError(400, 'decision must be approved|rejected');
      return studio.resolveApproval(String(req.params.id), decision, str(b, 'response', { max: 4000 }));
    }),
  );

  // -- director chat --------------------------------------------------------
  r.get('/projects/:id/chat', wrap((req) => store.listChat(String(req.params.id))));
  r.post(
    '/projects/:id/chat',
    wrap((req) => studio.chat(String(req.params.id), str(req.body as Body, 'content', { required: true, max: 8000 }))),
  );

  // -- files ----------------------------------------------------------------
  r.get(
    '/projects/:id/files',
    wrap((req) => {
      store.getProject(String(req.params.id));
      return fileTree(String(req.params.id));
    }),
  );
  r.get('/projects/:id/file', (req, res, next) => {
    try {
      const id = String(req.params.id);
      store.getProject(id);
      const root = workspaceRoot(id);
      const abs = resolveInside(root, String(req.query.path ?? ''));
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, 'File not found');
      res.setHeader('Content-Type', mimeFor(abs));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Never let agent-written HTML/SVG run scripts in the app's origin.
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
      if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="${path.basename(abs)}"`);
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      next(e);
    }
  });
  r.put(
    '/projects/:id/file',
    wrap((req) => {
      const id = String(req.params.id);
      store.getProject(id);
      const b = req.body as Body;
      const root = workspaceRoot(id);
      const abs = resolveInside(root, str(b, 'path', { required: true }));
      const content = typeof b.content === 'string' ? b.content : '';
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      hub.broadcast({ kind: 'files_changed', projectId: id }, id);
      return { ok: true };
    }),
  );

  r.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Internal error';
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  });

  return r;
}
