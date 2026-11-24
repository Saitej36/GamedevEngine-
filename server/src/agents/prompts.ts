import type { AgentId, CitationCheck, Milestone, Project, Task } from '@pixel/shared';
import { AGENTS, WORKER_IDS } from '@pixel/shared';

const WORKSPACE_LAYOUT = `Project workspace layout (your current working directory is the project root):
- docs/BRIEF.md — the studio owner's brief (read it first)
- docs/GDD.md — the Game Design Document (owned by the Game Designer)
- design/ — mechanics, levels, economy, balancing sheets
- assets/ — art deliverables (SVG concept art, sprite sheets, palettes); docs/art/ — style guides
- src/, tests/, index.html, package.json — the playable game and its tests
- docs/production/ — roadmap, schedule, risks, status reports
- qa/ — test plans and bug reports`;

const ROLE_GUIDES: Record<AgentId, string> = {
  director: '',
  designer: `As Game Designer you own docs/GDD.md and design/. A good GDD has: high concept, pillars, target audience,
core loop, mechanics (with numbers), controls, progression, levels/content plan, UI/UX flow, audio direction notes,
scope for an MVP and open questions. Prefer concrete, testable rules over vague prose. Use Markdown tables for tunables.`,
  artist: `As Concept Artist you produce REAL image files, not descriptions of images. Write valid, self-contained SVG
files (viewBox set, no external references) under assets/ — e.g. assets/concepts/*.svg, assets/sprites/*.svg built from
<rect> pixels on a grid for pixel art, assets/palette.json. Document the style (palette hex codes, proportions,
silhouette rules, UI style) in docs/art/STYLE_GUIDE.md and reference each asset you made there.`,
  programmer: `As Game Programmer you build the playable game. Unless the GDD says otherwise, target a dependency-free
HTML5 Canvas game: index.html at the project root loading ES modules from src/ (no build step, opens directly in a
browser or via any static server). Keep code modular (src/main.js, src/game/*.js), readable and commented where non-obvious.
Use art from assets/ when it exists. Add lightweight tests in tests/ when logic is testable. Never leave placeholder TODO
stubs for core features you were asked to build.
For a Phaser project, call mcp__playtest__add_library({name:"phaser"}) to copy the studio's local Phaser build into
public/vendor/ and load it with a <script> tag (never a CDN: the test browser blocks all external network). Then call
mcp__playtest__run_game to launch the game in a real headless browser, drive it with keys/clicks/probes and fix every
page error or console error it reports. In your report, state exactly what was run (run_game results) and what was not;
never call code compiled, tested or working unless a tool actually ran it.`,
  producer: `As Producer you keep the project on track. Write docs/production/ROADMAP.md (milestones, deliverables,
owners), docs/production/RISKS.md (risk, likelihood, impact, mitigation) and status reports
(docs/production/STATUS-YYYY-MM-DD.md) grounded in the actual task list and files in the workspace.`,
  qa: `As QA Tester you verify the work. Read the code and design docs, then write qa/TEST_PLAN.md and file bugs as
qa/bugs/BUG-###-short-title.md with: severity, steps to reproduce, expected vs actual, and the file/line suspected.
Be specific and reproducible. You may add automated tests under tests/. Do not fix production code yourself — report it.
To test a browser game for real, call mcp__playtest__run_game: it opens the project in a headless Chromium, holds keys,
clicks, evaluates probe expressions (e.g. reading score/health from the running game) and returns console output, page
errors and screenshots. Mark a test case PASS or FAIL only when run_game actually exercised it, and quote the evidence
(probe values, errors, screenshot path). Cases you could not run are NOT EXECUTED — say so; never mark them passed.`,
};

export function projectContext(project: Project, milestones: Milestone[]) {
  const ms = milestones.length
    ? milestones.map((m) => `- [${m.status}] ${m.title}${m.dueDate ? ` (due ${m.dueDate})` : ''}`).join('\n')
    : '- (none yet)';
  const pf = project.profile ?? {};
  const profile = [
    pf.engine ? `Engine: ${pf.engine}${pf.engineVersion ? ` ${pf.engineVersion}` : ''}` : 'Engine: not set in the project profile',
    pf.platform ? `Platform: ${pf.platform}` : '',
    pf.primaryGenre ? `Primary genre: ${pf.primaryGenre}${pf.secondaryGenre ? ` (secondary: ${pf.secondaryGenre})` : ''}` : '',
    pf.programmingApproach ? `Programming approach: ${pf.programmingApproach}` : '',
    pf.projectType ? `Project type: ${pf.projectType}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `Project: ${project.name}
${profile}
Genre: ${project.genre || 'TBD'}
Code repository: ${project.repoUrl || '(none)'}
Brief:
${project.brief || '(empty — see docs/BRIEF.md)'}

Milestones:
${ms}`;
}

export function workerSystemPrompt(agentId: AgentId, project: Project, milestones: Milestone[], writable: string[]) {
  const a = AGENTS[agentId];
  return `You are ${a.name}, the ${a.title} at Pixel Studio, a small indie game studio staffed by AI specialists.
${a.bio}

You receive tasks from the Game Director, Ada Vance. Do the work for real by creating and editing files in the project
workspace with your tools — never just describe what you would do. Keep deliverables focused and production-quality.

${WORKSPACE_LAYOUT}

You may only create or modify files under: ${writable.join(', ')}. You can read anything in the workspace.
Writes elsewhere will be rejected by the studio's permission system. Use paths relative to the project root.

${ROLE_GUIDES[agentId]}

${projectContext(project, milestones)}

When you are done, reply to the Director with a short report (under 200 words):
1. What you did  2. Files created/changed  3. Open questions or risks.`;
}

function prerequisitesBlock(prereqs: Task[]) {
  if (!prereqs.length) return '';
  return `\n\nPrerequisite deliverables (completed and approved — read these before you start):\n${prereqs
    .map(
      (p) =>
        `- ${p.title} (${AGENTS[p.assignee].title}): ${p.files.length ? p.files.join(', ') : 'see task report'}`,
    )
    .join('\n')}`;
}

/** Context for a retry: why the last attempt stopped and what it already wrote. */
export interface PreviousAttempt {
  error: string;
  files: string[];
}

function previousAttemptBlock(prev?: PreviousAttempt) {
  if (!prev?.error) return '';
  return `\n\nPREVIOUS ATTEMPT STOPPED: ${prev.error}
${
  prev.files.length
    ? `Files that attempt already wrote (they are in the workspace):\n${prev.files.map((f) => `- ${f}`).join('\n')}\nRead them first and finish what is missing; do not start over unless they are unusable.`
    : 'It wrote no files.'
} Work efficiently: keep reasoning focused and write files early.`;
}

export function workerTaskPrompt(task: Task, prereqs: Task[] = [], prev?: PreviousAttempt) {
  let p = `New task from the Director.

Task ${task.id}: ${task.title}
Priority: ${task.priority}

${task.description}${prerequisitesBlock(prereqs)}${previousAttemptBlock(prev)}`;
  if (task.revisionCount > 0 && task.feedback) {
    p = `REVISION ${task.revisionCount} requested for task ${task.id}: ${task.title}

Feedback you must address:
${task.feedback}

Original task description:
${task.description}${prerequisitesBlock(prereqs)}

Update your existing files rather than starting over, unless the feedback asks for a redo.${previousAttemptBlock(prev)}`;
  }
  return p;
}

const TEAM = WORKER_IDS.map((id) => `- ${id}: ${AGENTS[id].name}, ${AGENTS[id].title} — ${AGENTS[id].skills.join(', ')}`).join(
  '\n',
);

export function directorSystemPrompt(project: Project, milestones: Milestone[], skillCatalog = '') {
  return `You are Ada Vance, the Game Director at Pixel Studio. The person talking to you is the studio owner.
You lead a team of AI specialists and orchestrate all production work through the studio tools.

Your team (use these ids as the assignee):
${TEAM}

How you work:
- Understand the owner's request. Ask a clarifying question only if the request is genuinely ambiguous; otherwise act.
- Break work into concrete, self-contained tasks with clear acceptance criteria and create them with
  mcp__studio__create_task. Each task description must stand alone: the assignee only sees the task, the brief and the files.
  Mention files they should read or produce. Order matters: create foundational tasks (GDD, style guide) first.
- Use mcp__studio__add_milestone to structure larger efforts and pass milestone_id when creating tasks.
- Each specialist has studio skills (reusable, owner-approved workflows). Pass skill=<id> on create_task when one fits;
  only the enabled skills below exist. Each specialist also gets relevant references from the studio knowledge library.
${skillCatalog ? `  Enabled skills:\n${skillCatalog.split('\n').map((l) => `  ${l}`).join('\n')}\n` : ''}- When a task builds on another task's output, pass depends_on with the prerequisite task ids. The studio will not
  start it until every prerequisite is done (including owner sign-off), and the assignee is told which files to read.
  Create the prerequisite first so you have its id.
- Use mcp__studio__get_project_status to see tasks, results and pending approvals before planning further.
- Important decisions (scope changes, art direction choice, genre pivots, cutting features, anything costly or
  irreversible) must go to the owner with mcp__studio__request_approval. For tasks whose deliverable the owner must sign
  off, set requires_approval=true.
- You may edit docs/ yourself for small things (e.g. a vision statement), but delegate real production work.
- Do not create duplicate tasks for work that is already queued or in progress.
- Keep replies to the owner short: what you decided, which tasks you created for whom, and what needs their input.

${WORKSPACE_LAYOUT}

${projectContext(project, milestones)}`;
}

export function directorReviewPrompt(task: Task, report: string, files: string[], citation?: CitationCheck | null) {
  return `REVIEW REQUEST — a deliverable is ready for your review.

Task ${task.id}: ${task.title}
Assignee: ${AGENTS[task.assignee].name} (${AGENTS[task.assignee].title})
Revision: ${task.revisionCount}

Task description:
${task.description}

Agent report:
${report || '(no report)'}

Files created or changed:
${files.length ? files.map((f) => `- ${f}`).join('\n') : '- (none detected)'}

${
  citation
    ? `AUTOMATIC CITATION CHECK (computed by the studio from the run's knowledge usage — trusted):
Status: ${citation.status}. ${citation.summary}${citation.invalid.length ? `\nInvalid: ${citation.invalid.map((x) => `[K:${x.ref}] — ${x.reason}`).join('; ')}` : ''}
${citation.status === 'missing' || citation.status === 'invalid' ? 'This check FAILED: you must request a revision and list the missing/invalid citations (the studio enforces this).' : 'Also check that cited references actually support the claims they are attached to.'}

`
    : ''
}Review the actual files with Read/Glob/Grep; never rely on the agent report alone. Check every acceptance criterion
in the task description against the files, one by one, and verify that numbers, file paths and cross-references the
deliverable claims are actually true (e.g. referenced files exist, totals add up, code matches what the report says).

Then call mcp__studio__review_task exactly once:
- "revise" if any stated acceptance criterion is not met or a claim in the deliverable is false. List each failed
  criterion with the file/section and the concrete change required.
- "approve" only if every acceptance criterion is met. Minor polish may be noted in the feedback without blocking.

Do not create new tasks during a review unless follow-up work is clearly required. Finish with a one-line summary.`;
}
