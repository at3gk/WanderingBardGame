# ROADMAP

One task per run, in order. Reprioritize/cut freely (log cuts in DESIGN.md's
changelog) but don't skip ahead — each task assumes the previous ones landed.

1. **Scaffold.** Vite + Phaser 3 + TypeScript + Vitest project. `vite.config`
   base set to `/WanderingBardGame/`. Empty Phaser scene that boots to a
   blank canvas. `npm test && npm run build` green. Confirm CI/deploy
   workflows pick it up and the Pages URL is live (even if blank).
2. **Beat timing core.** Pure TS module (no Phaser/DOM) implementing beat
   spawn scheduling, scroll-to-hit-line timing, hit-window checking, and
   song-meter fill/drain math. Fully covered by Vitest — this is the one
   core mechanic's logic, get it right and tested before it touches
   rendering.
3. **Render the lane.** Phaser scene renders the single beat lane using
   the timing core from task 2. Wire up tap/click/keyboard input to call
   the hit-check function. Visual hit/miss feedback (simple, no polish).
4. **Song meter UI.** On-screen meter reflecting the fill/drain state from
   the timing core. Walking-vs-stopped state derived from meter threshold,
   exposed as a value the next tasks can read (no bard sprite yet).
5. **Bard sprite states.** Placeholder bard sprite (procedural/CC0) with
   walk and idle animations, switching based on the walking-vs-stopped
   state from task 4.
6. **Scrolling road.** Background scroll speed tied to walking state.
   Single biome backdrop for now.
7. **Procedural audio base layer.** Web Audio-generated (or CC0 sample)
   backing loop tied to the beat tempo, playing continuously as the base
   layer. Keep all audio behind one manifest file per CLAUDE.md.
8. **Audio layering.** Additional instrument/voice layers fade in as song
   meter rises past thresholds, fade out as it falls — the audio becomes
   the primary feedback for how well the player is doing.
9. ~~**Second biome + transition.**~~ Done (Run 9): distance-traveled
   counter drives a crossfade to a second "Forest Dusk" scenery biome.
10. ~~**Consolidation pass.**~~ Done (Run 10): no vision drift found; fixed
    one visual rough edge (hit-line indicator overlapped the bard's head —
    see STATE.md). Bundle size and mobile touch input re-verified green.
11. ~~**Coin readout.**~~ Done (Run 11): coins accrue continuously at a rate
    scaled by the live song-meter ratio, displayed via a procedural coin
    icon + count in the top-right corner. No drain, no shop, no spend loop
    — a pure readout.
12. ~~**v0.1 ship check.**~~ Done (Run 12): every DoD item in DESIGN.md
    verified against a real production build (`npm run build` + `vite
    preview`, live Pages URL unreachable from the sandbox — see STATE.md).
    All met, nothing to cut. The `v0.1` git tag itself is **blocked on
    human** — this environment's git/GitHub write access can't push a tag
    (see STATE.md's Blocked on human section for the exact command a human
    needs to run).
13. ~~**(Post-v0.1) Unbounded beat schedule.**~~ Done (Run 13): the beat
    schedule now generates in 300-beat batches, appending the next batch
    once the current one's runway drops under 15s (`RoadScene.
    appendBeatBatch`, called from `update`). `AudioEngine` gained a
    matching `extend` method so the backing loop's notes keep pace with
    the visual schedule instead of going silent after ~3 min. Resolved
    markers are now filtered out of `RoadScene.markers` each frame so a
    long/unbounded session doesn't accumulate unbounded memory. Not
    required for v0.1's Definition of Done (v0.1 already shipped); this
    closes the "endless road" gap flagged in DESIGN.md's Run 10 changelog
    entry.

14. **(Post-v0.1) Human playtest pass.** Every eyeballed constant logged
    under STATE.md's "Needs human playtest" section (hit window, meter
    gain/drain, bard walk-cycle timing, road scroll speed, audio timbre
    and layering thresholds, biome transition distance, coin rate) is
    still untuned by ear/feel on a real device. Once a human has a chance
    to actually play it, fold their feedback into concrete constant
    changes here instead of leaving the list to grow indefinitely.
    **Blocked on human** (see STATE.md) — no autonomous run can execute
    this, so runs skip past it to the next actionable task until a human
    plays the build.
15. ~~**(Post-v0.1) Third biome + generalized transitions.**~~ Done
    (Run 14): DESIGN.md's Concept names three vignettes but only two
    biomes existed. `src/core/biome.ts`'s `biomeBlendRatio` (hardcoded to
    exactly 2 biomes) is now `biomeBlendAt`, which walks an array of
    `BiomeTransition` entries to support any number of biomes; added
    "Riverside Camp" as the third. `RoadScene` swaps its two TileSprite
    textures dynamically as the blended pair changes over a walk instead
    of being hardcoded to `BIOMES[0]`/`BIOMES[1]`. Folds into task 14's
    playtest scope rather than being separately tracked.
16. ~~**(Post-v0.1) Per-biome base-loop pattern.**~~ Done (Run 15):
    DESIGN.md's core-mechanic section names "tempo/pattern variety... as
    the road changes scenery" as the mechanic's only depth, but the base
    loop played the exact same 4-note pattern for the entire walk. Added
    `LoopLayer.patternByBiome` (manifest.ts) so the base loop's melody now
    differs per biome (village/forest/riverside each get their own
    4-semitone pattern); `AudioEngine.start`/`extend` take a `biomeId` and
    resolve the pattern for whichever biome is current when a batch is
    scheduled. Deliberately scoped to the base loop only (not tempo, not
    the harmony/sparkle layers) — changing BPM mid-walk risks desyncing
    the beat schedule and audio clock, and is its own task if wanted
    later. See STATE.md for the batch-boundary quantization caveat.
17. ~~**(Post-v0.1) Tighten batch-boundary quantization.**~~ Done (Run 16):
    task 16 noted that a per-biome pattern switch only takes effect at the
    next beat-batch boundary, and the batch size at the time (300 beats,
    ~187s at 96 BPM) made that lag as long as a full walk's first
    transition. Shrunk `RoadScene.BEAT_BATCH_SIZE` from 300 to 32 (~20s),
    comfortably above `BEAT_LOOKAHEAD_MS` (15s) so batches still don't
    thrash, but short enough that a pattern switch now lands within ~20s
    of the visual crossfade instead of up to ~187s. Doesn't eliminate the
    caveat (still a step-change at the nearest boundary, not sample-exact
    with the crossfade) — that would mean rescheduling in-flight notes,
    real synchronization work out of scope here — just shrinks its worst
    case by roughly 9x. Pure constant change, no new logic; existing tests
    cover the batching math generically (no test was pinned to the old
    batch size).
18. ~~**(Post-v0.1) Per-biome patterns for harmony/sparkle layers.**~~ Done
    (Run 17): task 16 gave only `baseLoop` a `patternByBiome` override,
    leaving `harmony`/`sparkle` unchanged even though the resolve/schedule
    plumbing was already generic per-layer. Added forest/riverside
    overrides to both, each layer's own pattern shifted by the same
    per-beat diff `baseLoop` already uses for that biome, so all three
    layers move together at a transition instead of just the melody.
    Manifest data + a consistency test only, no logic changes.
19. ~~**(Post-v0.1) Fix the persistent favicon 404.**~~ Done (Run 18): every
    single headless verification note since Run 1 has carried the same
    caveat — "no console errors beyond the expected missing-favicon 404."
    `index.html` had no `<link rel="icon">` at all, so the browser always
    requested `/favicon.ico` and always missed. Added an inline SVG data-URI
    favicon (a small bard-body-colored dot on the game's background color,
    no new asset file) so the console is actually clean, not just
    clean-with-an-asterisk. Pure `index.html` change, no runtime code
    touched.

## Needs human playtest

- (tracked in STATE.md as items land)
