import { useEffect, useState } from 'react';
import type { FileNode } from '@pixel/shared';
import { api } from '../api/client';
import { useStudio } from '../state/store';
import { MarkdownFile } from './MarkdownDoc';

const IMAGE = /\.(svg|png|jpe?g|gif|webp)$/i;
const OWNER: Record<string, string> = {
  docs: 'Director · Designer',
  design: 'Game Designer',
  assets: 'Concept Artist',
  src: 'Game Programmer',
  tests: 'Programmer · QA',
  qa: 'QA Tester',
};

export function FileExplorer() {
  const mode = useStudio((s) => s.mode);
  const projectId = useStudio((s) => s.projectId);
  const version = useStudio((s) => s.filesVersion);
  const openFile = useStudio((s) => s.openFile);
  const [tree, setTree] = useState<FileNode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'live' || !projectId) return;
    api.files(projectId).then(setTree, (e) => setError(String(e.message ?? e)));
  }, [mode, projectId, version]);

  useEffect(() => {
    if (openFile) {
      setSelected(openFile);
      useStudio.getState().set({ openFile: null });
    }
  }, [openFile]);

  useEffect(() => {
    if (!selected || !projectId || IMAGE.test(selected)) return;
    setContent('Loading…');
    setTruncated(false);
    api.readFile(projectId, selected).then(
      (t) => {
        // Very large files are previewed partially; the file itself (and Download) is untouched.
        setTruncated(t.length > 300_000);
        setContent(t.length > 300_000 ? t.slice(0, 300_000) : t);
      },
      () => setContent('(could not read file)'),
    );
  }, [selected, projectId, version]);

  if (mode !== 'live')
    return (
      <div className="panel files">
        <div className="empty">The file explorer shows the real project workspace. Connect the backend to browse files agents create.</div>
      </div>
    );

  return (
    <div className="panel files">
      {error && <div className="notice error">{error}</div>}
      <div className="files-split">
        <div className="tree">{tree?.children?.map((n) => <TreeNode key={n.path} node={n} selected={selected} onSelect={setSelected} depth={0} />)}</div>
        <div className="preview">
          {!selected && <div className="empty">Select a file to preview it.</div>}
          {selected && projectId && (
            <>
              <div className="preview-head">
                <code>{selected}</code>
                <span className="grow" />
                <a className="btn ghost" href={api.fileUrl(projectId, selected, true)}>
                  Download
                </a>
              </div>
              {truncated && <div className="notice warn">Preview shows the first 300,000 characters. Download for the full file.</div>}
              {IMAGE.test(selected) ? (
                <div className="image-preview">
                  <img src={`${api.fileUrl(projectId, selected)}&v=${version}`} alt={selected} />
                </div>
              ) : selected.endsWith('.md') ? (
                <div className="doc-preview">
                  <MarkdownFile
                    key={selected}
                    source={content}
                    filePath={selected}
                    onOpenFile={setSelected}
                    assetUrl={(p) => `${api.fileUrl(projectId, p)}&v=${version}`}
                  />
                </div>
              ) : (
                <pre className="code-preview">{content}</pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNode({ node, selected, onSelect, depth }: { node: FileNode; selected: string | null; onSelect: (p: string) => void; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === 'dir') {
    const count = node.children?.length ?? 0;
    return (
      <div>
        <button className="tree-row dir" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} 📁 {node.name}
          {depth === 0 && OWNER[node.name] && <span className="owner">{OWNER[node.name]}</span>}
          {!count && <span className="muted small"> (empty)</span>}
        </button>
        {open && node.children?.map((c) => <TreeNode key={c.path} node={c} selected={selected} onSelect={onSelect} depth={depth + 1} />)}
      </div>
    );
  }
  return (
    <button
      className={`tree-row file ${selected === node.path ? 'active' : ''}`}
      style={{ paddingLeft: 22 + depth * 14 }}
      onClick={() => onSelect(node.path)}
      title={node.modifiedAt}
    >
      {IMAGE.test(node.name) ? '🖼️' : '📄'} {node.name}
      <span className="muted small"> {formatSize(node.size ?? 0)}</span>
    </button>
  );
}

const formatSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
