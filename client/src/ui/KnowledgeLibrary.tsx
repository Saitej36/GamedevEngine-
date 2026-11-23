import { useEffect, useMemo, useState } from 'react';
import type { AgentId, ImportedSkill, KnowledgeHit, KnowledgePack, KnowledgeSource, Skill, SourceKind } from '@pixel/shared';
import { AGENTS, AGENT_IDS } from '@pixel/shared';
import { api, type RoutingPreview } from '../api/client';
import { useStudio } from '../state/store';
import { Avatar } from './Avatar';
import { MarkdownDoc } from './MarkdownDoc';
import { timeAgo } from './format';

type View = 'departments' | 'skills' | 'packs' | 'sources' | 'retrieval';
type Data = { packs: KnowledgePack[]; skills: Skill[]; sources: KnowledgeSource[]; errors: string[] };

const TRUST_LABEL: Record<string, string> = {
  internal: 'Studio-authored',
  official: 'Official docs',
  community: 'Community',
  project: 'Project file',
};

/**
 * Owner-facing view of the exact registry the agents use: every skill and pack listed here is what the
 * orchestrator loads, and toggles here change what agents receive on their next run.
 */
export function KnowledgeLibrary({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('departments');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<{ title: string; body: string; meta?: string } | null>(null);
  const toast = useStudio((s) => s.toast);

  const reload = () =>
    api.knowledge().then(
      (d) => setData(d),
      (e) => setError(String(e.message ?? e)),
    );
  useEffect(() => {
    void reload();
  }, []);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      await reload();
      if (ok) toast(ok, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const openDoc = async (id: string) => {
    const d = await api.knowledgeDoc(id);
    setViewer({ title: d.title, body: d.body, meta: `${id} · pack ${d.packId} · studio-authored` });
  };
  const openSkill = async (id: string) => {
    const s = await api.knowledgeSkill(id);
    setViewer({ title: s.title, body: s.body, meta: `skill ${s.id} · ${AGENTS[s.role].title} · ${s.enabled ? 'enabled' : 'disabled'} · ${s.file}` });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="library">
        <div className="library-head">
          <div className="modal-title">Knowledge Library</div>
          <nav className="seg">
            {(['departments', 'skills', 'packs', 'sources', 'retrieval'] as View[]).map((v) => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                {v === 'retrieval' ? 'Retrieval test' : v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </nav>
          <span className="grow" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {error && <div className="notice error">{error}</div>}
        {data?.errors.length ? <div className="notice warn">Content problems (excluded until fixed): {data.errors.join('; ')}</div> : null}
        {!data ? (
          <div className="empty">Loading…</div>
        ) : (
          <div className="library-body">
            {view === 'departments' && <Departments data={data} act={act} openDoc={openDoc} openSkill={openSkill} />}
            {view === 'skills' && <Skills data={data} act={act} openSkill={openSkill} />}
            {view === 'packs' && <Packs data={data} act={act} openDoc={openDoc} />}
            {view === 'sources' && <Sources data={data} act={act} setViewer={setViewer} />}
            {view === 'retrieval' && <Retrieval />}
          </div>
        )}
        {viewer && (
          <div className="library-viewer">
            <div className="preview-head">
              <strong>{viewer.title}</strong>
              <span className="grow" />
              <button className="btn ghost icon" onClick={() => setViewer(null)}>
                ✕
              </button>
            </div>
            {viewer.meta && <div className="muted small">{viewer.meta}</div>}
            <MarkdownDoc source={viewer.body} filePath="" />
          </div>
        )}
      </div>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;

function Departments({ data, act, openDoc, openSkill }: { data: Data; act: Act; openDoc: (id: string) => void; openSkill: (id: string) => void }) {
  const [dept, setDept] = useState<AgentId>('designer');
  const packs = data.packs;
  const skills = data.skills.filter((s) => s.role === dept);
  const sources = data.sources.filter((s) => s.departments.includes(dept));
  const toggle = (p: KnowledgePack) => {
    const has = p.departments.includes(dept);
    const next = has ? p.departments.filter((d) => d !== dept) : [...p.departments, dept];
    return act(() => api.setPackDepartments(p.id, next), `${p.title} ${has ? 'removed from' : 'assigned to'} ${AGENTS[dept].title}`);
  };
  return (
    <div className="library-split">
      <div className="dept-list">
        {AGENT_IDS.map((id) => (
          <button key={id} className={`dept ${dept === id ? 'active' : ''}`} onClick={() => setDept(id)}>
            <Avatar id={id} size={24} />
            <span>
              <strong>{AGENTS[id].title}</strong>
              <span className="muted small"> {packs.filter((p) => p.departments.includes(id)).length} packs · {data.skills.filter((s) => s.role === id && s.enabled).length} skills</span>
            </span>
          </button>
        ))}
      </div>
      <div className="dept-detail">
        <div className="section-title">Knowledge packs searchable by the {AGENTS[dept].title}</div>
        <p className="muted small">Engine packs (Unity, Unreal, Phaser, web) are only loaded for tasks that target that engine.</p>
        {packs.map((p) => (
          <label key={p.id} className="pack-row">
            <input type="checkbox" checked={p.departments.includes(dept)} onChange={() => toggle(p)} />
            <span className="pack-name">{p.title}</span>
            <span className="pill">{p.layer}</span>
            <span className="muted small">{p.docs.length} docs</span>
            <span className="grow" />
            {p.docs.slice(0, 1).map((d) => (
              <button key={d.id} type="button" className="link small" onClick={() => openDoc(d.id)}>
                preview
              </button>
            ))}
          </label>
        ))}
        <div className="section-title">Skills</div>
        {skills.map((s) => (
          <div key={s.id} className="pack-row">
            <span className={`pill ${s.enabled ? 'st-done' : 'st-cancelled'}`}>{s.enabled ? 'enabled' : 'disabled'}</span>
            <button className="link" onClick={() => openSkill(s.id)}>
              {s.id}
            </button>
            <span className="muted small">{s.summary}</span>
          </div>
        ))}
        {!skills.length && <div className="muted small">No skills for this role.</div>}
        <div className="section-title">External sources</div>
        {sources.map((s) => (
          <div key={s.id} className="pack-row">
            <span className="pill">{TRUST_LABEL[s.trust]}</span> {s.name} <span className="muted small">{s.status}{s.enabled ? '' : ' · disabled'}</span>
          </div>
        ))}
        {!sources.length && <div className="muted small">No external sources assigned. Add one under Sources.</div>}
      </div>
    </div>
  );
}

function ReviewQueue({ act }: { act: Act }) {
  const [items, setItems] = useState<ImportedSkill[] | null>(null);
  const load = () => api.skillImports().then(setItems, () => setItems([]));
  useEffect(() => {
    void load();
  }, []);
  const review = (id: string, decision: 'approve' | 'reject') =>
    act(async () => {
      await api.reviewImport(id, decision, '');
      await load();
    }, decision === 'approve' ? 'Skill approved' : 'Skill rejected');
  const pending = (items ?? []).filter((i) => i.approval === 'quarantined');
  return (
    <div className="card">
      <div className="section-title">Imported skills — review queue</div>
      <p className="muted small">
        Skills from external repositories wait here in quarantine and are never shown to agents until you approve them. Skills with blocking findings
        (shell or install commands, permission bypasses, unpinned source, missing license or sections) cannot be approved. No skills are imported in this phase.
      </p>
      {!items ? (
        <div className="muted small">Loading…</div>
      ) : !items.length ? (
        <div className="muted small">The queue is empty.</div>
      ) : (
        items.map((i) => (
          <div key={i.id} className="import-row">
            <div>
              <strong>{i.title}</strong> <code>{i.skillId}</code> v{i.version} · {AGENTS[i.role].title} · <span className="pill">{i.approval}</span>
            </div>
            <div className="muted small">
              {i.sourceRepo} @ {i.sourceCommit || 'unpinned'} · {i.license || 'no license'} · engines {i.engines.join(', ') || 'any'}
            </div>
            {i.lintFindings.map((f, n) => (
              <div key={n} className={`small ${f.severity === 'block' ? 'error-text' : 'muted'}`}>
                {f.severity === 'block' ? '⛔' : '⚠'} {f.rule}: {f.detail}
              </div>
            ))}
            {i.approval === 'quarantined' && (
              <div className="actions">
                <button className="btn danger ghost" onClick={() => review(i.id, 'reject')}>
                  Reject
                </button>
                <button className="btn primary" disabled={i.lintFindings.some((f) => f.severity === 'block')} onClick={() => review(i.id, 'approve')}>
                  Approve
                </button>
              </div>
            )}
          </div>
        ))
      )}
      {pending.length > 0 && <div className="muted small">{pending.length} waiting for review.</div>}
    </div>
  );
}

function Skills({ data, act, openSkill }: { data: Data; act: Act; openSkill: (id: string) => void }) {
  return (
    <>
    <ReviewQueue act={act} />
    <div className="skill-grid">
      {AGENT_IDS.map((role) => (
        <div key={role} className="card">
          <div className="dash-head">
            <Avatar id={role} size={22} />
            <strong>{AGENTS[role].title}</strong>
          </div>
          {data.skills
            .filter((s) => s.role === role)
            .map((s) => (
              <div key={s.id} className="skill-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => act(() => api.setSkillEnabled(s.id, !s.enabled), `${s.id} ${s.enabled ? 'disabled' : 'enabled'}`)}
                  />
                </label>
                <div>
                  <button className="link" onClick={() => openSkill(s.id)}>
                    {s.title}
                  </button>{' '}
                  <code>{s.id}</code>
                  <div className="muted small">{s.summary}</div>
                  <div className="muted small">Uses: {s.packs.join(', ') || '—'}</div>
                  <div className="muted small">
                    v{s.version} · {s.origin === 'internal' ? 'studio-authored' : `imported from ${s.sourceRepo}@${s.sourceCommit.slice(0, 10)}`} · {s.license}
                    {s.engineDependent && ' · engine-dependent'}
                    {s.disciplines.length > 0 && ` · ${s.disciplines.join(', ')}`}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
    </>
  );
}

function Packs({ data, act, openDoc }: { data: Data; act: Act; openDoc: (id: string) => void }) {
  return (
    <div className="pack-list">
      {data.packs.map((p) => (
        <div key={p.id} className="card">
          <div className="dash-head">
            <strong>{p.title}</strong>
            <span className="pill">{p.layer}</span>
            {p.tools.length > 0 && <span className="pill">only for {p.tools.join(', ')} tasks</span>}
            <span className="grow" />
            <span className="muted small">
              {TRUST_LABEL[p.trust]} · v{p.version} · {p.license}
            </span>
          </div>
          <div className="muted small">{p.description}</div>
          <div className="dept-chips">
            {AGENT_IDS.map((d) => {
              const on = p.departments.includes(d);
              return (
                <button
                  key={d}
                  className={`chip ${on ? 'on' : ''}`}
                  title={on ? 'Click to remove' : 'Click to assign'}
                  onClick={() => act(() => api.setPackDepartments(p.id, on ? p.departments.filter((x) => x !== d) : [...p.departments, d]))}
                >
                  {on ? '✓ ' : ''}
                  {AGENTS[d].title}
                </button>
              );
            })}
          </div>
          <div className="doc-list">
            {p.docs.map((d) => (
              <button key={d.id} className="link small" onClick={() => openDoc(d.id)} title={d.sections.join(' · ')}>
                {d.title} <span className="muted">({d.words} words)</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<SourceKind, string> = {
  github: 'GitHub repository',
  example_project: 'Example project (GitHub)',
  docs_site: 'Official documentation pages',
  markdown: 'Markdown documents',
  pdf: 'PDF guide',
  internal_doc: 'Internal studio document',
};

function Sources({ data, act, setViewer }: { data: Data; act: Act; setViewer: (v: { title: string; body: string; meta?: string }) => void }) {
  const projects = useStudio((s) => s.projects);
  const [form, setForm] = useState({
    kind: 'github' as SourceKind,
    name: '',
    url: '',
    ref: '',
    version: '',
    license: '',
    trust: 'official',
    paths: '',
    text: '',
    projectId: '',
    departments: ['programmer'] as AgentId[],
  });
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const needsPaths = form.kind === 'github' || form.kind === 'example_project' || form.kind === 'docs_site';
  const submit = async () => {
    setBusy(true);
    await act(
      () =>
        api.addSource({
          kind: form.kind,
          name: form.name,
          url: form.url,
          ref: form.ref,
          version: form.version,
          license: form.license,
          trust: form.trust,
          departments: form.departments,
          includePaths: form.paths.split('\n').map((s) => s.trim()).filter(Boolean),
          projectId: form.projectId || null,
          files: form.kind === 'markdown' || form.kind === 'internal_doc' ? [{ path: `${form.name || 'document'}.md`, content: form.text }] : undefined,
          pdfBase64: form.kind === 'pdf' ? pdf?.base64 : undefined,
        }),
      'Source imported',
    );
    setBusy(false);
  };
  return (
    <div className="sources">
      <div className="card form">
        <div className="section-title">Register a knowledge source</div>
        <div className="row">
          <label>
            Type
            <select
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as SourceKind;
                setForm({ ...form, kind, trust: kind === 'internal_doc' ? 'internal' : kind === 'example_project' ? 'community' : form.trust });
              }}
            >
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Phaser 3 docs: Arcade physics" />
          </label>
          <label>
            Trust
            <select value={form.trust} onChange={(e) => setForm({ ...form, trust: e.target.value })}>
              <option value="official">Official documentation</option>
              <option value="community">Community / example</option>
              <option value="internal">Internal studio document</option>
            </select>
          </label>
        </div>
        {(form.kind === 'github' || form.kind === 'example_project') && (
          <div className="row">
            <label>
              Repository URL
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://github.com/owner/repo" />
            </label>
            <label>
              Branch / tag
              <input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="main" />
            </label>
          </div>
        )}
        {needsPaths && (
          <label>
            {form.kind === 'docs_site' ? 'Documentation page URLs (one per line — sites are never crawled)' : 'Folders or files to import (one per line — the whole repository is never imported)'}
            <textarea rows={3} value={form.paths} onChange={(e) => setForm({ ...form, paths: e.target.value })} placeholder={form.kind === 'docs_site' ? 'https://docs.example.com/page' : 'docs/guide\nREADME.md'} />
          </label>
        )}
        {(form.kind === 'markdown' || form.kind === 'internal_doc') && (
          <label>
            Markdown content
            <textarea rows={6} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </label>
        )}
        {form.kind === 'pdf' && (
          <label>
            PDF file
            <input
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const buf = new Uint8Array(await f.arrayBuffer());
                let bin = '';
                for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
                setPdf({ name: f.name, base64: btoa(bin) });
                if (!form.name) setForm({ ...form, name: f.name });
              }}
            />
          </label>
        )}
        <div className="row">
          <label>
            Version (optional; GitHub imports record the commit)
            <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </label>
          <label>
            License
            <input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} placeholder="e.g. MIT, CC BY 4.0, proprietary" />
          </label>
          <label>
            Scope
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Only {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="dept-chips">
          <span className="muted small">Departments that may use it:</span>
          {AGENT_IDS.map((d) => (
            <button
              key={d}
              type="button"
              className={`chip ${form.departments.includes(d) ? 'on' : ''}`}
              onClick={() => setForm({ ...form, departments: form.departments.includes(d) ? form.departments.filter((x) => x !== d) : [...form.departments, d] })}
            >
              {form.departments.includes(d) ? '✓ ' : ''}
              {AGENTS[d].title}
            </button>
          ))}
        </div>
        <div className="actions">
          <span className="muted small">Imported text is stored as untrusted reference data; it can never change agent instructions or permissions.</span>
          <span className="grow" />
          <button className="btn primary" disabled={busy || !form.name.trim() || !form.departments.length} onClick={submit}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
      {data.sources.map((s) => (
        <div key={s.id} className="card">
          <div className="dash-head">
            <strong>{s.name}</strong>
            <span className="pill">{TRUST_LABEL[s.trust]}</span>
            <span className={`pill ${s.status === 'ready' ? 'st-done' : s.status === 'error' ? 'st-failed' : ''}`}>{s.status}</span>
            <span className="grow" />
            <label className="check">
              <input type="checkbox" checked={s.enabled} onChange={() => act(() => api.updateSource(s.id, { enabled: !s.enabled }))} /> enabled
            </label>
          </div>
          <div className="muted small">
            {KIND_LABEL[s.kind]}
            {s.url && <> · {s.url}</>}
            {s.version && <> · version {s.version}</>}
            {s.license && <> · license {s.license}</>}
            {s.retrievedAt && <> · retrieved {timeAgo(s.retrievedAt)}</>}
            {s.projectId && <> · project-scoped</>}
          </div>
          <div className="muted small">Departments: {s.departments.map((d) => AGENTS[d].title).join(', ')}</div>
          {s.notes && <div className="muted small">{s.notes}</div>}
          {s.error && <div className="notice error">{s.error}</div>}
          <div className="doc-list">
            {s.documents.map((d) => (
              <button
                key={d.id}
                className="link small"
                onClick={async () => {
                  const doc = await api.sourceDoc(s.id, d.id);
                  setViewer({ title: doc.title, body: doc.content, meta: `${s.name} · ${doc.path} · untrusted reference data` });
                }}
              >
                {d.path} <span className="muted">({Math.round(d.bytes / 1024)} KB)</span>
              </button>
            ))}
          </div>
          <div className="actions">
            {['github', 'docs_site', 'example_project'].includes(s.kind) && (
              <button className="btn" onClick={() => act(() => api.refreshSource(s.id), 'Source refreshed')}>
                Refresh
              </button>
            )}
            <span className="grow" />
            <button className="btn danger ghost" onClick={() => act(() => api.deleteSource(s.id), 'Source removed')}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Retrieval() {
  const projectId = useStudio((s) => s.projectId);
  const [agent, setAgent] = useState<AgentId>('programmer');
  const [q, setQ] = useState('Implement a player controller MonoBehaviour in Unity C# with EditMode tests');
  const [res, setRes] = useState<{ tools: string[]; skill: Skill | null; hits: KnowledgeHit[]; routing: RoutingPreview | null } | null>(null);
  const run = async () => setRes(await api.knowledgeSearch(agent, q, projectId));
  const words = useMemo(() => res?.hits.reduce((n, h) => n + h.text.split(/\s+/).length, 0) ?? 0, [res]);
  return (
    <div className="retrieval">
      <p className="muted small">
        Shows exactly what an agent would receive at the start of a task with this text: the skill it would follow and the references injected into its prompt.
      </p>
      <div className="row">
        <label>
          Agent
          <select value={agent} onChange={(e) => setAgent(e.target.value as AgentId)}>
            {AGENT_IDS.map((id) => (
              <option key={id} value={id}>
                {AGENTS[id].title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: 4 }}>
          Task text
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        </label>
        <button className="btn primary" onClick={run}>
          Preview
        </button>
      </div>
      {res && (
        <div className="card">
          <div className="small">
            Engine: <strong>{res.routing?.engine ? `${res.routing.engine}${res.routing.engineVersion ? ` ${res.routing.engineVersion}` : ' (version unknown)'}` : 'none'}</strong>
            {res.routing && <span className="muted"> from {res.routing.engineSource}</span>} · Genre: <strong>{res.routing?.genre ?? 'none'}</strong> · Disciplines:{' '}
            <strong>{res.routing?.disciplines.map((d) => d.id).join(', ') || 'none'}</strong> · Skill: <strong>{res.skill ? res.skill.id : 'none (no match)'}</strong>
            {res.routing?.supportingSkills.length ? <span className="muted"> + {res.routing.supportingSkills.join(', ')}</span> : null} · {res.hits.length} references, {words} words ·
            confidence {res.routing ? Math.round(res.routing.confidence * 100) : 0}%
          </div>
          {res.routing?.clarification && <div className="notice warn small">Clarification required: {res.routing.clarification}</div>}
          {res.routing && (
            <ul className="routing-reasons small">
              {res.routing.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {res.hits.map((h, i) => (
            <div key={i} className="hit">
              <div className="hit-head">
                <code>{h.refId}</code> <span className="muted">§ {h.section}</span>
                {h.slot && <span className="pill">{h.slot}</span>}
                {h.versionStatus === 'unverified' && <span className="pill st-awaiting_approval">version unverified</span>}
                <span className="grow" />
                <span className="pill">{TRUST_LABEL[h.trust]}</span>
                <span className="muted small">score {h.score}</span>
              </div>
              <div className="muted small hit-text">{h.text.slice(0, 280)}…</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
