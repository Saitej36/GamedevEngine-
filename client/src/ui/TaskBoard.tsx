import { useEffect, useMemo, useState } from 'react';
import type { AgentId, Skill, Task, TaskPriority, TaskStatus } from '@pixel/shared';
import { AGENTS, TASK_STATUS_LABEL, WORKER_IDS } from '@pixel/shared';
import { useStudio } from '../state/store';
import { actions } from '../state/controller';
import { Avatar } from './Avatar';
import { Markdown, timeAgo } from './format';
import { TaskHistory } from './History';
import { api } from '../api/client';

const COLUMNS: { title: string; statuses: TaskStatus[] }[] = [
  { title: 'Queued', statuses: ['needs_clarification', 'queued', 'revision'] },
  { title: 'In progress', statuses: ['in_progress'] },
  { title: 'Review', statuses: ['in_review', 'awaiting_approval'] },
  { title: 'Done', statuses: ['done'] },
  { title: 'Failed', statuses: ['failed', 'cancelled'] },
];

const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function TaskBoard() {
  const tasks = useStudio((s) => s.tasks);
  const [filter, setFilter] = useState<AgentId | 'all'>('all');
  const [showNew, setShowNew] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      tasks
        .filter((t) => filter === 'all' || t.assignee === filter)
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt)),
    [tasks, filter],
  );

  return (
    <div className="panel tasks">
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as AgentId | 'all')}>
          <option value="all">All agents</option>
          {WORKER_IDS.map((id) => (
            <option key={id} value={id}>
              {AGENTS[id].name} — {AGENTS[id].title}
            </option>
          ))}
        </select>
        <span className="grow" />
        <button className="btn primary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Close' : '+ New task'}
        </button>
      </div>
      {showNew && <NewTaskForm onDone={() => setShowNew(false)} />}
      <div className="board">
        {COLUMNS.map((col) => {
          const items = visible.filter((t) => col.statuses.includes(t.status));
          return (
            <div key={col.title} className="column">
              <div className="column-head">
                {col.title} <span className="count">{items.length}</span>
              </div>
              {items.map((t) => (
                <TaskCard key={t.id} task={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
              ))}
              {!items.length && <div className="column-empty">—</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task: t, open, onToggle }: { task: Task; open: boolean; onToggle: () => void }) {
  const mode = useStudio((s) => s.mode);
  const aiLive = useStudio((s) => s.info?.aiMode === 'live');
  const projectId = useStudio((s) => s.projectId);
  const allTasks = useStudio((s) => s.tasks);
  const prereqs = t.dependsOn.map((id) => allTasks.find((x) => x.id === id)).filter((x): x is Task => !!x);
  const waitingOn = prereqs.filter((p) => p.status !== 'done');
  const events = useStudio((s) => s.events);
  // STARTING until the backend reports that the real Agent SDK session for this attempt has started.
  const mine = events.filter((e) => e.taskId === t.id && !e.simulated);
  const lastStart = mine.filter((e) => e.type === 'task_started').at(-1)?.createdAt ?? t.startedAt ?? '';
  const sessionUp = mine.some((e) => e.createdAt >= lastStart && e.data?.sessionStarted === true);
  const label = t.status === 'in_progress' && !sessionUp ? 'STARTING' : TASK_STATUS_LABEL[t.status];
  const fileEvents = mine.filter((e) => e.type === 'file_created' && typeof e.data.path === 'string');
  const created = new Set(fileEvents.filter((e) => /^Created /.test(e.message)).map((e) => String(e.data.path)));
  const modified = new Set(fileEvents.filter((e) => /^Updated /.test(e.message)).map((e) => String(e.data.path)).filter((f) => !created.has(f)));
  const end = t.completedAt ? Date.parse(t.completedAt) : ['in_progress', 'in_review'].includes(t.status) ? Date.now() : Date.parse(t.updatedAt);
  const duration = t.startedAt ? Math.max(0, Math.round((end - Date.parse(t.startedAt)) / 1000)) : null;
  return (
    <div className={`card task-card prio-${t.priority} st-${t.status}`}>
      <button className="task-head" onClick={onToggle}>
        <Avatar id={t.assignee} size={22} />
        <span className="task-title">{t.title}</span>
      </button>
      <div className="task-meta">
        <span className={`pill st-${t.status}`}>{label}</span>
        {t.revisionCount > 0 && <span className="pill">rev {t.revisionCount}</span>}
        {t.requiresApproval && <span className="pill">sign-off</span>}
        {t.skillId && <span className="pill" title="Studio skill assigned to this task">skill: {t.skillId}</span>}
        {waitingOn.length > 0 && ['queued', 'revision'].includes(t.status) && (
          <span className="pill st-awaiting_approval" title={waitingOn.map((p) => p.title).join(', ')}>
            waiting on {waitingOn.length}
          </span>
        )}
        <span className="muted">{t.priority}</span>
        <span className="grow" />
        <span className="muted">{timeAgo(t.updatedAt)}</span>
      </div>
      {open && (
        <div className="task-detail">
          <div className="muted small">
            {AGENTS[t.assignee].name} · created by {t.createdBy === 'user' ? 'you' : AGENTS[t.createdBy].name}
            {t.costUsd > 0 && ` · $${t.costUsd.toFixed(3)} (actual SDK cost)`}
            {duration !== null && ` · ${duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`} since start`}
          </div>
          {t.files.length > 0 && (
            <div className="small">
              <span className="muted">Output files (verified on disk): </span>
              {t.files.map((f, i) => (
                <span key={f}>
                  {i > 0 && ', '}
                  <button className="link" onClick={() => useStudio.getState().set({ tab: 'files', openFile: f })}>
                    {f}
                  </button>
                  {created.has(f) ? <span className="muted"> (created)</span> : modified.has(f) ? <span className="muted"> (modified)</span> : null}
                </span>
              ))}
            </div>
          )}
          <Markdown text={t.description} />
          {prereqs.length > 0 && (
            <div className="small">
              <span className="muted">Depends on: </span>
              {prereqs.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  {p.title} <span className={`pill st-${p.status}`}>{TASK_STATUS_LABEL[p.status]}</span>
                </span>
              ))}
            </div>
          )}
          {t.feedback && t.revisionCount > 0 && ['revision', 'in_progress'].includes(t.status) && (
            <div className="notice">
              <strong>Revision requested:</strong> <Markdown text={t.feedback} />
            </div>
          )}
          {mode === 'live' && <TaskHistory taskId={t.id} updatedAt={t.updatedAt} />}
          {t.status === 'needs_clarification' ? (
            <div className="notice warn">
              <strong>Waiting for your answer:</strong> {t.error}{' '}
              <button className="link" onClick={() => useStudio.getState().set({ tab: 'dashboard' })}>
                Open the project profile
              </button>
            </div>
          ) : (
            t.error && <div className="notice error">{t.error}</div>
          )}
          {t.result && (
            <details>
              <summary>Agent report</summary>
              <Markdown text={t.result} />
            </details>
          )}
          {t.files.length > 0 && (
            <div className="files-list">
              {t.files.map((f) =>
                mode === 'live' && projectId ? (
                  <button
                    key={f}
                    className="link"
                    onClick={() => useStudio.getState().set({ tab: 'files', openFile: f })}
                  >
                    📄 {f}
                  </button>
                ) : (
                  <span key={f}>📄 {f}</span>
                ),
              )}
            </div>
          )}
          <div className="actions">
            {(t.status === 'queued' || t.status === 'revision') && mode === 'live' && aiLive && (
              <button className="btn" onClick={() => actions.taskAction(t.id, 'start')}>
                ▶ Run now
              </button>
            )}
            {(t.status === 'failed' || t.status === 'cancelled') && (
              <button className="btn" onClick={() => actions.taskAction(t.id, 'retry')}>
                ↻ Retry
              </button>
            )}
            {!['done', 'cancelled', 'failed'].includes(t.status) && (
              <button className="btn" onClick={() => actions.taskAction(t.id, 'cancel')}>
                ✕ Cancel
              </button>
            )}
            {(t.status === 'queued' || t.status === 'failed') && (
              <select value={t.assignee} onChange={(e) => actions.reassign(t.id, e.target.value as AgentId)}>
                {WORKER_IDS.map((id) => (
                  <option key={id} value={id}>
                    → {AGENTS[id].name}
                  </option>
                ))}
              </select>
            )}
            <span className="grow" />
            {mode === 'live' && (
              <button
                className="btn danger ghost"
                onClick={() => confirm(`Delete task "${t.title}"?`) && actions.taskAction(t.id, 'delete')}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewTaskForm({ onDone }: { onDone: () => void }) {
  const milestones = useStudio((s) => s.milestones);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<AgentId>('designer');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [milestoneId, setMilestoneId] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [skillId, setSkillId] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const mode = useStudio((s) => s.mode);
  useEffect(() => {
    if (mode === 'live') api.knowledge().then((k) => setSkills(k.skills), () => setSkills([]));
  }, [mode]);
  const roleSkills = skills.filter((s) => s.role === assignee && s.enabled);
  return (
    <form
      className="card form"
      onSubmit={async (e) => {
        e.preventDefault();
        await actions.createTask({ title, description, assignee, priority, milestoneId: milestoneId || null, requiresApproval, skillId: skillId || null });
        onDone();
      }}
    >
      <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      <textarea
        placeholder="What should be produced? Include acceptance criteria and files to read/write."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
      />
      <div className="row">
        <label>
          Assignee
          <select
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value as AgentId);
              setSkillId('');
            }}
          >
            {WORKER_IDS.map((id) => (
              <option key={id} value={id}>
                {AGENTS[id].name} — {AGENTS[id].title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Skill
          <select value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            <option value="">Choose automatically</option>
            {roleSkills.map((s) => (
              <option key={s.id} value={s.id} title={s.summary}>
                {s.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Milestone
          <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
            <option value="">—</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} /> I must
        sign off the deliverable
      </label>
      <div className="actions">
        <span className="grow" />
        <button className="btn primary" disabled={!title.trim() || !description.trim()}>
          Create task
        </button>
      </div>
    </form>
  );
}
