# Procedural Generation: Seeds, Layouts and Validation

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/disciplines/procedural-gen/SKILL.md, skills/disciplines/procedural-gen/references/dungeon-generation.md, skills/disciplines/level-design/SKILL.md, skills/disciplines/level-design/references/pacing-and-flow.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: translated Python snippets to C# and prose; removed engine code for engines Pixel Studio does not target and all shell commands; added level-design gating ideas and notes for UE 5.4, Unity 6 / 2022.3 LTS and Phaser 3.90; condensed.
> Engine target: engine-neutral. Code is illustrative and has NOT been compiled or run.

## Own the randomness: one seed, derived sub-seeds

Determinism matters most: one seed reproduces one world, so bugs replay and players can share
seeds. Pass one seeded RNG into every function that makes a choice; the engine's global random
makes results depend on call order and unrelated systems.

Derive a child stream per system (layout, loot, decoration, chunk) so adding one decoration roll
does not reshuffle every later room. When seeds must survive engine updates (daily challenges,
seed-only saves), ship your own PRNG, because library generators may change between versions:

```csharp
public struct SplitMix64 {
    ulong state;
    public SplitMix64(ulong seed) { state = seed; }
    public ulong Next() {
        ulong z = state += 0x9E3779B97F4A7C15UL;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }
    public SplitMix64 Child() => new SplitMix64(Next()); // sub-seed for one system
}
```

Pin the first outputs in a test so a refactor cannot silently change every shared seed. Upstream
pins seed 0 to `0xE220A8397B1DCDAF, 0x6E789E6AA1B965F4, 0x06C45D188009454F`. For a bounded
integer, reject values above the largest multiple of `n` instead of plain modulo, which is biased.

## Weighted tables, bags and pity

A weighted pick sums relative weights, rolls in `[0, total)` and walks the cumulative sum; handle
the float edge where the roll equals the total. Pure rolls produce streaks (ten commons in a row).
For a guaranteed rate over a window use a **bag**: fill it in proportion to weights, shuffle, draw
without replacement, refill when empty. For rares use a **pity timer** that forces or boosts the
rare after N misses. Keep both on the seeded stream so drop sequences reproduce.

## Rooms, graphs and BSP

Generate into plain data (a grid of ints, a list of rooms, a room graph), separate from rendering,
so it can be tested without the engine.

- **Rooms and corridors:** place random rectangles with at least one tile of padding, reject
  overlaps, and connect them. Chaining each room to the previous one is readable but linear;
  connecting room centres with a minimum spanning tree and then adding a few extra edges for loops
  gives better flow. Cap placement attempts; "try until N rooms fit" can loop forever.
- **BSP:** split the longer axis recursively to a minimum size, one room per leaf, and connect
  siblings as the recursion unwinds. Good for building-like dungeons.
- **Room graph first:** for gated content, generate the graph (rooms, exits, what each exit needs,
  what each room grants) before geometry, validate it, then realise it as space.

## Drunkard's walk and cellular caves

A drunkard's walk starts a digger in the middle and takes random cardinal steps inside the border,
carving floor until a target fraction (about 0.45 of the map) is open. Cardinal steps keep the
carved floor 4-connected. Check that the target fits the carveable interior and give the walk a
step budget; when the budget runs out, report failure or retry with an explicit new seed rather
than accepting a partial cave.

Cellular automata smoothing turns noise into caverns: for 4 or so passes, a cell becomes wall when
5 or more of its 9-cell neighbourhood are walls. Smoothing can split regions, so re-check
connectivity after it.

## Wave function collapse overview

WFC (simple-tiled model) fills a grid so every neighbour pair obeys adjacency rules. Each cell
starts with every tile possible. Repeat: **observe** the undecided cell with the fewest options,
**collapse** it to one tile by weight, **propagate** by shrinking neighbours to tiles still
supported, until nothing changes. An empty cell is a contradiction: restart (with a capped restart
count) or backtrack.

- Author **symmetric** rules: if B may sit east of A, A must be allowed west of B. Contradictions
  on every run usually mean asymmetric rules.
- Sort candidate tiles before a weighted pick; unordered set iteration is not stable.
- Pre-collapse fixed cells (border walls, entrance) and propagate from them to steer layouts.
- Tile weights decide the overall mix. WFC guarantees local rules only, so run the same
  connectivity checks on its output.

## Validation and soft-lock checks

Validate every generated result, then reject and regenerate with a derived seed, or repair:

1. **Connectivity:** flood-fill from the spawn; every floor tile must be reached, or dig a tunnel
   to the nearest reached tile, or keep only the largest region.
2. **Safe spawn** (not in a hazard) and a **path to the exit** (A* over the grid).
3. **Key order, not just connectivity.** Search over states of (room, keys held): an exit opens
   only when its requirement is held, and a room's grant is added on entry. The goal must be
   reachable from the start. A flood fill passes a level whose key sits behind its own door; this
   search catches it.
4. **No dead-end traps:** from the landing room of every one-way drop, a save point or exit must
   still be reachable. Write two-way doors as two exits and drops as one.

## Seed sweeps as acceptance criteria

Tune with one seed fixed so each parameter change is visible, then sweep at least 200 seeds and
report the numbers:

| Check | Pass condition |
|---|---|
| Determinism | Generating the same seed twice gives identical output, also in a fresh process |
| Validity | Zero failures across all checks above |
| Variety | Distinct-map count (by hash) close to the seed count; a low number means the seed is not reaching the generator |
| Distribution | Min / median / max of floor ratio, room count, loot rarity within design ranges |

List failing seeds for replay, and ask a human to play a few named seeds and report broken, samey
or unfair maps with the seed.

## Engine notes

- **Unreal Engine 5.4:** `FRandomStream` is a seedable stream; keep one per system rather than
  using `FMath::Rand`. The PCG framework is a plugin; Verify on UE 5.4: its stability status
  before building production content on it.
- **Unity 6 / 2022.3 LTS:** use `new System.Random(seed)` or `Unity.Mathematics.Random` (non-zero
  `uint` seed) per system. Avoid `UnityEngine.Random.InitState` for generation: it reseeds the one
  global generator every other script also draws from. .NET documents that `System.Random` may
  change between major versions, so ship your own PRNG for long-lived seeds.
- **Phaser 3.90:** `new Phaser.Math.RandomDataGenerator([seedString])` is seedable and separate
  from the global `Phaser.Math.RND`. Verify on Phaser 3.90: `weightedPick` biases toward the start
  of the array rather than taking explicit weights, so implement a real weighted table yourself.
