# STATE

Run counter: 32

## Current status
Third overnight session (2026-07-26) — **v0.3: the songbook**, plus the
project's first real self-verification harness. The human's standing
instruction this session: don't queue questions for a playtest, test it
yourself.

- **Tasks 45–46 — real songs.** The melody is no longer generated. Three
  public-domain tunes, one per biome (Mary Had a Little Lamb / Twinkle
  Twinkle / Ode to Joy), carry real note values. Note values needed no
  input change: a half note simply takes two beats to arrive, so its
  length is felt in the waiting — which also answers the old task 44
  (tap-and-hold) by making it unnecessary.
  Architecturally this *deleted* machinery: markers and audio are built
  from one list of `SongBeat`s, so the staff and the sound can't disagree;
  `patternByBiome`/`resolvePattern`/`generateBaseLoopSchedule` and the
  batch-quantization caveat are gone. `LoopLayer` now carries a
  `semitoneOffset` (melody / octave-below drone / octave-above sparkle)
  instead of its own pattern.
- **Task 47 — `tools/`.** A headless harness that plays the game by
  itself (real CDP input; synthetic PointerEvents do *not* reach Phaser)
  and asserts on meter, walk, page errors, marker/texture leaks, and —
  the good part — **every pitch it hears**, by instrumenting
  `createOscillator` and checking each frequency is a natural note in
  tune to within a cent. A `proofsheet.mjs` bakes every note-value ×
  staff-position combination for engraving review. See `tools/README.md`.
- **Notation grew up.** `STAFF_LINE_GAP` 14 → 18 (one dial: heads are one
  gap tall, as in real engraving) after the proof sheet showed letters
  were cramped; bard dropped to ground offset 178 to clear the lower
  ledger territory; clef scales off the staff gap.
- **What the harness caught on its first runs**: hollow-head letters
  merging into the ring (fixed by a thinner ring on a larger head), and
  the fact that synthetic pointer events silently do nothing (a trap
  worth not rediscovering — it's in the tools README).

- **Task 48 — a second tune per biome.** Each biome rotates through a set
  rather than repeating one song: village adds *Hot Cross Buns*, forest
  *Au Clair de la Lune* (in G), riverside *Lightly Row* (an octave up).
  Both tunes in a set sit in the same staff region, so the low → middle →
  upper curriculum survives the variety (enforced by test). Hint text now
  says "tap when a note reaches the line" — the lane is a staff, so the
  instruction can name what the player is looking at.
- **Mobile bugs the desktop view hid** (found by shooting an iPhone
  viewport, worth doing after any layout change): the hint clipped off
  the left edge (now clamped so it can't), and played notes drifted over
  the clef at the lane's left end (now they fade out past the hit line,
  `EXIT_PROGRESS` 1.35 → 1.28 — which also just looks better).

Verified: `npm test` 127 green (56 new), `npm run build` green, and two
long autoplay runs (200s+) PASS. The 200s run is the good one: it crossed
all three biomes and wrapped home, reporting **pitches heard = A B C D E
F G** (all seven natural names, zero off-scale, in tune within a cent)
and the running order
`Buns → Mary → Buns → Mary → Twinkle → Au Clair → Ode → Lightly Row →
Ode → Buns → Mary → Buns`
— which verifies rotation, biome hand-off *and* the loop home in one
shot. Meter held at 100 under perfect play; markers and textures both
bounded (26 live markers, 49 textures steady).

Note the harness bug that hid this at first: it analysed only the first
400 recorded notes, so later biomes' pitches were invisible. Analysis now
runs in-page over every note. Worth remembering — a verification tool
that silently samples a prefix is worse than none.

- **Task 49 — consolidation.** Drift check clean; STATE.md trimmed of
  four stale per-run write-ups. A fourth biome was considered and
  rejected with a reason worth keeping: naturals-only gives about two
  usable octaves, and the three existing vignettes already own the low,
  middle and upper thirds of it, so a fourth would either duplicate a
  region (weakening the curriculum) or sit in unreadable ledger
  territory. Rotation bought the variety instead.

- **Task 50 — rests.** A written silence is now a symbol, not an empty
  gap: `SongNote.rest` occupies its time, scrolls the staff, sounds
  nothing, and is never tapped or missed — it's born `resolved: 'rest'`,
  so it falls out of hit-finding and miss-detection by construction
  rather than by special cases scattered around. Engraved by value
  (whole hangs under the line above the middle, half sits on it, quarter
  is the zigzag). *Hot Cross Buns* carries the first one. Autoplay still
  holds a perfect meter with rests in the schedule, which is the proof
  they really are un-tappable.

**Next run: nothing is queued and nothing is blocked.** Read DESIGN.md's
Pedagogy section first, then take ROADMAP task 50's suggestions or the
idea backlog. Run `tools/autoplay.mjs` before and after any change to the
schedule, the songbook or the audio — it catches what unit tests can't.

## Previous status (second overnight session, 2026-07-25)
**v0.2 direction set by the human: teach kids to read music.** DESIGN.md gained a full
Pedagogy section (read it first — it is the contract for the v0.2 arc,
ROADMAP tasks 41–44). Executed so far this session:

- **Task 41 — notation core + C-major re-voice**: `src/core/notation.ts`
  (semitone→letter, semitone→staff step, stem/ledger engraving rules; 10
  tests) and the manifest re-voiced — root A3 → middle C (261.63 Hz),
  every pattern naturals-only (village C D E G A / forest G A C5 D5 E5 /
  riverside C D G A D5 — the biome curriculum), sparkle moved from +24
  to +19 (octave+fifth, keeps naturals natural), plus manifest tests
  enforcing no-accidentals and the middle-C root. 83 tests green.
- **Task 42 — staff lane**: done. The lane is a real treble staff; markers
  are engraved quarter notes (RenderTexture-baked per pitch: dark letter
  in a tintable white head, correct stems, middle-C ledger), positioned
  by `core/notation.ts` steps from the same batch-time biome pattern the
  audio uses. Bard dropped to ground offset 150 so low notes clear the
  cap; hit line spans the staff. Screenshot-verified across low/high
  ranges (stem-up C-D-E with ledger; stem-down C5-D5-E5). Note for
  future far-state checks: the 15s `BEAT_LOOKAHEAD_MS` delays pattern
  switches ~15s past the visual crossfade — with throwaway shrunken
  biome cycles you must also shrink `BEAT_BATCH_SIZE` and wait out the
  lookahead to see a non-village pattern on screen.
- **Bonus (backlog) — treble clef**: shipped. Stroked-arc stylization at
  the staff's left edge, spiral correctly on the G line, 0.5 alpha so
  notes stay dominant. The backlog gated it on "doesn't look wrong";
  the screenshot check passed it.
- **Task 43 — first-reader polish**: done. Mobile legibility confirmed
  by iPhone-viewport screenshot (DPR scale-up makes letters large; no
  change needed). Added the silent metronome (hit line brightens each
  beat, fades to the next — beat-clock-derived, never out of step) so
  pre-readers can feel the rhythm. PLAYTEST.md gained the round-3
  kid-testing protocol. The v0.2 arc's buildable tasks (41–43) are all
  shipped; task 44 (rhythm values) is a design question gated on an
  explicit human yes.

## Previous status (older sessions)
Trimmed during the 2026-07-26 consolidation pass: the per-run write-ups
for Runs 29–32 and the first overnight session duplicated their own
`Recent runs` entries below and their ROADMAP done-entries. See those.


## Process notes for future runs

- **Visual verification is possible and expected for visual work.**
  Pattern: `npm run build && npm run preview` (port 4173), then a
  Playwright script in the scratchpad (NOT a project dependency — keep
  package.json clean) with
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`,
  screenshot, and actually look at the image. Tap input can be simulated
  with `page.mouse.click` swept across beat offsets.
- **Far-state screenshots** (later biomes, dusk states, wrap points):
  temporarily sed the relevant constants down (transition distances,
  `DUSK_CYCLE_PX`, `missDrain` → 0 so the bard never stops), `npx vite
  build`, screenshot, then `git checkout` / sed back before committing.
  The rendering path exercised is identical; shipped constants stay
  untouched. Always run `git diff --stat` afterward to prove it.
- **This session's PR cadence** (if working interactively again): commit
  per task on the working branch, PR to main, enable auto-merge (squash),
  merge origin/main back after each squash lands, repeat.

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
- Run 27 (2026-07-24): Fixed a phantom ~5px mobile scroll gap per new
  ROADMAP task 27 (see Current status above). Phaser's `<canvas>` defaults
  to `display: inline`, reserving descender space below itself the same
  way a line of text would, which made the page taller than the viewport
  and vertically scrollable despite `#game` being sized to exactly
  `100vh`. Added `#game canvas { display: block; }`. Also deduplicated an
  accidental repeated task-25 entry in ROADMAP.md. `npm test` 52 tests
  green (unchanged), build green.
- Run 28 (2026-07-24): Fixed a backing-loop/visual-beat phase
  misalignment per new ROADMAP task 28 (see Previous status above).
  `AudioEngine.start()` anchored its note-scheduling clock to "the real
  moment of the first tap" instead of the visual schedule's own
  scene-creation-time zero, so the backing loop was out of phase with the
  beat markers by the player's own reaction time on every playthrough.
  Added a `nowMs` param to `start()` to anchor correctly and skip
  already-passed notes; added `AudioEngine.test.ts` (previously
  uncovered). `npm test` 56 tests green (4 new), build green.
- Run 29 (2026-07-24): `100dvh` for `#game`'s height per new ROADMAP task
  29 (see Previous status above). `100vh` alone sizes against mobile
  Safari/Chrome's largest-possible viewport rather than the actually-
  visible one on cold load — the classic mobile "100vh" gap, same family
  of real-viewport bug as tasks 26/27. Pure CSS, no new dependency.
  `npm test` 56 tests green (unchanged), build green.
- Interactive session (2026-07-25): ROADMAP task 14 (human playtest pass)
  executed and closed (see Current status above). Human verdicts folded
  into `HIT_WINDOW_MS`, `hitGain`, all `manifest.ts` patterns, beat-derived
  walk/scroll constants, and `biome.ts` palettes; art-direction feedback
  became ROADMAP tasks 30–32; PLAYTEST.md added (round-1 answers recorded,
  round-2 checklist for the retuned values). Also re-confirmed the v0.1
  tag push is impossible from this environment (still HTTP 403; GitHub
  MCP has no tag/release write call). `npm test` 56 green, build green.
- Overnight session, task 30 (2026-07-25): bard sprite & walk-animation
  overhaul per ROADMAP task 30 (human granted an extended interactive
  session to execute the art tasks directly). Placeholder rectangles →
  multi-part procedural character (legs/tunic/lute/capped head with
  feather) with beat-synced walk (legs + per-footfall bob + stride rock on
  a separate upper-body container so feet stay grounded) and a
  breathing/lute-sway idle. Verified with headless screenshots of both
  anim states, not just green tests. `npm test` 56 green, build green.
- Overnight session, task 31 (2026-07-25): per-biome background scenery
  per ROADMAP task 31. Silhouette band between sky and road at 0.45x
  parallax, crossfaded biome-to-biome like the road; village houses with
  lit windows / forest conifers with fireflies / riverside water-tent-
  campfire-reeds. `Biome` gained `sceneryColor`/`sceneryAccent`. All
  three biomes screenshot-verified (throwaway build with shortened
  transitions; shipped constants untouched). `npm test` 56 green, build
  green.
- Overnight session, task 32 (2026-07-25): art-style consolidation per
  ROADMAP task 32. Beat markers → tintable eighth-note glyphs (cream /
  green hit-pulse / dimmed mauve miss), coin icon → note-stamped coin,
  mute toggle → note glyph, hit line → rounded caps; DESIGN.md gained an
  "Art direction" section codifying the language (world cool and quiet;
  warmth belongs to the bard and the music). Screenshot-verified with a
  live tap run (hit pulse captured). `npm test` 56 green, build green.
- Overnight session, tasks 33+34 (2026-07-25): the player's own note +
  night sky. `AudioEngine.pluck(biomeId, beatIndex)` — a hit immediately
  plays that beat's melody note +1 octave at 1.6x base gain (tapping was
  previously silent in a music game); misses stay silent per DESIGN.md
  tone; mute covers it via master gain; 3 new tests. Night sky: sparse
  fixed-position cream starfield at 0.08x parallax + still moon with soft
  glow — road 1x / scenery 0.45x / stars 0.08x gives the scene depth.
  New ROADMAP arc queued for future runs ("the road loops home", tasks
  35–38). `npm test` 59 green, build green, screenshot-verified.
- Overnight session, task 35 (2026-07-25): the road loops home.
  `biomeBlendAt` wraps when the transition list is as long as the biome
  list (distance modulo cycle length; shorter lists keep the clamping
  behavior). Third transition added (riverside → village, 14000–16000px)
  → village → forest → riverside → village → … forever, every cycle
  identical. 5 new tests (64 total); wrap screenshot-verified via the
  shortened-transitions throwaway build. `npm test` 64 green, build
  green.
- Overnight session, task 36 (2026-07-25): slow dusk cycle
  (`src/core/dusk.ts`) — cosine brightness curve, one cycle per three
  biome loops, max 22% darken; world (sky/scenery/road) darkens while
  stars/moon brighten; bard + notation never darkened per art direction.
  7 new tests (71 total); deep-night screenshot-verified via shortened-
  cycle throwaway build. `npm test` 71 green, build green.
- Run 31 (2026-07-25, scheduled): strum on hit per new ROADMAP task 39,
  promoted from the idea backlog since task 38 (round-2 playtest) is
  still blocked on human. See ROADMAP task 39's done entry for the full
  writeup. `npm test` 71 green (unchanged), build green, headless
  screenshot confirmed the strum tween with zero console/page errors.

## Needs human playtest

Much smaller than it used to be: `tools/autoplay.mjs` now answers
mechanically what used to be queued for a person — that the melody is in
tune and naturals-only, that the songbook rotates and loops, that perfect
play holds the meter, that nothing leaks over a long walk. Round-1
feedback (2026-07-25) settled the original feel questions. What genuinely
still needs a human:

- **Subjective feel a machine can't judge**: is 96 BPM comfortable for a
  small child, does the 90ms hit window forgive a young hand, does the
  music actually sound cozy on real speakers.
- **Real-device behaviours headless can't reproduce**: audio resume after
  backgrounding the tab, gesture lockdown against pinch/double-tap zoom,
  and the visible-viewport fit on a phone with browser chrome showing.
- **The teaching outcome**, which is the whole point and is not
  measurable here: does a child start naming notes? PLAYTEST.md's round-3
  protocol is written for exactly that.

## Blocked on human
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
  **Update (2026-07-25, interactive session)**: re-tested from the
  interactive remote environment — `git push origin v0.1` still returns
  HTTP 403 (tag refs rejected, only the designated working branch is
  pushable), and the GitHub MCP toolset was re-checked: it has
  branch/file write calls but still no tag or release *creation* call.
  Blocker confirmed; the command above remains the only route.
