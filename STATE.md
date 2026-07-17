# STATE

Run counter: 9

## Current status
Run 8 complete. ROADMAP.md task 8 (audio layering) done: additional
instrument voices now fade in/out as the song meter rises/falls, so the
backing track itself becomes feedback for how well the player is doing
(per DESIGN.md). `src/audio/manifest.ts`'s `AudioManifest` gained a
`layers: LoopLayer[]` array alongside the existing always-on `baseLoop`
— still the one manifest file per CLAUDE.md, just a richer shape as
promised in Run 7's note. Each `LoopLayer` can carry an optional
`meterThreshold` (0–1 fraction of the meter's max); `baseLoop` has none
(always on). Two placeholder layers: `harmony` (sine, octave-up
fifth/fourth pattern, threshold 0.5) and `sparkle` (triangle, two-
octaves-up pattern, threshold 0.85) — eyeballed voicings, not tuned by
ear yet (see playtest note below).
`src/audio/layering.ts` is a new pure function, `isLayerActive(meterRatio,
layer)`, extracted so the fade-in/out *rule* is Vitest-covered without
touching Web Audio — same pure-core/thin-wrapper split as `baseLoop.ts`/
`AudioEngine.ts`. 4 new tests (below/at/above threshold, no-threshold
default).
`src/audio/AudioEngine.ts` now schedules every layer (base + extras)
through its own `GainNode` instead of connecting straight to
`ctx.destination`; `setMeterRatio(ratio)` (called every frame from
`RoadScene.update`) checks `isLayerActive` per layer and, only on a
threshold crossing, ramps that layer's gain node to 0 or 1 over 0.6s via
`linearRampToValueAtTime` — a smooth crossfade, and cheap to call every
frame since it no-ops unless the active/inactive state actually flips.
Base-loop scheduling and note-envelope logic are unchanged, so tuning
work from Run 7 isn't disturbed. No new runtime dependency (still plain
Web Audio). `npm test` now 24 tests, green. `npm run build` green,
~1.22 MB output, still under the 5 MB budget.
Verified manually with a headless Playwright check against `vite
preview` at 390×844: three taps spanning past both a 0.5 and 0.85 meter
crossing (given `DEFAULT_SONG_METER_CONFIG.hitGain = 8` this needs many
more hits than 3 taps to actually cross 0.85 in-game, so this smoke test
only confirms no console errors during the fade-check code path, not
that a crossing was exercised) — no errors beyond the expected missing-
favicon 404. Playwright can't capture actual audio output, so whether
the two layers sound intentional together and the 0.6s crossfade timing
feels right is a **Needs human playtest** item below — doesn't block
task 9 (biome transition is independent of audio layer tuning). Next run
executes ROADMAP.md task 9 (second biome + transition on distance
traveled).

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

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
