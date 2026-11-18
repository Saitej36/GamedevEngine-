import { useState } from 'react';
import type { Approval } from '@pixel/shared';
import { AGENTS } from '@pixel/shared';
import { useStudio } from '../state/store';
import { actions } from '../state/controller';
import { Avatar } from './Avatar';
import { Markdown, timeAgo } from './format';

export function ApprovalQueue() {
  const approvals = useStudio((s) => s.approvals);
  const pending = approvals.filter((a) => a.status === 'pending');
  const resolved = approvals.filter((a) => a.status !== 'pending').slice(0, 30);
  return (
    <div className="panel approvals">
      <div className="section-title">Waiting for you ({pending.length})</div>
      {!pending.length && <div className="empty">Nothing needs your decision right now.</div>}
      {pending.map((a) => (
        <PendingApproval key={a.id} approval={a} />
      ))}
      {resolved.length > 0 && <div className="section-title">History</div>}
      {resolved.map((a) => (
        <div key={a.id} className={`card approval resolved ${a.status}`}>
          <div className="approval-head">
            <span className={`pill ${a.status === 'approved' ? 'st-done' : 'st-failed'}`}>{a.status}</span>
            <span className="approval-title">{a.title}</span>
            <span className="grow" />
            <span className="muted small">{a.resolvedAt && timeAgo(a.resolvedAt)}</span>
          </div>
          {a.response && <div className="muted small">“{a.response}”</div>}
        </div>
      ))}
    </div>
  );
}

function PendingApproval({ approval: a }: { approval: Approval }) {
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (d: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await actions.resolveApproval(a.id, d, response.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card approval pending">
      <div className="approval-head">
        <Avatar id={a.requestedBy} size={26} />
        <div>
          <div className="approval-title">{a.title}</div>
          <div className="muted small">
            {AGENTS[a.requestedBy].name} · {timeAgo(a.createdAt)}
          </div>
        </div>
      </div>
      <div className="approval-details">
        <Markdown text={a.details} />
      </div>
      <textarea
        rows={2}
        placeholder="Optional comment (required guidance when rejecting)"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />
      <div className="actions">
        <button className="btn danger" disabled={busy} onClick={() => decide('rejected')}>
          Reject
        </button>
        <span className="grow" />
        <button className="btn primary" disabled={busy} onClick={() => decide('approved')}>
          Approve
        </button>
      </div>
    </div>
  );
}
