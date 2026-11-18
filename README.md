# PIXEL STUDIO — AI Game Development Office

A desktop-first web app where you run an indie game studio staffed by six AI employees.
Each employee is a pixel-art NPC in a top-down office **and** a real
[Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) agent that writes real files into your
project workspace. You brief the Game Director; she plans, delegates, reviews and escalates decisions to you.

```
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY
npm run dev               # server :8787 + client :5173 → open http://localhost:5173
```

Requires Node.js 22.13+ (uses the built-in `node:sqlite`).

## What runs where

| Mode | When | What you see |
|---|---|---|
| **Live** | Server reachable and credentials present | Real agents. Every animation is driven by real agent events. NPCs roam (ambient simulation) only while idle. |
| **AI offline** | Server reachable, no `ANTHROPIC_API_KEY` (or `AI_MODE=off`) | Everything works except agent execution: projects, manual tasks, files, approvals. Tasks stay queued — nothing is faked. |
| **Demo** | Server not reachable | A clearly labelled client-side simulation (`SIM` tags, banner) that feeds the same event protocol to show how the office reacts. Produces no files. |

## The team

| Agent | Role | May write to | Tools |
|---|---|---|---|
| Ada Vance | Game Director (orchestrator) | `docs/` | Read, Glob, Grep, Write, Edit + studio tools |
| Milo Park | Game Designer | `docs/`, `design/` | Read, Glob, Grep, Write, Edit |
| Rin Okada | Concept Artist | `assets/`, `docs/art/` | Read, Glob, Grep, Write, Edit |
| Theo Brandt | Game Programmer | `src/`, `public/`, `tests/`, `index.html`, `package.json`, `README.md` | + Bash if `ALLOW_AGENT_BASH=true` |
| Sasha Reyes | Producer | `docs/production/` | Read, Glob, Grep, Write, Edit |
| Jun Ito | QA Tester | `qa/`, `tests/` | + Bash if `ALLOW_AGENT_BASH=true` |

Identities, permissions and sprite palettes live in `shared/src/roster.ts`; system instructions in
`server/src/agents/prompts.ts`.

## How work flows

```
You ──chat──▶ Director (Agent SDK session, resumed per project)
                 │  studio MCP tools: create_task · add_milestone · request_approval · cancel_task · get_project_status
                 ▼
            Task queue (SQLite) ──scheduler──▶ Specialist (Agent SDK session, cwd = project workspace)
                                                  │ writes real files, reports back to the Director chat
                                                  ▼
                                   Director review (review_task: approve | revise with feedback)
                                                  │            └─▶ revision (resumes the agent's session) ↺ max N
                                                  ▼
                              requires sign-off? ─▶ Approval queue (you approve / reject with guidance)
                                                  ▼
                                                done 🎉
```

Task states: `queued → in_progress → in_review → (revision ↺) → [awaiting_approval] → done`, plus `failed` /
`cancelled` (retryable). State is persisted; on restart interrupted tasks are re-queued and pending reviews resumed.
The Director can also put any decision in front of you with `request_approval`; your answer is fed back to her.

## Usage, sessions and review history

- Every Claude Agent SDK run is stored in `agent_runs`: Director planning (`planning`), specialist work (`task`)
  and Director reviews (`review`), each with its project, task, session ID, tokens, turns, duration and cost.
  The session ID is saved as soon as the SDK announces it, so it survives a crash mid-run.
- `costStatus` is `actual` (reported by the SDK), `unavailable` (the run ended without a result, e.g. crash,
  cancel or server restart; never counted as $0) or `legacy_aggregate` (a pre-v2 task total covering run +
  review). The Project tab shows the breakdown; `GET /api/projects/:id/usage` returns the runs and summary.
- Director reviews and owner approvals/rejections are separate `task_reviews` records (`GET /api/tasks/:id/history`);
  approving a task never overwrites the Director's notes.
- Migration v2 backfills these tables from existing data without modifying any existing row.

## Real-time events → animations

The server emits `task_created`, `task_assigned`, `task_started`, `agent_working`, `file_created`,
`task_completed`, `approval_required`, `task_failed`, `agent_idle` over a WebSocket (`/ws`). One table,
`shared/src/animation.ts`, maps each event to an NPC status:

| Event | NPC |
|---|---|
| `task_assigned` | walks to the meeting room (briefing) |
| `task_started`, `agent_working` (write/edit/bash) | types at their desk |
| `agent_working` (read/glob/grep, reviews) | reads at their desk |
| `file_created` | typing + 📄 bubble |
| `task_completed` | celebrates (jumps) |
| `approval_required` | waits at desk with ❗ |
| `task_failed` | slumps with ⚠️ |
| `agent_idle` | roams the office (coffee, couch, other departments) |

## Security model

- Each project has its own workspace (`data/workspaces/<projectId>`); agents run with it as `cwd` and with
  `settingSources: []` (no user/project Claude settings are loaded).
- Every tool call passes `server/src/agents/guard.ts` twice — from the SDK `canUseTool` callback and from a
  `PreToolUse` hook, so it also covers auto-approved calls. It enforces: paths resolve inside the workspace
  (incl. symlink resolution), writes only into the role's folders, only the role's tools, no web/subagent tools.
- Bash is off by default. When enabled it is limited to Programmer/QA with a deny-list — treat it as best-effort
  and run the server in a container if you enable it.
- Per-run `maxTurns` and `maxBudgetUsd` limits; cancel aborts the running agent.
- The file API serves agent output with `Content-Security-Policy: sandbox` and `nosniff`.

## Project layout

```
shared/   domain types, event protocol, roster, event→animation table
server/   Express REST + WebSocket hub, SQLite store, orchestrator, Agent SDK runner, permission guard
client/   React UI (Vite) + Phaser 3 office (procedural pixel art, A* pathfinding)
  src/game/   OfficeGame (createOfficeGame), map, pathfinding, characters, furniture, Npc
  src/sim/    offline demo simulation (same protocol as the server)
```

REST highlights (`/api`): `projects`, `projects/:id` (brief, milestones, tasks, approvals, stats),
`projects/:id/chat`, `projects/:id/tasks`, `tasks/:id/{start,cancel,retry}`, `approvals/:id/resolve`,
`projects/:id/files`, `projects/:id/file?path=`, `projects/:id/events`, `agents/:id`.

## Scripts

| | |
|---|---|
| `npm run dev` | server (tsx watch) + Vite client with proxy |
| `npm run build` && `npm start` | production: server on :8787 also serves `client/dist` |
| `npm test` | server tests (permission guard, task lifecycle, usage/session/review tracking, migration) + client Markdown tests |
| `npm run typecheck` | all workspaces |
