# STATE

Run counter: 45

## Current status

**At a glance** — read this, then only the sections you need.

- **Run 45 (scheduled): ROADMAP task 115, scatter on the road — and a
  correction to what the task thought it needed.** Before writing any code,
  read `WorldStreamer.ts` against the task's own claim ("no pebbles, no
  tufts in the rut, no puddles") and found two of the three already
  shipped: `roadgrass` and `roadstone` `ScatterKind`s have existed since the
  v0.6 initial commit, with real instance counts confirmed by a headless
  scene scan and visible (if sparse) in a screenshot. Only puddles were
  really missing. Added `puddleGeometry` (`src/three/world/geometry.ts`) —
  a flat irregular ellipse, wound to face +Y since `solidMaterial` is
  front-face-only — as a new `puddle` `ScatterKind` placed in the wheel
  rut itself (`RUT_BAND`), the one band every other carriageway kind
  deliberately keeps bare. That's also why "tufts in the rut" was never
  going to be both true and right: the rut stays bare of growth because
  it's the road's low, worn, sometimes-wet ground, which is exactly why a
  puddle belongs there instead. `BiomePalette` gained a `density.puddle`
  key — driest in village (0.35), wettest in riverside (1.3), forest
  between (1.0) — and colour is a fixed cool grey-blue mixed toward each
  biome's own road tone, since there's no real-time reflection to carry the
  differentiation instead.
  Verified with a 19-point headless scan along a full day's road (puddle
  `InstancedMesh`es present and growing with distance, zero console/page
  errors) and cropped screenshots at several of those points showing
  puddles reading clearly as water, distinct from the road and verge.
  `npm test` 745 green (unchanged — `src/three/world/` has no unit test
  coverage, same precedent as the rest of the Three.js build; verified by
  screenshot and a live scene-graph scan instead), `npm run build` green
  (691.65 KB vs 690.96 KB).
  **Flagged for whoever runs next, especially on task 119**: the same
  "already built, task never updated" pattern applies to skyline landmarks
  — `Landmark`, `landmarksNear`/`chooseLandmark`/`raiseLandmark` and four
  landmark geometries are fully wired into chunk building already. Check
  with a screenshot before assuming task 119 starts from nothing.
- **Run 44 deleted the dead 2D/Phaser code.** `src/scenes/` (the
  `RoadScene`/`picker`/`meterBar`/`freePlayOverlay`/`readouts` modules from
  runs 39-43), `src/render/` (`engraving`/`scenery`/`ui`), and the orphaned
  `src/audio/AudioEngine.ts` (+ its test) — none of it was imported from
  `src/three/` or `src/main.ts`, confirmed by grep before deleting. The
  `phaser` dependency is gone from `package.json`/`package-lock.json`;
  production bundle dropped 1266 KB → 686 KB. The 24 Playwright checks in
  `tools/` that drove the old scene through `window.game.scene.scenes[0]`
  (a global that stopped existing the moment v0.6 landed) are deleted too —
  `verify-all.mjs` now runs the one check that still matches the live game,
  `shader-check`. `postcard.mjs`/`shot.mjs`/`browser.mjs` are unaffected
  (they always drove `window.bard`, the Three.js game's own handle).
  `tools/README.md`, root `README.md` (Stack section still said Phaser),
  and `.github/workflows/headless-checks.yml` (still said "the fast
  fourteen") are updated to match. `npm test` 745 green (762 minus
  `AudioEngine.test.ts`'s 17), `npm run build` green.

  Wiring `shader-check` into `verify-all` for the first time since v0.6
  immediately found something real: **FAIL, time-of-day is inert
  (luminance range 3)** across dawn/day/golden/night samples. Not a
  regression from this run — no rendering code was touched — and not new
  information either: `tools/README.md`'s own description of the check
  already named exactly this failure mode as what it looks for, and the
  "still wrong" list below already had "the upper sky does little work at
  noon" in its critique notes. This is that finding, now pinned to a
  number a future run can check against instead of an adjective. Added as
  item 7 below. `headless-checks.yml` stays `continue-on-error: true` so
  this red doesn't block anything, per the existing blocked-on-human note
  about promoting it to a real gate.

- **Where v0.6 actually stands, and what is still wrong.** A harsh
  frame-by-frame critique of ten posed screenshots returned **not shippable
  next to A Short Hike**, and named three structural absences rather than a
  polish gap. Two and a half are now closed: there are travellers in the
  world and an audience at a busk (there was literally nobody before); the
  staff is legible, with dark note heads carrying cream letters at a pitch
  spacing that survives the end-on view; the sky's zenith arrives inside the
  visible frame band and carries cloud. The land has a midground again.

  **Still wrong, in the order a next run should take them:**
  1. The road is bare. Narrowing it to a 3.4 m cart track and deepening the
     ruts helped, but the carriageway has no scatter on it at all — no
     pebbles, no tufts in the rut, no puddles. On a phone in portrait it is
     still the largest single area in the frame.
  2. The bard stands upright at his own campfire. `resting` calls
     `setPose('sitting')` and the pose does not look like sitting.
  3. The camp lantern reads as a bright quad beside a bare post.
  4. The busk caption still collides with the top note on phone landscape
     (844x390). Moving it means a considered change to `hudLayout.ts`, which
     its own test constrains — the top slot exists to keep the card off the
     bard mid-busk.
  5. No landmarks on the skyline. Now that ridges exist, a standing stone or
     a chapel placed deliberately on one would give the walk something to
     walk toward. This was correctly deferred until the terrain could hold it.
  6. No instrument picker, and `journey.unlockedInstruments` is never
     appended to — an earned instrument is playable but not choosable.
  7. Time-of-day lighting is nearly inert: `shader-check.mjs` measures
     average frame luminance at dawn/day/golden/night and gets a range of
     3 (Run 44) — the palette moves the sky dome's colour but barely the
     light falling on anything else. Ties together two items already
     named in the critique notes below ("the near ground is dark by
     albedo rather than by shadow", "the upper sky does little work at
     noon") into one measured, re-checkable number.

- **v0.6, the road in three dimensions (interactive, human-directed, landed
  after run 43).** A human set a new direction — build the wandering road as a
  low-poly 3D painterly game in Three.js, with a shared daily road, busking,
  instrument unlocks, variable-reward encounters, idle busking and a
  campfire. DESIGN.md carries the full write-up and the changelog entry
  naming what was cut. This entry records what a future run needs to know.

  **What was kept.** All of `core/`. It is pure TypeScript with no renderer
  in it, so this was a rebuild of the presentation and not of the game. The
  no-fail stance, the no-grading stance and the pedagogy are unchanged and
  still constrain everything.

  **What replaced Phaser.** `src/three/` — one painterly ShaderMaterial that
  every solid surface uses, a sky dome that *is* the light source, a chunked
  terrain ribbon in road space, GPU-instanced scatter, a procedurally-built
  bard with a hand-driven walk, a damped camera rig, GPU-resident particles.
  `src/core/` gained road, encounters, instruments, idle, performance and
  journey; `src/audio/` gained instrument voices, generated ambience and
  adaptive layers.

  **The Phaser files and their checks are gone (Run 44).** `src/scenes/`,
  `src/render/`, `src/audio/AudioEngine.ts` and the 24 `tools/` Playwright
  checks that drove `window.game` (Phaser's global, which stopped existing
  the moment v0.6 landed) are all deleted — see the Run 44 note in "At a
  glance" above for the detail and what it turned up.

  **Three rendering bugs worth remembering, because none was findable by
  reading the code.**
  1. `USE_INSTANCING_COLOR` is injected by three into the *vertex* shader
     prefix only. A fragment shader guarding its matching varying on the same
     define simply has no declaration; both stages compile clean, and every
     per-instance colour in the game is silently dropped. Both varyings are
     unconditional now.
  2. A rim light added flat rather than scaled by albedo turns grass white:
     blades are thin and seen edge-on, so fresnel sits near 1 across the whole
     blade rather than at its edge.
  3. Ambient applied at the full value of the sky colour lights a surface as
     brightly as the sky itself. The lighting model now names its exposure in
     two constants, with about three stops between sun and shade.

  The general lesson, and the reason `tools/postcard.mjs` exists: **look at
  the frames.** All three survived type-checking, unit tests and a careful
  reading of the shader. The first screenshot found all three in a minute.

  **`tools/postcard.mjs`** poses the game through `window.bard.pose({s,
  dayFraction, phase})` and shoots ten framings including two phone aspect
  ratios. `tools/shader-check.mjs` fails a run if a frame is black or tonally
  flat, or if the time-of-day palette is inert. Both need `PLAYWRIGHT_PATH`
  and a served build; `tools/browser.mjs` now centralises the launch and
  probes for the pre-installed Chromium, because the ad-hoc Playwright install
  and the pre-installed browser do not always agree on a build number.

  **A process note that cost real time.** Committing while sub-agents were
  still editing the same working tree captured `src/core/journey.ts` in the
  middle of a mutation test — a deliberately-broken guard marked
  `// TEMP-REVERT` went into a commit and had to be undone in the next one.
  Grep for that marker convention before committing mid-session.

  **The pinned-day road test moved on purpose.** `road.test.ts` pins seed
  20260728 exactly, so that an accidental change to the generator cannot
  silently hand every player a different road. The 3D world needed visible
  landform, so the corridor grading came in from 30 m to 18 m and the
  cross-road hills from a 520 m wavelength to 190 m; the pins were
  regenerated in the same commit, which is what that test asks for. An
  intermediate attempt also shortened the *along*-road hills to 165 m and
  turned the lane into a 30% climb — the existing roughness test caught that
  before it was ever seen, which is exactly what it was written for.


- **Run 43 (scheduled): split the coin/distance readouts out of
  `RoadScene.ts`,** per new ROADMAP task 112 — the next piece task 112's own
  "nothing queued" note (as task 111 left it) had already named as a
  candidate once task 111 took the meter out. Both blockers re-checked
  first (unchanged — see Blocked on human), no playtest answer had arrived,
  idea backlog still down to the one phone-dependent item.
  Of the four things left in `setWalkChromeVisible` (staff lines, clef, hit
  line/flash, coin/distance readouts), the coin/distance pair was the
  cleanest cut: `updateCoinReadout`/`updateDistanceReadout` were already two
  small self-contained private methods touching only their own two
  GameObjects, unlike the other three, which are interleaved with
  `laneY`/`hitLineX`/`beatPhase` in the same per-frame block as the note
  markers. `src/scenes/readouts.ts` (new, 75 lines) now owns `coinIcon`,
  `coinText`, `distanceText` and their five margin/radius constants, via
  `createReadouts` (called once from `create()`), `layoutReadouts` (the
  per-frame update, replacing the two removed methods) and
  `setReadoutsVisible` (called from `setWalkChromeVisible`). Same
  `Host`-interface shape as the picker/free-play/meter splits.
  `coins`, `distancePx`, `coinIcon`, `coinText` and `distanceText` all
  dropped `private` — a private class field can't satisfy a plain interface
  type, and `tools/hud-check.mjs`, `tools/freeplay-check.mjs` and five other
  checks already reach several of them directly. `RoadScene.ts` 1783 → 1747
  lines.
  Verified behaviour-preserving rather than assumed: `npm test` 279 green
  (unchanged — no unit tests cover scene modules, same precedent as the
  other three splits), `npm run build` green (1266.76 KB vs 1266.84 KB, a
  module-boundary-only difference), and the full 14-check quick suite
  green — including `hud-check` (reads `coinIcon`/`coinText` rects directly)
  and `freeplay-check` (reads `coinText.visible`, `distanceText.visible` and
  `coins` directly). `node_modules` was missing at the start of this run
  (fresh checkout); `npm install` (54 packages, 0 vulnerabilities) was
  needed first, and Playwright for the check suite was installed fresh into
  the scratchpad (`npm i playwright@1.56.1`, matching the pinned version)
  since it stays out of `package.json` on purpose.
  **Flagged for whoever runs next**: this is the fourth small RoadScene
  extraction in a row (tasks 107, 109, 111, 112). ROADMAP task 113 asks the
  next run not to pick a fifth one by default — see its entry for the
  reasoning.
- **Run 42 (scheduled): split the song meter out of `RoadScene.ts`,** per
  new ROADMAP task 111 — the "just the meter bar" first cut task 110's own
  note left open once task 108 had ruled out `setWalkChromeVisible` as a
  whole (nine unrelated fields, no shared sub-grouping). Both blockers
  re-checked first (unchanged — see Blocked on human), no playtest answer
  had arrived, idea backlog still down to the one phone-dependent item.
  `src/scenes/meterBar.ts` (new, 125 lines) now owns the three meter
  GameObjects (`meterTrack`, `meterFill`, `meterStaffLines`) and their
  constants (`METER_HEIGHT`, `METER_FILL_COLOR*`, `METER_STAFF_LINE_*` —
  grepped first and confirmed all seven were meter-only, none shared with
  another file), plus three functions: `createMeterBar` (called once from
  `create()`), `layoutMeterBar` (the per-frame resize/reposition, replacing
  the inline block that used to live in `updateMeterBar`), and
  `setMeterBarVisible` (called from `setWalkChromeVisible` in place of the
  three inline `setVisible` calls). Same `Host`-interface shape as the
  picker and free-play splits: `MeterBarHost` is the exact slice of
  RoadScene the module reads and writes. One deliberate difference from
  those two precedents, explained in the module's own header — the three
  fields stay plain (non-`private`) fields on RoadScene rather than a
  returned handle, both for the same reason the picker/free-play fields
  did (a private class field can't satisfy a plain interface type) and
  because `tools/hud-check.mjs` already reaches `scene.meterTrack` directly
  to check the chrome doesn't overlap itself — a handle would have meant
  touching a passing check for no behavioural reason. `RoadScene.ts` 1838
  → 1783 lines.
  Verified behaviour-preserving rather than assumed: `npm test` 279 green
  (unchanged — no unit tests cover scene modules, same precedent as the
  other two splits), `npm run build` green (1266.84 KB vs 1266.81 KB
  before, a module-boundary-only difference), and the full 14-check quick
  suite green — including `hud-check`, which reads `meterTrack`'s rect
  directly at 8 viewports, and `autoplay`/`mash-check`/`seam-check`, which
  exercise `layoutMeterBar` and `setMeterBarVisible` every frame and across
  every mode toggle. `node_modules` was missing at the start of this run
  (a fresh checkout); `npm install` (54 packages, 0 vulnerabilities) was
  needed before `npm test`/`npm run build` would run at all.
- **Run 41 (scheduled): split the free-play staff out of `RoadScene.ts`,**
  per new ROADMAP task 109 — the "legitimate work if someone scopes a real
  first piece" that task 108 left open rather than attempting. Both
  blockers re-checked first (network fetch still 403s, GitHub MCP toolset
  still has no tag/ref-write or branch-protection-write call), no playtest
  answer had arrived, idea backlog held only the phone-dependent item.
  `src/scenes/freePlayOverlay.ts` (new, 414 lines) now owns the scrim, the
  ladder of lines/pips/labels, the cursor, the written-phrase tracking and
  `playFreeNote` — same `Host`-interface shape as the picker split (task
  107): `FreePlayOverlayHost` is the exact slice of `RoadScene` it reads
  and writes, including `songTitleText` (shared with the walk mode — the
  specific entanglement task 108 flagged) and three callbacks
  (`hitLineX`, `noteOriginY`, `strumLute`) for what's genuinely the
  scene's own layout/animation. `enterFreePlay`/`exitFreePlay` stay on
  `RoadScene` as mode-toggle orchestration. `RoadScene.ts` 2172 → 1838
  lines. Two constants moved out to break a would-be circular import
  between the two scene modules: `STAFF_LINE_STEPS` to `core/notation.ts`,
  `NOTE_TINT_UPCOMING/HIT/MISS` to `render/engraving.ts` (both were
  RoadScene-local but shared by the walk's markers and free play's notes).
  **Verification caught a real transcription error before it shipped**: an
  earlier truncated file read led this run to write the wrong tween option
  on `playFreeNote`'s fade-out (`ease: 'Quad.easeIn'` instead of the
  actual `delay: 220`) into the new module; re-reading the untruncated
  original caught it before any check ran. Given this exact area (the
  practice staff) shipped invisible to production once before (PRs
  #115–#122), verification ran wider than the minimum: `npm test` 279
  green (unchanged — no unit tests cover scene modules, same precedent as
  the picker), build green (1266.81 KB vs 1267.23 KB, module-boundary-only
  difference), the full 14-check quick suite green, plus `songpick-check`,
  `rotate-check` and `seam-check` (normally skipped in quick mode) run
  explicitly since they exercise the picker/free-play/rotation seams this
  change touches directly — all green, no regressions.

- **Run 40 (scheduled): a five-place assumption turned out to be
  untested, and doesn't hold.** Both blockers re-checked, unchanged (see
  Blocked on human); no playtest answer; idea backlog still correctly
  deferred. Read the free-play-staff and walk-chrome code (ROADMAP task
  108's own instruction before claiming either as a next extraction) and
  confirmed task 107's caution was right — `buildFreeStaff` shares
  `songTitleText` with the walk mode, and `setWalkChromeVisible` touches
  nine unrelated fields (meter, coins, distance) — so neither is a clean
  single-unit extraction and this run didn't attempt one.
  Instead: `RoadScene.ts` (×2), `render/ui.ts`, this file, `tools/README.md`,
  and ROADMAP task 59's own summary all assert flatly that "a resize
  re-runs Phaser's `create()`" — the reason the learning scaffold sits at
  module scope and texture baking is idempotent. No check had ever isolated
  that specific claim: `rotate-check.mjs` only ever proved state *survives*
  a resize, which it would either way given those defenses. Attached a
  `Phaser.Scenes.Events.CREATE` counter after boot and drove two rotations
  (plus, in a scratch script, a third arbitrary resize and a direct
  GameObject-identity check on `bardUpper`): **`create()` fires zero
  additional times** — same scene instance, same GameObjects throughout.
  The assumption does not hold, at least in headless Chromium with WebGL.
  Did not remove the defenses (module-scoped scaffold, `textures.exists()`
  guards) — cheap insurance, and this can't rule out a real device behaving
  differently under actual WebGL context loss, which was the original,
  never-independently-tested worry. What changed: `rotate-check.mjs` now
  asserts the count permanently instead of assuming it, and the five
  misleading comments/docs say what's verified versus what's still just
  insurance. `npm test` 279 green (unchanged), build green (bundle
  byte-identical), full 14-check quick suite green.

- **Run 39 (scheduled): split the songbook picker out of `RoadScene.ts`.**
  Both standing blockers re-checked first, unchanged (see Blocked on human).
  No playtest answer had arrived, and the idea backlog is down to the one
  phone-dependent item, so this run picked up the consolidation this file
  had already flagged as the obvious next one: `RoadScene.ts` had regrown to
  2275 lines since the last extraction pass (task 66) — entirely from the
  "two ways in" session, none of which existed when the scene was last
  split. `openPicker`/`closePicker` and the `PICKER_*` constants moved to
  `src/scenes/picker.ts`: 2275 → 2172 lines.
  This extraction is a different shape from the earlier `render/*` ones,
  worth knowing before doing the other two (free-play staff, walk chrome).
  Those modules are pure functions of their inputs with **no** game state,
  which is exactly what let their texture sheets prove byte-identical
  output. The picker is not: it owns `pickerParts`/`pickerOpen` (the whole
  overlay tears down as one unit, and other input handling needs to know
  it's open) and reads the current song choice to highlight a row. So it
  takes a `PickerHost` interface — the slice of `RoadScene` it touches —
  plus a `chooseSong` callback, rather than the bare scene. One real
  friction point: `pickerParts`/`pickerOpen` had to drop `private`, because
  a private class field cannot satisfy a plain interface type (`tsc`
  caught this immediately, not a silent bug). `PICKER_CHOSEN_BG` is
  exported and re-imported by `RoadScene`, since it doubles as the
  free-play cursor/pip color and the practice-mode lute tint — it was
  never picker-only despite the name.
  Verified behaviour-preserving rather than assumed: `npm test` 279 green
  (unchanged), build green (1.27 MB, unchanged), and specifically the three
  checks that exercise the picker — `songpick-check`, `freeplay-check`
  (choosing a song from inside free play opens the picker from a different
  mode), `hud-check` (the picker button's touch-target geometry) — all
  still green, plus the full 14-check quick suite with zero regressions
  elsewhere. ROADMAP task 108 records why the other two extractions are
  *not* automatic next tasks: free-play still touches substantial scene
  state and isn't a clean single overlay the way the picker was, and "walk
  chrome" was never one cohesive block to begin with.

- **Run 38 (scheduled): investigated one candidate bug, mutation-tested it
  away, shipped nothing.** A search for this run's task turned up a
  plausible-looking sibling of PR #125's tween leak: the songbook picker's
  `openPicker()`/`closePicker()` (`RoadScene.ts`) add a fade tween per part
  with no `killTweensOf` guard, same shape as the practice staff before
  #125. It is not the same bug. Built both versions and drove the exact
  toggle pattern that proved #125 real: with the picker's guard removed,
  `tweens.getTweens().length` spikes to ~35 mid-mash but **drains back to
  baseline within 1.5s of settling, every time** — no permanent growth,
  40 toggles or otherwise. #125's leak was never about "destroy doesn't
  kill a tween on the same target" in general; it was specifically the
  free-play cursor's `repeat: -1` breathing tween (line ~1352, in
  `fadeInFreeStaff`) — a tween with no natural end, so an orphaned copy
  runs forever. The picker's fades are one-shot 130ms tweens with no
  `repeat`; even orphaned, they finish and get pruned on schedule. Grepped
  the rest of `RoadScene.ts` for other `repeat: -1` tweens targeting a
  destroyable object: the bard's walk/idle/lute-sway loops are the only
  others, and their targets (`bardLegLeft`, `bardUpper`, `bardLute`, …)
  are never destroyed — they're stopped via `.stop()` in `bardTweens`,
  a different and already-correct mechanism. No other instance of the
  real bug shape exists in this file.
  **Logging this so a future run doesn't re-open the same lead**: adding
  `killTweensOf` to the picker anyway (it wouldn't hurt) and a fifth
  seam-check pair to cover it were both drafted, then reverted — the
  check would have passed trivially either way, which is exactly the
  false-confidence CLAUDE.md warns against, and the codebase's own rule
  against unnecessary guards applies here too. `RoadScene.ts` and
  `tools/seam-check.mjs` are unchanged from the last commit.
  Blockers re-checked, both unchanged: `WebFetch` on a plain Wikipedia
  page still returns HTTP 403 (forest-song transcription still blocked),
  and the full `mcp__github__*` tool list available this run still has
  no tag/ref-write, release-create, or branch-protection-write call.
  279 tests, `npm run build` green — reconfirmed as a baseline, no code
  touched.

- **Session of 2026-07-27 small hours (human-directed, PRs #115–#122):
  a polish pass, and it found three shipped bugs rather than cosmetics.**
  The practice staff — the whole second way to learn — had been drawn at
  **alpha 0 on the live site** since its lay-in animation shipped: two
  fade-ins ran back to back, the second reading the zeros the first had
  just written and tweening 0 to 0. The songbook and lute buttons were
  drawn *underneath* the song meter on every portrait phone, so both were
  invisible on the devices the game is for. And the road ran off the
  bottom of the screen in landscape, with the bard cut off at the shins.
  All three were invisible in the one configuration a check is most
  likely to be run in — a desktop-ish landscape window.

  **The lesson worth keeping: every one of them passed the checks.** The
  practice staff was built, positioned, laid out correctly at nine
  viewports, and responded to taps — `freeplay-check` asserted behaviour
  and never once asked whether anything could be *seen*. If a feature's
  purpose is visual, assert something visual: ink, contrast, geometry
  against real rendered bounds. Behaviour passing is not the same as the
  thing working.

- **Session of 2026-07-26 evening (human-directed, PRs #91–#112).** Two
  human asks: choose one song to learn instead of rotating, and find
  another way to learn besides the walking bard. Both built, plus an art
  pass. See DESIGN.md's "Two ways in".
  The most useful thing that came out of it, for whoever works here next:
  **the bugs were all in the interactions, not the features.** Each of the
  three new surfaces worked alone. Choosing a song *from inside free play*
  left the staff showing the previous tune and queued 26 phantom road notes
  behind it — which then went missed and fed the learning model. Rotating
  the phone *while practising* left the staff spread for the old screen
  with its lowest notes off the bottom. Neither would have been found by
  testing any one feature. Probe the seams. The three seams that were
  broken are now pinned by `freeplay-check` and `rotate-check`; the two
  that were already right (choosing "wander" from inside free play,
  reloading out of free play) are pinned too, so they stay right.

- **v0.5 "two ways in"** (human-directed, 2026-07-26) is the current shape.
  DESIGN.md has a new section of that name; read it before touching either
  mode. The walk is unchanged and remains the game.

- **There are two ways to learn now.** The *walk* is the original: notes
  scroll, you tap in time, letters fade as positions become familiar.
  *Free play* (the lute button) is the inverse — the staff spread out big
  and still, every position labelled, tap one to hear it. The walk asks for
  timing; free play asks for nothing. Free play deliberately does not feed
  the learning model.
- **With a song chosen, free play becomes practice**: the tune as positions
  to find, a pip marking the next one, and a wrong note that sounds and
  costs nothing. It is the only place in the game where *reading* the staff
  — rather than remembering how the tune goes — is what moves you forward.

- **The world got deeper and stopped looking tiled** (2026-07-26): a fourth
  parallax plane (a far ridge behind the scenery, at 0.19 vs scenery 0.45
  and stars 0.08) and scenery tiles doubled to 512px with silhouettes that
  differ *within* one tile. Far-layer colour is derived by receding each
  biome's own silhouette toward its own sky, so it stays right for free
  when a palette is re-pitched.

- **You can now choose one song to learn** instead of letting the songbook
  rotate (human-set, 2026-07-26). Songbook button beside the mute toggle →
  pick a tune → it repeats and the road settles in its home biome. "Wander"
  gives the rotation back. The choice rides in the same localStorage record
  as the scaffold, so it is still there tomorrow.

- The game is **v0.5**: a rhythm walk where the letter inside each note
  fades *in time* as a position is practised, across sittings, persisted in
  ~200 bytes of `localStorage`. The core mechanic is one tap. v0.5 adds the
  song choice and the second way in; it does not change the walk.
- **Eleven songs**, four per biome except forest, which has three and is
  short a fourth (blocked — see *Blocked on human*).
- **279 unit tests**; **24 headless checks** in `tools/`. Run them all with
  `PLAYWRIGHT_PATH=<dir>/node_modules/playwright node tools/verify-all.mjs`
  (or `quick` for the fast fourteen). Green as of 2026-07-27. Use playwright
  **1.56.1**
  (`/opt/node22/lib/node_modules/playwright`) — a newer copy won't match
  the installed browser build and every check will fail for that reason
  alone. **Run the suite quiet** — two Playwright suites at once will fail
  `autoplay` on frame timing and it looks exactly like a real regression.
  The fast fourteen
  now also run automatically after every merge to `main`
  (`.github/workflows/headless-checks.yml`), informational only — it
  doesn't gate the merge or the deploy.
- **Source layout**: `core/` pure logic, `audio/` one manifest + engine,
  `render/` texture baking (engraving, scenery, ui), `scenes/picker.ts` the
  songbook overlay (split out 2026-07-27, task 107), `scenes/RoadScene.ts`
  the one scene (2172 lines — the free-play staff and the walk chrome are
  the two remaining plausible extractions, neither an automatic next task;
  see ROADMAP task 108). Layout maths keeps
  moving *out* of it into `core/` — `hud.ts` (the top bar) and
  `worldLayout.ts` (lane, bard, road) joined `freePlay.ts` on 2026-07-27,
  each because a fixed pixel offset hung off a proportional anchor had
  broken on some real screen. That pattern is worth watching for. Every texture the game draws
  is checkable in a deterministic sheet — `proofsheet`, `scenery-sheet`,
  `ui-sheet` — which is what let all three extractions be proved
  byte-for-byte rather than eyeballed.
- **The one *blocking* question the project cannot answer itself** is
  whether the fade pace suits a real five-year-old. The single dial is
  `SESSION_GAIN_CAP`. Several things that used to need a human have since
  been mechanised (backgrounding, gesture lockdown, layout, legibility at
  deep night) — but not all: judging *feel* still needs hands and ears
  (is 96 BPM right for a small child, does the ±90ms window forgive a young
  hand, is the music actually cozy), and the teaching outcome still needs a
  child. See PLAYTEST.md.
- **Standing lesson from the 2026-07-26 session**: when a check fails,
  suspect the check first. Around a dozen "bugs" that session turned out to
  be in the instrument, not the game — a harness that paused its own taps, a
  tap landing outside a rotated viewport, a comparison against a leftover
  PNG from a crashed run, a reload that force-saved over the state being
  tested, and the wrong AudioContext among them. Every harness now documents
  its wrong versions alongside its right one; that write-up is the most
  useful thing in `tools/README.md`.

### v0.4 and the session of 2026-07-26

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

**25-minute soak: no degradation of any kind** (2026-07-26, the longest run
yet — 150 samples, 2393 steps ≈ 153,000px, so **3.2 full dusk cycles and
~9.6 biome loops**). fps is flat end to end (24/21/17/20/18 at the start,
20/20/21/22/19 at the finish, min 15 — no downward trend), textures plateau
at 118 once all eleven songs have been met, the marker list peaks at 70, and
2110 of 2115 taps land. All eleven songs appear in the rotation. This is the
scenario a short run structurally cannot test — a child who leaves the game
running — and nothing drifts.

**Long-session stability confirmed clean** (7-minute autoplay): fps holds
17–23, textures plateau at 109 (bounded by the songbook — 85 note/rest
textures plus scenery and UI, so not a leak), markers stay bounded, and
590 of 592 taps land. An earlier run showing fps 11 and 201 misses was my
own CPU contention from running three Chromium instances at once — a
reminder to run long measurements alone. `autoplay.mjs` now asserts the
texture count plateaus.

**Consolidation: the engraving has its own module** (`src/render/engraving.ts`,
2026-07-26). RoadScene had grown to 1584 lines — 46% of the codebase in one
file, which is a real risk for autonomous runs that have to read it before
touching it. The note and rest glyph baking moved out with its geometry
constants: 1584 → 1485 lines in the scene, 156 in a module that has no
access to game state and so cannot start depending on it. A glyph is a pure
function of (name, position, note value), which is exactly what lets
`proofsheet.mjs` check every combination at once.

Proved behaviour-preserving rather than assumed: the proof sheet is
**byte-identical** before and after (md5 `fbc8094…`), and all seven
harnesses pass. Two things worth keeping from how that went:

- The refactor **broke `proofsheet.mjs`**, which called a private method on
  the scene. The engraving functions are now exposed on `window.engraving`
  from `main.ts`, deliberately and with a comment, instead of tooling
  reaching into scene internals.
- The first "identical" result was a **false pass**: the script had crashed,
  so the comparison ran against the previous run's leftover PNG. Delete the
  artefact before regenerating it — otherwise a screenshot diff confirms
  that nothing changed about an image nothing rewrote. Third instrument bug
  of the session, same lesson each time.

**Consolidation, second chunk: the scenery too** (`src/render/scenery.ts`).
The road, biome silhouette, water-glint, star-field and signpost bakers
moved out the same way: **RoadScene 1485 → 1325**, and across both chunks
**1584 → 1325** with 359 lines now living in two focused render modules.
The tile dimensions are exported from the module rather than duplicated,
because the scene has to *place* what the module *draws* and two copies of
those numbers would be free to drift apart.

Verified by a new `tools/scenery-sheet.mjs`, which bakes all ten world
textures into one labelled sheet — a live screenshot only ever shows the
biome you happen to be walking through. Sheet **byte-identical** across the
move (md5 `0126afb…`), proof sheet still byte-identical too, and all eight
harnesses green.

Note for whoever refactors next: the first attempt at this extraction used
a regex to find method bodies and silently removed **478 lines instead of
163** — the optional doc-comment group matched a comment far above. Caught
by `wc -l` before anything else ran, reverted with `git checkout`. Match
method spans by walking braces line-by-line, and check the line delta
against what you expected before running any test.

**The song title is proven to name the tune actually playing**
(`tools/title-check.mjs`). Passes are queued a lookahead ahead of playback,
so `announceSong` holds the title until the music reaches that song's first
note — arithmetic with no test behind it, and getting it wrong would teach a
false name to exactly the child who is paying attention. Every title lands
within ~50ms of its own pass starting. Took three instrumentation attempts
(marker-index slicing, then pairing schedule calls to titles by index, then
finally matching each title to whichever pass was playing); the game was
fine in all three.

**The mobile gesture lockdown is asserted, not just written.**
`index.html` has long disabled double-tap-to-zoom, pinch-zoom, the
long-press callout and overscroll — rapid taps are the input model, so a
browser reading two quick taps as "zoom" fights the game. It was all CSS and
a meta tag with nothing checking it, which is exactly what a later edit
strips without noticing. `pillar-check` now reads the computed result at
every viewport, plus the observable consequence: the page must not scroll.
Mutation-checked.

**Backgrounding is mechanised, and Phaser's spare AudioContext is gone**
(`tools/backgrounding-check.mjs`). "Audio resume after backgrounding" had
been a *human* playtest item since round 1; it did not need to be. Forcing
the suspend and observing the resume gives `running → suspended → running`,
with the learning record force-written on the way out and sound plus meter
fully restored on return. A real device is still needed for whether iOS
suspends in ways Chromium does not — the question is narrowed, not closed.

Writing it found something real: **Phaser's sound manager was creating a
second, unused AudioContext** and holding it open all session. Every sound
here is hand-rolled Web Audio, so it is disabled now
(`audio: { noAudio: true }` in `main.ts`) — one fewer idle claim on a
phone's audio hardware. The first version of the check grabbed *that*
context, watched Phaser resume it, and concluded the game had failed to
suspend.

**The bundle-size pillar has a number behind it now.** CLAUDE.md asks for
"small bundle (<5 MB)" and nothing measured it. `pillar-check` now sums
everything the page pulls over the wire — what a phone actually downloads
to play, rather than `du -sh dist` — and asserts the pillar. Currently
**1.19 MB**, four times the headroom. Mutation-checked by tightening the
threshold to 1 MB and confirming it fires, since a guard that cannot fail
is worthless.

**The no-fail promise is now asserted** (`tools/nofail-check.mjs`). Every
other harness plays well or plays chaotically; none checked what happens to
a child who simply is not managing. Tapping once and then doing nothing for
45s: the meter floors at 0 and the bard stops, but the scene stays active,
notes keep arriving so the child can rejoin whenever they like, the missed
note is mauve (`0x8A5A5A` — red channel nowhere near dominant, per
DESIGN.md's "nothing flashes red"), the only text on screen is the song
title and the readouts, and nothing sounds on a miss. That last one is
asserted via an oscillator-rate ceiling: the tune plays on regardless of
the meter (deliberately — it is how a lost child hears where they are), so
the test allows three layers at tempo and would catch a buzzer added on top.

**Deep night proven not to dim the teaching surface**
(`tools/dusk-check.mjs`). The art direction promises the dusk cycle darkens
the world but never the bard or the notation; nothing asserted it. At the
deepest point of the cycle the sky moves 2759214 → 794387 and the
road/scenery tint drops, while note tint, note alpha, staff line colour and
alpha, and clef tint and alpha are all **byte-identical**. The check asserts
both halves — without confirming the world actually darkened it could pass
just because the cycle had stopped running.

**Mute and the keyboard now have coverage** (`tools/input-check.mjs`).
Every other harness taps the middle of the canvas, so these two paths had
none at all — and mute is the control a *parent* reaches for. Verified that
muting zeroes the master gain rather than only changing the icon (the icon
can lie; the gain cannot), that the slash appears, that pressing mute is
never scored as a beat even though the button sits over the playfield, that
the walk keeps earning while muted, that unmuting restores gain, and that
the spacebar plays (19 hits, 0 misses). All good, no code changes needed.

**Mashing is safe, and earns credit it hasn't earned**
(`tools/mash-check.mjs`). Every other harness plays correctly — on the beat,
one tap per note — which is the least likely thing a five-year-old does. At
38 taps/sec for a minute the game is fine: markers and textures bounded,
fps 36, saved record valid. Taps that hit nothing cost nothing — only 80
encounters and 461 oscillators from 2274 taps, so a stray tap neither feeds
the model nor makes a sound.

The honest caveat: those 80 were all *hits* with zero misses, because
spraying taps lands on every note. The model reads that as familiarity and
will fade letters for a child who is not looking at the staff. **Left alone
deliberately** — DESIGN.md scopes the model as a dosage schedule driven by
exposure rather than an assessment, and the design self-corrects: letters
faded without being learned mean the child struggles next time they play
properly, the meter drops, and full support returns instantly. A
burst-detector would be a new system guarding something the existing one
already absorbs.

**The moon has craters** — the last flat thing in the world. Everything
else carries shape (gables and lit windows, conifers and fireflies, a tent
and a campfire); the moon was a plain disc and it is the largest object in
the sky. Baked as a texture now, craters only slightly darker than the disc
and clear of the rim, so it still reads as a light source rather than as
detail to study. In `render/scenery.ts`, covered by `scenery-sheet.mjs`.

**Coming back after days away is verified end-to-end**
(`tools/timeaway-check.mjs`). The decay arithmetic was unit-tested but the
round trip through real `localStorage` with a real backdated timestamp was
not — and that path fails silently and unkindly if it fails at all. Two
sittings of practice, then a backdated record: well-practised positions
held, a mid-strength one decayed and was handed a band of help back, no
record was ever wiped, and a deliberately corrupted record starts the game
fresh rather than breaking it. The check asserts a gap can only ever return
support, never remove it, and never raises a position's `peak`.

Two traps in writing it, both documented in `tools/README.md` because
anything touching this storage will hit them: **a reload force-saves** (it
fires `visibilitychange` → hidden, the scene's own save path, so backdating
and then reloading writes the live state and a fresh timestamp over the
backdate and the gap never happens), and **saves are throttled to 5s** (so
a baseline read straight after playing is stale, which made a gap look as
though it had *added* practice).

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
- **This environment cannot reach the open internet.** Outbound fetches get
  403 on CONNECT to every host — including `at3gk.github.io`, so the *live*
  deployed site cannot be checked from here; the green `Test, build, deploy`
  run on `main` is the only production signal available. Web *search* does
  work (it goes through the model's own API), but it returns titles and
  summaries, not page contents. Don't spend a run re-testing this.
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
- **The checks run in place now.** `export
  PLAYWRIGHT_PATH=<dir>/node_modules/playwright`, then
  `node tools/verify-all.mjs` from the repo. They used to have to be copied
  next to the Playwright install, and running the copies is how this session
  twice tested a stale script — once letting a crashed run "prove" nothing
  had changed. Artefacts land in the working dir and are gitignored.
- **Run the checks with one command**: `node tools/verify-all.mjs` (all
  15, ~20 min) or `... quick` (the fast eight, ~5 min), from the directory
  where Playwright is installed, with `npm run preview` up. It runs them
  serially on purpose — several Chromium instances starve each other, and a
  long run measured under that contention reported 11fps and a third of its
  taps missing against a game that was completely fine.
- **When a check fails, suspect the check first.** This is the single most
  useful thing the 2026-07-26 session learned, and it learned it seven
  times. A harness that paused tapping during a rotation; one that tapped a
  fixed point outside a landscape viewport; one comparing a marker to the
  wrong oscillator; one indexing oscillators as interleaved when they are
  grouped by layer; one comparing against a leftover PNG from a crashed
  run; one whose baseline was a stale throttled save; one measuring under
  its own CPU contention. Every one produced a confident, specific,
  plausible failure. None of them was the game. Before changing code to fix
  a failing check, make the check prove it can see its own success case.
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
- Run 34 (2026-07-26, scheduled): coin chime per new ROADMAP task 78,
  promoted from the idea backlog after re-checking both *Blocked on human*
  items (still blocked — see below) and finding no playtest answer waiting.
  `AudioEngine.chime()` sounds a quiet, fixed sine two octaves above the
  root on every 25th coin; `core/coins.ts` gained the pure
  `crossedCoinMilestone` to detect a whole-coin threshold against
  continuous fractional accrual. New `tools/coinchime-check.mjs` (added to
  `verify-all`'s fast set) hooks oscillator creation the way
  `nofail-check`/`autoplay` do to confirm it headlessly, since nothing here
  can listen. `npm test` 215 green (8 new), build green, `verify-all quick`
  (9 checks) green.
- Interactive session (2026-07-26, overnight): the long one. Shipped as
  PRs #57–#84, each squash-merged to `main`, every deploy green.

  **Product changes** (the parts a player can meet): two verified songs
  (*This Old Man*, *The Itsy Bitsy Spider*); **one real bug fixed** — the
  audio clock was anchored once at `start()` so the tune drifted off the
  staff over a long sitting, and is re-anchored per pass now; `wasUnplayable`
  keeps a note whose whole hit window vanished in one frame gap out of the
  learning model; the moon got craters; and Phaser's unused second
  AudioContext was disabled.

  **Structure**: texture baking split into `render/{engraving,scenery,ui}`,
  RoadScene 1584 → 1264, each move proved byte-identical by a deterministic
  texture sheet.

  **Verification**: 4 harnesses → 16, one runner (`verify-all`), runnable in
  place from the repo. New ground covered — the design pillars across nine
  viewports down to 320px, the bundle-size number, phone rotation, days
  away, mashing, mute and the keyboard, backgrounding, the gesture lockdown,
  legibility at deepest night, the no-fail promise, and that the song title
  names the tune actually playing. Tests 179 → 207.

  **Corrected two claims the docs were making**: "fade the prompt, never the
  answer" was credited to reveal handlers that provably never fire (the real
  guarantee is stronger and is now a pinned invariant), and two PLAYTEST
  items asked about machinery replaced in v0.3.

  The through-line: **around a dozen "bugs" this session were in the check,
  not the game.** A harness that paused its own taps; one tapping outside a
  rotated viewport; one comparing against a leftover PNG from a crashed run;
  one whose reload force-saved over the state being tested; the wrong
  AudioContext; an oscillator list indexed as interleaved when it is grouped
  by layer. The game was consistently in better shape than the instruments
  measuring it. Every harness now documents its wrong versions next to its
  right one — that write-up is the most useful thing this session produced
  for whoever runs next.
- Run 35 (2026-07-26, scheduled): wired the headless checks into CI, per
  new ROADMAP task 79 — see its done-entry for the full writeup. Short
  version: all 18 `tools/*.mjs` scripts hardcoded this environment's own
  Playwright browser path, which is why they were never run in CI; removed
  the hardcode (Playwright resolves its own browser without it, verified
  both here and via a deliberate version-mismatch check), and added
  `.github/workflows/headless-checks.yml` — the fast nine run after every
  merge to `main`, informational only (`continue-on-error`, not a required
  check), since this environment can't watch a real Actions run land to
  confirm it end-to-end. `npm test` 215 green (no game code touched),
  build green, quick suite 9/9 green on a clean local re-run (one
  `dusk-check` flake on a loaded run didn't reproduce — see task 79).
  **Confirmed (2026-07-26, same day, follow-up check)**: `headless-checks.yml`'s
  first-ever run (on the merge commit, run #1) came back green on a real
  GitHub-hosted runner — Playwright installed fresh, Chromium downloaded
  fresh, all 9 quick checks passed
  (https://github.com/at3gk/WanderingBardGame/actions/runs/30210381321).
  The step itself succeeded (not just masked by `continue-on-error`), so
  the portable-browser-resolution fix holds outside this environment too.
  Nothing further needed here.
- Run 36 (2026-07-26, scheduled): resolved ROADMAP task 92 (see its done
  entry) rather than shipping game code — the previous PR (#107) had
  already merged onto `main` by the time this run started, and the
  designated working branch was reset onto it fresh
  (`git checkout -B <branch> origin/main`), per this project's own
  merged-PR-restart convention.
  Re-checked both standing blockers (unchanged) and found `headless-checks.yml`
  now has **19/19 green runs** since it landed — a real pattern, not the
  single data point task 79 had. But turning that into an actual required
  merge gate needs GitHub branch-protection configuration, and the GitHub
  MCP toolset available here has no call that writes branch-protection
  rules — confirmed by scanning the full tool list, same shape of gap as
  the missing tag/ref-write call. Logged as a new Blocked on human item
  below rather than guessed at. Also weighed and rejected adding a
  `pull_request` trigger for pre-merge-only visibility: GitHub holds a PR
  non-mergeable while any attached check is still running regardless of
  whether it's required, so that would add several minutes to every merge
  in the three-times-daily cycle for a check nobody watches live between
  runs — a real cost to the pipeline's cadence for no real benefit here.
  `headless-checks.yml` is unchanged. `npm test` 254 green (unchanged),
  build green — re-confirmed as a baseline, no code touched this run.
- Run 37 (2026-07-27, scheduled): resolved ROADMAP task 104 (see its done
  entry). Both standing blockers re-checked and unchanged (forest-song
  fetch still 403s; GitHub MCP toolset still has no tag/ref-write or
  branch-protection-write call), no playtest answer had arrived, and the
  idea backlog is down to one phone-dependent item — so this run fixed what
  the re-check itself turned up instead of inventing new scope: the root
  `README.md` and `.github/workflows/headless-checks.yml` both still
  quoted "seventeen checks" / "the fast nine", stale since task 79 first
  wired CI — four checks landed since (`hud-check`, `ground-check`,
  `bard-check`, `seam-check`) and were never counted, even though
  `tools/README.md` and `verify-all.mjs` already had the right numbers (24
  total, 14 quick). Corrected both. No game code touched; `npm test` (279
  green) and `npm run build` (1.27 MB) reconfirmed, and the full 14-check
  quick suite run once end-to-end to confirm the re-check found no
  regression: all 14 green, no drift.
- Run 38 (2026-07-27, scheduled): resolved ROADMAP task 105 (see its done
  entry). Investigated a candidate tween leak in the songbook picker
  (`openPicker`/`closePicker`, same missing-`killTweensOf` shape as #125's
  practice-staff bug) and mutation-tested it away rather than shipping a
  speculative fix — the picker's fades are one-shot and finish on schedule
  even orphaned, unlike #125's `repeat: -1` breathing tween. Shipped
  nothing; `RoadScene.ts` unchanged. `npm test` 279 green, build green,
  reconfirmed as a baseline.
- Run 39 (2026-07-27, scheduled): resolved ROADMAP task 107 (see its done
  entry and Current status above for the full writeup). Split the songbook
  picker overlay into `src/scenes/picker.ts` — the consolidation this file
  had flagged as the obvious next one, `RoadScene.ts` having regrown to
  2275 lines since task 66. `npm test` 279 green (unchanged), build green
  (1.27 MB, unchanged), full 14-check quick suite plus `songpick-check`
  green with zero regressions.
- Run 40 (2026-07-28, scheduled): resolved ROADMAP task 108 (see its done
  entry and Current status above). Tested the "a resize re-runs `create()`"
  assumption five pieces of documentation asserted flatly and found it does
  not hold in headless Chromium: zero additional `CREATE` events across two
  rotations, same scene instance and GameObjects throughout. Kept the
  defenses it produced (cheap insurance against a real device behaving
  differently) but corrected the docs and pinned the count as an assertion
  in `rotate-check.mjs`. `npm test` 279 green (unchanged), build green,
  full 14-check quick suite green.
- Run 41 (2026-07-28, scheduled): resolved ROADMAP task 109 (see its done
  entry and Current status above for the full writeup). Split the
  free-play staff out of `RoadScene.ts` into `src/scenes/freePlayOverlay.ts`
  — the "real first piece" task 108 left as legitimate-but-unscoped work.
  `RoadScene.ts` 2172 → 1838 lines. `npm test` 279 green (unchanged), build
  green (1266.81 KB vs 1267.23 KB), full 14-check quick suite plus
  `songpick-check`, `rotate-check` and `seam-check` green with zero
  regressions. Caught and fixed one transcription slip (a tween option
  misread off a truncated file read) before it ever reached a check.

- **Session close, 2026-07-27 small hours (human-directed, PRs #115–#122).**
  Asked for a polish pass on art, animation and the game. It found three
  bugs that were live rather than cosmetic, all of them invisible in
  landscape on a desktop-ish window and all of them passing every check:

  1. **The practice staff was drawn at alpha 0** — the entire second way
     to learn, invisible on the deployed site since its lay-in animation
     shipped. Two fade-ins ran back to back; the second read the zeros the
     first had just written, took them for each part's *target*, and
     tweened 0 to 0. Both halves correct alone.
  2. **The songbook and lute buttons were under the meter** on every
     portrait phone. Buttons counted pixels from the left; the meter took
     60% of the width and centred itself; nothing had asked those rules to
     agree, and they only do on a wide screen.
  3. **The road ran off the bottom in landscape**, 48px on a 568x320
     screen, leaving 12 of its 60px and the bard cut off at the shins.

  Also shipped: a fifth parallax plane (the near verge at 1.35, the first
  thing in the game that moves faster than the road) over real earth,
  because below the road there had only ever been the camera's background
  colour — the sky. A scrim behind the practice staff. The meter handed
  cream back to the notation and took gold, and its five staff lines were
  made to resolve as lines rather than a smear (18px bar, half-pixel
  offsets). The bard eases in and out of walking instead of snapping every
  limb to neutral on the frame the meter crossed its threshold.

  Three new harnesses, and the reason each exists is the same: nothing had
  ever asserted the thing it covers. `hud-check` (chrome geometry and that
  each button does its own job), `ground-check` (the bard's real rendered
  bounds land on a visible road at eight viewports), `bard-check` (start,
  stop, rest and breath), `seam-check` (mute x practice, tab-away x
  practice, rotation x the ground — all three passed first time, which is
  why they are worth holding still).

  What to carry forward:
  1. **If a feature's purpose is visual, assert something visual.** The
     practice staff passed every behavioural assertion in `freeplay-check`
     while being completely invisible. Ink, contrast, and geometry against
     real rendered bounds are what would have caught it — and do now.
  2. **A fixed pixel offset hung off a proportional anchor is this
     codebase's recurring bug.** Three instances so far (free-play staff,
     top bar, lane-to-ground). Each moved into `core/` as testable maths.
     Grep for the pattern before adding a fourth.
  3. **Run the check suite quiet.** Two Playwright suites at once fails
     `autoplay` on frame timing and reads exactly like a regression.
  4. **A visual check is easy to write wrong and it will still pass.**
     `bard-check` took four tries and every wrong version was green:
     per-frame delta (frame-rate dependent), triggering the state change
     from Node (missed the 150ms window entirely), scanning the whole
     sample (measured an ordinary walk-cycle crossing and called it the
     stop — that one passed against a build with the ease cut to 1ms), and
     not holding the meter up (the bard had already stopped before the
     sample began). Mutation-test every new check against the fault it
     exists to catch, before believing a green.

- **Session close, 2026-07-26 evening (human-directed, PRs #91–#113).**
  Shipped: the song picker (the human's one hard requirement — pick a tune
  and it repeats instead of the songbook rotating), free play and its
  practice mode (the second way in), and an art pass (fourth parallax
  plane, 512px scenery with silhouettes that vary within a tile, road
  verges, a contact shadow under the bard). 258 tests, 19 headless checks,
  three new harnesses (`songpick-check`, `freeplay-check`,
  `practice-soak`), and an eight-minute drill soak (8576 notes) that
  accumulates nothing.

  What to carry forward, in order of how much it will save you:
  1. **Probe the seams, not the features.** All three defects this session
     were cross-surface. Every feature passed alone.
  2. **`RoadScene.ts` is 1979 lines** and wants the next consolidation
     run. Picker overlay, free-play staff, walk chrome — three clean
     extractions, each provable byte-for-byte against a texture sheet.
  3. **Playwright 1.56.1 or every check lies to you.**
  4. The blockers did not move: the fade pace still needs a child, the
     fourth forest song still needs a source the sandbox can fetch, the
     v0.1 tag still needs a call the MCP toolset doesn't have.

- Run 44 (2026-07-29, scheduled): deleted the dead 2D/Phaser code — see
  the Run 44 note in "At a glance" above for the full detail (files
  removed, bundle size, the 24 dead checks, and what wiring `shader-check`
  into `verify-all.mjs` for the first time turned up). `npm test` 745
  green, `npm run build` green, bundle 686 KB. No feature work; this was
  the first item STATE.md had flagged as next after the v0.6 merge.

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
- **Promoting `headless-checks.yml` from informational to a real merge
  gate** (2026-07-26, Run 36). The check has gone 19/19 green since it
  landed (task 79) — a real pattern now, not a single lucky run. But making
  a GitHub Actions check actually block a merge requires it to be named as
  a **required status check** in the repo's branch-protection settings for
  `main` (GitHub Settings → Branches → Branch protection rule → "Require
  status checks to pass before merging" → add `quick` from the "Headless
  checks" workflow), which is a repository-admin action. The GitHub MCP
  toolset available in this environment has no call that writes
  branch-protection rules (only read/write calls for files, branches, PRs,
  issues and releases were found on a full scan) — the same shape of gap as
  the missing tag/ref-write call below. Once a human enables that setting,
  a future run should also flip `.github/workflows/headless-checks.yml` to
  trigger on `pull_request` (not just `push: main`) and drop
  `continue-on-error: true`, so a real failure actually blocks auto-merge
  instead of only reporting after the fact.
- **A fourth forest song** (2026-07-26). Village and riverside rotate four
  tunes each; forest has three. The candidate is chosen and researched:
  **Here We Go Round the Mulberry Bush** — traditional, the tune Nancy
  Dawson danced into fame in 1700s London, so clearly public domain. It
  uses scale degrees 1/2/3/5/6/7 only, which makes it naturals-only in C
  major, sitting G4–G5: exactly the forest register, and its lowest note
  matches Twinkle's, so it passes the biome staff-region test.
  What is missing is a **note-for-note transcription verified against a
  published source**. This environment's network policy blocks outbound
  fetches (403 on CONNECT to every host); web *search* still works but the
  snippets carry titles, keys and provenance, never note sequences. That
  standard is not negotiable here — a forest transposition of *This Old
  Man* was drafted and rejected for matching the real tune in only 6 of 32
  notes, and a wrong contour actively mis-teaches a child who knows the
  song. Needs a run with network access, or a transcription from a human.
  (*Wheels on the Bus* is the obvious alternative and is **rejected on
  rights**: attributed to Verna Hills, 1939, which fails CLAUDE.md's
  CC0-only rule.)
  **Update (2026-07-26, Run 34)**: re-checked — `WebFetch` still returns
  HTTP 403 on every host tried, including a plain Wikipedia page (not just
  music-transcription sites), so this isn't a site-specific block. Blocker
  confirmed, nothing new to route around.
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
  **Update (2026-07-26, Run 34)**: re-checked the GitHub MCP tool list again
  — still `get_tag`/`list_tags`/`get_release_by_tag`/`get_latest_release`
  only, no ref-write or release-creation call. Blocker unchanged.
