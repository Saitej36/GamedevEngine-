# PIXEL STUDIO — AI Game Development Office

A desktop-first web app where you run an indie game studio staffed by six AI employees.
Each employee is a pixel-art NPC in a top-down office **and** a real
[Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) agent that writes real files into your
project workspace. You brief the Game Director; she plans, delegates, reviews and escalates decisions to you.

```
npm install
npm run setup:browser     # one time: downloads headless Chromium so QA can really launch games
cp .env.example .env      # add ANTHROPIC_API_KEY (or be logged in to Claude Code on this machine)
npm run dev               # server :8787 + client :5173 → open http://localhost:5173
```

Requires Node.js 22.13+ (uses the built-in `node:sqlite`).

On startup the server proves it can do real work before any task runs: it opens one minimal real Agent SDK
session (fractions of a cent) and launches headless Chromium once. The top bar shows **● LIVE** only after the SDK
answered; otherwise you see **AI configuration error** with the SDK's own message, and tasks stay queued.
Generated games open from **Files → ▶ Preview game** (served on `PREVIEW_PORT`, default 8788, a separate origin).

## What runs where

| Mode | When | What you see |
|---|---|---|
| **Live** (default) | Server reachable and the startup Agent SDK session answered | Real agents writing real files. Employees show as working only during a real agent run; idle NPCs just walk around. |
| **AI configuration error** | The startup Agent SDK session failed | The exact SDK error and a Re-check button. Projects, files and approvals work; tasks stay QUEUED. |
| **AI disabled** | Only when you set `AI_MODE=off` | Same as above, by your choice. The server never switches to this on its own. |
| **Server not reachable** | The client cannot reach `/api` | An error banner with Retry. Nothing is simulated. |
| **Simulated demo** | Only when you click *Open simulated demo* or add `?demo` to the URL | A labelled client-side simulation. Produces no files and is never counted as work. |

A task is COMPLETED only if its output files exist on disk (checked when the agent finishes and again at completion);
an agent that reports success without writing a file is FAILED. Task states: QUEUED → STARTING (waiting for the SDK
session) → RUNNING → REVIEW → WAITING_FOR_APPROVAL → COMPLETED, or FAILED with the real error.

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

## Knowledge system

Agent identity (`shared/src/roster.ts`), execution (`server/src/agents/runner.ts`) and knowledge (`knowledge/`) are
separate. Knowledge has five layers:

| Layer | Where | Trust |
|---|---|---|
| Shared studio standards | `knowledge/packs/studio-core` | studio-authored |
| Role knowledge (design, art, engineering, production, QA, direction) | `knowledge/packs/*-craft` | studio-authored |
| Tool docs (Unity, Unreal, Phaser, vanilla web) | `knowledge/packs/tool-*` — internal summaries, loaded only for tasks that target that tool | studio-authored |
| Reusable skills (Purpose · Required inputs · Workflow · Expected output · Quality checklist · Failure conditions) | `knowledge/skills/<role>/*.md`, validated at load | studio-authored |
| External sources: GitHub repos/example projects (selected paths only), documentation pages (listed URLs only), Markdown, PDFs, internal docs | database, registered in the **Knowledge** library | official / community / internal, with version, license, retrieval date |
| Project knowledge | the project's own `docs/`, `design/`, `qa/` Markdown | project |

At the start of every run the orchestrator chooses a skill (assigned by the Director via `create_task(skill=…)`,
or matched from the task text), runs a BM25 search limited to the packs assigned to that department plus the
engine detected in the task/brief, and injects at most ~1,800 words: the skill as instructions and the references
inside `<reference>` envelopes marked as data. Agents can search further with the read-only
`mcp__knowledge__search_knowledge` / `read_knowledge` tools. Every skill, injected reference, search and read is
recorded per run (`GET /api/tasks/:id/knowledge`) and shown under **Knowledge used** on the task card. External
text can never become a skill or change permissions; forged envelope tags are neutralised. Format rules:
`knowledge/FORMAT.md`.

**Knowledge Router v2.** Each project has a structured profile (engine, engine version, platform, primary and
secondary genre, programming approach, project type; *Project → Edit*). Every run is routed:

1. **Engine — exactly one.** Priority: project profile → project files (`*.uproject`, `ProjectSettings/ProjectVersion.txt`,
   `package.json` with `phaser`, `.asmdef`, `*.Build.cs`, …) → engine named in the task (then the brief). Conflicting
   signals or no signal on engine-dependent work (Programmer, engine-dependent skills) **park the task as
   `needs_clarification`** and the Director asks the owner; it restarts when the profile is updated. Several engines
   are never loaded.
2. **Version.** Engine packs and engine-tagged sources declare version ranges (studio baselines: UE `>=5.4 <5.5`,
   Unity `>=2022.3 <7000` i.e. 2022.3 LTS–Unity 6, Phaser `>=3.90 <4`). Incompatible knowledge is excluded and
   recorded; knowledge whose version cannot be checked is flagged `engine_version_status="unverified"`.
3. **Disciplines** (several) and **one primary genre** from `knowledge/routing.json` keyword tables.
4. **Budget:** one primary skill, up to two supporting skills (same role, shared discipline; purpose + checklist only),
   and at most 6 sections / ~1,800 words: engine ≤2 · genre ≤1 · discipline ≤2 · project architecture ≤1 · general.
5. Every decision (engine + source + confidence, version, genre, disciplines, skills, references, exclusions,
   reasons, clarification) is stored in `routing_decisions` and shown under **Routing** on the task card.

Skills carry metadata (version, source repo/commit, license, engines + versions, disciplines, genres, department,
approval). Imported skills go to a **quarantine** (`skill_imports`), are linted (shell/install/network commands,
permission bypass, instruction overrides, unpinned source, missing license or sections) and are invisible to agents
until the owner approves them in *Knowledge → Skills → Review queue*. Nothing is imported or fetched automatically.

Fetching GitHub folders needs the GitHub API (set `GITHUB_TOKEN` for higher limits); without it only explicitly
listed files are fetched over raw URLs. Behind an HTTP proxy, start the server with `NODE_USE_ENV_PROXY=1`.

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
- Generated games run only on the separate preview origin (127.0.0.1, read-only, CSP without network access to the
  studio API); state-changing API requests must carry the `X-Pixel-Studio` header, so a generated page cannot forge one.
- QA/Programmer playtests (`mcp__playtest__run_game`) serve the project on 127.0.0.1 and run it in headless Chromium
  with all external requests blocked. It is not a shell: the agent can only load its own project's files.

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
| `npm run setup:browser` | one-time Chromium download for real playtesting (Playwright is an optional dependency) |
| `npm run build` && `npm start` | production: server on :8787 also serves `client/dist` |
| `npm test` | server tests (permission guard, task lifecycle, usage/session/review tracking, migration) + client Markdown tests |
| `npm run typecheck` | all workspaces |
