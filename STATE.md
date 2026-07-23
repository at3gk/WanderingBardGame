# STATE

Run counter: 27

## Current status
Run 26 complete — added `touch-action: none` plus `user-select`/
`-webkit-touch-callout: none` to `#game` in `index.html`, a new ROADMAP
task 26. ROADMAP task 14 (human playtest pass) is still blocked on an
actual human — see Blocked on human below; no other queued task was
actionable so this run added a new one, same as Runs 19, 21, 22, 23, 24,
and 25.

Re-read `index.html`: the viewport meta tag has `user-scalable=no`, but
that flag alone doesn't reliably stop pinch-zoom or double-tap-zoom on
modern mobile Safari (Apple loosened it for accessibility years ago), and
nothing else guarded against it. This game's entire input model is rapid
single/double taps in the same spot (ROADMAP task 3) — exactly the
gesture mobile browsers key off of for double-tap-zoom, and a long tap is
also what triggers the text-selection callout menu. Neither is a "feel"
question like the items below; it's a standard, documented mobile-web
fix (the same class of gap as task 25's touch-target padding), so it
didn't need to wait on task 14.

- Added `touch-action: none`, `-webkit-touch-callout: none`,
  `-webkit-user-select: none`, `user-select: none` to the `#game` div's
  CSS in `index.html`. No JS changes — Phaser's pointer/touch handling
  goes through its own event listeners, not the browser gestures being
  suppressed here.

Verified: `npm test` (52 tests green, unchanged — CSS-only change, no
logic touched). `npm run build` (green, bundle ~1.22 MB, unchanged).
Headless Playwright check (iPhone 12 emulation) against the built `vite
preview` output: confirmed `getComputedStyle(#game).touchAction` is
`"none"` and `userSelect` is `"none"`; sent 6 taps at the 625ms beat
cadence at the same point (the classic double-tap-zoom trigger) and
confirmed `visualViewport.scale` stayed `1` and `window.scrollY` stayed
`0` throughout; screenshot after the taps shows the meter high, coins
accrued, and the bard mid-stride — ordinary tap input still reaches the
game unaffected. Zero console errors, zero failed/4xx+ requests.

## Previous status (Run 25)
Run 25 complete — padded the mute icon's touch target so its interactive
hit area (previously ~20px, matching the icon's visual size) meets the
44x44 CSS px minimum WCAG 2.5.5 and Apple's HIG call for. Added a 44x44
`Phaser.GameObjects.Zone` as the actual tap target; the icon itself is
visually unchanged. `npm test` 52 tests green (unchanged), build green.
Headless Playwright confirmed a tap 16px off-center now toggles mute
while a tap further out still registers as an ordinary beat input.

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
  tested before it touches rendering.
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
  8. Deliberately kept it to two placeholder layers with eyeballed
  voicings/thresholds — tuning is a playtest item, not this run's scope.
- Run 9 (2026-07-18): Added the distance-driven second biome and
  crossfade per ROADMAP task 9 (`src/core/distance.ts`,
  `src/core/biome.ts`, both pure/tested; `RoadScene` crossfades sky color
  and a second road `TileSprite` via `biomeBlendRatio`). Deliberately
  kept it to two biomes with a palette-only difference (sky + road
  colors) — no new scenery elements/parallax layers, that's beyond this
  task's scope and risks drift per CLAUDE.md. `npm test` 34 tests green,
  build green (~1.22 MB). Transition timing/palette flagged for human
  playtest (see below).
- Run 10 (2026-07-18): Consolidation pass (see Current status above).
  Fixed the hit-line/bard-head overlap; no other changes. Next run
  resumes feature work at task 11.
- Run 11 (2026-07-18): Added the coin readout per ROADMAP task 11 (see
  Current status above). Deliberately kept it a pure accumulate-only
  readout of the meter ratio — no per-hit bonus, no spend loop, matching
  DESIGN.md's framing of coins as a readout, not a separate system.
- Run 12 (2026-07-19): v0.1 ship check per ROADMAP task 12. No code
  changes — verified every DoD item against a real production build,
  found nothing unmet. `v0.1` tag pending the squash-merge landing on
  `main` (see Blocked on human below for why).
- Run 13 (2026-07-19): Unbounded beat schedule per ROADMAP task 13.
  `RoadScene.appendBeatBatch` generates another 300-beat batch once the
  current one's runway drops under 15s; `AudioEngine.extend` mirrors this
  on the audio side so the backing loop never runs out of scheduled notes.
  Resolved markers are now filtered out of `RoadScene.markers` each frame
  instead of accumulating forever. `npm test` 41 tests green (2 new),
  build green.
- Run 14 (2026-07-19): Third biome + generalized N-biome transitions per
  ROADMAP task 15. DESIGN.md's Concept names three vignettes but only two
  biomes existed; `biomeBlendRatio` (hardcoded to 2 biomes) became
  `biomeBlendAt`, which walks a `BiomeTransition[]` array to support any
  number of biomes. Added "Riverside Camp" as the third. ROADMAP task 14
  (human playtest pass) was next in line but needs an actual human;
  logged as blocked and this run's slot went to the biome work instead.
  `npm test` 44 tests green (5 new), build green.
- Run 15 (2026-07-20): Per-biome base-loop melodic pattern per ROADMAP
  task 16. Added `LoopLayer.patternByBiome` (manifest.ts) so the base
  loop's melody now differs per biome (village/forest/riverside each get
  their own 4-semitone pattern); `AudioEngine.start`/`extend` take a
  `biomeId` and resolve the pattern for whichever biome is current when a
  batch is scheduled. Deliberately scoped to the base loop only (not
  tempo, not the harmony/sparkle layers). Noted a batch-boundary
  quantization caveat (pattern switch lags the visual crossfade by up to
  a full batch) — became task 17. `npm test` 49 tests green (5 new),
  build green.
- Run 16 (2026-07-20): Tightened the batch-boundary quantization flagged
  by Run 15, per new ROADMAP task 17. Shrunk `RoadScene.BEAT_BATCH_SIZE`
  from 300 to 32 — pure constant tuning, no new logic — cutting the
  worst-case lag between a biome's visual crossfade and its audio pattern
  switch from ~187s to ~20s. Deliberately didn't attempt sample-exact sync
  (rescheduling in-flight notes mid-batch); that's real synchronization
  work and its own task if wanted. `npm test` 49 tests green (unchanged),
  build green.
- Run 17 (2026-07-20): Per-biome patterns for the `harmony`/`sparkle`
  layers per new ROADMAP task 18. Task 16 had scoped biome patterns to
  `baseLoop` only; the resolve/schedule plumbing was already
  layer-generic, so this run was manifest data (each layer's biome
  override = its own pattern + the same diff `baseLoop` uses for that
  biome) plus a consistency test, no logic changes. `npm test` 52 tests
  green (3 new), build green.
- Run 18 (2026-07-21): Fixed the persistent favicon 404 per new ROADMAP
  task 19. Every headless verification note since Run 1 carried the same
  "expected missing-favicon 404" caveat; added an inline SVG data-URI
  favicon to `index.html` (no new asset file) so it's actually gone. Also
  trimmed the old Run 12 verbose "Previous status" writeup from this file
  (its content is fully captured in this Recent runs bullet already) to
  keep STATE.md from growing unbounded — not a full consolidation pass,
  just routine hygiene. `npm test` 52 tests green (unchanged), build
  green.
- Run 19 (2026-07-21): Mute toggle per new ROADMAP task 20 (see Previous
  status above). `AudioEngine` gained a shared `masterGain` node all
  layers route through plus `setMuted`/`isMuted`; `RoadScene` added a
  small interactive icon (top-left) that toggles it, excluded from
  beat-hit handling via Phaser's `currentlyOver` pointerdown list. No
  prior queued task was actionable (task 14 still blocked), so this run
  added a new one rather than stalling.
- Run 20 (2026-07-21): Consolidation pass (see Previous status above). No
  vision drift or code rough edges found after a full read-through; fixed
  a chronological-ordering bug in this file's own Recent runs log and
  trimmed five redundant "Previous status" write-ups (Runs 13–18) that
  fully duplicated their own Recent runs bullets. No code changes.
- Run 21 (2026-07-22): Distance-walked readout per new ROADMAP task 21
  (see Previous status above). `RoadScene.updateDistanceReadout()` shows
  `distancePx` converted to "N steps" (via `ROAD_TILE_WIDTH`) bottom-left —
  DESIGN.md names distance as a readout alongside coins/scenery, but
  nothing had surfaced it to the player since Run 9. Pure rendering, no
  new core module, no new dependency. `npm test` 52 tests green
  (unchanged), build green.
- Run 22 (2026-07-22): First-tap onboarding hint per new ROADMAP task 22
  (see Previous status above). A small "tap to the beat" text above the
  hit line, shown from scene start and faded out 400ms after the
  player's first input (hit or miss). Considered and ruled out clamping
  per-frame `delta` for backgrounded-tab catch-up first — Phaser's
  `TimeStep.smoothDelta` already handles that by default. Pure rendering,
  no new core module, no new dependency. `npm test` 52 tests green
  (unchanged), build green.
- Run 23 (2026-07-22): Resume audio after tab backgrounding per new
  ROADMAP task 23 (see Previous status above). `AudioEngine.resume()`
  re-resumes a suspended `AudioContext`; `RoadScene` calls it from a
  `document.visibilitychange` listener so a backgrounded-then-returned
  tab doesn't stay silent for the rest of the session. Pure correctness
  fix, no new core module, no new dependency. `npm test` 52 tests green
  (unchanged), build green.
- Run 24 (2026-07-23): Captured the Space key per new ROADMAP task 24 (see
  Previous status above). `keydown-SPACE` triggered `handleInput()` but was
  never captured, so the browser's default Space action (page scroll)
  fired alongside every keyboard beat hit. Added
  `this.input.keyboard.addCapture('SPACE')`. One-line fix, no new
  dependency. `npm test` 52 tests green (unchanged), build green.
- Run 25 (2026-07-23): Padded the mute icon's touch target per new ROADMAP
  task 25 (see Previous status above). The icon's interactive hit area
  matched its 20px visual size, well under the 44x44 CSS px minimum both
  WCAG 2.5.5 and Apple's HIG call for — a measurable gap, not a feel
  question, so it didn't need to wait on task 14. Added a 44x44
  `Phaser.GameObjects.Zone` as the actual tap target; the icon itself is
  visually unchanged. `npm test` 52 tests green (unchanged), build green.
- Run 26 (2026-07-23): Locked down mobile tap-gesture CSS on `#game` per
  new ROADMAP task 26 (see Current status above). `user-scalable=no`
  alone doesn't reliably block pinch/double-tap-zoom on modern mobile
  Safari, and this game's whole input model is rapid same-spot taps —
  exactly what triggers it, plus the long-press text-selection callout.
  Added `touch-action: none` and the `user-select`/`-webkit-touch-callout`
  trio; no JS changes, Phaser's own pointer handling is unaffected.
  `npm test` 52 tests green (unchanged), build green.

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

- Task 11 coin readout (this run): `COIN_RATE_PER_SEC = 5` (at full meter)
  is an eyeballed constant, not tuned against how satisfying the count-up
  feels over a real walk length — headless checks can confirm the accrual
  math, not the pacing. Needs a real playtest to judge whether the number
  climbs at a pleasing rate or feels too slow/fast to notice; doesn't
  block task 12 (the ship check verifies DoD items, none of which specify
  coin pacing).

- Task 13 unbounded beat schedule (this run): `BEAT_BATCH_SIZE = 300` and
  `BEAT_LOOKAHEAD_MS = 15000` are eyeballed — the lookahead just needs to
  be comfortably larger than one frame, which it is, but nobody has
  actually played across a real batch boundary (~172s in) to confirm the
  transition is inaudible/invisible on real hardware (a dropped audio
  frame or a visible marker pop-in would be a real bug, not just a feel
  issue). Needs a real device playtest of a session longer than ~3
  minutes; doesn't block anything since v0.1 already shipped and no other
  task depends on schedule length.

- Task 15 third biome (this run): Riverside Camp's palette and the second
  transition's position/length (`9000`–`11000` px, matching the first
  transition's shape) are eyeballed, same caveat as task 9's original
  transition — headless checks confirm the blend math and that the scene
  visibly resolves to the right palette after two consecutive transitions,
  not whether the pacing (two ~44s-apart mood shifts over one walk) feels
  right, or whether Riverside Camp's blue-teal palette reads as distinct
  enough from Forest Dusk's green on a real screen. Rolls into task 14
  (human playtest pass) rather than being a separate item.

- Task 16 per-biome base-loop pattern (this run): the `forest`
  (`[0, 3, 7, 3]`) and `riverside` (`[0, 5, 9, 5]`) patterns are eyeballed
  variations on the original `village` pattern, not composed/tuned by
  ear — headless checks confirm the right pattern is scheduled for the
  right biome, not whether the melodic difference actually reads as a
  mood shift on real speakers. Also needs a real-device check of the
  known batch-boundary quantization (see Recent runs above): does the
  pattern's step-change at a batch boundary land close enough to the
  visual crossfade to feel connected, or far enough off to feel like an
  unrelated glitch? Doesn't block anything — v0.1 already shipped and no
  other task depends on pattern tuning. **Update (Run 16, ROADMAP task
  17)**: the worst-case lag is now ~20s instead of up to ~187s (batch size
  shrunk 300 → 32), but the underlying question — does a ~20s-late step
  still read as connected or as a glitch — is unchanged and still needs a
  real playtest to answer. **Update (Run 17, ROADMAP task 18)**: the
  `harmony`/`sparkle` layers now shift per biome too (same diff as
  `baseLoop`), not just the base melody — same "eyeballed, not tuned by
  ear" caveat applies to the two new diff vectors, and whether three
  layers moving together reads as a stronger/clearer mood shift than one
  layer alone is itself still a feel question for the same playtest.

- Task 20 mute toggle (this run): the icon's size (`MUTE_ICON_RADIUS = 10`,
  20px touch target) and top-left placement are eyeballed, not checked
  against real thumb ergonomics on a real phone — headless Playwright
  confirms it's tappable and toggles correctly at the coordinates it's
  drawn at, not whether it's comfortably reachable/discoverable one-handed.
  Doesn't block anything — muting is off by default and every other
  mechanic is unaffected either way.

- Task 21 distance readout (this run): converting `distancePx` to "steps"
  via `ROAD_TILE_WIDTH` (64px/step) is an eyeballed choice of unit, not
  tuned against how a real player perceives pace — headless checks confirm
  the readout updates and doesn't overlap other UI, not whether "N steps"
  climbing at that rate reads as a satisfying sense of progress or is
  ignored/too-fast/too-slow, the same class of question as task 11's coin
  rate. Doesn't block anything — it's a passive readout with no gameplay
  effect either way.

- Task 22 onboarding hint (this run): the wording ("tap to the beat"),
  15px size, and position (above the hit line) are eyeballed, not checked
  against real thumb/eye ergonomics on a phone — headless Playwright
  confirms it renders without overlap and fades on the first real tap, not
  whether a genuine first-time player actually reads it in time before the
  first beat marker arrives, or whether the wording itself is clear enough
  without also naming the tap-anywhere-on-screen behavior explicitly.
  Doesn't block anything — it's cosmetic onboarding with no effect on the
  underlying mechanic either way.

- Task 23 audio resume (this run): the fix wires a real, correct API
  (`AudioContext.resume()` on `visibilitychange`) and the headless smoke
  check confirms the wiring runs without error, but a headless single-tab
  Playwright browser has no way to make the OS/browser actually suspend
  the `AudioContext` the way a real backgrounded mobile tab does — the
  test simulates the *event*, not the underlying browser behavior it
  responds to. Needs a real mobile device playtest: background the tab
  mid-walk (switch apps, lock the screen) for a few seconds, return, and
  confirm the backing track is actually audible again rather than
  silently stuck off. Doesn't block anything else — the fix is additive
  and can't make backgrounding behave worse than before.

## Blocked on human
- **ROADMAP task 14 — human playtest pass** (Run 14): every item in this
  "Needs human playtest" section needs a real person actually playing the
  game on a real device/speakers to judge feel — there's no way to execute
  "does this feel cozy/comfortable/fun" headlessly. This run reprioritized
  around it (did task 15 instead, which was actionable) rather than
  blocking the whole run. Route: whenever a human next plays the build,
  fold their feedback into concrete constant changes and close this out;
  until then each new feature run keeps adding to the list above rather
  than the list ever getting tuned.
- **v0.1 git tag** (Run 12): ROADMAP task 12 says "Tag this as v0.1."
  DoD verification and the ship-check PR (#13) are done and merged
  (squash commit `021410f` on `main`), but the tag itself can't be pushed
  from this environment: the local git push proxy accepts pushes only to
  the designated `claude/*` working branch (a plain `git push origin
  v0.1` / `git push origin refs/tags/v0.1` both got HTTP 403), and the
  available GitHub MCP tools have no tag/ref-write call — only read-only
  `get_tag`/`list_tags`/`get_release_by_tag`/`get_latest_release`. Routing
  around it (e.g. faking a tag via `create_branch`) would be misleading,
  so this is left undone rather than faked. A human (or a future run with
  broader GitHub write scope) needs to run, from a clone with real push
  access:
  `git tag -a v0.1 021410f -m "v0.1 ship — see DESIGN.md Definition of
  Done" && git push origin v0.1`
  Doesn't block ROADMAP task 13 — the game itself already meets every
  v0.1 DoD item regardless of whether the tag exists.
