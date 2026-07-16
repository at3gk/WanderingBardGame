# STATE

Run counter: 5

## Current status
Run 4 complete. ROADMAP.md task 4 (song meter UI) done: `RoadScene` now
holds a `meter` value (starts at `songMeter.DEFAULT_SONG_METER_CONFIG.max`
so the game opens already walking, per the DoD "opens directly into the
walk") and applies `applyHit`/`applyMiss` from `core/songMeter.ts` at the
same two points task 3 already detected hit/miss (the `handleInput` hit
branch and the time-based miss detection in `update`). A meter bar
(track + fill rectangle, both repositioned/resized every frame from
`scale.width` like the hit line) renders top-center; fill width scales
with `meter/max` and its color swaps cream-vs-muted-slate depending on
the new `get walking()` accessor (wraps `isWalking` from the timing
core). `walking` is the exposed value future tasks (bard sprite, road
scroll) read — no bard sprite yet, per ROADMAP task 4 scope. `npm test
&& npm run build` green locally (16 Vitest tests, unchanged — this task
is Phaser wiring around already-tested pure functions, nothing new to
unit-test per CLAUDE.md's "Vitest for all headless logic"). Verified
manually with a headless Playwright check against `vite preview` at a
390×844 mobile viewport: meter bar renders full at load, and after ~4s
of no input (all beats missed) the fill visibly drains to empty with no
rendering errors at the zero-width edge case; only console message was
the expected missing-favicon 404 (see Run 1 note). Build output ~1.21 MB,
same single-chunk warning as prior runs, still well under the 5 MB
budget. Next run executes ROADMAP.md task 5 (bard sprite states: walk/idle
switching on the `RoadScene.walking` accessor this run added).

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

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
