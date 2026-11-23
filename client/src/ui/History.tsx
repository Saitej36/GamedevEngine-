import { useEffect, useState } from 'react';
import type { AgentRun, KnowledgeUsage, RoutingDecision, TaskReview } from '@pixel/shared';
import { AGENTS } from '@pixel/shared';
import { api } from '../api/client';
import { useStudio } from '../state/store';
import { Markdown, timeAgo } from './format';

const DECISION_LABEL: Record<TaskReview['decision'], string> = {
  approve: 'Director approved',
  revise: 'Director requested revision',
  escalated: 'Escalated to owner',
  approved: 'Owner approved',
  rejected: 'Owner rejected',
  note: 'Note (before review history)',
};

/** Cost of a run as text: actual figures, or say plainly that the SDK reported none. */
export function runCost(r: AgentRun) {
  if (r.status === 'running') return 'running…';
  if (r.costUsd === null) return 'cost unavailable';
  return `$${r.costUsd.toFixed(3)}${r.costStatus === 'legacy_aggregate' ? ' (pre-tracking total)' : ''}`;
}

export const RUN_KIND_LABEL: Record<AgentRun['kind'], string> = {
  planning: 'Director planning',
  task: 'Task run',
  review: 'Director review',
  legacy: 'Run + review (pre-tracking)',
};

/** Review decisions and Agent SDK sessions for one task. */
export function TaskHistory({ taskId, updatedAt }: { taskId: string; updatedAt: string }) {
  const usageVersion = useStudio((s) => s.usageVersion);
  const [data, setData] = useState<{ reviews: TaskReview[]; runs: AgentRun[] } | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeUsage[]>([]);
  const [routing, setRouting] = useState<RoutingDecision[]>([]);
  useEffect(() => {
    api.taskHistory(taskId).then(setData, () => setData(null));
    api.taskKnowledge(taskId).then(setKnowledge, () => setKnowledge([]));
    api.taskRouting(taskId).then(setRouting, () => setRouting([]));
  }, [taskId, updatedAt, usageVersion]);
  if (!data) return null;
  const runKind = new Map(data.runs.map((r) => [r.id, `${RUN_KIND_LABEL[r.kind]} (${AGENTS[r.agentId]?.name.split(' ')[0] ?? r.agentId})`]));
  return (
    <>
      {routing.length > 0 && (
        <details className="history-block">
          <summary>Routing ({routing.length} decision{routing.length === 1 ? '' : 's'})</summary>
          {routing.map((r) => (
            <div key={r.id} className={`routing ${r.clarificationRequired ? 'clarify' : ''}`}>
              <div className="routing-head">
                <strong>{r.runId ? (runKind.get(r.runId) ?? 'Run') : 'Not started'}</strong>
                <span className="pill">confidence {Math.round(r.confidence * 100)}%</span>
                {r.clarificationRequired && <span className="pill st-awaiting_approval">clarification required</span>}
                <span className="grow" />
                <span className="muted small">{timeAgo(r.createdAt)}</span>
              </div>
              <div className="routing-grid small">
                <span className="muted">Engine</span>
                <span>
                  {r.engine ? `${r.engine}${r.engineVersion ? ` ${r.engineVersion}` : ' (version unknown)'}` : 'none'} <span className="muted">· from {r.engineSource} · {Math.round(r.engineConfidence * 100)}%</span>
                </span>
                <span className="muted">Genre</span>
                <span>
                  {r.genre ?? 'none'} <span className="muted">· from {r.genreSource}</span>
                </span>
                <span className="muted">Disciplines</span>
                <span>{r.disciplines.map((d) => d.id).join(', ') || 'none'}</span>
                <span className="muted">Skills</span>
                <span>
                  {r.primarySkill ?? 'none'}
                  {r.supportingSkills.length > 0 && <span className="muted"> + {r.supportingSkills.join(', ')}</span>}
                </span>
                <span className="muted">References</span>
                <span>
                  {r.references.map((x) => `${x.refId} [${x.slot}${x.versionStatus === 'unverified' ? ', version unverified' : ''}]`).join(' · ') || 'none'}
                </span>
                {r.excluded.length > 0 && (
                  <>
                    <span className="muted">Excluded</span>
                    <span>{r.excluded.map((x) => `${x.refId} (${x.reason})`).join(' · ')}</span>
                  </>
                )}
              </div>
              {r.clarificationRequired && <div className="notice warn small">{r.clarificationQuestion}</div>}
              <ul className="routing-reasons small">
                {r.reasons.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
      {knowledge.length > 0 && (
        <details className="history-block">
          <summary>Knowledge used ({new Set(knowledge.map((k) => k.refId)).size} sources)</summary>
          <table className="run-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>How</th>
                <th>Reference</th>
                <th>Trust</th>
              </tr>
            </thead>
            <tbody>
              {knowledge.map((k) => (
                <tr key={k.id}>
                  <td>{(k.runId && runKind.get(k.runId)) ?? '—'}</td>
                  <td>{k.mode === 'auto' ? 'injected' : k.mode === 'skill' ? 'skill' : `agent ${k.mode}`}</td>
                  <td className="task-cell" title={`${k.title} § ${k.section}${k.query ? ` — query: ${k.query}` : ''}`}>
                    <code>{k.refId}</code> {k.section && <span className="muted">§ {k.section}</span>}
                  </td>
                  <td>{k.trust}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {data.reviews.length > 0 && (
        <div className="history-block">
          <div className="section-title">Review history</div>
          {data.reviews.map((r) => (
            <div key={r.id} className={`review rv-${r.decision}`}>
              <div className="review-head">
                <strong>{DECISION_LABEL[r.decision]}</strong>
                {r.revision !== null && <span className="pill">rev {r.revision}</span>}
                <span className="grow" />
                <span className="muted small">{timeAgo(r.createdAt)}</span>
              </div>
              {r.feedback ? <Markdown text={r.feedback} /> : <span className="muted small">No comment</span>}
            </div>
          ))}
        </div>
      )}
      {data.runs.length > 0 && (
        <details className="history-block">
          <summary>Agent sessions ({data.runs.length})</summary>
          <RunTable runs={data.runs} showTask={false} />
        </details>
      )}
    </>
  );
}

export function RunTable({
  runs,
  showTask,
  taskTitle,
}: {
  runs: AgentRun[];
  showTask: boolean;
  taskTitle?: (id: string) => string;
}) {
  return (
    <div className="run-table-wrap">
      <table className="run-table">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Agent</th>
            {showTask && <th>Task</th>}
            <th>Cost</th>
            <th>Session ID</th>
            <th>Tokens in/out</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>{RUN_KIND_LABEL[r.kind]}</td>
              <td>{AGENTS[r.agentId]?.name.split(' ')[0] ?? r.agentId}</td>
              {showTask && (
                <td className="task-cell" title={r.taskId ? (taskTitle?.(r.taskId) ?? r.taskId) : ''}>
                  {r.taskId ? (taskTitle?.(r.taskId) ?? r.taskId) : '—'}
                </td>
              )}
              <td className={r.costUsd === null ? 'muted' : ''}>{runCost(r)}</td>
              <td>
                <code title={r.sessionId ?? ''}>{r.sessionId ? r.sessionId.slice(0, 8) : '—'}</code>
              </td>
              <td className="num">
                {r.inputTokens === null ? '—' : `${r.inputTokens.toLocaleString()} / ${(r.outputTokens ?? 0).toLocaleString()}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
