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
    All met, nothing to cut. `v0.1` tag pushed to `main`'s squash-merge
    commit once this run's PR lands (see STATE.md for why it can't be
    pushed to the PR branch itself).
13. **(Post-v0.1) Unbounded beat schedule.** The beat schedule is currently
    a fixed 300-beat run generated once at scene start (~3 min at 96 BPM),
    not a literally endless road per DESIGN.md's Concept section. Extend
    `generateBeatSchedule`/`RoadScene` to keep generating beats as the
    player approaches the end of the current schedule. Not required for
    v0.1's Definition of Done; noted during the Run 10 consolidation pass
    to avoid it being forgotten.

## Needs human playtest

- (tracked in STATE.md as items land)
