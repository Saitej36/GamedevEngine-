# Save Systems: Schemas, Migration and Crash-Safe Writes

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/save-systems/SKILL.md, skills/disciplines/save-systems/references/versioning-and-migration.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: translated Python and engine snippets to C# and TypeScript; re-targeted storage notes from Unity 6.3 and UE 5.8 to Unity 6 / 2022.3 LTS and UE 5.4, added Phaser 3.90 web storage; removed shell, console and headless-test commands; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## What to save: data, not objects

A save is a snapshot of authoritative state that must survive crashes, restarts and patches.
Store ids, numbers, flags, positions, inventory as (id, count) pairs and the RNG seed plus
generator version. Rebuild objects from that data on load. Never serialize live engine objects,
references or scene paths: a rename or refactor then breaks every old save. **Recompute** derived
data (final stat tables from base plus modifiers, procedural maps from the seed); saving it
invites desync when a formula changes in a patch.

Keep an in-memory dictionary or plain struct as the canonical shape and (de)serialize at the
boundary, so migrations work on that neutral shape. Start with JSON (readable, diffable, easy to
migrate); move to binary only for size or speed you have measured.

## Run state versus profile state

Separate files by lifetime:

| File | Contents | Written when |
|---|---|---|
| Profile / meta | unlocks, meta-currency, statistics, achievements | on change, throttled |
| Settings | volume, bindings, accessibility toggles | on settings close |
| Run / slot | the current run or campaign position | checkpoints, level change, quit |

A crash or a corrupt run file must never wipe profile progress, and deleting a slot must not
touch settings. Permadeath games delete the run file on death but keep the profile.

## Versioned schemas and migration

Stamp an integer `version` in every save from the first release. On load: parse, read the
version (missing means the first shipped schema), **refuse newer** saves with a clear message,
migrate older ones step by step, validate, then apply.

```csharp
const int SaveVersion = 3;
static readonly Dictionary<int, Func<JObject, JObject>> Migrations = new() {
    [1] = d => { /* list of completed quests -> flags map */ return d; },
    [2] = d => { d["difficulty"] ??= "normal"; return d; }, // new field gets a default
};
JObject Upgrade(JObject d) {
    int v = (int?)d["version"] ?? 1;
    if (v > SaveVersion) throw new NewerSaveException(v);
    while (v < SaveVersion) { d = Migrations[v](d); v++; d["version"] = v; }
    return d;
}
```

Each migration is a pure function from version N to N+1. Additive changes insert a default;
renames move the value inside the migration (game code never reads both names); removals drop the
field. **Keep every migration forever**: deleting one strands every save of that version. Keep a
corpus of one real save per shipped version and load each through the chain after every schema
change.

**Load-time validation:** required keys and types present; numbers finite and in range (no NaN,
hp ≥ 0, indices in bounds); ids still exist in current content (drop or substitute removed items,
never crash); references resolve. On failure, log, try the backup, and tell the player rather than
silently loading a broken state.

## Atomic writes and backups

Writing in place corrupts the only save when the game crashes mid-write. Instead:

1. Write the full payload to `save.json.tmp` and close it, checking every error (disk full,
   read-only, no permission).
2. If `save.json` exists, move it to `save.json.bak`.
3. Rename the temp file to `save.json`.

The loader tries the primary, then `.bak`, which covers a crash between the renames. Same-volume
rename is atomic on POSIX; on Windows rely on the backup as well. Closing a file does not
guarantee it reached the disk, so a power cut right after saving can still lose the newest file.
Add a checksum of the payload to detect truncation (this is not anti-tamper). Rotate a small ring
of autosaves (autosave_0..2) so one bad autosave is not the only recent state.

## Slots and autosave

- Manual slots are separate files; the autosave has its own file and never overwrites a manual
  slot.
- Autosave only at safe boundaries (checkpoint, level change, menu open), never mid-combat or
  mid-transition, and throttle it (for example at most once a minute plus every checkpoint).
- Store slot metadata (timestamp, play time, location name, version) in a small header so the
  load menu does not parse every full save.
- Save to the per-user data folder, never next to the executable, which is often read-only and
  replaced by updates.
- Local saves are player-controlled; never treat them as the authority for multiplayer or economy
  state.

## Platform storage notes

- **Unreal Engine 5.4:** subclass `USaveGame` with `UPROPERTY` fields, then
  `UGameplayStatics::SaveGameToSlot` / `AsyncSaveGameToSlot` and `LoadGameFromSlot`;
  `DoesSaveGameExist` for the menu. Put an explicit int version field in your `USaveGame`
  subclass and migrate after load. The platform layer chooses the folder (on desktop, the
  project's Saved/SaveGames) and uses platform save APIs on consoles. Verify on UE 5.4: whether
  the platform writer is atomic; if unsure, keep a backup slot and write to it alternately.
- **Unity 6 / 2022.3 LTS:** write under `Application.persistentDataPath`; changing company or
  product name changes that folder. `JsonUtility` cannot serialize dictionaries; use Newtonsoft
  JSON if the project already includes it. .NET `File.Replace(tmp, path, bak)` performs the
  swap-with-backup in one call on desktop. Use `PlayerPrefs` only for small settings. On WebGL the
  path is backed by IndexedDB; Verify on your Unity version: whether an explicit sync is needed
  after writing.
- **Phaser 3.90 / web:** `localStorage` is synchronous, string-only and small (a few MB per
  origin), and `setItem` throws when quota is exceeded or storage is blocked; wrap every access in
  try/catch and degrade to "saving unavailable". Emulate atomic writes by writing to a new key and
  then updating a pointer key. Use IndexedDB for large saves. Storage is per origin, so a changed
  domain or port loses saves.
- **Steam Cloud and consoles:** cloud files sync after exit and before the next launch; quotas
  must be configured first; keep `.tmp` files out of the synced pattern. Consoles have
  certification rules; follow the platform documentation.

## Verification

- Round trip: save, save again (first becomes `.bak`), load and compare fields; then truncate the
  primary and confirm the loader falls back to `.bak`.
- A save stamped with a newer version is refused with a message, not half-loaded.
- Search the save code for serialized engine objects; there should be none.
- Ask a human to save mid-level, quit fully, relaunch, load, and report any difference in
  position, inventory, flags or quest state.
