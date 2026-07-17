# STATE

Run counter: 7

## Current status
Run 6 complete. ROADMAP.md task 6 (scrolling road) done: `RoadScene` now
generates a small procedural ground tile once via `this.make.graphics(...)
.generateTexture(...)` (a dark band with a lighter dash — no image assets,
per CLAUDE.md) and renders it as a `Phaser.GameObjects.TileSprite` sitting
just below the bard's feet, resized/repositioned every frame from
`scale.width` and `laneY` like every other element in the scene. It's
added first in `create()`, before the hit line/meter/bard, so it paints
behind everything. `update()` now takes Phaser's `(_time, delta)` params
(previously ignored) and `updateRoad` advances `tilePositionX` by
`ROAD_SCROLL_PX_PER_SEC * delta / 1000` only while the existing `walking`
accessor is true — idle freezes the band in place, same state-gating
pattern as the bard's animation swap from task 5. Single flat band, no
parallax/biome art yet (that's task 9's "second biome" and the
consolidation pass). No new pure logic to Vitest here (the scroll math is
a one-line delta accumulation, not a standalone module) — `npm test`
stays at 16 tests, green, consistent with how tasks 3/5 handled
Phaser-only additions. `npm run build` green, ~1.21 MB output, same
single-chunk warning, still under the 5 MB budget. Verified manually with
a headless Playwright check against `vite preview` at a 390×844 mobile
viewport: screenshotted before and after a tap-and-wait, and the ground
band's dash pattern visibly shifted between frames while the bard and
meter rendered correctly; no console errors beyond the expected
missing-favicon 404 (see Run 1 note). A pair of static screenshots can't
confirm scroll *smoothness*, so scroll-speed feel joins the **Needs human
playtest** list below. Next run executes ROADMAP.md task 7 (procedural
audio base layer, behind the audio manifest file).

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
- Run 6 (2026-07-17): Added the scrolling ground band per ROADMAP task 6
  (see Current status above). Deliberately kept it a single flat
  procedural band with no biome art/parallax — that's task 9's job once
  distance-traveled tracking exists.

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
- Task 6 scrolling road (this run): `ROAD_SCROLL_PX_PER_SEC = 90` is an
  eyeballed constant chosen to roughly match the bard's own walk-cycle
  cadence by eye in a screenshot diff, not measured against it. Needs a
  real device playtest to confirm the ground scroll speed actually reads
  as the same pace as the bard's legs, not faster/slower; doesn't block
  task 7 (audio layer is independent of scroll speed).

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
