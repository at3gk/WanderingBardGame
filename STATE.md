# STATE

Run counter: 4

## Current status
Run 3 complete. ROADMAP.md task 3 (render the lane) done: `RoadScene`
now generates a 300-beat schedule via `core/beats.ts` on create, renders
markers scrolling right-to-left toward a fixed hit line (position
recomputed from `scale.width/height` every frame so `Scale.RESIZE`
reflows cleanly), and spawns/despawns marker graphics lazily as they
enter/exit the travel window. Input is wired via `pointerdown` (covers
both touch and mouse) and `keydown-SPACE`, both routed through
`isWithinHitWindow` against the nearest unresolved beat; a hit tints the
marker green and flashes the hit line, a miss (via `isBeatMissed`,
checked every frame) tints the marker muted red — no meter/game-over
logic yet, that's task 4. `npm test && npm run build` green locally (16
Vitest tests, all still in `core/`, unchanged — Phaser scene code isn't
unit-tested per CLAUDE.md's "Vitest for all headless logic"). Verified
manually with a headless Playwright check against `vite preview` at a
390×844 mobile viewport: canvas renders, taps register hits/misses
visually (screenshot showed a resolved dark-red miss marker past the
line and cream unresolved markers approaching), only console message was
the expected missing-favicon 404 (see Run 1 note). Build output ~1.21 MB,
same single-chunk warning as Run 2, still well under the 5 MB budget.
Next run executes ROADMAP.md task 4 (song meter UI: on-screen meter
reflecting `core/songMeter.ts` fill/drain, wired to the hit/miss events
RoadScene now produces).

## Recent runs
- Run 0 (2026-07-15): Wrote DESIGN.md (concept: single-lane rhythm-tap
  mechanic keeps a wandering bard walking down a procedurally-sequenced
  road; cozy, no-fail tone) and ROADMAP.md (12 tasks to v0.1, one per
  run). No code written per vision-run instructions in CLAUDE.md.
- Run 1 (2026-07-15): Scaffolded the project — `package.json` (phaser,
  vite, typescript, vitest), `vite.config.ts` (base `/WanderingBardGame/`),
  `tsconfig.json`, `index.html`, `src/main.ts` booting a `Phaser.Game`
  with one empty `RoadScene`, and a sanity Vitest test. Verified with a
  headless Playwright smoke check against `vite preview`: canvas renders,
  no console errors (aside from an expected missing-favicon 404).
  PR #1 (Run 0) had merged onto `main` by this run despite the branch-
  protection blocker logged below — the code and STATE.md disagreed, so
  the blocker note is now cleared per CLAUDE.md ("trust the code").
  Re-verify next run whether new PRs still hit that 405; re-log under
  **Blocked on human** if it recurs.
- Run 2 (2026-07-16): Added the beat timing core per ROADMAP task 2 (see
  Current status above). No Phaser/rendering work this run — deliberately
  scoped to the pure-logic module so the one core mechanic is right and
  tested before it touches a scene.
- Run 3 (2026-07-16): Rendered the lane per ROADMAP task 3 (see Current
  status above). Deliberately left the song meter out of this run — task
  3 is scoped to rendering + input + per-beat hit/miss feedback only,
  the meter is task 4.

## Needs human playtest
- Task 3 render/input (this run): tap-to-hit feel — is `HIT_WINDOW_MS =
  120` too strict/loose, is `TRAVEL_TIME_MS = 1800` at `BPM = 96` a
  comfortable read on a real touch device? These are eyeballed constants,
  not derived from anything; a human playtest is the only way to tune
  them, and neither blocks task 4 (the meter reads hit/miss state, not
  the timing constants).

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
