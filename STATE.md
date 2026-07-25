# STATE

Run counter: 32

## Current status
Run 32 (scheduled, 2026-07-25): **meter as staff** (ROADMAP task 40,
promoted from the idea backlog — task 38 is still blocked on the human
round-2 playtest). See ROADMAP task 40's done entry for the full
writeup; in short, the song-meter bar now carries five faint staff
lines drawn on top of the existing track/fill, so it joins the notation
language every other UI element already speaks (task 32). Screenshot
verification caught a real bug before commit: the first attempt tinted
the lines the same cream as the full-meter fill color, silently erasing
them at 100% meter — only checking the *full* state (not just empty/mid)
surfaced it. Fixed with a distinct bronze tone. Pure `RoadScene`
rendering addition, no change to `songMeter`'s logic, no new texture,
no new dependency. `npm test` 71 green (unchanged), build green, bundle
unchanged (~1.23 MB).

## Previous status (Run 31, scheduled, 2026-07-25)
Run 31: **strum on hit** (ROADMAP task 39, promoted from the idea
backlog — task 38 is still blocked on the human round-2 playtest). See
ROADMAP task 39's done entry for the full writeup; in short, the lute
now kicks and springs back on every hit as the visual twin of the
existing pluck-note audio (task 33). Pure `RoadScene` tween addition, no
new texture, no new dependency. `npm test` 71 green (unchanged), build
green, headless-screenshot verified.

## Previous status (overnight interactive session, 2026-07-25)
**The game got its round-1 human playtest, and then eight PRs of it.**
A human played the build, gave verdicts, and granted an extended
session ("keep running and cook"). Everything below merged to main the
same night (PRs #32–#39, each CI-green before merge):

1. **Playtest fold-in** (#32): hit window 120→90ms, hitGain 8→12,
   melodies recomposed as 8-beat pentatonic phrases, walk/scroll
   beat-derived (one footfall per beat, one tile per footfall), biome
   palettes re-pitched. See ROADMAP task 14's done entry.
2. **Bard sprite & animation overhaul** (#33, task 30) — multi-part
   procedural bard (tunic/cap/feather/lute), beat-synced walk, live idle.
3. **Per-biome scenery bands** (#34, task 31) — village houses / forest
   conifers / riverside camp silhouettes at 0.45x parallax.
4. **Art-style consolidation** (#35, task 32) — one visual language:
   everything the player touches is musical notation; DESIGN.md gained an
   "Art direction" section.
5. **The player's own note + night sky** (#36, tasks 33–34) — hits play
   the beat's melody note (+1 octave); starfield + moon at 0.08x parallax.
6. **The road loops home** (#37, task 35) — cyclic biome transitions,
   village → forest → riverside → village forever.
7. **Slow dusk cycle** (#38, task 36) — the time-of-day shift DESIGN.md
   promised at Run 0; world darkens, stars/moon brighten, bard stays warm.
8. **Consolidation** (#39, task 37) — this entry, process notes below,
   flash-width nit fixed, drift check clean.

Tests 56 → 71, all green; bundle ~1.22 MB (limit 5 MB); no new runtime
dependencies. Next actionable work for scheduled runs: nothing queued —
propose a fresh arc (task 38 is blocked on human round-2 playtest;
PLAYTEST.md covers everything above). `ROAD_SCROLL_PX_PER_SEC` note:
90 → 102.4 with the beat-derived walk, so transitions arrive ~12% sooner.

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

## Previous status (Run 29)
Run 29 complete — `#game`'s CSS used a plain `height: 100vh` to fill the
viewport. On mobile Safari/Chrome, `100vh` is sized against the *largest*
possible viewport (address bar collapsed), not what's actually visible on
a cold load (address bar shown) — the well-documented mobile "100vh" gap.
That's the same family of real-mobile-viewport bug as Run 26's
`touch-action` fix and Run 27's phantom-scroll-gap fix, not a feel/tuning
question, so — same reasoning as tasks 25–28 — it didn't need to wait on
the still-blocked task 14 human playtest.

- Added `height: 100dvh` immediately after the existing `height: 100vh` in
  `index.html`'s `#game` rule. `dvh` (dynamic viewport height) tracks the
  currently-visible viewport as browser chrome shows/hides; the `100vh`
  declaration stays as a fallback for any browser without `dvh` support
  (an unrecognized value is simply ignored, so the fallback only applies
  there — evergreen mobile/desktop browsers all support `dvh`). Pure CSS,
  no JS/logic change, no new dependency.

Verified: `npm test` (56 tests green, unchanged — CSS-only change touches
no logic). `npm run build` (green, bundle ~1.22 MB, unchanged). Headless
Playwright (iPhone 12 emulation) against the built `vite preview` output
confirmed the cascade resolves `#game`'s computed CSSOM height rule to
`100dvh` (the later, dvh-supporting declaration wins) and that
`getComputedStyle(#game).height` matches `window.innerHeight` exactly
(664px both); 8 taps at the 625ms beat cadence produced zero console/page
errors afterward. Caveat: headless Chromium doesn't dynamically show/hide
a real address bar the way a physical mobile browser does, so this
confirms the CSS lands and doesn't regress ordinary play, not that the
previously-hidden mobile gap is now visible on a real device — same class
of headless-vs-real-device caveat as Run 23's audio-resume fix.

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
Round-1 feedback (2026-07-25) answered the original feel questions for
tasks 3–29; that itemized list is retired (see git history / PLAYTEST.md).
Open items for round 2:

- **Retuned values need re-judging**: 90ms hit window (tighter — did it
  overshoot into "too strict"?), hitGain 12 refill pace, the recomposed
  8-beat phrases (do they now read as intentional, cozy music?),
  beat-synced walk/scroll (do legs and ground finally read as one motion?),
  and the stronger biome palettes (do the three moods land now?).
- **Round-1 items never explicitly answered**: real-device verification of
  the mobile fixes (viewport gap, gesture lockdown, audio resume after
  backgrounding — tasks 23/26/27/29), audible dropouts or marker pop-in at
  beat-batch boundaries (task 13), and whether backing-loop notes land on
  the markers after Run 28's phase fix.

PLAYTEST.md is the round-2 checklist; fold answers in the same way.

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
