import { useEffect, useState } from 'react';
import type { AgentRun, Milestone, ProjectProfile, UsageSummary } from '@pixel/shared';
import { ProfileFields, profileSummary } from './ProfileFields';
import { api } from '../api/client';
import { RunTable } from './History';
import { AGENTS, WORKER_IDS } from '@pixel/shared';
import { currentProject, useStudio } from '../state/store';
import { actions } from '../state/controller';
import { Avatar } from './Avatar';

export function Dashboard() {
  const project = useStudio(currentProject);
  const tasks = useStudio((s) => s.tasks);
  const stats = useStudio((s) => s.stats);
  const milestones = useStudio((s) => s.milestones);
  const approvals = useStudio((s) => s.approvals);
  const mode = useStudio((s) => s.mode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ name: string; genre: string; brief: string; repoUrl: string; profile: ProjectProfile }>({ name: '', genre: '', brief: '', repoUrl: '', profile: {} });
  const [msTitle, setMsTitle] = useState('');
  const [msDue, setMsDue] = useState('');

  useEffect(() => {
    if (project) setDraft({ name: project.name, genre: project.genre, brief: project.brief, repoUrl: project.repoUrl, profile: project.profile ?? {} });
  }, [project]);

  if (!project) return <div className="panel"><div className="empty">No project selected.</div></div>;

  const live = tasks.filter((t) => t.status !== 'cancelled');
  const done = live.filter((t) => t.status === 'done').length;
  const progress = live.length ? done / live.length : 0;
  const active = live.filter((t) => ['in_progress', 'in_review', 'revision'].includes(t.status)).length;
  const pending = approvals.filter((a) => a.status === 'pending').length;
  // Live: every Agent SDK run (planning, tasks, reviews). Demo: no real spend.
  const cost = stats?.usage.knownCostUsd ?? tasks.reduce((n, t) => n + t.costUsd, 0);
  const open = (path: string) => useStudio.getState().set({ tab: 'files', openFile: path });

  return (
    <div className="panel dashboard">
      <div className="card">
        {editing ? (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              await actions.updateProject(project.id, draft);
              setEditing(false);
            }}
          >
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" required />
            <input value={draft.genre} onChange={(e) => setDraft({ ...draft, genre: e.target.value })} placeholder="Genre" />
            <textarea rows={5} value={draft.brief} onChange={(e) => setDraft({ ...draft, brief: e.target.value })} placeholder="Project brief" />
            <input value={draft.repoUrl} onChange={(e) => setDraft({ ...draft, repoUrl: e.target.value })} placeholder="Code repository URL" />
            <ProfileFields value={draft.profile} onChange={(profile) => setDraft({ ...draft, profile })} />
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
              <span className="grow" />
              <button className="btn primary">Save</button>
            </div>
          </form>
        ) : (
          <>
            <div className="dash-head">
              <div>
                <div className="dash-title">{project.name}</div>
                <div className="muted">{project.genre || 'Genre TBD'}</div>
                <div className="small profile-line">
                  {profileSummary(project.profile) || <span className="muted">No project profile yet: set the engine and genre so agents get the right knowledge.</span>}
                </div>
              </div>
              <span className="grow" />
              {mode === 'live' && <button className="btn ghost" onClick={() => setEditing(true)}>Edit</button>}
            </div>
            <p className="brief">{project.brief || <span className="muted">No brief yet.</span>}</p>
            <div className="links">
              <button className="link" onClick={() => open('docs/BRIEF.md')}>📄 Brief</button>
              <button className="link" onClick={() => open('docs/GDD.md')}>📘 GDD</button>
              <button className="link" onClick={() => useStudio.getState().set({ tab: 'files' })}>🎨 Assets directory</button>
              {project.repoUrl ? (
                <a className="link" href={project.repoUrl} target="_blank" rel="noreferrer noopener">🔗 {project.repoUrl}</a>
              ) : (
                <span className="muted small">No code repository linked</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="progress-row">
          <span>Overall progress</span>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>
        <div className="tiles">
          <Tile label="Tasks done" value={`${done}/${live.length}`} />
          <Tile label="Active" value={active} />
          <Tile label="Approvals" value={pending} tone={pending ? 'warn' : undefined} />
          <Tile label="Files" value={stats?.fileCount ?? '—'} />
          <Tile label="AI spend" value={`$${cost.toFixed(2)}`} />
        </div>
      </div>

      {mode === 'live' && <UsageCard projectId={project.id} />}

      <div className="card">
        <div className="section-title">Milestones</div>
        {!milestones.length && <div className="muted small">No milestones yet — add one or ask the Director to plan them.</div>}
        {milestones.map((m) => <MilestoneRow key={m.id} m={m} />)}
        {mode === 'live' && (
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!msTitle.trim()) return;
              await actions.addMilestone(msTitle.trim(), msDue);
              setMsTitle('');
              setMsDue('');
            }}
          >
            <input placeholder="New milestone" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
            <input type="date" value={msDue} onChange={(e) => setMsDue(e.target.value)} />
            <button className="btn">Add</button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="section-title">Team throughput</div>
        {WORKER_IDS.map((id) => {
          const mine = live.filter((t) => t.assignee === id);
          const d = mine.filter((t) => t.status === 'done').length;
          return (
            <div key={id} className="team-row">
              <Avatar id={id} size={22} />
              <span className="team-name">{AGENTS[id].name}</span>
              <div className="progress small"><div style={{ width: `${mine.length ? (d / mine.length) * 100 : 0}%` }} /></div>
              <span className="muted small">{d}/{mine.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MilestoneRow({ m }: { m: Milestone }) {
  const allTasks = useStudio((s) => s.tasks);
  const tasks = allTasks.filter((t) => t.milestoneId === m.id && t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'done').length;
  const next = m.status === 'planned' ? 'active' : m.status === 'active' ? 'done' : 'planned';
  return (
    <div className="milestone">
      <button className={`pill ms-${m.status}`} title="Click to change status" onClick={() => actions.setMilestoneStatus(m.id, next)}>
        {m.status}
      </button>
      <span className="ms-title">{m.title}</span>
      {m.dueDate && <span className="muted small">due {m.dueDate}</span>}
      <span className="grow" />
      <div className="progress small"><div style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></div>
      <span className="muted small">{done}/{tasks.length}</span>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' }) {
  return (
    <div className={`tile ${tone ?? ''}`}>
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

function UsageCard({ projectId }: { projectId: string }) {
  const usageVersion = useStudio((s) => s.usageVersion);
  const tasks = useStudio((s) => s.tasks);
  const [data, setData] = useState<{ summary: UsageSummary; runs: AgentRun[] } | null>(null);
  useEffect(() => {
    api.usage(projectId).then(setData, () => setData(null));
  }, [projectId, usageVersion]);
  if (!data) return null;
  const u = data.summary;
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? id;
  const rows: [string, number][] = [
    ['Director planning', u.byKind.planning],
    ['Specialist tasks', u.byKind.task],
    ['Director reviews', u.byKind.review],
  ];
  if (u.byStatus.legacy_aggregate.runs) rows.push(['Before per-run tracking', u.byKind.legacy]);
  return (
    <div className="card">
      <div className="section-title">AI usage</div>
      <div className="usage-rows">
        {rows.map(([label, v]) => (
          <div key={label} className="usage-row">
            <span>{label}</span>
            <span className="num">${v.toFixed(3)}</span>
          </div>
        ))}
        <div className="usage-row total">
          <span>Known total</span>
          <span className="num">${u.knownCostUsd.toFixed(3)}</span>
        </div>
      </div>
      <div className="muted small usage-notes">
        {u.byStatus.actual.runs} run{u.byStatus.actual.runs === 1 ? '' : 's'} with actual SDK cost
        {u.byStatus.legacy_aggregate.runs > 0 && ` · ${u.byStatus.legacy_aggregate.runs} pre-tracking total(s), not split by run`}
        {u.byStatus.unavailable.runs > 0 && ` · ${u.byStatus.unavailable.runs} run(s) with cost unavailable (not included)`}
        {u.runningRuns > 0 && ` · ${u.runningRuns} running`}
        {' · '}
        {u.tokens.input.toLocaleString()} in / {u.tokens.output.toLocaleString()} out tokens
        {u.tokens.cacheRead > 0 && ` · ${u.tokens.cacheRead.toLocaleString()} cache reads`}
      </div>
      {data.runs.length > 0 && (
        <details>
          <summary>Agent sessions ({data.runs.length})</summary>
          <RunTable runs={data.runs} showTask taskTitle={title} />
        </details>
      )}
    </div>
  );
}
