import type { AgentId, KnowledgeSource, KnowledgeUsage, SourceKind } from '@pixel/shared';
import { isAgentId } from '@pixel/shared';
import type { Db } from '../db/db.js';
import { HttpError, newId, nowIso } from '../util.js';

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const sn = (v: unknown) => (v === null || v === undefined ? null : String(v));
const arr = (v: unknown) => {
  try {
    const a = JSON.parse(s(v) || '[]');
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
};

export interface ExternalDoc {
  id: string;
  sourceId: string;
  path: string;
  title: string;
  content: string;
  bytes: number;
}

/** Persistence for owner knowledge settings, external sources and usage records. */
export class KnowledgeStore {
  constructor(private db: Db) {}

  // -- pack ↔ department assignment (rows only exist where the owner changed something or defaults were seeded)
  packAssignments(): Map<string, Map<AgentId, boolean>> {
    const out = new Map<string, Map<AgentId, boolean>>();
    for (const r of this.db.prepare(`SELECT * FROM knowledge_pack_departments`).all() as Row[]) {
      const dept = s(r.department);
      if (!isAgentId(dept)) continue;
      if (!out.has(s(r.pack_id))) out.set(s(r.pack_id), new Map());
      out.get(s(r.pack_id))!.set(dept, Number(r.assigned) === 1);
    }
    return out;
  }
  setPackDepartment(packId: string, dept: AgentId, assigned: boolean) {
    this.db
      .prepare(
        `INSERT INTO knowledge_pack_departments (pack_id, department, assigned) VALUES (?, ?, ?)
         ON CONFLICT(pack_id, department) DO UPDATE SET assigned = excluded.assigned`,
      )
      .run(packId, dept, assigned ? 1 : 0);
  }

  // -- skills on/off (default: enabled)
  skillSettings(): Map<string, boolean> {
    return new Map(
      (this.db.prepare(`SELECT * FROM skill_settings`).all() as Row[]).map((r) => [s(r.skill_id), Number(r.enabled) === 1]),
    );
  }
  setSkillEnabled(skillId: string, enabled: boolean) {
    this.db
      .prepare(`INSERT INTO skill_settings (skill_id, enabled) VALUES (?, ?) ON CONFLICT(skill_id) DO UPDATE SET enabled = excluded.enabled`)
      .run(skillId, enabled ? 1 : 0);
  }

  // -- external sources
  private toSource(r: Row): KnowledgeSource {
    const id = s(r.id);
    return {
      id,
      kind: s(r.kind) as SourceKind,
      name: s(r.name),
      url: s(r.url),
      version: s(r.version),
      license: s(r.license),
      trust: s(r.trust) as KnowledgeSource['trust'],
      departments: arr(r.departments).filter(isAgentId),
      includePaths: arr(r.include_paths),
      projectId: sn(r.project_id),
      enabled: Number(r.enabled) === 1,
      status: s(r.status) as KnowledgeSource['status'],
      error: s(r.error),
      notes: s(r.notes),
      retrievedAt: sn(r.retrieved_at),
      createdAt: s(r.created_at),
      documents: (
        this.db.prepare(`SELECT id, path, title, bytes FROM knowledge_documents WHERE source_id = ? ORDER BY path`).all(id) as Row[]
      ).map((d) => ({ id: s(d.id), path: s(d.path), title: s(d.title), bytes: Number(d.bytes) })),
    };
  }
  listSources(): KnowledgeSource[] {
    return (this.db.prepare(`SELECT * FROM knowledge_sources ORDER BY created_at`).all() as Row[]).map((r) => this.toSource(r));
  }
  getSource(id: string): KnowledgeSource {
    const r = this.db.prepare(`SELECT * FROM knowledge_sources WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Knowledge source ${id} not found`);
    return this.toSource(r);
  }
  createSource(src: Pick<KnowledgeSource, 'kind' | 'name' | 'url' | 'version' | 'license' | 'trust' | 'departments' | 'includePaths' | 'projectId' | 'notes'>) {
    const id = newId('src');
    this.db
      .prepare(
        `INSERT INTO knowledge_sources (id, kind, name, url, version, license, trust, departments, include_paths, project_id, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, src.kind, src.name, src.url, src.version, src.license, src.trust, JSON.stringify(src.departments), JSON.stringify(src.includePaths), src.projectId, src.notes, nowIso());
    return this.getSource(id);
  }
  updateSource(id: string, patch: Partial<Pick<KnowledgeSource, 'name' | 'version' | 'license' | 'trust' | 'departments' | 'enabled' | 'notes' | 'status' | 'error' | 'retrievedAt'>>) {
    const n = { ...this.getSource(id), ...patch };
    this.db
      .prepare(
        `UPDATE knowledge_sources SET name=?, version=?, license=?, trust=?, departments=?, enabled=?, notes=?, status=?, error=?, retrieved_at=? WHERE id=?`,
      )
      .run(n.name, n.version, n.license, n.trust, JSON.stringify(n.departments), n.enabled ? 1 : 0, n.notes, n.status, n.error, n.retrievedAt, id);
    return this.getSource(id);
  }
  deleteSource(id: string) {
    this.db.prepare(`DELETE FROM knowledge_sources WHERE id = ?`).run(id);
  }
  replaceDocuments(sourceId: string, docs: { path: string; title: string; content: string }[]) {
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`DELETE FROM knowledge_documents WHERE source_id = ?`).run(sourceId);
      const ins = this.db.prepare(
        `INSERT INTO knowledge_documents (id, source_id, path, title, content, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const d of docs) ins.run(newId('kdoc'), sourceId, d.path, d.title, d.content, Buffer.byteLength(d.content), nowIso());
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  externalDocs(): ExternalDoc[] {
    return (this.db.prepare(`SELECT * FROM knowledge_documents ORDER BY source_id, path`).all() as Row[]).map((r) => ({
      id: s(r.id),
      sourceId: s(r.source_id),
      path: s(r.path),
      title: s(r.title),
      content: s(r.content),
      bytes: Number(r.bytes),
    }));
  }

  // -- usage
  addUsage(u: Omit<KnowledgeUsage, 'id' | 'createdAt'>) {
    this.db
      .prepare(
        `INSERT INTO knowledge_usage (id, run_id, project_id, task_id, agent_id, mode, ref_id, title, section, origin, trust, query, score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId('ku'), u.runId, u.projectId, u.taskId, u.agentId, u.mode, u.refId, u.title, u.section, u.origin, u.trust, u.query, u.score, nowIso());
  }
  listUsage(f: { taskId?: string; runId?: string; projectId?: string }): KnowledgeUsage[] {
    const where: string[] = [];
    const args: string[] = [];
    if (f.taskId) (where.push('task_id = ?'), args.push(f.taskId));
    if (f.runId) (where.push('run_id = ?'), args.push(f.runId));
    if (f.projectId) (where.push('project_id = ?'), args.push(f.projectId));
    return (
      this.db
        .prepare(`SELECT * FROM knowledge_usage ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, rowid`)
        .all(...args) as Row[]
    ).map((r) => ({
      id: s(r.id),
      runId: sn(r.run_id),
      projectId: sn(r.project_id),
      taskId: sn(r.task_id),
      agentId: s(r.agent_id) as AgentId,
      mode: s(r.mode) as KnowledgeUsage['mode'],
      refId: s(r.ref_id),
      title: s(r.title),
      section: s(r.section),
      origin: s(r.origin) as KnowledgeUsage['origin'],
      trust: s(r.trust) as KnowledgeUsage['trust'],
      query: s(r.query),
      score: r.score === null || r.score === undefined ? null : Number(r.score),
      createdAt: s(r.created_at),
    }));
  }
}
