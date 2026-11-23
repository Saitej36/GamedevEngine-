# Import bundle format (phase2-gamedev)

This folder holds **adapted** third-party material. Nothing here is loaded by the knowledge catalog. The server's
import endpoint copies it into quarantine; agents can use an item only after the owner approves it in the Knowledge
Library. All of it is treated as untrusted, community-derived reference data.

## Reference document (references/<id>.md)
- Plain Markdown, first line `# Title`, then an attribution block, then `##` sections (retrieval splits at `##`).
- Attribution block (required, exactly this shape):

```
> **Adapted reference — community source, not official documentation.**
> Source: <repo URL> @ <full commit> — <original path(s)>
> License: <SPDX> (see licenses/). Modified by Pixel Studio: <what changed, e.g. "re-targeted from UE 5.8 to UE 5.4; removed install/shell commands; condensed">.
> Engine target: <engine + baseline, or "engine-neutral">. Code is illustrative and has NOT been compiled or run.
```
- 600–1200 words, 5–9 `##` sections. Every `##` section must make sense on its own.
- Version adaptation: target ONLY the baselines (Unreal Engine 5.4, Unity 6 / 2022.3 LTS, Phaser 3.90). Remove
  features that do not exist on the baseline or say clearly "Not on 5.4 — added later" / "Unity 6 only". Where you
  cannot confirm an API on the baseline, write a line starting `Verify on <engine version>:`. Never present an
  upstream-version (UE 5.8, Unity 6.3, Phaser 4) claim as baseline fact.
- Remove every install, download, upload or shell instruction (npm/npx/pip/apt/brew/curl/wget/git clone/sudo/
  steamcmd/butler, `!`-injection). Agents have no shell. If a command is essential for a human (e.g. running engine
  tests), put it under a `## Commands for the human (not run by agents)` section and keep it to editor/engine CLI.
- No Godot/GDScript code; translate an idea to the target engine's language or describe it in prose.

## Skill supplement (supplements/<skill-id>.md)
- Extra guidance appended to an EXISTING Pixel Studio skill after owner approval. Same attribution block. Sections:
  `## Additional workflow steps`, `## Additional quality checks`, `## Additional failure conditions`.
- 250–600 words. Must not contradict the base skill, its role's write permissions or the no-shell rule.
