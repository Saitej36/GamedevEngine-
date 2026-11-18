import { useEffect, useState } from 'react';
import { useStudio } from './state/store';
import { boot } from './state/controller';
import { OfficeView } from './ui/OfficeView';
import { NewProjectModal, Roster, Tabs, Toasts, TopBar } from './ui/Shell';
import { ChatPanel } from './ui/ChatPanel';
import { TaskBoard } from './ui/TaskBoard';
import { ApprovalQueue } from './ui/ApprovalQueue';
import { FileExplorer } from './ui/FileExplorer';
import { Dashboard } from './ui/Dashboard';
import { Timeline } from './ui/Timeline';
import { AgentProfile } from './ui/AgentProfile';
import { ErrorBoundary } from './ui/ErrorBoundary';

export function App() {
  const tab = useStudio((s) => s.tab);
  const mode = useStudio((s) => s.mode);
  const projectId = useStudio((s) => s.projectId);
  const selected = useStudio((s) => s.selectedAgent);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    void boot();
  }, []);

  return (
    <div className="app">
      <TopBar onNewProject={() => setShowNew(true)} />
      <main className="main">
        <section className="stage">
          <ErrorBoundary label="Office">
            <OfficeView />
          </ErrorBoundary>
          {selected && (
            <ErrorBoundary key={selected} label="Profile">
              <AgentProfile id={selected} />
            </ErrorBoundary>
          )}
          <Roster />
        </section>
        <section className="side">
          <Tabs />
          {mode === 'live' && !projectId ? (
            <div className="panel welcome">
              <div className="welcome-title">Welcome to your studio</div>
              <p>Your six AI employees are waiting. Create a game project and brief your Game Director to get started.</p>
              <button className="btn primary" onClick={() => setShowNew(true)}>
                + Create your first project
              </button>
            </div>
          ) : (
            <ErrorBoundary key={tab} label="Panel">
              {tab === 'chat' && <ChatPanel />}
              {tab === 'tasks' && <TaskBoard />}
              {tab === 'approvals' && <ApprovalQueue />}
              {tab === 'files' && <FileExplorer />}
              {tab === 'dashboard' && <Dashboard />}
              {tab === 'timeline' && <Timeline />}
            </ErrorBoundary>
          )}
        </section>
      </main>
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
      <Toasts />
    </div>
  );
}
