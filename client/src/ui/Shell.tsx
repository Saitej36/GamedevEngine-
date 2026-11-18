import { useState } from 'react';
import { AGENTS, AGENT_IDS, STATUS_LABEL } from '@pixel/shared';
import { useStudio, type Tab } from '../state/store';
import { actions, retryConnection, selectProject } from '../state/controller';
import { Avatar } from './Avatar';
import { STATUS_COLOR } from './format';

export function TopBar({ onNewProject }: { onNewProject: () => void }) {
  const projects = useStudio((s) => s.projects);
  const projectId = useStudio((s) => s.projectId);
  const mode = useStudio((s) => s.mode);
  const info = useStudio((s) => s.info);
  return (
    <header className="topbar">
      <div className="logo">
        <span className="logo-mark">▣</span> PIXEL STUDIO
      </div>
      <div className="project-picker">
        <select value={projectId ?? ''} onChange={(e) => selectProject(e.target.value || null)} disabled={mode !== 'live'}>
          {!projects.length && <option value="">No projects yet</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={onNewProject} disabled={mode !== 'live'}>
          + New project
        </button>
      </div>
      <span className="grow" />
      {mode === 'live' && info && (
        <span className={`badge ${info.aiMode === 'live' ? 'ok' : 'warn'}`} title={info.aiReason}>
          {info.aiMode === 'live' ? `● AI live · ${info.model}` : '● AI offline'}
        </span>
      )}
      {mode === 'demo' && (
        <button className="badge warn" onClick={() => retryConnection()} title="Backend not reachable — click to retry">
          ● Demo mode (simulated)
        </button>
      )}
      {mode === 'connecting' && <span className="badge">Connecting…</span>}
    </header>
  );
}

export function Roster() {
  const agents = useStudio((s) => s.agents);
  const selected = useStudio((s) => s.selectedAgent);
  const tasks = useStudio((s) => s.tasks);
  return (
    <div className="roster">
      {AGENT_IDS.map((id) => {
        const st = agents[id];
        const queued = tasks.filter((t) => t.assignee === id && ['queued', 'revision'].includes(t.status)).length;
        return (
          <button
            key={id}
            className={`roster-card ${selected === id ? 'selected' : ''} st-${st.status}`}
            onClick={() => useStudio.getState().selectAgent(selected === id ? null : id)}
          >
            <Avatar id={id} size={30} />
            <div className="roster-text">
              <div className="roster-name">
                {AGENTS[id].name.split(' ')[0]} <span className="muted small">{AGENTS[id].title}</span>
              </div>
              <div className="roster-status">
                <span className="dot" style={{ background: STATUS_COLOR[st.status] }} />
                {STATUS_LABEL[st.status]}
                {queued > 0 && <span className="pill">{queued} queued</span>}
              </div>
              <div className="roster-activity">{st.activity || ' '}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Director' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'files', label: 'Files' },
  { id: 'dashboard', label: 'Project' },
  { id: 'timeline', label: 'Activity' },
];

export function Tabs() {
  const tab = useStudio((s) => s.tab);
  const pending = useStudio((s) => s.approvals.filter((a) => a.status === 'pending').length);
  const active = useStudio((s) => s.tasks.filter((t) => t.status === 'in_progress').length);
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => useStudio.getState().set({ tab: t.id })}>
          {t.label}
          {t.id === 'approvals' && pending > 0 && <span className="count warn">{pending}</span>}
          {t.id === 'tasks' && active > 0 && <span className="count">{active}</span>}
        </button>
      ))}
    </nav>
  );
}

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', genre: '', brief: '', repoUrl: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await actions.createProject(form);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-title">New game project</div>
        <label>
          Name
          <input autoFocus required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Star Hopper" />
        </label>
        <label>
          Genre
          <input maxLength={80} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="e.g. Cozy 2D platformer" />
        </label>
        <label>
          Project brief
          <textarea
            rows={6}
            value={form.brief}
            onChange={(e) => setForm({ ...form, brief: e.target.value })}
            placeholder="Pitch, audience, platform, must-have features, references, constraints…"
          />
        </label>
        <label>
          Code repository (optional)
          <input value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} placeholder="https://github.com/you/game" />
        </label>
        {error && <div className="notice error">{error}</div>}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <span className="grow" />
          <button className="btn primary" disabled={busy || !form.name.trim()}>
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}

export function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.tone}`} onClick={() => useStudio.getState().dismissToast(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}
