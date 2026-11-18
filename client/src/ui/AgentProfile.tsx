import { useEffect, useState } from 'react';
import type { AgentId, Task } from '@pixel/shared';
import { AGENTS, DEPARTMENTS, STATUS_LABEL, TASK_STATUS_LABEL } from '@pixel/shared';
import { api } from '../api/client';
import { useStudio } from '../state/store';
import { Avatar } from './Avatar';
import { STATUS_COLOR, timeAgo } from './format';
import { Timeline } from './Timeline';

export function AgentProfile({ id }: { id: AgentId }) {
  const profile = AGENTS[id];
  const state = useStudio((s) => s.agents[id]);
  const mode = useStudio((s) => s.mode);
  const info = useStudio((s) => s.info);
  const projectTasks = useStudio((s) => s.tasks);
  const [history, setHistory] = useState<Task[] | null>(null);

  useEffect(() => {
    setHistory(null);
    if (mode === 'live') api.agent(id).then((d) => setHistory(d.tasks), () => setHistory(null));
  }, [id, mode, state.status]);

  const tasks = (history ?? projectTasks.filter((t) => t.assignee === id)).slice(0, 25);
  const current = projectTasks.find((t) => t.id === state.currentTaskId) ?? tasks.find((t) => t.id === state.currentTaskId);
  const close = () => useStudio.getState().selectAgent(null);

  return (
    <aside className="profile">
      <div className="profile-head">
        <Avatar id={id} size={56} />
        <div>
          <div className="profile-name">{profile.name}</div>
          <div className="muted">{profile.title}</div>
          <div className="small" style={{ color: DEPARTMENTS[profile.department].color }}>
            {DEPARTMENTS[profile.department].name}
          </div>
        </div>
        <span className="grow" />
        <button className="btn ghost icon" onClick={close} aria-label="Close profile">✕</button>
      </div>

      <div className="card live-status">
        <div className="status-line">
          <span className="dot" style={{ background: STATUS_COLOR[state.status] }} />
          <strong>{STATUS_LABEL[state.status]}</strong>
          {mode === 'demo' && <span className="tag sim">simulated</span>}
          {mode === 'live' && state.status === 'idle' && <span className="tag">roaming</span>}
          <span className="grow" />
          <span className="muted small">{timeAgo(state.updatedAt)}</span>
        </div>
        {state.activity && <div className="activity">{state.activity}</div>}
        {current && (
          <div className="small">
            Current task: <strong>{current.title}</strong>
          </div>
        )}
      </div>

      <p className="bio">{profile.bio}</p>
      <div className="chips">
        {profile.skills.map((s) => (
          <span key={s} className="chip static">{s}</span>
        ))}
      </div>

      <div className="section-title">Permissions</div>
      <div className="perm card">
        <div><span className="muted">Tools:</span> {profile.tools.join(', ')}{profile.canUseBash && info?.bashEnabled ? ', Bash' : ''}</div>
        <div><span className="muted">Can write:</span> {profile.writableDirs.map((d) => <code key={d}>{d}/</code>)}</div>
        <div><span className="muted">Reads:</span> whole project workspace (sandboxed)</div>
        {id === 'director' && <div><span className="muted">Studio tools:</span> create_task, add_milestone, request_approval, review_task, cancel_task</div>}
        {profile.canUseBash && !info?.bashEnabled && <div className="muted small">Shell access available but disabled (ALLOW_AGENT_BASH=false)</div>}
      </div>

      <div className="section-title">Task history</div>
      <div className="history">
        {!tasks.length && <div className="muted small">No tasks yet.</div>}
        {tasks.map((t) => (
          <div key={t.id} className="history-row">
            <span className={`pill st-${t.status}`}>{TASK_STATUS_LABEL[t.status]}</span>
            <span className="history-title">{t.title}</span>
            <span className="muted small">{timeAgo(t.updatedAt)}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Live activity</div>
      <Timeline key={id} agentId={id} compact />
    </aside>
  );
}
