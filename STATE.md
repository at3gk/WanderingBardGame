# STATE

Run counter: 33

## Current status
**v0.4 — learning, not just exposure** (2026-07-26). The human sharpened
the goal: *"where they can actually learn music... thru songs that they
already know."* The weakness that named: a letter printed in every note
head **forever** is a crutch. A child can read the letters fluently and
never once encode the position, so the position→name association is never
retrieved and never sticks.

- **The letter now fades in *time*, not opacity** (`src/core/scaffold.ts`,
  27 tests). Familiarity is tracked per *staff position* (not per letter —
  C5 is a different thing to learn than middle C). As a position is
  practised its letter arrives later and later in the note's 1800ms
  flight: 1800 → 1350 → 950 → 600 → 350ms before the tap. A half-opacity
  letter would still be perfectly readable and teach nothing; a letter
  that arrives late buys real recall time.
- **Fade the prompt, never the answer.** The 350ms floor is load-bearing:
  a note only lives ~500ms past the hit line, so relying on an
  after-the-fact reveal would have left a child checking themselves
  against a letter already fading away. Now every note always shows its
  name before the tap, and also reveals on strike and on miss. A miss
  costs exactly what it did before — a dimmed note and a little meter —
  and never information.
- **Quick to help, slow to withdraw.** +1 per hit; −3 per miss but only
  while still walking (a child who has lost the beat misses everything);
  hysteresis wider than the miss penalty so no single wobble flips a band;
  a +12 per-sitting cap so a scaffold can't vanish faster than the memory
  forms; help restored instantly when the meter drops, always on the first
  sighting of a position in each tune, and partially after days away.
- **Honest about what a tap proves**: timing, not reading — it is
  confounded by melodic memory. So this is a *dosage schedule driven by
  exposure*, not an assessment, and DESIGN.md says so plainly.
- **Songs they already know** (task 53): Au Clair de la Lune and Lightly
  Row — method-book tunes many children have never heard — were replaced
  by *Row, Row, Row Your Boat* and *Old MacDonald Had a Farm*. Familiarity
  is now load-bearing rather than decorative: if the child knows the tune,
  the pitch is free when the letter is gone, so they are never stuck.
  That is the only reason fading is safe here at all.
- **Persistence** (`scaffoldStorage.ts`): one ~200-byte localStorage key,
  no login, no menu, no identifiers, every access in try/catch. Loaded
  once per page, *not* in `create()` — a resize re-runs `create()` and
  wiping a child's progress on an orientation change would be a silent,
  invisible bug.

Verified: `npm test` **179 green** (+27 for the model alone), build green,
and a new `tools/learning-check.mjs` that unit tests cannot replace — it
plays well for 90s, then deliberately stops. Result: **67 letterless
repeats** (real recall attempts), C4/D4/E4 faded 1800 → 950ms lead while
rare positions correctly stayed fully supported, and **full help returned**
after the bad stretch. `autoplay.mjs` still PASSes with all-natural pitches.

Design was worked out by a five-agent workflow before any code: a pedagogy
model, a familiarity audit of the songbook, a code-integration map, and two
adversarial critiques. The critiques earned their keep — one did the
arithmetic showing a revealed letter was only visible ~400ms *while
fading* (fixed by the 350ms lead floor), and both caught that a single miss
could flip a band (fixed by widening hysteresis past the miss penalty) and
that the session cap was gross rather than net (a miss now refunds
allowance, so a wobble can't strand a position for a whole sitting).

**Multi-session fading verified end-to-end** (`tools/multisession-check.mjs`,
added after the v0.4 merge). The model's central promise is a claim about
days, not minutes — a note should reach full fade only across *several*
sittings, never inside one, because a scaffold must not vanish faster than
the memory forms. Measured on the shipped build, through real localStorage
across real page reloads:

```
after sitting 1: {"0":2,"1":2,"2":2,"3":4,"4":3,"7":4}
after sitting 2: {"0":1,"1":1,"2":1,"3":4,"4":2,"7":3}
after sitting 3: {"0":0,"1":0,"2":0,"3":3,"4":1,"7":3}
```

Band 4 is full help, 0 is fully faded. C4/D4/E4 take exactly three sittings;
the rarer F4 (step 3) correctly lags far behind, so the fade follows real
exposure rather than a clock. This is `SESSION_GAIN_CAP` doing its job.

**The songbook is eleven tunes** (2026-07-26): *This Old Man* joined the
village set and *The Itsy Bitsy Spider* the riverside, so village and
riverside now rotate four songs each and forest three. Both were
transcribed and then independently verified against published sources
before landing. A forest transposition of *This Old Man* was drafted and
**rejected** — its contour matched the real tune for only 6 of 32 notes,
including an inverted phrase on the song's most recognizable line, and a
wrong contour actively mis-teaches a child who knows the song. Forest is
therefore deliberately one short rather than wrong.

**Which mechanism actually keeps the promise** (2026-07-26). "Fade the
prompt, never the answer" was credited in DESIGN.md and in three code
comments to the reveal-on-strike and reveal-on-miss handlers. That was
wrong, and `tools/reveal-check.mjs` (new) proves it: over a 90s walk, 86
letters were revealed and **every one came from the scheduled mid-flight
path — zero from strike, zero from miss**, including through four seconds
of deliberate missing at a high meter. The reason is arithmetic: the reveal
lead floor (350ms) is wider than the hit window (±90ms), so the letter is
always already showing before a tap can register. The two handlers are
unreachable backstops.

This is the *stronger* guarantee — the answer lands on a bright, upright,
full-alpha note the child is still about to play, not on one already
dimmed and scrolling away — but it held only by coincidence of two
constants in different files. `HIT_WINDOW_MS`/`TRAVEL_TIME_MS` moved to
`core/beats.ts` and `scaffold.test.ts` now enforces the relationship ("the
answer always beats the tap"), so tightening the fade to make the game
harder can no longer silently downgrade the promise to a ~400ms fading
consolation. The guard was mutation-checked: dropping the floor to 50ms
fails it with a clear message.

**The autoplay harness was not checking the thing it exists to check**
(2026-07-26). Its hit/miss counts filtered the *live* marker list, which is
culled as notes scroll off — so "hits: 1" after 207 taps was the last
second's state printed as a total. Nothing asserted on them either, so a
regression that broke input outright would still have gone green (the meter
never drains if notes are never resolved). Counting now hooks
`recordEncounter`, and there are assertions on hit and miss rate. Turning
those on exposed a third bug in the harness: its tap loop capped its wait
at 400ms then clicked regardless, firing about one tap into empty air for
every real one. Now: 100 taps, 100 hits, 0 misses.

**The design pillars are now measured, not assumed** (`tools/pillar-check.mjs`,
2026-07-26). Two CLAUDE.md pillars had never been checked by anything:
"playable in under 5 seconds" and "mobile-friendly". Both hold, across six
viewports from iPhone SE to desktop — playable in 0.7–1.3s, every drawable
staff position on screen with room for its stem, taps registering, and the
tightest thing the songbook draws (two eighth notes at 96 BPM) still 49px
apart on the narrowest phone against a ~24px note head. Confirmed visually
at 375px on This Old Man's run of eighth-note C's: clearly separated,
letters legible.

Method note worth keeping: the spacing check *sampled* first and quietly
measured nothing — only quarter notes came around in the sampling window,
so it reported a comfortable 110px gap and passed without ever seeing the
case it existed for. It now computes the worst case from tempo, flight time
and runway. A check that cannot see its own failure case is not a check.

**Rotation is safe, and the harness lied twice about it**
(`tools/rotate-check.mjs`, 2026-07-26). Rotating a phone re-runs Phaser's
`create()` — the path that forced the scaffold to module scope — so it now
has a check: portrait → landscape → portrait, playing throughout. Verdict:
coins, steps, audio, markers and saved learning progress all survive, meter
holds at 100, and no position ends weaker than it started.

Getting there took three attempts, and the two failures were both mine:
the first version paused tapping for 1.2s after each resize (genuine
misses, which read as "rotation costs progress"), and the second tapped a
fixed (200, 520) that falls outside the 390px-tall landscape viewport (so
every tap missed the page and the meter crashed to zero). Both times the
game was innocent. **A self-verifying project has to treat a failing check
as a claim about the check first** — that is the standing lesson, and it
is why each harness now documents the wrong version as well as the right
one.

**One real change came out of it**: `wasUnplayable` in `core/beats.ts`. A
note whose *entire* hit window elapses inside a single frame gap was never
on screen to be played, so it no longer feeds the learning model — it still
misses visibly and still dips the meter, it just isn't taken as evidence
about what the child knows. Scoped honestly: this is **insurance, not a fix
for an observed bug.** Rotation was the suspected trigger and measurably is
not one (peak frame gap 50ms rotating, 69ms backgrounded, against a 180ms
window). It closes the band between the two guards the scene already had —
wider than the hidden-tab check, narrower than `MASS_MISS_LIMIT` — which is
what a moderate stall on a cheap phone looks like. Exhaustively tested to be
inert for every frame gap up to the full window width.

**Songbook blocked, not skipped**: the forest set is one song short and
should get a fourth. It did not get one this session because this
environment's network policy blocks outbound fetches (403 on CONNECT to
every host), so a transcription cannot be verified note-for-note against a
published source — the exact standard that caused the forest *This Old Man*
to be rejected. Candidate already researched: **Here We Go Round the
Mulberry Bush**, traditional (tune dates to 1700s London, clearly public
domain), which in C major uses scale degrees 1/2/3/5/6/7 only — all
naturals — and sits G4–G5, matching the forest register. *Wheels on the Bus*
was considered and **rejected on rights**: it is attributed to Verna Hills,
1939, which does not meet CLAUDE.md's CC0-only bar. Ship Mulberry Bush from
a run with network access, or from a human-supplied transcription.

**Audio no longer drifts away from the staff over a long session**
(2026-07-26). Visuals run off Phaser's time (`performance.now`), audio off
`AudioContext.currentTime` — the sound hardware's clock. Those are never
exactly the same rate, and `AudioEngine` anchored them **once** at
`start()` and scheduled every later pass against that original anchor, so
the difference accumulated for as long as the session lasted. In a rhythm
game, what you see and what you hear sliding apart is the one failure that
ruins it. `schedule()` now re-derives the anchor on every pass, bounding
the error to a single song instead of a whole sitting; `nowMs` became a
required argument so there is one place that maps visual time onto audio
time. Two new unit tests cover it, including one that moves the clocks
apart by hand and asserts the correction is absorbed rather than carried.

Honest limits on that: **the drift was never convincingly measured in a
browser.** Five attempts gave five answers (17s, 1.2s, ±900ms scattered,
−22s, −566ms) and every time the bug was in the instrument — CPU contention
from my own concurrent checks, comparing the raw clock gap (which should
grow and is harmless) instead of note-sounds-vs-note-seen, matching an
early-resolved marker against the wrong oscillator, and indexing
oscillators as interleaved when `scheduleLayer` emits one layer at a time.
Reading the anchor straight out of a live `schedule()` gives ~7ms, agreeing
with the unit tests. So the fix is shipped on the strength of the tested
arithmetic, and **no browser sync assertion is wired up** — a check that has
been wrong five times has not earned the right to fail a run. Headless is
the wrong place to judge it anyway: with no audio device the clock runs
~0.17% slow against a software sink. `tools/README.md` records the method
for anyone picking it up.

**Long-session stability confirmed clean** (7-minute autoplay): fps holds
17–23, textures plateau at 109 (bounded by the songbook — 85 note/rest
textures plus scenery and UI, so not a leak), markers stay bounded, and
590 of 592 taps land. An earlier run showing fps 11 and 201 misses was my
own CPU contention from running three Chromium instances at once — a
reminder to run long measurements alone. `autoplay.mjs` now asserts the
texture count plateaus.

Deviation from CLAUDE.md worth flagging: this is more than "exactly ONE
roadmap task" — it is a model, a persistence layer, a songbook swap and a
harness. That rule governs the scheduled autonomous runs; this was an
interactive session with an explicit human direction to build the thing.

## Previous status (v0.3 and earlier sessions)
Trimmed during the 2026-07-26 consolidation. The v0.3 session (the
songbook, note values, rests, and the `tools/` self-verification harness),
the art-direction sessions, and every scheduled run before them are
written up in their ROADMAP done-entries and the `Recent runs` log below.
`tools/README.md` documents the harnesses.

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
  merge origin/main back after each squash lands, repeat. Expect conflicts
  in STATE/ROADMAP against scheduled runs landing in parallel — and expect
  ROADMAP *task-number collisions*, since a scheduled run will happily
  claim the next number while you hold it too. Renumber yours; don't
  renumber theirs (theirs is already merged and referenced).
- **Verify behaviour, not just green tests.** `tools/autoplay.mjs` plays
  the game and checks every pitch it hears; `tools/learning-check.mjs`
  plays *well and then badly* to prove the letter-fading model both fades
  and restores. Run both after touching the schedule, the songbook, the
  audio or the scaffold. Note that autoplay is a *perfect* player, so it
  structurally cannot detect a broken return-on-struggle path — that is
  exactly why the second harness exists.
- **For a feature with real design risk, design it in a workflow first.**
  The v0.4 learning model was specced by parallel agents (pedagogy model,
  songbook familiarity audit, code-integration map) and then attacked by
  two adversarial critics before a line was written. The critics earned it:
  they found that a revealed letter would only be visible ~400ms *while
  fading* (arithmetic I had not done), that a single miss could flip a
  support band, and that the session cap was gross rather than net. All
  three were real, and all three were cheaper to fix on paper.

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
- Run 33 (2026-07-25, scheduled): signposts at transitions per new
  ROADMAP task 52, promoted from the idea backlog since nothing else was
  queued (task 38, round-2 playtest, is still blocked on human). See
  ROADMAP task 52's done entry and Current status above for the full
  writeup. `npm test` 157 green (5 new), build green, screenshot-verified.

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
