# STATE

Run counter: 6

## Current status
Run 5 complete. ROADMAP.md task 5 (bard sprite states) done: `RoadScene`
now draws a placeholder bard as a `Phaser.GameObjects.Container` built
from primitives (two leg rectangles, a body rectangle, a head circle —
no image assets, consistent with every other visual in the scene so far)
positioned below the beat lane and repositioned every frame from
`scale.width/height` like the hit line and meter bar. `setBardAnimState`
swaps between two Phaser tween sets keyed off the existing `walking`
accessor (from task 4, itself wrapping `songMeter.isWalking`): walking
swings both legs opposite-phase and pulses `scaleY` for a bounce; idle
stops the legs and runs a slow `scaleX`/`scaleY` breathing pulse instead.
`update()` only calls `setBardAnimState` on an actual walking-state
transition (tracked via `bardWasWalking`), not every frame, so the
tweens aren't restarted 60x/sec. `npm test && npm run build` green
locally (16 Vitest tests, unchanged — this is Phaser/tween wiring around
the already-tested `walking` boolean, nothing new to unit-test per
CLAUDE.md's "Vitest for all headless logic"). Verified manually with a
headless Playwright check against `vite preview` at a 390×844 mobile
viewport: screenshotted the bard at load (walking, meter full) and again
after ~7s of no input (meter drained, `walking` false) — sprite renders
correctly both times with no console errors beyond the expected
missing-favicon 404 (see Run 1 note) and benign WebGL perf-warning spam.
A static screenshot can't confirm the tween motion itself, so leg-swing
smoothness stays a **Needs human playtest** item below. Build output
~1.21 MB, same single-chunk warning as prior runs, still well under the
5 MB budget. Next run executes ROADMAP.md task 6 (scrolling road:
background scroll speed tied to the same `walking` state).

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
- Run 4 (2026-07-16): Added the song meter UI per ROADMAP task 4 (see
  Current status above). Deliberately left the bard sprite out of this
  run — task 4 is scoped to the meter and the exposed `walking` state
  only, the sprite is task 5.
- Run 5 (2026-07-16): Added the placeholder bard sprite and walk/idle
  animation per ROADMAP task 5 (see Current status above). Deliberately
  left the road static — no scrolling background yet, task 6's scope.

## Needs human playtest
- Task 3 render/input: tap-to-hit feel — is `HIT_WINDOW_MS = 120` too
  strict/loose, is `TRAVEL_TIME_MS = 1800` at `BPM = 96` a comfortable
  read on a real touch device? These are eyeballed constants, not
  derived from anything; a human playtest is the only way to tune them.
- Task 4 song meter (this run): `DEFAULT_SONG_METER_CONFIG` (hitGain 8,
  missDrain 14, walkingThreshold 40, max 100) is also eyeballed — drains
  roughly 3 consecutive misses to stop walking from a full meter, refills
  in ~5 hits from empty. Whether that feels forgiving enough for the
  "cozy, no-fail" tone in DESIGN.md needs a real playtest; doesn't block
  task 5 (the sprite reads the boolean `walking` state, not the tuning).
- Task 5 bard sprite (this run): leg-swing amplitude/speed
  (`BARD_WALK_SWING_DEG = 20`, `BARD_WALK_STEP_MS = 260`) and the idle
  breathing pulse (`BARD_IDLE_BREATH_MS = 1400`) are eyeballed constants
  verified only via static screenshots, not real motion. Needs a real
  device playtest to check the walk cycle actually reads as "walking"
  and not jittery; doesn't block task 6 (road scroll reads `walking`,
  not these constants).

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
