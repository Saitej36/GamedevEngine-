import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AgentId, ProjectProfile, TaskPriority } from '@pixel/shared';
import { AGENTS, isAgentId } from '@pixel/shared';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import type { Hub } from '../events/hub.js';
import type { Studio } from '../orchestrator/studio.js';
import { fileTree, mimeFor, resolveInside, workspaceRoot, writeBrief } from '../workspace/workspace.js';
import { HttpError } from '../util.js';

type Body = Record<string, unknown>;

const ENGINE_IDS = ['', 'unreal', 'unity', 'phaser', 'web', 'godot', 'other'] as const;
/** Validate an owner-supplied project profile (all fields optional strings, engine from a fixed list). */
function parseProfile(v: unknown): ProjectProfile {
  if (v === undefined || v === null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'profile must be an object');
  const o = v as Record<string, unknown>;
  const out: ProjectProfile = {};
  const text = (k: keyof ProjectProfile, max = 120) => {
    const x = o[k];
    if (x === undefined || x === null || x === '') return;
    if (typeof x !== 'string' || x.length > max) throw new HttpError(400, `profile.${k} must be a string of at most ${max} characters`);
    (out as Record<string, string>)[k] = x.trim();
  };
  if (o.engine !== undefined && o.engine !== null) {
    if (!ENGINE_IDS.includes(o.engine as (typeof ENGINE_IDS)[number])) throw new HttpError(400, `profile.engine must be one of ${ENGINE_IDS.filter(Boolean).join(', ')}`);
    if (o.engine) out.engine = o.engine as ProjectProfile['engine'];
  }
  text('engineVersion', 40);
  text('platform');
  text('primaryGenre');
  text('secondaryGenre');
  text('programmingApproach', 200);
  text('projectType');
  return out;
}
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
  // PDF uploads to the knowledge library arrive base64-encoded; every other route keeps the small limit.
  const smallJson = express.json({ limit: '2mb' });
  const uploadJson = express.json({ limit: '30mb' });
  r.use((req, res, next) => (req.method === 'POST' && req.path === '/knowledge/sources' ? uploadJson : smallJson)(req, res, next));

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
        profile: parseProfile(b.profile),
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
      if ('profile' in b) studio.updateProfile(String(req.params.id), parseProfile(b.profile));
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
  r.get('/projects/:id/usage', wrap((req) => studio.usage(String(req.params.id))));
  r.get(
    '/projects/:id/tool-calls',
    wrap((req) => {
      const d = req.query.decision;
      return studio.toolCalls(
        String(req.params.id),
        d === 'allow' || d === 'deny' || d === 'tool_rejected' ? d : undefined,
      );
    }),
  );
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
        dependsOn: Array.isArray(b.dependsOn) ? b.dependsOn.map(String) : [],
        skillId: str(b, 'skillId') || null,
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
  r.get('/tasks/:id/history', wrap((req) => studio.taskHistory(String(req.params.id))));
  r.get('/tasks/:id/knowledge', wrap((req) => studio.taskKnowledge(String(req.params.id))));
  r.get('/tasks/:id/routing', wrap((req) => studio.taskRouting(String(req.params.id))));

  // -- knowledge library ----------------------------------------------------
  const kn = () => {
    if (!studio.knowledge) throw new HttpError(503, 'Knowledge library not loaded');
    return studio.knowledge;
  };
  const SOURCE_KINDS = ['docs_site', 'github', 'markdown', 'pdf', 'example_project', 'internal_doc'] as const;
  const TRUST = ['official', 'community', 'internal'] as const;
  const depts = (v: unknown): AgentId[] => (Array.isArray(v) ? v.map(String).filter(isAgentId) : []);
  r.get(
    '/knowledge',
    wrap(() => ({ packs: kn().packs(), skills: kn().skills(), sources: kn().sources(), errors: kn().errors })),
  );
  r.get(
    '/knowledge/docs/:id',
    wrap((req) => {
      const d = kn().docContent(String(req.params.id));
      if (!d) throw new HttpError(404, 'Document not found');
      return d;
    }),
  );
  r.get(
    '/knowledge/skills/:id',
    wrap((req) => {
      const s = kn().skill(String(req.params.id));
      if (!s) throw new HttpError(404, 'Skill not found');
      return { ...s, body: kn().skillBody(s.id) };
    }),
  );
  r.put(
    '/knowledge/skills/:id',
    wrap((req) => kn().setSkillEnabled(String(req.params.id), Boolean((req.body as Body).enabled))),
  );
  r.put(
    '/knowledge/packs/:id/departments',
    wrap((req) => kn().setPackDepartments(String(req.params.id), depts((req.body as Body).departments))),
  );
  r.get(
    '/knowledge/search',
    wrap((req) => {
      const agent = String(req.query.agent ?? '');
      if (!isAgentId(agent)) throw new HttpError(400, 'agent is required');
      const q = String(req.query.q ?? '').trim();
      if (!q) throw new HttpError(400, 'q is required');
      const projectId = req.query.projectId ? String(req.query.projectId) : null;
      const project = projectId ? store.getProject(projectId) : null;
      const prepared = studio.prepareKnowledge({
        agentId: agent,
        projectId,
        taskText: q,
        projectText: project ? `${project.genre}\n${project.brief}` : '',
      });
      if (!prepared) return { tools: [], skill: null, hits: [], routing: null };
      const pl = prepared.plan;
      return {
        tools: prepared.tools,
        skill: prepared.skill,
        hits: prepared.hits,
        routing: {
          engine: pl.engine.engine,
          engineVersion: pl.engine.version,
          engineSource: pl.engine.source,
          engineConfidence: pl.engine.confidence,
          genre: pl.genre.genre,
          disciplines: pl.disciplines,
          supportingSkills: pl.supporting.map((x) => x.id),
          excluded: pl.excluded,
          confidence: pl.confidence,
          reasons: pl.reasons,
          clarification: pl.clarification,
        },
      };
    }),
  );
  // Imported-skill review queue. There is deliberately no endpoint that imports or fetches skills in this phase.
  r.get('/knowledge/skill-imports', wrap(() => kn().imports()));
  r.post('/knowledge/skill-imports/:id/approve', wrap((req) => kn().approveImport(String(req.params.id), str(req.body as Body, 'note', { max: 2000 }))));
  r.post('/knowledge/skill-imports/:id/reject', wrap((req) => kn().rejectImport(String(req.params.id), str(req.body as Body, 'note', { max: 2000 }))));
  r.get('/knowledge/sources', wrap(() => kn().sources()));
  r.post(
    '/knowledge/sources',
    wrap(async (req) => {
      const b = req.body as Body;
      const kind = str(b, 'kind', { required: true }) as (typeof SOURCE_KINDS)[number];
      if (!SOURCE_KINDS.includes(kind)) throw new HttpError(400, `kind must be one of ${SOURCE_KINDS.join(', ')}`);
      const trust = (str(b, 'trust') || (kind === 'internal_doc' ? 'internal' : kind === 'example_project' ? 'community' : 'official')) as (typeof TRUST)[number];
      if (!TRUST.includes(trust)) throw new HttpError(400, 'trust must be official, community or internal');
      const files = Array.isArray(b.files)
        ? (b.files as unknown[]).map((f) => {
            const o = f as Body;
            return { path: str(o, 'path', { required: true, max: 300 }), content: typeof o.content === 'string' ? o.content : '' };
          })
        : undefined;
      const pdf = typeof b.pdfBase64 === 'string' ? Uint8Array.from(Buffer.from(b.pdfBase64, 'base64')) : undefined;
      const projectId = str(b, 'projectId') || null;
      if (projectId) store.getProject(projectId);
      return kn().addSource(
        {
          kind,
          name: str(b, 'name', { required: true, max: 120 }),
          url: str(b, 'url', { max: 500 }),
          version: str(b, 'version', { max: 120 }),
          license: str(b, 'license', { max: 200 }),
          trust,
          departments: depts(b.departments),
          includePaths: Array.isArray(b.includePaths) ? b.includePaths.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 200) : [],
          projectId,
          notes: str(b, 'notes', { max: 1000 }),
          engine: str(b, 'engine', { max: 20 }),
          engineVersions: str(b, 'engineVersions', { max: 60 }),
        },
        { files, pdf, ref: str(b, 'ref', { max: 120 }) || undefined },
      );
    }),
  );
  r.patch(
    '/knowledge/sources/:id',
    wrap((req) => {
      const b = req.body as Body;
      const patch: Parameters<NonNullable<Studio['knowledge']>['updateSource']>[1] = {};
      if ('enabled' in b) patch.enabled = Boolean(b.enabled);
      if ('departments' in b) patch.departments = depts(b.departments);
      if ('name' in b) patch.name = str(b, 'name', { required: true, max: 120 });
      if ('license' in b) patch.license = str(b, 'license', { max: 200 });
      if ('trust' in b) {
        const t = str(b, 'trust') as (typeof TRUST)[number];
        if (!TRUST.includes(t)) throw new HttpError(400, 'Invalid trust');
        patch.trust = t;
      }
      return kn().updateSource(String(req.params.id), patch);
    }),
  );
  r.post('/knowledge/sources/:id/refresh', wrap((req) => kn().refreshSource(String(req.params.id))));
  r.delete(
    '/knowledge/sources/:id',
    wrap((req) => {
      kn().deleteSource(String(req.params.id));
    }),
  );
  r.get(
    '/knowledge/sources/:id/docs/:docId',
    wrap((req) => kn().sourceDocument(String(req.params.id), String(req.params.docId))),
  );
  r.get('/projects/:id/knowledge-usage', wrap((req) => kn().usage({ projectId: String(req.params.id) })));
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
