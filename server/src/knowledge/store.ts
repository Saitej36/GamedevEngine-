import type { AgentId, CitationCheck, ImportedSkill, KnowledgeSource, KnowledgeUsage, RoutingDecision, SourceKind } from '@pixel/shared';
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
      engine: s(r.engine),
      engineVersions: s(r.engine_versions),
      reviewStatus: (s(r.review_status) || 'approved') as KnowledgeSource['reviewStatus'],
      bundleId: s(r.bundle_id),
      bundleItem: s(r.bundle_item),
      contentHash: s(r.content_hash),
      lintFindings: (() => {
        try {
          return JSON.parse(s(r.lint_findings) || '[]');
        } catch {
          return [];
        }
      })(),
      reviewedAt: sn(r.reviewed_at),
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
  createSource(
    src: Pick<KnowledgeSource, 'kind' | 'name' | 'url' | 'version' | 'license' | 'trust' | 'departments' | 'includePaths' | 'projectId' | 'notes'> &
      Partial<Pick<KnowledgeSource, 'engine' | 'engineVersions'>>,
  ) {
    const id = newId('src');
    this.db
      .prepare(
        `INSERT INTO knowledge_sources (id, kind, name, url, version, license, trust, departments, include_paths, project_id, notes, engine, engine_versions, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, src.kind, src.name, src.url, src.version, src.license, src.trust, JSON.stringify(src.departments), JSON.stringify(src.includePaths), src.projectId, src.notes, src.engine ?? '', src.engineVersions ?? '', nowIso());
    return this.getSource(id);
  }
  /** Bundle-imported source: always created/updated in quarantine (pending_review). */
  findBundleSource(bundleId: string, item: string): KnowledgeSource | null {
    const r = this.db.prepare(`SELECT * FROM knowledge_sources WHERE bundle_id = ? AND bundle_item = ?`).get(bundleId, item) as Row | undefined;
    return r ? this.toSource(r) : null;
  }
  upsertBundleSource(
    src: Pick<KnowledgeSource, 'name' | 'url' | 'version' | 'license' | 'departments' | 'includePaths' | 'notes' | 'engine' | 'engineVersions' | 'bundleId' | 'bundleItem' | 'contentHash' | 'lintFindings'>,
  ): { source: KnowledgeSource; changed: boolean } {
    const existing = this.findBundleSource(src.bundleId, src.bundleItem);
    if (existing && existing.contentHash === src.contentHash) return { source: existing, changed: false };
    const id = existing?.id ?? newId('src');
    if (existing) {
      // Content changed upstream (or locally): back to quarantine; the previous approval no longer applies.
      this.db
        .prepare(
          `UPDATE knowledge_sources SET name=?, url=?, version=?, license=?, departments=?, include_paths=?, notes=?, engine=?, engine_versions=?,
             content_hash=?, lint_findings=?, review_status='pending_review', reviewed_at=NULL, status='ready', error='', retrieved_at=? WHERE id=?`,
        )
        .run(src.name, src.url, src.version, src.license, JSON.stringify(src.departments), JSON.stringify(src.includePaths), src.notes, src.engine, src.engineVersions,
          src.contentHash, JSON.stringify(src.lintFindings), nowIso(), id);
    } else {
      this.db
        .prepare(
          `INSERT INTO knowledge_sources (id, kind, name, url, version, license, trust, departments, include_paths, project_id, notes, engine, engine_versions,
             status, retrieved_at, review_status, bundle_id, bundle_item, content_hash, lint_findings, created_at)
           VALUES (?, 'repo_import', ?, ?, ?, ?, 'community', ?, ?, NULL, ?, ?, ?, 'ready', ?, 'pending_review', ?, ?, ?, ?, ?)`,
        )
        .run(id, src.name, src.url, src.version, src.license, JSON.stringify(src.departments), JSON.stringify(src.includePaths), src.notes, src.engine, src.engineVersions,
          nowIso(), src.bundleId, src.bundleItem, src.contentHash, JSON.stringify(src.lintFindings), nowIso());
    }
    return { source: this.getSource(id), changed: true };
  }
  setSourceReview(id: string, status: KnowledgeSource['reviewStatus'], note?: string) {
    const cur = this.getSource(id);
    const notes = note ? `${cur.notes}${cur.notes ? '\n' : ''}Review (${status}): ${note}` : cur.notes;
    this.db.prepare(`UPDATE knowledge_sources SET review_status = ?, reviewed_at = ?, notes = ? WHERE id = ?`).run(status, nowIso(), notes, id);
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
  replaceDocuments(sourceId: string, docs: { id?: string; path: string; title: string; content: string }[]) {
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`DELETE FROM knowledge_documents WHERE source_id = ?`).run(sourceId);
      const ins = this.db.prepare(
        `INSERT INTO knowledge_documents (id, source_id, path, title, content, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const d of docs) ins.run(d.id ?? newId('kdoc'), sourceId, d.path, d.title, d.content, Buffer.byteLength(d.content), nowIso());
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

  // -- routing history
  addRouting(d: Omit<RoutingDecision, 'id' | 'createdAt'>): RoutingDecision {
    const id = newId('route');
    this.db
      .prepare(
        `INSERT INTO routing_decisions (id, run_id, project_id, task_id, agent_id, engine, engine_version, engine_source, engine_confidence,
           genre, genre_source, disciplines, primary_skill, supporting_skills, refs, excluded, confidence, reasons,
           clarification_required, clarification_question, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, d.runId, d.projectId, d.taskId, d.agentId, d.engine, d.engineVersion, d.engineSource, d.engineConfidence,
        d.genre, d.genreSource, JSON.stringify(d.disciplines), d.primarySkill, JSON.stringify(d.supportingSkills),
        JSON.stringify(d.references), JSON.stringify(d.excluded), d.confidence, JSON.stringify(d.reasons),
        d.clarificationRequired ? 1 : 0, d.clarificationQuestion, nowIso(),
      );
    return this.listRouting({ id })[0];
  }
  listRouting(f: { id?: string; taskId?: string; runId?: string; projectId?: string }): RoutingDecision[] {
    const where: string[] = [];
    const args: string[] = [];
    if (f.id) (where.push('id = ?'), args.push(f.id));
    if (f.taskId) (where.push('task_id = ?'), args.push(f.taskId));
    if (f.runId) (where.push('run_id = ?'), args.push(f.runId));
    if (f.projectId) (where.push('project_id = ?'), args.push(f.projectId));
    const j = (v: unknown, d: unknown) => {
      try {
        return JSON.parse(s(v)) ?? d;
      } catch {
        return d;
      }
    };
    return (
      this.db
        .prepare(`SELECT * FROM routing_decisions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, rowid`)
        .all(...args) as Row[]
    ).map((r) => ({
      id: s(r.id),
      runId: sn(r.run_id),
      projectId: sn(r.project_id),
      taskId: sn(r.task_id),
      agentId: s(r.agent_id) as AgentId,
      engine: sn(r.engine),
      engineVersion: sn(r.engine_version),
      engineSource: s(r.engine_source) as RoutingDecision['engineSource'],
      engineConfidence: Number(r.engine_confidence),
      genre: sn(r.genre),
      genreSource: s(r.genre_source) as RoutingDecision['genreSource'],
      disciplines: j(r.disciplines, []),
      primarySkill: sn(r.primary_skill),
      supportingSkills: j(r.supporting_skills, []),
      references: j(r.refs, []),
      excluded: j(r.excluded, []),
      confidence: Number(r.confidence),
      reasons: j(r.reasons, []),
      clarificationRequired: Number(r.clarification_required) === 1,
      clarificationQuestion: s(r.clarification_question),
      createdAt: s(r.created_at),
    }));
  }

  // -- imported skills (quarantine → owner review)
  private toImport(r: Row): ImportedSkill {
    const j = (v: unknown, d: unknown) => {
      try {
        return JSON.parse(s(v)) ?? d;
      } catch {
        return d;
      }
    };
    return {
      id: s(r.id),
      skillId: s(r.skill_id),
      role: s(r.role) as AgentId,
      title: s(r.title),
      summary: s(r.summary),
      body: s(r.body),
      version: s(r.version),
      sourceRepo: s(r.source_repo),
      sourceCommit: s(r.source_commit),
      license: s(r.license),
      engines: j(r.engines, []),
      engineVersions: j(r.engine_versions, {}),
      disciplines: j(r.disciplines, []),
      genres: j(r.genres, []),
      engineDependent: Number(r.engine_dependent) === 1,
      kind: (s(r.kind) || 'skill') as ImportedSkill['kind'],
      targetSkillId: s(r.target_skill_id),
      bundleId: s(r.bundle_id),
      approval: s(r.status) as ImportedSkill['approval'],
      origin: 'imported',
      lintFindings: j(r.lint_findings, []),
      submittedAt: s(r.submitted_at),
      reviewedAt: sn(r.reviewed_at),
      reviewNote: s(r.review_note),
    };
  }
  addImport(
    i: Omit<ImportedSkill, 'id' | 'approval' | 'origin' | 'submittedAt' | 'reviewedAt' | 'reviewNote' | 'kind' | 'targetSkillId' | 'bundleId'> &
      Partial<Pick<ImportedSkill, 'kind' | 'targetSkillId' | 'bundleId'>>,
  ): ImportedSkill {
    const id = newId('simp');
    this.db
      .prepare(
        `INSERT INTO skill_imports (id, skill_id, version, role, title, summary, body, source_repo, source_commit, license, engines,
           engine_versions, disciplines, genres, engine_dependent, status, lint_findings, submitted_at, kind, target_skill_id, bundle_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', ?, ?, ?, ?, ?)`,
      )
      .run(
        id, i.skillId, i.version, i.role, i.title, i.summary, i.body, i.sourceRepo, i.sourceCommit, i.license,
        JSON.stringify(i.engines), JSON.stringify(i.engineVersions), JSON.stringify(i.disciplines), JSON.stringify(i.genres),
        i.engineDependent ? 1 : 0, JSON.stringify(i.lintFindings), nowIso(), i.kind ?? 'skill', i.targetSkillId ?? '', i.bundleId ?? '',
      );
    return this.getImport(id);
  }
  getImport(id: string): ImportedSkill {
    const r = this.db.prepare(`SELECT * FROM skill_imports WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new HttpError(404, `Imported skill ${id} not found`);
    return this.toImport(r);
  }
  listImports(status?: ImportedSkill['approval']): ImportedSkill[] {
    return (
      (status
        ? this.db.prepare(`SELECT * FROM skill_imports WHERE status = ? ORDER BY submitted_at`).all(status)
        : this.db.prepare(`SELECT * FROM skill_imports ORDER BY submitted_at`).all()) as Row[]
    ).map((r) => this.toImport(r));
  }
  setImportStatus(id: string, status: ImportedSkill['approval'], note: string) {
    this.db.prepare(`UPDATE skill_imports SET status = ?, review_note = ?, reviewed_at = ? WHERE id = ?`).run(status, note, nowIso(), id);
    return this.getImport(id);
  }

  findBundleImport(bundleId: string, skillId: string): ImportedSkill | null {
    const r = this.db.prepare(`SELECT * FROM skill_imports WHERE bundle_id = ? AND skill_id = ? ORDER BY submitted_at DESC LIMIT 1`).get(bundleId, skillId) as Row | undefined;
    return r ? this.toImport(r) : null;
  }

  // -- citation checks
  addCitationCheck(c: Omit<CitationCheck, 'id' | 'createdAt'>): CitationCheck {
    const id = newId('cite');
    this.db
      .prepare(
        `INSERT INTO citation_checks (id, run_id, project_id, task_id, agent_id, status, cited, invalid, uncited, files_checked, summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, c.runId, c.projectId, c.taskId, c.agentId, c.status, JSON.stringify(c.cited), JSON.stringify(c.invalid), JSON.stringify(c.uncited),
        JSON.stringify(c.filesChecked), c.summary, nowIso());
    return this.listCitationChecks({ id })[0];
  }
  listCitationChecks(f: { id?: string; taskId?: string; runId?: string; projectId?: string }): CitationCheck[] {
    const where: string[] = [];
    const args: string[] = [];
    if (f.id) (where.push('id = ?'), args.push(f.id));
    if (f.taskId) (where.push('task_id = ?'), args.push(f.taskId));
    if (f.runId) (where.push('run_id = ?'), args.push(f.runId));
    if (f.projectId) (where.push('project_id = ?'), args.push(f.projectId));
    const j = (v: unknown) => {
      try {
        return JSON.parse(s(v) || '[]');
      } catch {
        return [];
      }
    };
    return (
      this.db.prepare(`SELECT * FROM citation_checks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, rowid`).all(...args) as Row[]
    ).map((r) => ({
      id: s(r.id),
      runId: sn(r.run_id),
      projectId: sn(r.project_id),
      taskId: sn(r.task_id),
      agentId: s(r.agent_id) as AgentId,
      status: s(r.status) as CitationCheck['status'],
      cited: j(r.cited),
      invalid: j(r.invalid),
      uncited: j(r.uncited),
      filesChecked: j(r.files_checked),
      summary: s(r.summary),
      createdAt: s(r.created_at),
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
