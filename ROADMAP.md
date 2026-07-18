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
10. **Consolidation pass.** Per CLAUDE.md drift control: mentally walk the
    full build, fix rough edges, re-check touch input on a real mobile
    viewport, confirm bundle size, update DESIGN.md if the game has
    drifted from vision. No new features this run.
11. **Coin readout.** Visual coin accumulation tied directly to song-meter
    performance (readout only — no shop, no spend loop).
12. **v0.1 ship check.** Verify every Definition of Done item in
    DESIGN.md against the live deploy. Fix or explicitly cut (with
    changelog entry) anything unmet. Tag this as v0.1.

## Needs human playtest

- (tracked in STATE.md as items land — nothing playable yet)
