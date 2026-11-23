import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    genre TEXT NOT NULL DEFAULT '',
    brief TEXT NOT NULL DEFAULT '',
    repo_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    director_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    order_idx INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignee TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    priority TEXT NOT NULL DEFAULT 'medium',
    requires_approval INTEGER NOT NULL DEFAULT 0,
    revision_count INTEGER NOT NULL DEFAULT 0,
    feedback TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT '',
    files TEXT NOT NULL DEFAULT '[]',
    error TEXT NOT NULL DEFAULT '',
    cost_usd REAL NOT NULL DEFAULT 0,
    session_id TEXT,
    created_by TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    response TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    agent_id TEXT,
    task_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id, created_at);
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    agent_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id, created_at);
  CREATE TABLE IF NOT EXISTS agent_state (
    agent_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    current_task_id TEXT,
    project_id TEXT,
    activity TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  `,
  // v2 — per-run usage/session tracking and append-only review history.
  // Existing rows are only copied from, never modified, so earlier data is preserved.
  `
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    agent_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    session_id TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    cost_usd REAL,
    cost_status TEXT NOT NULL DEFAULT 'unavailable',
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    cache_creation_tokens INTEGER,
    num_turns INTEGER,
    duration_ms INTEGER,
    model TEXT,
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_runs_project ON agent_runs(project_id, started_at);
  CREATE INDEX IF NOT EXISTS idx_runs_task ON agent_runs(task_id);
  CREATE INDEX IF NOT EXISTS idx_runs_session ON agent_runs(session_id);

  CREATE TABLE IF NOT EXISTS task_reviews (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer TEXT NOT NULL,
    decision TEXT NOT NULL,
    feedback TEXT NOT NULL DEFAULT '',
    revision INTEGER,
    run_id TEXT,
    approval_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_task ON task_reviews(task_id, created_at);

  -- Backfill: a task's pre-v2 cost was one figure covering its run(s) and review(s).
  INSERT OR IGNORE INTO agent_runs (id, project_id, task_id, agent_id, kind, session_id, status, cost_usd, cost_status, started_at, finished_at)
    SELECT 'run_legacy_' || id, project_id, id, assignee, 'legacy', session_id, 'ok',
           CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END,
           CASE WHEN cost_usd > 0 THEN 'legacy_aggregate' ELSE 'unavailable' END,
           COALESCE(started_at, created_at), updated_at
    FROM tasks WHERE cost_usd > 0 OR session_id IS NOT NULL;
  -- Backfill: Director planning sessions were stored on the project without cost.
  INSERT OR IGNORE INTO agent_runs (id, project_id, task_id, agent_id, kind, session_id, status, cost_usd, cost_status, started_at, finished_at)
    SELECT 'run_legacy_dir_' || id, id, NULL, 'director', 'planning', director_session_id, 'ok', NULL, 'unavailable', created_at, updated_at
    FROM projects WHERE director_session_id IS NOT NULL;
  -- Backfill: the single feedback column (may hold a Director note or an owner comment).
  INSERT OR IGNORE INTO task_reviews (id, project_id, task_id, reviewer, decision, feedback, revision, created_at)
    SELECT 'rev_legacy_' || id, project_id, id, 'legacy', 'note', feedback, revision_count, updated_at
    FROM tasks WHERE feedback != '';
  -- Backfill: resolved owner sign-offs.
  INSERT OR IGNORE INTO task_reviews (id, project_id, task_id, reviewer, decision, feedback, approval_id, created_at)
    SELECT 'rev_legacy_' || a.id, a.project_id, a.task_id, 'owner', a.status, a.response, a.id, COALESCE(a.resolved_at, a.created_at)
    FROM approvals a JOIN tasks t ON t.id = a.task_id WHERE a.status != 'pending';
  `,
  // v3 — task dependencies and an audit log of every agent tool call (allowed or denied).
  `
  CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on)
  );
  CREATE INDEX IF NOT EXISTS idx_deps_on ON task_dependencies(depends_on);

  CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT,
    agent_id TEXT NOT NULL,
    tool_use_id TEXT,
    tool TEXT NOT NULL,
    path TEXT,
    detail TEXT NOT NULL DEFAULT '',
    decision TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    outcome TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_toolcalls_project ON tool_calls(project_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_toolcalls_use ON tool_calls(tool_use_id);
  `,
  // v4 — the Agent SDK reports total_cost_usd cumulatively for a resumed session. Keep the raw figure and
  // store each run's own cost as the increase over the session's previous report.
  `
  ALTER TABLE agent_runs ADD COLUMN reported_cost_usd REAL;
  UPDATE agent_runs SET reported_cost_usd = cost_usd WHERE cost_status = 'actual';
  UPDATE agent_runs SET cost_usd = reported_cost_usd - (
      SELECT MAX(p.reported_cost_usd) FROM agent_runs p
      WHERE p.session_id = agent_runs.session_id AND p.cost_status = 'actual'
        AND p.started_at < agent_runs.started_at AND p.id != agent_runs.id)
    WHERE cost_status = 'actual' AND session_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM agent_runs p
        WHERE p.session_id = agent_runs.session_id AND p.cost_status = 'actual'
          AND p.started_at < agent_runs.started_at AND p.id != agent_runs.id
          AND p.reported_cost_usd <= agent_runs.reported_cost_usd);
  -- Task totals are derived from runs; refresh them for tasks that have tracked runs.
  UPDATE tasks SET cost_usd = (SELECT COALESCE(SUM(r.cost_usd), 0) FROM agent_runs r WHERE r.task_id = tasks.id AND r.cost_usd IS NOT NULL)
    WHERE EXISTS (SELECT 1 FROM agent_runs r WHERE r.task_id = tasks.id);
  `,
  // v5 — knowledge system: owner settings, external sources and per-run knowledge usage.
  `
  ALTER TABLE tasks ADD COLUMN skill_id TEXT;
  CREATE TABLE IF NOT EXISTS knowledge_pack_departments (
    pack_id TEXT NOT NULL,
    department TEXT NOT NULL,
    assigned INTEGER NOT NULL,
    PRIMARY KEY (pack_id, department)
  );
  CREATE TABLE IF NOT EXISTS skill_settings (
    skill_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '',
    license TEXT NOT NULL DEFAULT '',
    trust TEXT NOT NULL,
    departments TEXT NOT NULL DEFAULT '[]',
    include_paths TEXT NOT NULL DEFAULT '[]',
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    retrieved_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kdocs_source ON knowledge_documents(source_id);
  CREATE TABLE IF NOT EXISTS knowledge_usage (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
    project_id TEXT,
    task_id TEXT,
    agent_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    title TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL,
    trust TEXT NOT NULL,
    query TEXT NOT NULL DEFAULT '',
    score REAL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kusage_task ON knowledge_usage(task_id);
  CREATE INDEX IF NOT EXISTS idx_kusage_run ON knowledge_usage(run_id);
  `,
  // v6 — Knowledge Router v2: project profile, routing history, imported-skill quarantine, source engine metadata.
  `
  ALTER TABLE projects ADD COLUMN profile TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE knowledge_sources ADD COLUMN engine TEXT NOT NULL DEFAULT '';
  ALTER TABLE knowledge_sources ADD COLUMN engine_versions TEXT NOT NULL DEFAULT '';
  CREATE TABLE IF NOT EXISTS routing_decisions (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
    project_id TEXT,
    task_id TEXT,
    agent_id TEXT NOT NULL,
    engine TEXT,
    engine_version TEXT,
    engine_source TEXT NOT NULL,
    engine_confidence REAL NOT NULL,
    genre TEXT,
    genre_source TEXT NOT NULL,
    disciplines TEXT NOT NULL DEFAULT '[]',
    primary_skill TEXT,
    supporting_skills TEXT NOT NULL DEFAULT '[]',
    refs TEXT NOT NULL DEFAULT '[]',
    excluded TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL,
    reasons TEXT NOT NULL DEFAULT '[]',
    clarification_required INTEGER NOT NULL DEFAULT 0,
    clarification_question TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_routing_task ON routing_decisions(task_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_routing_run ON routing_decisions(run_id);
  CREATE TABLE IF NOT EXISTS skill_imports (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    version TEXT NOT NULL,
    role TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    source_repo TEXT NOT NULL,
    source_commit TEXT NOT NULL DEFAULT '',
    license TEXT NOT NULL DEFAULT '',
    engines TEXT NOT NULL DEFAULT '[]',
    engine_versions TEXT NOT NULL DEFAULT '{}',
    disciplines TEXT NOT NULL DEFAULT '[]',
    genres TEXT NOT NULL DEFAULT '[]',
    engine_dependent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'quarantined',
    lint_findings TEXT NOT NULL DEFAULT '[]',
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT,
    review_note TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_imports_version ON skill_imports(skill_id, version, source_commit);
  `,
];

export type Db = DatabaseSync;

export function openDb(file = config.dbPath): Db {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  while (version < MIGRATIONS.length) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      version++;
      db.prepare('UPDATE schema_version SET version = ?').run(version);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}
