import { useEffect, useRef, useState } from 'react';
import { AGENTS } from '@pixel/shared';
import { useStudio } from '../state/store';
import { actions } from '../state/controller';
import { Avatar } from './Avatar';
import { Markdown, timeAgo } from './format';

const SUGGESTIONS = [
  'Draft the GDD and a visual style guide for this game.',
  'Build a playable prototype of the core loop.',
  'Have QA write a test plan and review the current code.',
  'Give me a production roadmap with milestones.',
];

export function ChatPanel() {
  const chat = useStudio((s) => s.chat);
  const typing = useStudio((s) => s.directorTyping);
  const mode = useStudio((s) => s.mode);
  const info = useStudio((s) => s.info);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.length, typing]);

  const send = async (content: string) => {
    const c = content.trim();
    if (!c || sending) return;
    setSending(true);
    setText('');
    try {
      await actions.sendChat(c);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel chat">
      {mode === 'live' && info?.aiMode === 'offline' && (
        <div className="notice warn">
          <strong>AI offline.</strong> {info.aiReason}
        </div>
      )}
      <div className="chat-list" ref={listRef}>
        {chat.length === 0 && <div className="empty">Say hello to Ada, your Game Director.</div>}
        {chat.map((m) => {
          const who = m.role === 'user' ? 'You' : m.agentId ? AGENTS[m.agentId].name : 'Studio';
          return (
            <div key={m.id} className={`msg msg-${m.role}`}>
              {m.role !== 'user' && m.agentId && <Avatar id={m.agentId} size={28} />}
              <div className="msg-body">
                <div className="msg-meta">
                  <span className="msg-who">{who}</span>
                  {m.agentId && m.role === 'agent' && <span className="tag">{AGENTS[m.agentId].title} → Director</span>}
                  <span className="msg-time">{timeAgo(m.createdAt)}</span>
                </div>
                <Markdown text={m.content} />
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="msg msg-director">
            <Avatar id="director" size={28} />
            <div className="msg-body typing">
              Ada is thinking<span className="dots" />
            </div>
          </div>
        )}
      </div>
      {chat.length <= 1 && (
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          value={text}
          placeholder="Instruct the Director… (Enter to send, Shift+Enter for newline)"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={2}
        />
        <button className="btn primary" disabled={!text.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
