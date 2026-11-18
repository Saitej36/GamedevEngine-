import { useMemo, useState } from 'react';
import type { AgentEventType, AgentId } from '@pixel/shared';
import { AGENTS, AGENT_IDS, EVENT_ANIMATION } from '@pixel/shared';
import { useStudio } from '../state/store';
import { clock } from './format';

const TYPE_LABEL: Record<AgentEventType, string> = {
  task_created: 'created',
  task_assigned: 'assigned',
  task_started: 'started',
  agent_working: 'working',
  file_created: 'file',
  task_completed: 'completed',
  approval_required: 'approval',
  task_failed: 'failed',
  agent_idle: 'idle',
};

export function Timeline({ agentId, compact }: { agentId?: AgentId; compact?: boolean }) {
  const events = useStudio((s) => s.events);
  const [agent, setAgent] = useState<AgentId | 'all'>(agentId ?? 'all');
  const [hideWorking, setHideWorking] = useState(false);
  const list = useMemo(
    () =>
      events
        .filter((e) => (agent === 'all' || e.agentId === agent) && (!hideWorking || e.type !== 'agent_working'))
        .slice()
        .reverse(),
    [events, agent, hideWorking],
  );
  return (
    <div className={`panel timeline ${compact ? 'compact' : ''}`}>
      {!agentId && (
        <div className="toolbar">
          <select value={agent} onChange={(e) => setAgent(e.target.value as AgentId | 'all')}>
            <option value="all">Everyone</option>
            {AGENT_IDS.map((id) => (
              <option key={id} value={id}>
                {AGENTS[id].name}
              </option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={hideWorking} onChange={(e) => setHideWorking(e.target.checked)} /> milestones only
          </label>
        </div>
      )}
      <div className="events">
        {!list.length && <div className="empty">No activity yet.</div>}
        {list.map((e) => (
          <div key={e.id} className={`event ev-${e.type}`}>
            <span className="ev-time">{clock(e.createdAt)}</span>
            <span className="ev-icon">{EVENT_ANIMATION[e.type].bubble || '•'}</span>
            <span className={`ev-type ev-${e.type}`}>{TYPE_LABEL[e.type]}</span>
            <span className="ev-msg">
              {!agentId && e.agentId && <strong>{AGENTS[e.agentId].name.split(' ')[0]}: </strong>}
              {e.type === 'file_created' && typeof e.data.path === 'string' && !e.simulated ? (
                <button className="link" onClick={() => useStudio.getState().set({ tab: 'files', openFile: String(e.data.path) })}>
                  {e.message}
                </button>
              ) : (
                e.message
              )}
              {e.simulated && <span className="tag sim">sim</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
