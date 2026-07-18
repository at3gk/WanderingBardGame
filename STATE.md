# STATE

Run counter: 10

## Current status
Run 9 complete. ROADMAP.md task 9 (second biome + transition) done: a
distance-traveled counter now drives a crossfade from the village-dusk
scenery to a second "Forest Dusk" biome.
`src/core/distance.ts` is a new pure function, `accumulateDistance
(distancePx, walking, deltaMs, speedPxPerSec)` — per the task's own
scoping note ("derived from walking state, not a new system") it just
integrates the same `ROAD_SCROLL_PX_PER_SEC` the road already scrolls
at, only while `walking` is true, holding still otherwise. 4 new tests.
`src/core/biome.ts` holds the two-biome data (`BIOMES`: `village`/
`Village Dusk` — the existing palette — and `forest`/`Forest Dusk`, a
cooler mossy-green palette) plus the pure `biomeBlendRatio(distancePx,
transitionStartPx, transitionLengthPx)`, a clamped 0→1 linear ramp
across a transition band so the scenery fades rather than cuts. 6 new
tests (before/at-start/mid/at-end/beyond/zero-length-band). Same pure-
core/thin-wrapper split as the audio and beat-timing modules.
`RoadScene` now tracks `distancePx`, computes `biomeBlendRatio` every
frame, and uses it two places: `cameras.main.setBackgroundColor` lerps
between the two biomes' sky colors (new `RoadScene.lerpColor` — a small
per-channel RGB blend, rendering-only so not pulled into core), and a
second ground `TileSprite` (`roadNext`, pre-generated with the forest
palette via the now-per-biome `roadTileTexture(biome)`) sits on top of
the original and fades its alpha in via the same ratio; both tile
sprites advance `tilePositionX` in lockstep so the dashes stay aligned
through the fade. Transition constants (`BIOME_TRANSITION_START_PX =
4000`, `_LENGTH_PX = 2000`) are eyeballed against `ROAD_SCROLL_PX_PER_SEC
= 90` (~44s to start, ~67s to fully resolve) — see playtest note below.
No new runtime dependency. `npm test` now 34 tests, green. `npm run
build` green, ~1.22 MB output, still under the 5 MB budget.
Verified manually with a headless Playwright check against `vite
preview` at 390×844: five taps plus ~4s of runtime, screenshot confirms
the scene still renders correctly (bard, road, meter, markers) with no
regression — no errors beyond the expected missing-favicon 404. Getting
distance past the ~44s transition start isn't practical in a quick smoke
check, so whether the crossfade timing/colors actually read as a mood
shift on a real device is a **Needs human playtest** item below; doesn't
block task 10 (consolidation pass doesn't depend on biome tuning). Next
run is task 10, the every-10th-run consolidation pass per CLAUDE.md's
drift control (run counter hits 10).

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
- Run 7 (2026-07-17): Added the procedural Web Audio base loop per
  ROADMAP task 7 (see Current status above). Deliberately kept it a
  single continuous layer with no meter-driven fading — that's task 8's
  scope once the base loop's shape is settled.
- Run 8 (2026-07-17): Added meter-driven audio layering per ROADMAP task
  8 (see Current status above). Deliberately kept it to two placeholder
  layers with eyeballed voicings/thresholds — tuning is a playtest item,
  not this run's scope.
- Run 9 (2026-07-18): Added the distance-driven second biome and
  crossfade per ROADMAP task 9 (see Current status above). Deliberately
  kept it to two biomes with a palette-only difference (sky + road
  colors) — no new scenery elements/parallax layers, that's beyond this
  task's scope and risks drift per CLAUDE.md.

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
- Task 7 audio base loop (this run): `AUDIO_MANIFEST.baseLoop` (root
  220 Hz, triangle wave, `[0, 0, 7, 5]` semitone pattern, gain 0.05,
  180 ms notes) is an eyeballed starting timbre/pattern, not tuned by
  ear against the "cozy" tone in DESIGN.md — headless checks can confirm
  the schedule math and that no console errors fire, not what it
  actually sounds like. Needs a real device/speaker playtest for volume
  level and whether the pattern feels intentional rather than random;
  doesn't block task 8 (layering fades additional layers in/out around
  this same base, independent of its exact notes).
- Task 8 audio layering (this run): the `harmony` (threshold 0.5) and
  `sparkle` (threshold 0.85) layer voicings/gains and the 0.6s crossfade
  duration are eyeballed, not tuned by ear — headless checks can confirm
  the threshold-crossing/gain-ramp logic fires without errors, not
  whether the layers sound cozy together or the crossfade timing feels
  natural on real speakers. Needs a real device/speaker playtest across
  a full walk (enough hits to actually cross both thresholds); doesn't
  block task 9 (biome transitions are independent of audio tuning).

- Task 9 second biome (this run): `BIOME_TRANSITION_START_PX = 4000` and
  `BIOME_TRANSITION_LENGTH_PX = 2000` (against `ROAD_SCROLL_PX_PER_SEC =
  90`, so ~44s in to start, ~67s to fully resolve) and the `Forest Dusk`
  palette (`skyColor 0x141f1c`, `roadBandColor 0x2f3a2f`, `roadDashColor
  0x3f4d3a`) are eyeballed, not tuned against real play — headless checks
  can confirm the blend-ratio math and that both tile sprites stay in
  lockstep, not whether the timing feels earned or the two palettes read
  as a genuine mood shift on a real screen. Needs a real device playtest
  across a full walk long enough to cross the transition band; doesn't
  block task 10 (the consolidation pass doesn't depend on biome tuning).

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
