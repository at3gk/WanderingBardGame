# STATE

Run counter: 8

## Current status
Run 7 complete. ROADMAP.md task 7 (procedural audio base layer) done:
`src/audio/manifest.ts` is the one audio manifest file per CLAUDE.md —
today it holds `AUDIO_MANIFEST.baseLoop` (waveform, a 4-note semitone
pattern off a root frequency, gain, note duration); task 8's extra layers
will extend this same file rather than adding a second one.
`src/audio/baseLoop.ts` is pure TS (no Web Audio/DOM) turning a manifest
layer into a concrete note schedule — it reuses `generateBeatSchedule`
from `core/beats.ts` directly so the audio grid and the visual beat lane
share one clock and can't drift apart; fully covered by Vitest (4 new
tests: semitone-to-frequency math, schedule timing, pattern cycling).
`src/audio/AudioEngine.ts` is the thin Web Audio wrapper: lazily creates
an `AudioContext` (must happen inside a user-gesture handler or browsers
block it), pre-schedules the whole bounded note sequence (same
`BEAT_COUNT` bound the visual lane already uses) as oscillator+gain-
envelope "pluck" notes on the context's own sample-accurate clock —
no JS-side lookahead scheduler needed at this length. `RoadScene.
handleInput` calls `audioEngine.start(BPM, BEAT_COUNT)` on the first tap/
keypress (the engine no-ops on repeat calls), so audio and the existing
tap-to-hit input share the same user gesture. No new runtime dependency
(Web Audio is a browser built-in). `npm test` now 20 tests, green.
`npm run build` green, ~1.21 MB output, still under the 5 MB budget.
Verified manually with a headless Playwright check against `vite preview`
at 390×844: tapped twice with a pause between, no console errors beyond
the expected missing-favicon 404 and the usual benign software-WebGL
warnings (see Run 1/6 notes); confirmed `AudioContext` is available in
the test browser. Playwright can't capture actual audio output, so
whether the base loop's timbre/pattern/volume actually sounds "cozy" and
in-time is a **Needs human playtest** item below — doesn't block task 8
(layering reads the same manifest/engine shape, not the tuning). Next run
executes ROADMAP.md task 8 (audio layering: additional instrument layers
fade in/out with the song meter).

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

## Blocked on human
- (none currently — see Run 1 note above on the previously-logged
  branch-protection blocker)
