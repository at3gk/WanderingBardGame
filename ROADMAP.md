# ROADMAP

One task per run, in order. Reprioritize/cut freely (log cuts in DESIGN.md's
changelog) but don't skip ahead — each task assumes the previous ones landed.

## Start here

This file is an append-only record of every task and why it was done, which
makes it long. You do not need to read it top to bottom.

- **What to do next**: read STATE.md's HANDOFF block first — it is the
  authoritative, every-run-updated pointer. As of run 140, the live queue
  is **v1.1, "the crafted frame"** (task 166 onward, further below): a
  wave-based art-quality loop, judged by blind panels of opus judges
  standing in for the human eyes v0.7 assumed weren't available, plus the
  186 creature family it's tracked only in STATE.md's handoffs so far.
  Run 136 measured (not fixed — it's a real design call, sized separately)
  a candidate next lever: vista frames occasionally show zero large-form
  scatter (rock/shrub/log) in one quadrant, same shape as the tree
  sentinel guarantee before it existed — see STATE.md's run-136 handoff
  and `tools/scatter-probe.mjs` before deciding whether that's worth a
  `waysideSentinelSites`-style fix or is fine left as-is. Run 137 closed
  task 143 (the road's soft edge, a real fix — see its done-note) and
  corrected a stale claim on task 144 (the bard already casts a shadow;
  only its terrain self-shadow half is still parked). **TASK 169 ("terrain
  as the hero surface") IS NOW DONE (run 139)**: it folded in 143/144/149,
  and the last open piece — 149's one sliver, "07's night spikes"/the
  dark-meadow wavy read — closed this run with `tools/ground-cover-probe.mjs`
  (built on `scatter-probe.mjs`'s projection method, sampling actual
  rendered pixel colour through the finishing pass). The finding is a
  REFUTAL with a positive cause, not a shrug: the pinned `07-night-campfire`
  postcard pose (`s: 1400`) puts ZERO grass/fern instances anywhere on
  screen (a harness pose bug — `RoadStage.makeCamp` builds the camp at the
  road's real last stop, not at whatever `s` a pose asks for), so the
  texture a human sees in that exact image cannot be ground-cover colour by
  construction; where grass/fern IS in view (a corrected pose matching real
  play), its rendered colour shows a low, ordinary spatial-banding share —
  no real streak. See STATE.md's run-139 handoff and ROADMAP task 149's own
  done-note for the full account, including two things run 139 explicitly
  did NOT chase (both flagged as follow-ups, not fixed then): the
  postcard.mjs `s: 1400` resting-pose mismatch itself — **fixed, task
  187, run 140** — and the app.renderer/finishing.render discrepancy in
  the rest of the pixel-reading tools — **now fixed too, task 188, run
  141** (see STATE.md's run-141 handoff) — and an incidental observation
  that the wider meadow's lumpy look in a correctly-posed resting frame may
  be SHRUB silhouette density rather than grass/fern colour at all — a
  different vocabulary question. **v0.9**
  (retention, "the road home") and **v1.0** (the Festival of the Long Road
  arc) are both complete as of run 135 — read them for *why*, not for open
  work. **v1.3** ("the family songbook," task 176 onward) is queued and
  entirely untouched since being written 2026-08-01 — a reasonable next
  arc once the art-quality loop reaches a natural pause.
- The **v0.7 queue** right below (tasks 122-128) is superseded, not next:
  it was written on the premise that "no agent in this environment can
  judge art quality," which the v1.1 queue's blind-panel system (run 135
  consolidation note) proved wrong — those six tasks are on hold because a
  working substitute was built, not because the questions stopped
  mattering.
- The **v0.6 queue**, task 115 onward, sits below v0.7. It supersedes the numbered entries below: a human reset the
  direction on 2026-07-28 and the game is now a 3D one (DESIGN.md, "The
  road in three dimensions"). Entries up to 113 remain the record of how
  the 2D game was built and are still worth reading for *why* something is
  the way it is — several of their conclusions (the no-fail stance, the
  notation rules, the mobile layout lessons) carry straight over. Tasks
  109-113 split the Phaser `RoadScene` into modules; task 114 deleted that
  whole 2D presentation layer once v0.6 made it dead code.
- **Why something is the way it is**: find its numbered done-entry. They are
  written to be read later and are referenced by number from STATE.md.
- **Before you start**: read STATE.md's "At a glance" — it is the short
  version of where the project stands.
- **Before you finish**: `npm test && npm run build`, then
  `node tools/verify-all.mjs` with the preview server up. See
  `tools/README.md`. Point `PLAYWRIGHT_PATH` at playwright **1.56.1**
  (`/opt/node22/lib/node_modules/playwright`); a newer copy fails every
  check on a browser-build mismatch that looks like a real regression.

Everything below task 12 is v0.1 history and is only worth reading if you
are tracing a specific decision.

1. **Scaffold.** Vite + Phaser 3 + TypeScript + Vitest project. `vite.config`
   base set to `/WanderingBardGame/`. Empty Phaser scene that boots to a
   blank canvas. `npm test && npm run build` green. Confirm CI/deploy
   workflows pick it up and the Pages URL is live (even if blank).
2. **Beat timing core.** Pure TS module (no Phaser/DOM) implementing beat
   spawn scheduling, scroll-to-hit-line timing, hit-window checking, and
   song-meter fill/drain math. Fully covered by Vitest — this is the one
   core mechanic's logic, get it right and tested before it touches
   rendering.
3. **Render the lane.** Phaser scene renders the single beat lane using
   the timing core from task 2. Wire up tap/click/keyboard input to call
   the hit-check function. Visual hit/miss feedback (simple, no polish).
4. **Song meter UI.** On-screen meter reflecting the fill/drain state from
   the timing core. Walking-vs-stopped state derived from meter threshold,
   exposed as a value the next tasks can read (no bard sprite yet).
5. **Bard sprite states.** Placeholder bard sprite (procedural/CC0) with
   walk and idle animations, switching based on the walking-vs-stopped
   state from task 4.
6. **Scrolling road.** Background scroll speed tied to walking state.
   Single biome backdrop for now.
7. **Procedural audio base layer.** Web Audio-generated (or CC0 sample)
   backing loop tied to the beat tempo, playing continuously as the base
   layer. Keep all audio behind one manifest file per CLAUDE.md.
8. **Audio layering.** Additional instrument/voice layers fade in as song
   meter rises past thresholds, fade out as it falls — the audio becomes
   the primary feedback for how well the player is doing.
9. ~~**Second biome + transition.**~~ Done (Run 9): distance-traveled
   counter drives a crossfade to a second "Forest Dusk" scenery biome.
10. ~~**Consolidation pass.**~~ Done (Run 10): no vision drift found; fixed
    one visual rough edge (hit-line indicator overlapped the bard's head —
    see STATE.md). Bundle size and mobile touch input re-verified green.
11. ~~**Coin readout.**~~ Done (Run 11): coins accrue continuously at a rate
    scaled by the live song-meter ratio, displayed via a procedural coin
    icon + count in the top-right corner. No drain, no shop, no spend loop
    — a pure readout.
12. ~~**v0.1 ship check.**~~ Done (Run 12): every DoD item in DESIGN.md
    verified against a real production build (`npm run build` + `vite
    preview`, live Pages URL unreachable from the sandbox — see STATE.md).
    All met, nothing to cut. The `v0.1` git tag itself is **blocked on
    human** — this environment's git/GitHub write access can't push a tag
    (see STATE.md's Blocked on human section for the exact command a human
    needs to run).
13. ~~**(Post-v0.1) Unbounded beat schedule.**~~ Done (Run 13): the beat
    schedule now generates in 300-beat batches, appending the next batch
    once the current one's runway drops under 15s (`RoadScene.
    appendBeatBatch`, called from `update`). `AudioEngine` gained a
    matching `extend` method so the backing loop's notes keep pace with
    the visual schedule instead of going silent after ~3 min. Resolved
    markers are now filtered out of `RoadScene.markers` each frame so a
    long/unbounded session doesn't accumulate unbounded memory. Not
    required for v0.1's Definition of Done (v0.1 already shipped); this
    closes the "endless road" gap flagged in DESIGN.md's Run 10 changelog
    entry.

14. ~~**(Post-v0.1) Human playtest pass.**~~ Done (2026-07-25, interactive
    session): a human played the build and answered structured feedback
    questions. Verdicts folded into constants the same session: hit window
    was **too loose** (`HIT_WINDOW_MS` 120 → 90), meter **refilled too
    slowly** (`hitGain` 8 → 12), the melody **read as random** (all three
    layers recomposed as 8-beat pentatonic phrases with a shared arch
    contour — see manifest.ts), the **walk/scroll mismatched** (both now
    derived from the beat: one footfall per beat, one road tile per
    footfall), and **biome shifts were too weak** (palettes re-pitched
    with clearly separated hues). The bigger art-direction feedback —
    better bard animation, actual background features per biome, a real
    art-style focus — is multi-run work, split into tasks 30–32 below.
    Retuned constants need a round-2 playtest (see PLAYTEST.md).
15. ~~**(Post-v0.1) Third biome + generalized transitions.**~~ Done
    (Run 14): DESIGN.md's Concept names three vignettes but only two
    biomes existed. `src/core/biome.ts`'s `biomeBlendRatio` (hardcoded to
    exactly 2 biomes) is now `biomeBlendAt`, which walks an array of
    `BiomeTransition` entries to support any number of biomes; added
    "Riverside Camp" as the third. `RoadScene` swaps its two TileSprite
    textures dynamically as the blended pair changes over a walk instead
    of being hardcoded to `BIOMES[0]`/`BIOMES[1]`. Folds into task 14's
    playtest scope rather than being separately tracked.
16. ~~**(Post-v0.1) Per-biome base-loop pattern.**~~ Done (Run 15):
    DESIGN.md's core-mechanic section names "tempo/pattern variety... as
    the road changes scenery" as the mechanic's only depth, but the base
    loop played the exact same 4-note pattern for the entire walk. Added
    `LoopLayer.patternByBiome` (manifest.ts) so the base loop's melody now
    differs per biome (village/forest/riverside each get their own
    4-semitone pattern); `AudioEngine.start`/`extend` take a `biomeId` and
    resolve the pattern for whichever biome is current when a batch is
    scheduled. Deliberately scoped to the base loop only (not tempo, not
    the harmony/sparkle layers) — changing BPM mid-walk risks desyncing
    the beat schedule and audio clock, and is its own task if wanted
    later. See STATE.md for the batch-boundary quantization caveat.
17. ~~**(Post-v0.1) Tighten batch-boundary quantization.**~~ Done (Run 16):
    task 16 noted that a per-biome pattern switch only takes effect at the
    next beat-batch boundary, and the batch size at the time (300 beats,
    ~187s at 96 BPM) made that lag as long as a full walk's first
    transition. Shrunk `RoadScene.BEAT_BATCH_SIZE` from 300 to 32 (~20s),
    comfortably above `BEAT_LOOKAHEAD_MS` (15s) so batches still don't
    thrash, but short enough that a pattern switch now lands within ~20s
    of the visual crossfade instead of up to ~187s. Doesn't eliminate the
    caveat (still a step-change at the nearest boundary, not sample-exact
    with the crossfade) — that would mean rescheduling in-flight notes,
    real synchronization work out of scope here — just shrinks its worst
    case by roughly 9x. Pure constant change, no new logic; existing tests
    cover the batching math generically (no test was pinned to the old
    batch size).
18. ~~**(Post-v0.1) Per-biome patterns for harmony/sparkle layers.**~~ Done
    (Run 17): task 16 gave only `baseLoop` a `patternByBiome` override,
    leaving `harmony`/`sparkle` unchanged even though the resolve/schedule
    plumbing was already generic per-layer. Added forest/riverside
    overrides to both, each layer's own pattern shifted by the same
    per-beat diff `baseLoop` already uses for that biome, so all three
    layers move together at a transition instead of just the melody.
    Manifest data + a consistency test only, no logic changes.
19. ~~**(Post-v0.1) Fix the persistent favicon 404.**~~ Done (Run 18): every
    single headless verification note since Run 1 has carried the same
    caveat — "no console errors beyond the expected missing-favicon 404."
    `index.html` had no `<link rel="icon">` at all, so the browser always
    requested `/favicon.ico` and always missed. Added an inline SVG data-URI
    favicon (a small bard-body-colored dot on the game's background color,
    no new asset file) so the console is actually clean, not just
    clean-with-an-asterisk. Pure `index.html` change, no runtime code
    touched.
20. ~~**(Post-v0.1) Mute toggle.**~~ Done (Run 19): the game has no menus
    per DESIGN.md, but also had no way at all to silence the audio short of
    muting the OS/tab — a real gap for a browser game someone might open
    somewhere sound isn't welcome. `AudioEngine` gained a `masterGain` node
    all layers route through (independent of each layer's own meter-driven
    fade) plus `setMuted`/`isMuted`; `RoadScene` added a small interactive
    icon (top-left, mirroring the coin readout's top-right placement) that
    toggles it. Tapping the icon is excluded from beat-hit handling via
    Phaser's `currentlyOver` list on the shared `pointerdown` listener, so
    it never counts as a hit or a miss. No new asset file, no new runtime
    dependency, no menu — just one more small on-screen readout/control in
    the same procedural-shapes style as everything else.
21. ~~**(Post-v0.1) Distance-walked readout.**~~ Done (Run 21): DESIGN.md's
    Concept/mechanic sections name "distance" alongside scenery and coins
    as a readout of song-meter performance, but `distancePx` (tracked
    since Run 9) only ever drove the internal biome crossfade — nothing
    surfaced it to the player. Added a small "N steps" text readout
    (bottom-left), converting `distancePx` via `ROAD_TILE_WIDTH` so one
    step matches one ground tile already scrolling past. Pure
    rendering/formatting, no new core module, same precedent as the coin
    readout's own display formatting.

22. ~~**(Post-v0.1) First-tap onboarding hint.**~~ Done (Run 22): nothing on
    screen told a first-time player what to do — no menu (correctly, per
    DESIGN.md), but also zero affordance for "tap to the beat," unlike every
    other run's readout (coins, distance, mute) which at least explains
    itself visually once you know the mechanic. Added a small "tap to the
    beat" text above the hit line, shown until the player's first input
    (hit or miss — dismissal is about discovery, not accuracy), then fades
    out over 400ms and never reappears for that session. No new asset, no
    new runtime dependency, no menu.

23. ~~**(Post-v0.1) Resume audio after tab backgrounding.**~~ Done (Run 23):
    mobile browsers suspend the `AudioContext` whenever the tab is
    backgrounded (app switch, screen lock, an incoming call) — a very
    ordinary thing to happen on a phone mid-walk. `AudioEngine` only ever
    resumed the context once, inside `start()`, so a backgrounded-then-
    returned session stayed silent forever even though gameplay kept
    running. Added `AudioEngine.resume()` plus a `document.visibilitychange`
    listener in `RoadScene` that calls it whenever the tab becomes visible
    again. No new system, no new dependency — a correctness fix for the
    "mobile-friendly" design pillar.

24. ~~**(Post-v0.1) Capture Space so it doesn't scroll the page.**~~ Done
    (Run 24): keyboard input bound `keydown-SPACE` to `handleInput()` but
    never captured the key, so every keyboard beat hit also triggered the
    browser's default Space behavior (scroll the page down) — fighting
    DESIGN.md's "keyboard/mouse works on desktop" pillar. Confirmed with a
    headless Playwright check (`window.scrollY` moved after three Space
    presses pre-fix, stayed at 0 post-fix). Added
    `this.input.keyboard.addCapture('SPACE')`, Phaser's documented API for
    exactly this. One-line fix, no new dependency, no logic change.

25. ~~**(Post-v0.1) Pad the mute icon's touch target.**~~ Done (Run 25): the
    mute icon (added Run 19) is a 20px-diameter dot with its interactive hit
    area matching that visual size — well under the 44x44 CSS px minimum
    both WCAG 2.5.5 and Apple's HIG call for as a comfortable touch target,
    unlike every other "eyeballed ergonomics" caveat logged in STATE.md,
    this one is measurable against a documented standard, not a feel
    question, so it didn't need to wait on human playtest. Added an
    invisible `Phaser.GameObjects.Zone` (44x44, same center) as the actual
    interactive target; the visual dot is unchanged. Headless Playwright
    confirmed a tap 16px off-center (inside the new zone, outside the old
    dot) now toggles mute, while a tap further out still registers as an
    ordinary beat input. No new dependency, no visual change.

26. ~~**(Post-v0.1) Lock down mobile tap-gesture CSS.**~~ Done (Run 26):
    `index.html`'s viewport meta tag sets `user-scalable=no`, but modern
    mobile Safari loosened that flag years ago for accessibility, so it no
    longer reliably blocks pinch-zoom or double-tap-zoom — and nothing else
    guarded against it. This game's entire input model is rapid taps in
    the same on-screen spot (ROADMAP task 3), exactly the gesture that
    triggers double-tap-zoom, with a long tap also risking the browser's
    text-selection callout menu — a real gap against the "touch input
    works on a real mobile viewport" pillar, not a feel question, so it
    didn't need to wait on task 14 either. Added `touch-action: none` plus
    `user-select`/`-webkit-touch-callout: none` to `#game`'s CSS. No JS
    changes — Phaser's pointer handling doesn't go through the browser
    gestures being suppressed. Headless Playwright (iPhone 12 emulation)
    confirmed the computed styles landed, `visualViewport.scale` and
    `window.scrollY` stayed at their defaults through 6 same-spot taps at
    the beat cadence, and ordinary tap input (meter/coins/bard animation)
    was unaffected.

27. ~~**(Post-v0.1) Fix phantom scroll gap from inline `<canvas>`.**~~ Done
    (Run 27): Phaser's `<canvas>` defaults to `display: inline`, so it sits
    on a text baseline and reserves a few px below itself for descenders —
    the classic "phantom scrollbar" CSS gotcha. That left the page ~5px
    taller than the viewport on mobile, making it vertically scrollable even
    though `#game` is explicitly sized to `100vh`, fighting the "touch input
    works on a real mobile viewport" pillar the same way task 26's
    touch-action fix did. Added `#game canvas { display: block; }` to
    `index.html`. Pure CSS, no JS/logic change.

28. ~~**(Post-v0.1) Fix backing-loop/visual-beat phase misalignment.**~~ Done
    (Run 28): `AudioEngine.start()` always anchored the backing loop's note
    phase-zero to "the real-world moment the player's first tap fired,"
    while the visual beat schedule's phase-zero has always been scene
    creation. Since a player can only ever tap successfully once a beat has
    scrolled to the hit line (at minimum ~625ms into the visual schedule at
    96 BPM, longer if the first tap misses), this meant the audio loop
    started playing note index 0 from scratch at that later real-world
    moment — putting every single playthrough's backing track out of phase
    with the markers crossing the hit line by however long the player took
    to tap. This is the game's one core mechanic (DESIGN.md: "keep a single
    melody going by tapping a beat in time as it arrives"), so a
    always-reproducible sync bug in it isn't a feel question deferred to
    task 14, the same reasoning as tasks 25–27. `AudioEngine.start` now
    takes the visual schedule's elapsed `nowMs` at the moment of the first
    tap and anchors its `startAt` reference to game-time-zero instead of
    tap-time, then skips scheduling any note whose beat has already scrolled
    past (so `start()` doesn't burst-play a backlog of "missed" notes all at
    once). Added `src/audio/AudioEngine.test.ts` (4 tests, previously zero
    coverage on this class) with a fake Web Audio stand-in verifying the
    phase math; also re-verified with a real headless Chromium run
    (deliberately delayed first tap by 1.5s) showing zero console/page
    errors. `npm test` 56 tests green (4 new), build green.

29. ~~**(Post-v0.1) Use `100dvh` for `#game`'s height.**~~ Done (Run 29):
    `#game` was sized with a plain `height: 100vh`, which on mobile
    Safari/Chrome is calculated against the *largest* possible viewport
    (address bar collapsed) rather than what's actually visible on a cold
    load (address bar shown) — the well-known mobile "100vh" viewport gap,
    the same class of real-viewport bug as tasks 26 (touch-action) and 27
    (phantom scroll gap from inline `<canvas>`), not a feel question. Added
    `height: 100dvh` after the existing `100vh` declaration (kept as a
    fallback for browsers without `dvh` support, which just ignore the
    unrecognized value) so `#game` tracks the actually-visible area as
    browser chrome shows/hides instead of the theoretical maximum. Pure CSS,
    no JS/logic change.

30. ~~**(Playtest feedback) Bard sprite & walk-animation overhaul.**~~ Done
    (2026-07-25, overnight session): the three-rectangle placeholder is
    now a multi-part procedural character — booted hip-pivoting legs,
    belted tunic with a gold buckle, a sleeve reaching across to a lute
    (neck up, strings + soundhole), and a capped head with a cream
    feather, all Graphics-drawn textures (no assets). Walk cycle: legs
    swing at one footfall per beat, upper body dips once per footfall and
    rocks with the stride (feet never leave the ground — the bob applies
    to a separate upper-body container). Idle: breathing pulse + gentle
    lute sway so the bard never freezes. Palette is deliberately warm to
    read against all three biome skies; buckle/feather/strings reuse the
    coin-gold and cream UI accents. Verified by real headless screenshots
    of both states.
31. ~~**(Playtest feedback) Per-biome background scenery.**~~ Done
    (2026-07-25, overnight session): a silhouette scenery band now sits
    between sky and road, scrolling at 0.45x road speed for parallax
    depth, crossfading between biomes with the same two-TileSprite
    pattern the road uses. Village: three gabled houses with warm lit
    windows and a chimney. Forest: conifer + round-canopy silhouettes
    with fireflies. Riverside: water band with wave glints, a tent, a
    campfire glow, reeds. `Biome` gained `sceneryColor`/`sceneryAccent`;
    all shapes are Graphics-drawn tiles (no assets). Verified by
    screenshots of all three biomes (temporarily shortened transition
    distances in a throwaway build to reach forest/riverside quickly;
    shipped constants unchanged).
32. ~~**(Playtest feedback) Art-style consolidation pass.**~~ Done
    (2026-07-25, overnight session): adopted one visual language —
    everything the player reads or touches is musical notation. Beat
    markers are now tintable eighth-note glyphs (cream upcoming, green
    pulse on hit as if plucked, dimmed mauve on miss — no red, per
    DESIGN.md's tone), the coin icon is a gold coin stamped with a note,
    the mute toggle is the same note glyph, and the hit line has soft
    rounded caps. DESIGN.md gained an "Art direction" section codifying
    the rule (world cool and quiet; warmth belongs to the bard and the
    music) so future runs extend the style instead of re-inventing it.
    Screenshot-verified including a live hit pulse.

33. ~~**The player's own note.**~~ Done (2026-07-25, overnight session):
    tapping was completely silent — in a music game, the player never
    made a sound. A hit now immediately plays that beat's melody note one
    octave above the base loop and slightly louder (`AudioEngine.pluck`),
    so a good run *sounds* like the player carrying the tune's top voice.
    Misses stay silent per DESIGN.md (a missed beat lets a note drop out;
    it never adds a buzzer). Routes through the master gain so mute
    covers it. 3 new tests (59 total).
34. ~~**Night sky.**~~ Done (2026-07-25, overnight session): the upper
    third of the screen was empty flat color. Added a sparse cream
    starfield (fixed positions — every load identical) drifting at 0.08x
    road speed, and a still moon with a soft glow. Three scroll speeds
    (road 1x, scenery 0.45x, stars 0.08x) give the world real depth.
    Screenshot-verified.

## The next arc: "the road loops home" (queued for future runs)

35. ~~**The road loops home.**~~ Done (2026-07-25, overnight session):
    `biomeBlendAt` now wraps — when the transition list is as long as the
    biome list, the final transition leads back to biome 0 and the whole
    schedule repeats every cycle (distance modulo the last transition's
    end; shorter lists keep the old clamping behavior, still tested).
    Added the third transition (riverside → village at 14000–16000px), so
    the walk is village → forest → riverside → village → … forever, each
    cycle's rhythm of change identical (village band 0–4000 of every
    16000px cycle, a transition every 5000px). Audio patterns already
    follow the current biome, so the melody loops home with the scenery.
    5 new tests (64 total); screenshot-verified past the wrap (village
    again at ~29 steps, second-cycle forest at ~38 steps in a shortened
    throwaway build).
36. ~~**Slow dusk cycle.**~~ Done (2026-07-25, overnight session):
    `src/core/dusk.ts` — a cosine dusk → deep-night → dusk brightness
    curve, one full cycle every three 16000px biome loops (~13 min of
    walking), dipping at most 22%. The sky, scenery, and road darken
    together while the stars and moon *brighten* (the sky inverts the
    ground's shade); the bard and the notation are deliberately never
    darkened — warmth belongs to the bard and the music, so the character
    carries their own light through the deepest night. Pure function + 7
    tests (71 total); deep-night state screenshot-verified via a
    shortened-cycle throwaway build.
37. ~~**Consolidation pass.**~~ Done (2026-07-25, overnight session, as
    the session's closer): drift check clean — every overnight addition
    is a readout or feedback on the one mechanic (pluck = the mechanic's
    own sound, sky/dusk/loop = scenery readouts; no new systems, no new
    runtime dependencies, bundle steady at ~1.22 MB of the 5 MB budget).
    One rough edge found and fixed (hit-flash overlay was still 4px wide
    after the hit line became 6px). STATE.md gained "Process notes for
    future runs" (headless screenshot workflow, throwaway-build trick,
    PR cadence); DESIGN.md changelog wrapped the session. Next scheduled
    run: propose a fresh arc — task 38 below is blocked on human.
38. **Round-2 playtest fold-in.** When the human answers PLAYTEST.md
    round 2, fold verdicts into constants the same way round 1 was folded
    in (see ROADMAP task 14's done entry for the protocol). Blocked on
    human — skip past it to the next actionable task until answers exist.
39. ~~**Strum on hit.**~~ Done (Run 31, scheduled): promoted from the idea
    backlog below — task 38 is still blocked on the human round-2
    playtest. `AudioEngine.pluck` (task 33) already gave a hit its own
    sound; the lute had no visual twin for it. Added `RoadScene.strumLute`:
    a one-shot ~140ms tween kicking the lute's angle toward the strings
    and springing back on every hit, as if the chord was just struck. The
    idle sway tween (previously inline in `setBardAnimState`) is now
    factored into `startIdleLuteSway()` so a hit can `killTweensOf` it
    (avoiding two tweens fighting over the same angle property) and, if
    the bard settles back to idle before the strum finishes, restart the
    sway from `strumLute`'s `onComplete` instead of leaving the lute
    frozen. No new texture, no new dependency. `npm test` 71 green
    (unchanged — Phaser scene tween, same precedent as tasks 30–34 which
    verified by screenshot rather than a unit test), build green,
    headless screenshot confirmed the kicked angle mid-tween with zero
    console/page errors.
40. ~~**Meter as staff.**~~ Done (Run 32, scheduled): promoted from the
    idea backlog below — task 38 is still blocked on the human round-2
    playtest. The song-meter bar was the last UI element not speaking the
    notation language task 32 established. Added five faint horizontal
    lines (`meterStaffLines`) drawn on top of the existing track/fill
    rectangles, resized alongside them every frame in `updateMeterBar` —
    no new texture, no change to the pure `songMeter` logic. First pass
    tinted the lines the same cream as the "walking" fill color, so a
    full meter erased them entirely (fill and lines were the same color);
    caught by screenshotting the full-meter state specifically, not just
    empty/mid. Fixed by giving the lines their own mid-tone (bronze
    `0xa8842f`, alpha 0.55) distinct from both the dark track and the
    cream fill, so they read as sheet-music lines whether the bar under
    them is blank or lit. `npm test` 71 green (unchanged — pure
    rendering, no logic touched), build green, bundle unchanged (~1.23
    MB). Screenshot-verified across all three meter states (empty, mid,
    full).

## The v0.2 arc: "the road teaches the scale" (human-set, 2026-07-25)

The human's direction: make this a game that teaches kids typical
musical notes. DESIGN.md's new Pedagogy section is the contract — read
it before executing any task below. The mechanic does not change; the
teaching is entirely presentation.

41. **Notation core + C-major re-voice.** New pure module
    `src/core/notation.ts`: semitone-from-C4 → letter name (naturals
    only, null for accidentals) and → diatonic staff step (C4 = 0,
    treble staff lines at steps 2/4/6/8/10), plus stem-direction and
    ledger-line rules. Fully tested. Re-voice the manifest: root moves
    A3 (220 Hz) → middle C (261.63 Hz); village = C D E G A around
    middle C, forest = G A C5 D5 E5 up the staff, riverside =
    C D G A D5 leaps — the per-biome note sets that are the curriculum.
    Add a manifest test asserting every pattern note in every layer and
    override is a natural (the game's notation must never be wrong).
42. ~~**The staff lane.**~~ Done (2026-07-25, second overnight session):
    five faint staff lines across the lane (middle line B4 on laneY);
    markers are engraved quarter notes baked per distinct pitch via
    RenderTexture (Graphics can't draw text) — white head/stem tintable
    cream/green/mauve, letter dark inside the head so no tint eats it,
    stems up below the middle line / down at or above it, middle C
    wearing its ledger. Markers learn their note at batch time from the
    same per-biome pattern the audio schedules with, so what the staff
    shows is exactly what the loop plays. Bard dropped to
    `BARD_GROUND_Y_OFFSET = 150` so low notes clear the cap; hit line
    grew to span the staff (96px); staff-line alpha raised 0.16 → 0.22
    after a first screenshot read too faint. Screenshot-verified: C-D-E
    ascent with middle C's ledger, stem-up lows, and forest's C5-D5-E5
    stem-down highs (via a throwaway build that also shrank
    `BEAT_BATCH_SIZE`, since the 15s scheduling lookahead delays pattern
    switches past a shrunken biome cycle — worth knowing for future
    far-state audio/visual checks; shipped constants untouched).
43. ~~**Legibility & first-reader polish.**~~ Done (2026-07-25, second
    overnight session): iPhone-viewport screenshot confirmed the DPR
    scale-up renders note letters large and crisp on phones — no size
    change needed. Hint wording kept ("tap to the beat"): pre-readers
    can't read *any* wording, so the real affordance added instead is a
    **silent metronome** — the hit line brightens on every beat and
    fades until the next, driven by the same clock as the beats, so the
    rhythm can be *felt* before anything can be read. PLAYTEST.md gained
    a full round-3 section for testing with an actual kid (observe,
    don't coach: labels noticed? pitch-position link? paper-staff
    transfer? does the busking pause read as rest, not losing?).
44. ~~**Rhythm values.**~~ Answered by design, not by asking (2026-07-26):
    tap-and-hold was the wrong shape — it changes the one input. Note
    values instead became *spacing*: a half note takes two beats to
    arrive, so its length is felt in the waiting, and the mechanic is
    untouched. Shipped as part of task 45.

## The v0.3 arc: "the songbook" (2026-07-26)

45. ~~**Real songs.**~~ Done: `core/song.ts` (song/note types, timeline
    expansion with per-note durations, seamless looping) and
    `core/songs.ts` (Mary Had a Little Lamb / Twinkle Twinkle / Ode to
    Joy, one per biome — see DESIGN.md's curriculum). Songs are validated
    by *engraving* tests, not style ones: naturals only, writable note
    values, whole bars, no note running over a bar line, everything
    inside a drawable staff range.
46. ~~**The game plays the songbook.**~~ Done: markers and audio are both
    built from one list of `SongBeat`s, so what the staff shows and what
    the ear hears cannot drift apart; note heads render by value (filled,
    hollow, stemless whole, flags, dots); each pass announces its title;
    a biome change waits for the current tune to finish rather than
    cutting mid-phrase. This *removed* the per-biome pattern plumbing and
    the batch-quantization caveat that came with it.
47. ~~**Self-verification harness.**~~ Done: `tools/` (see its README) —
    `autoplay.mjs` plays the game with real input and asserts on meter,
    walk, leaks and *every pitch it hears* (must be a natural, in tune to
    within a cent); `proofsheet.mjs` bakes every note-value × staff
    position for engraving review. Both found real bugs on first run.
48. ~~**A second tune per biome.**~~ Done: each biome now rotates through a
    set instead of repeating one song — village adds *Hot Cross Buns*,
    forest adds *Au Clair de la Lune* (in G), riverside adds *Lightly Row*
    (an octave up). Both tunes in a set sit in the same region of the
    staff, so the low → middle → upper curriculum survives the variety
    (enforced by test). Doubles the length of a full walk before anything
    repeats, with no new mechanic — just data plus a per-biome pass
    counter. Hint text also updated now that the lane is a staff: "tap
    when a note reaches the line".
49. ~~**Consolidation pass.**~~ Done (2026-07-26): drift check clean — the
    songbook is still a readout of the one mechanic (tap a note as it
    reaches the line), no new systems, no new runtime dependencies.
    STATE.md trimmed (four stale per-run write-ups that duplicated their
    own Recent-runs entries and ROADMAP done-entries), and its "Needs
    human playtest" section rewritten now that the harness answers most
    of it mechanically.
    **Considered and rejected: a fourth biome.** Naturals-only (the
    Pedagogy rule) means the usable staff is about two octaves, and
    village/forest/riverside already occupy the low, middle and upper
    thirds of it. A fourth vignette would have to either duplicate an
    existing region — weakening the curriculum, which is the point of the
    biome split — or live in heavy ledger territory that a beginner can't
    read. Rotation (task 48) bought the same variety without that cost.
    If a fourth is ever wanted, it should come with a reason of its own,
    not as "more scenery".
50. ~~**Rests.**~~ Done (2026-07-26): a written silence is now a symbol
    rather than an empty gap. `SongNote` gained `rest`; a rest occupies
    its time, scrolls down the staff like anything else, sounds nothing
    and is never tapped or missed (born `resolved: 'rest'`, so it drops
    out of both hit-finding and miss-detection by construction). Engraved
    by value: whole rest hanging under the line above the middle, half
    rest sitting on it — the pair beginners are taught to tell apart —
    and the quarter-rest zigzag. *Hot Cross Buns* now carries the first
    one, a beat of breath at each phrase end, which is how beginner books
    write it. Verified by autoplay (perfect meter with rests present, so
    they really are un-tappable) and a zoomed screenshot.
51. ~~**A third tune per biome.**~~ Done (2026-07-26): *London Bridge*
    (village), *Frère Jacques* in G (forest) and the *Jingle Bells*
    chorus (riverside) bring the songbook to nine. Pure data, no new
    mechanic, 50% more music before anything repeats; each stays in its
    biome's staff region so the curriculum is untouched. Frère Jacques
    keeps its authentic "din dan don" dip to the low D — exactly the
    below-the-staff reading the ledger line exists for.
52. ~~**Signposts at transitions.**~~ Done (Run 33, scheduled): a small
    silhouette signpost (post + two angled boards) now spawns at the
    screen's right edge the instant `distancePx` crosses each biome
    transition's start distance, scrolling by at the scenery band's own
    parallax rate — the world announcing the next vignette, per the idea
    backlog. `core/biome.ts` gained `signpostDistanceAt(occurrenceIndex)`,
    a pure function giving the distance the nth transition fires at
    (accounting for the loop's wrap, same cycle math as `biomeBlendAt`),
    with its own tests. `RoadScene` reuses a fixed 2-image pool rather than
    an unbounded array (transitions are 5000px apart; a signpost takes far
    less than that to cross the screen at `SCENERY_PARALLAX`, so at most
    one is ever on screen) — pre-created right after the scenery band and
    before the road in `create()` so display-list order alone gives
    correct paint depth, no `setDepth` needed. Same neutral silhouette
    color in every biome (it isn't a light source, so per the art
    direction it stays cool, not warm) and picks up the dusk tint like the
    rest of the world layer. Verified by a screenshot with transition
    distances temporarily shrunk (reverted after, `git diff --stat`
    confirmed clean) — the post+boards render correctly anchored to the
    road's top edge among the tree silhouettes. `npm test` 157 green (5
    new), build green.

## The v0.4 arc: "learning, not just exposure" (human-set, 2026-07-26)

The human's direction: *"If we can add that in where they can actually
learn music, that's the true goal here, just thru songs that they already
know."* DESIGN.md's rewritten Pedagogy section is the contract.

53. ~~**The letter is a scaffold, and scaffolds fade.**~~ Done: a letter
    printed in every note head forever is a crutch — a child can read the
    letters fluently and never encode the positions. `core/scaffold.ts`
    now tracks familiarity per *staff position* and fades the letter in
    **time**: it arrives later and later in the note's flight as a
    position is practised, down to a floor of 350ms before the tap. That
    buys ~1450ms of genuine attempted recall, then always confirms.
    Governing rule, never to be traded away: **fade the prompt, never the
    answer** — a hidden letter is revealed on the strike *and* on a miss,
    so it is never a dead end and a miss never costs information.
    Help returns on two misses during good play, instantly when the meter
    drops, always for the first sighting of a position in each tune, and
    partially after days away. Nothing about the model is ever displayed.
54. ~~**Songs they already know.**~~ Done: the two method-book tunes went
    out and two S-tier ones came in — *Row, Row, Row Your Boat* (village)
    and *Old MacDonald Had a Farm* (riverside), with London Bridge moved
    up to the forest register and Frère Jacques retitled *Are You
    Sleeping?*, which is what English-speaking children actually call it.
    Familiarity is load-bearing now, not decoration: if a child knows how
    the tune goes, the pitch is free when the letter is gone, so they are
    never stuck — which is the only reason fading is safe at all.
55. ~~**Riverside water shimmer.**~~ Done (2026-07-26, from the idea
    backlog): the water's glints were baked into the riverside scenery
    tile, so they sat dead still. They now live in two transparent layers
    of their own, pulsed at **opposite phases** — a single layer pulsing
    as one reads as a light blinking, two out of phase read as water
    moving. They scroll in lockstep with the scenery, pick up the dusk
    tint like the rest of the world layer, and fade with
    `riversidePresence()` so they only glint while there is water on
    screen, including part-way through a crossfade. Verified by
    instrumenting the live alphas (0.37 vs 0.69 at full riverside —
    genuinely out of phase) and by two screenshots a beat apart.
56. ~~**Two more songs they already know.**~~ Done: *This Old Man*
    (village, C4–G4 — its bars 5–6 walk the C-major pentascale straight up,
    the cleanest drill the village has, hidden inside a tune kids can
    already sing) and *The Itsy Bitsy Spider* (riverside, C5–G5, the
    songbook's clearest use of written silence). Both verified against
    published sources before landing. A forest *This Old Man* was drafted
    and **rejected** — 6 of 32 notes matched the real tune, with an
    inverted phrase on its most recognizable line. Forest stays at three
    songs rather than carrying a wrong contour.
57. ~~**Find out which mechanism actually keeps the safety promise.**~~
    Done. "Fade the prompt, never the answer" was credited to the
    reveal-on-strike and reveal-on-miss handlers; `tools/reveal-check.mjs`
    shows those never fire. All 86 reveals over a 90s walk came from the
    scheduled mid-flight path, because the 350ms lead floor clears the
    ±90ms hit window. That is the stronger guarantee, so it was promoted
    from coincidence to contract: the timing constants moved to
    `core/beats.ts` and `scaffold.test.ts` enforces the relationship.
    DESIGN.md and three misleading comments corrected. Also fixed the
    autoplay harness, which reported a last-second snapshot as a cumulative
    hit count, asserted nothing about it, and tapped into empty air about
    half the time.
58. ~~**Measure the design pillars.**~~ Done: `tools/pillar-check.mjs`
    checks "playable in under 5 seconds" and "mobile-friendly" across six
    viewports (iPhone SE → desktop), reading real scene geometry rather
    than eyeballing screenshots. All green — playable in 0.7–1.3s, every
    drawable staff position on screen with stem room, taps registering,
    and eighth notes still 49px apart on the narrowest phone against a
    ~24px head. Frame rate deliberately excluded: headless software GL
    says nothing about a real device.
59. ~~**Check what a phone rotation does.**~~ Done: `tools/rotate-check.mjs`.
    Rotation re-runs `create()` **[corrected by task 109: it doesn't, in
    headless testing — this entry's own claim was never itself tested]**,
    and everything survives it — progress, audio, the walk, and the saved
    scaffold. Two harness bugs made it look broken first (see STATE); the
    game was innocent both times. One real change came out of it:
    `wasUnplayable` keeps a note whose whole hit window elapsed inside one
    frame gap out of the learning model. Insurance for stalling devices, not
    a fix for an observed bug — rotation peaks at a 50ms gap against a
    180ms window.
60. **Fourth forest song — blocked on network, not on design.** The forest
    set has three songs where village and riverside have four. The
    candidate is researched and ready: **Here We Go Round the Mulberry
    Bush** — traditional (1700s, clearly public domain), degrees 1/2/3/5/6/7
    only so it is naturals-only in C major, sitting G4–G5 which is exactly
    the forest register. It was not shipped because this environment blocks
    outbound fetches, so the transcription cannot be verified note-for-note
    against a published source — and shipping an unverified contour is what
    got the forest *This Old Man* rejected. Do this from a run with network
    access. (*Wheels on the Bus* is the obvious alternative and is
    **rejected on rights**: attributed to Verna Hills, 1939, which fails
    CLAUDE.md's CC0-only rule.)
    Already tried and not sufficient: web *search* still works when fetches
    are blocked, but the snippets carry titles, keys and public-domain
    provenance — never note sequences. Don't spend another run on that
    route; it needs a real page fetch or a human-supplied transcription.
    **Done (2026-08-05, overnight session, from a machine WITH network)
    — the wait was worth it and the premise held exactly.** Wikipedia's
    article carries an engraved LilyPond score (G major, 6/8);
    transposed up a fourth to C it lands naturals-only on degrees
    1/2/3/5/6/7 at G4–G5, the forest register — precisely what this
    entry predicted in July. Independently corroborated by a
    Kodály-curriculum source (musicyoucanread.com: 6/8, form ABAC,
    tone set so-la-ti-do-re-mi-so — the exact set the transcription
    uses with do = C5), and it is the tune as universally sung. The
    songbook's first 6/8 song (three quarter-beats to the bar, the
    lilt in quarter+eighth pairs); forest now rotates four songs like
    the other biomes; every engraving/region/coverage test accepted
    it unchanged. Live-verified pinned and walking, zero console
    errors. 1144 tests green (+11), build green.
61. ~~**Stop the audio drifting away from the staff.**~~ Done: `AudioEngine`
    anchored the audio clock to the visual one once at `start()` and
    scheduled every later pass against that anchor, letting the difference
    between `performance.now` and the sound hardware's clock accumulate for
    a whole session. `schedule()` re-anchors per pass now, bounding it to
    one song; `nowMs` is required so there is a single mapping between the
    two clocks. Two unit tests, one of which moves the clocks apart by hand.
    No browser assertion — five attempts to measure it live gave five
    answers and the instrument was wrong every time (written up in
    `tools/README.md`).
62. ~~**Consolidation: split the engraving out of RoadScene.**~~ Done.
    RoadScene had reached 1584 lines, 46% of the codebase in one file. The
    note and rest glyph baking moved to `src/render/engraving.ts` with its
    geometry constants (scene 1584 → 1485; module 156). Plain functions
    taking the scene, not methods, so the engraving has no game state to
    depend on. Proof sheet byte-identical before and after; all seven
    harnesses green. `window.engraving` is now an explicit tooling handle
    in `main.ts` — `proofsheet.mjs` used to reach a private method and
    broke silently when it moved.
63. ~~**Consolidation, second chunk: the scenery bakers.**~~ Done:
    `src/render/scenery.ts` takes the road, biome silhouette, water-glint,
    star-field and signpost textures. RoadScene 1485 → 1325; across both
    chunks 1584 → 1325. Tile dimensions are exported from the module rather
    than duplicated, since the scene places what the module draws. Verified
    by a new `tools/scenery-sheet.mjs` that bakes all ten world textures
    into one sheet — byte-identical across the move, as was the proof
    sheet, with all eight harnesses green.
    **Next candidate if another consolidation run is due**: `createBard`
    and `createStyleTextures` (~250 lines) are the last big drawing blocks
    in the scene and would take it near 1000.
64. ~~**Verify what a child comes back to after days away.**~~ Done:
    `tools/timeaway-check.mjs`. The decay arithmetic was unit-tested but the
    round trip through real `localStorage` with a backdated timestamp was
    not. Practised positions hold, a mid-strength one decays and is handed a
    band of help back, nothing is ever wiped, and a corrupt record starts
    fresh rather than breaking. Asserts a gap can only return support, never
    remove it, and never raises a position's peak.
65. ~~**One command to run the whole suite.**~~ Done:
    `tools/verify-all.mjs` (`quick` for the fast four). Nine checks is more
    than a run will reliably remember, and the slow ones are exactly the
    ones that get skipped. Serial on purpose — concurrent Chromium
    instances starve each other badly enough to fake a performance
    regression. Full run: all nine green in ~13 minutes.
66. ~~**Consolidation, third and last chunk: the UI glyphs.**~~ Done:
    `src/render/ui.ts` takes the eighth-note glyph, coin, hit line and
    treble clef. RoadScene 1325 → **1263**, from 1584 at the start of the
    session. A new `tools/ui-sheet.mjs` completes the set of three texture
    sheets, so every texture the game draws is now checkable in a
    deterministic image; the sheet was byte-identical across the move, as
    were the other two. The scene's remaining drawing code is `createBard`,
    which is genuinely entangled with scene state (containers, tweens,
    walk/idle) and is *not* worth the same treatment — leave it.
67. ~~**Give the moon a face.**~~ Done (from the same instinct as the
    riverside shimmer): the moon was the largest thing in the sky and the
    only element in the world with no shape at all — a flat cream disc,
    while the houses have gables and lit windows, the forest has conifers
    and fireflies, the riverside has a tent and a campfire. It is baked as
    a texture now with four craters, drawn only slightly darker than the
    disc and kept clear of the rim so it still reads as a *light source*
    from across the room rather than as a thing to study. Covered by
    `scenery-sheet.mjs`.
68. ~~**Push the layout check to the extremes.**~~ Done: `pillar-check`
    covers nine viewports now, adding a 320px phone (the narrowest width
    still worth supporting), a tall-narrow 360x900 and a wide-short
    1440x560 — the shapes a browser window takes, as opposed to devices.
    All green. 320px is the tightest case in the whole matrix at 42px
    between eighth-note heads against a ~24px head, and it was confirmed
    visually as well as numerically.
69. ~~**Test what a child actually does: mash.**~~ Done:
    `tools/mash-check.mjs`, 38 taps/sec for a minute. Nothing comes apart,
    and stray taps cost nothing — no encounter, no sound. Recorded but not
    "fixed": mashing does earn exposure credit, since spraying taps hits
    every note. That is within DESIGN.md's scoping of the model (exposure,
    not assessment) and self-corrects through the return-on-struggle path,
    so no burst-detector was added.
70. ~~**Cover the two untested input paths.**~~ Done:
    `tools/input-check.mjs` for the mute toggle and the keyboard, neither of
    which any harness touched. Mute genuinely silences (master gain 1 → 0,
    read directly rather than trusting the icon), costs no beat despite
    sitting over the playfield, and restores on a second press; the spacebar
    plays. All green, no code changes needed.
71. ~~**Prove deep night doesn't dim the letters.**~~ Done:
    `tools/dusk-check.mjs`. The art direction promised the dusk cycle
    darkens the world but never the notation, and nothing checked it — which
    matters because the letters are the whole teaching surface and deep
    night arrives about four minutes into any walk. At mid-cycle the sky and
    the road/scenery tint both move while note tint, note alpha, staff
    colour and alpha, and clef tint and alpha are identical. Asserts both
    halves, so it cannot pass by the cycle having stopped.
72. ~~**Assert the no-fail promise.**~~ Done: `tools/nofail-check.mjs`
    taps once and then gives up for 45 seconds. No fail state, no red, no
    shaming text, notes still arriving so the child can rejoin, and nothing
    sounds on a miss (asserted as an oscillator-rate ceiling, since the tune
    itself deliberately plays on). The kindest part of the design was the
    least tested part of it.
73. ~~**Put a number behind the bundle-size pillar.**~~ Done: `pillar-check`
    sums everything the page pulls over the wire and asserts CLAUDE.md's
    "<5 MB". Currently 1.19 MB. Measured as what a phone downloads rather
    than as dist/ on disk, and mutation-checked at a 1 MB threshold.
74. ~~**Mechanise the backgrounding playtest item.**~~ Done:
    `tools/backgrounding-check.mjs` forces the suspend and observes the
    resume — `running → suspended → running`, progress force-saved on the
    way out, sound and meter restored on return. One fewer item needing a
    human. Turned up a real find: Phaser's sound manager was holding a
    second, unused AudioContext open all session, now disabled with
    `audio: { noAudio: true }` since every sound here is hand-rolled.
75. ~~**Assert the mobile gesture lockdown.**~~ Done: `pillar-check` reads
    the computed `touch-action`, `user-select`, `overscroll-behavior`,
    canvas `display` and the viewport meta at every viewport, and checks the
    page does not scroll. It was all CSS and a meta tag with nothing
    guarding it — the kind of thing a later edit removes silently, and
    double-tap zoom would ruin a tap-to-the-beat game. Mutation-checked.
76. ~~**Check the song title names the tune actually playing.**~~ Done:
    `tools/title-check.mjs`. Titles are queued a lookahead ahead of the
    music, and the arithmetic holding them back had no test; naming the
    wrong tune would actively mis-teach. Every title lands within ~50ms of
    its own pass. Three instrumentation attempts, game fine in all three.
77. ~~**A real soak.**~~ Done: 25 minutes of continuous autoplay, the
    longest run yet — 3.2 full dusk cycles and ~9.6 biome loops. No
    degradation at all: fps flat end to end, textures plateaued at 118,
    markers peaked at 70, 2110 of 2115 taps landed, all eleven songs
    appeared. The "child leaves it running" case, which a seven-minute run
    cannot reach.
78. ~~**Coin chime.**~~ Done (Run 34, scheduled): promoted from the idea
    backlog — both *Blocked on human* items were re-checked first (network
    still 403s on every host, including plain page fetches like Wikipedia;
    the GitHub MCP toolset still has no tag/ref-write call) and remain
    blocked, and no playtest answer had arrived. `AudioEngine.chime()` plays
    a very quiet, fixed sine two octaves above the root on every 25th coin —
    deliberately not `pluck`'s voice (that means "you just played this
    note"; the chime is a small aside about the case filling up, so it's
    never a pitch drawn from the song). `core/coins.ts` gained
    `crossedCoinMilestone(prevCoins, coins, every)`, a pure function reading
    the floor before/after a frame's fractional accrual, since coins accrue
    continuously and a whole-coin milestone can't be caught by equality.
    Wired into `RoadScene`'s per-frame coin accrual. The idea backlog asked
    for this to be prototyped behind a check before committing, and headless
    can't listen — so `tools/coinchime-check.mjs` hooks
    `AudioContext.createOscillator` the way `nofail-check`/`autoplay`
    already do and confirms the chime's distinctive voice sounds exactly
    once per real 25-coin milestone, not on every note (48.2 coins → 1
    chime heard, 1 expected). Added to `verify-all`'s fast set (17 checks
    now, ~17s). `npm test` 215 green (8 new), build green (bundle
    unaffected — no new texture, no new dependency), full `verify-all quick`
    (9 checks) also green.
79. ~~**Next: nothing queued → wire the checks into CI.**~~ Done (Run 35,
    scheduled): re-checked both blockers first per the note this task
    started with — the forest-song fetch still 403s on every host tried
    (including a plain Wikipedia page), and the GitHub MCP toolset still
    has no tag/ref-write call — both unchanged, nothing to route around.
    No playtest answer had arrived (none can, autonomously). The idea
    backlog was down to one item needing a real phone, so per its own
    "that's a signal to write a fresh idea" note, this task is the fresh
    idea: the 17 headless checks in `tools/` were real, comprehensive,
    and had caught real bugs all session — but they only ever ran when a
    session remembered to run them locally. Nothing wired them into CI, so
    a regression they'd have caught could ship silently between runs.
    Two things made that possible:
    - Every one of the 18 Playwright-launching scripts hardcoded
      `executablePath: '/opt/pw-browsers/chromium'`, this environment's
      own pre-installed browser path — which is also *why* they were
      deliberately never wired in (tools/README.md said so explicitly).
      Turns out this was unnecessary: Playwright resolves its own browser
      via the standard `PLAYWRIGHT_BROWSERS_PATH` env var (already set in
      this environment) when no `executablePath` is given at all, and
      falls back to its own install cache when nothing is set — which is
      exactly the state a stock CI runner or fresh machine starts in.
      Verified this both ways (a playwright install matching the pinned
      browser resolves it via the env var; a same-version mismatch install
      correctly reports "run playwright install" instead of silently
      picking the wrong binary). Removed the hardcode from all 18 scripts;
      `tools/README.md` updated to match — no environment-specific edit
      needed to run them anywhere.
    - Added `.github/workflows/headless-checks.yml`: runs the fast nine
      (`verify-all.mjs quick`) after every push to `main`, installing
      Playwright + Chromium ad hoc exactly as documented in
      `tools/README.md` (kept out of `package.json` on purpose — the game
      itself must stay dependency-free). Deliberately **not** wired into
      `ci.yml` or gating auto-merge: it triggers on `push: main`, not
      `pull_request`, and can't be verified end-to-end from this
      environment (no way to watch a real Actions run land), so it stays
      informational (`continue-on-error: true`) rather than a merge gate
      until it's proven itself. If it goes red after a real merge, that's
      the next run's task.
    `npm test` 215 green (unchanged, no game code touched), build green,
    quick suite re-run twice locally with the de-hardcoded scripts: 9/9
    green (one `dusk-check` flake on a loaded run turned out to be
    environmental — a clean re-run passed, and the isolated script also
    passed standalone — consistent with this project's own lesson that a
    failing check is worth suspecting before the game).

80. ~~**Choose one song to learn.**~~ Done (human-set): rotation is the
    right default for a long walk and the wrong thing for learning a piece.
    A songbook button beside the mute toggle opens a picker; choosing a tune
    pins it, and choosing "wander" gives the rotation back. Three decisions
    worth keeping: the picker **swallows taps** while open (a child poking a
    song list must not be playing notes through it, nor be charged for the
    ones scrolling past behind it); the chosen song starts **now**, which
    needed `AudioEngine.cancelPending` since Web Audio has no unschedule and
    passes are queued a whole song ahead; and the road **settles in that
    song's home biome**, because the three biomes are the three registers
    and letting the scenery wander would have the world disagree with what
    the child is reading.
81. ~~**Art pass: depth, and stop the background looking tiled.**~~ Done.
    The world had exactly one silhouette plane between the stars and the
    road, and its 256px tile repeated three and a half times across a
    desktop screen — the repeat was the first thing you saw. Two changes:
    a **far ridge** on its own plane at 0.19 (filling a conspicuous gap
    between stars 0.08 and scenery 0.45, and drifting at a rate that does
    not divide into the scenery's, so the two never beat together), and
    **512px scenery tiles** whose silhouettes differ within a single tile —
    seven village houses at irregular heights and spacings, a stand of
    firs, two riverside camps. Far-layer colour is *derived* (recede each
    biome's silhouette toward its own sky) rather than hand-picked per
    biome, so it survives the next palette re-pitch. Also redrew the
    songbook icon: a closed book was shapeless at 22px and an open book
    read as a list menu, so it is a page of sheet music with one bold note.
82. ~~**Free play: the staff as an instrument.**~~ Done (human-set:
    "another idea besides the walking bard as a way to learn"). The walk
    hands a child notes and asks for timing, and DESIGN.md is honest that a
    tap proves timing rather than reading — knowing the tune tells you when
    to tap whatever is written. This is the inverse: nothing scrolls,
    nothing is asked, nothing can be missed, and the child points at a line
    or a space and hears what it is. Position → sound → name, chosen by
    them rather than presented to them, which is the one direction the walk
    cannot exercise.
    It needed its own geometry: the walk's steps are 9px apart, which is
    fine to read and impossible to aim at, so free play spreads the same
    thirteen positions over the screen (45px on a phone). Letters are
    always shown — nothing is being asked, so nothing is withheld; this is
    the reference the walk deliberately fades. And it does **not** feed the
    learning model, because a note the child picked is not evidence they
    can read one the game picked.
83. ~~**Polish the two new surfaces.**~~ Done. Both the picker and the
    free-play staff snapped into existence between two frames, which reads
    as the game breaking rather than as something sliding in front; both
    fade now (130ms and 220ms). `pickerOpen` still flips *immediately* on
    close — the input model must never wait on a transition, or a child's
    first tap after choosing would vanish. And free play now marks the
    notes of the chosen tune with a warm pip: the ladder on its own gives
    no hint where to start, and this says "here are the ones in Twinkle"
    without an instruction nobody can read.
84. ~~**Practice: play the chosen song at your own pace.**~~ Done — the
    piece that makes free play more than a xylophone. With a song chosen,
    the ladder becomes that tune as a list of positions to find: a breathing
    pip marks the next note, finding it moves on, and **a wrong note sounds
    and costs nothing**. That last rule is the whole design. There is no
    penalty to apply, no streak to break and nothing to undo, so a child
    hunting around the right answer is doing exactly what the mode is for —
    and it is the only place in the game where reading the staff, rather
    than remembering the tune, is what actually moves you forward.
    Rests are dropped from the sequence: a silence is part of reading
    *rhythm*, which is the walk's job, and here it would read as the game
    having stopped responding.
85. ~~**Make practice feel finished, and stop paying for sitting
    still.**~~ Done. Coins accrue from the meter, which keeps whatever
    value it had on entering free play — so they ticked up while a child sat
    poking at a stationary staff. Coins and the step count are both counts
    of *walking*, so they are frozen and hidden there. And reaching the end
    of a tune now chimes and ripples up the notes just played — a moment,
    not a score. DESIGN.md's no-fail stance cuts both ways: a game that
    celebrates loudly has started grading quietly, so it says "that was the
    whole song" and gets out of the way.
86. ~~**Say what free play is, and stop drawing invisible layers.**~~
    Done. Two unlabelled buttons had appeared with no way to know what they
    do, so free play now carries a one-line hint that fades on the first
    tap, exactly like the road's: "tap a line to hear it", or "find the
    glowing note" when a song is chosen. It sits *below* the staff — the
    first attempt put it straight through the song title.
    Separately: each crossfading pair (road, scenery, far) drew its second
    layer every frame even at alpha 0, which is most of the time and *all*
    of the time once a song pins the biome. They are hidden outside a
    transition now. Principled, but honestly unproven here — headless
    software GL varies 15–19fps run to run, which is wider than any effect
    this could have.
87. ~~**Fix choosing a song from inside free play.**~~ Done — a real
    bug, found by probing the interactions between the three surfaces
    added this session rather than each one alone. The songbook is
    reachable from free play, so a choice can land while no road is
    running, and `chooseSong` assumed it never would. It did two wrong
    things at once: left the staff showing the *previous* song's notes (no
    new pips, no cursor, stale title), and queued a pass of road notes
    that scrolled invisibly behind the staff, went missed, drained the
    meter, and **fed the learning model with misses the child never had a
    chance at** — exactly the corruption free play is designed to avoid.
    Measured before the fix: 26 phantom markers. After: 0.
88. ~~**Make free play survive a rotation.**~~ Done — the second real
    bug from probing interactions. The walk's staff is recomputed every
    frame and rides a resize for free; the free-play staff is laid out
    once from the height available, so after turning the phone into
    landscape it was still spread for a portrait screen and the lowest
    notes ran off the bottom, unreachable. It rebuilds on resize now
    (gap 45 → 26 → 45 across a rotation and back), **without** resetting
    how far through the tune the child had got: turning the phone is not
    starting again. The picker is closed rather than re-laid-out — a
    rotation is a big enough change of context that reappearing in a new
    shape is more startling than being dismissed, and it is one tap back.
89. ~~**Ground the bard.**~~ Done: a contact shadow, the single cheapest
    thing that stops a character reading as pasted on top of the world
    rather than standing in it. It tightens and fades as he rises on each
    step and spreads when he lands, which is what gives a walk weight —
    and it is derived from the upper body's own bob rather than its own
    timer, so it can never fall out of step with the legs. Deliberately
    not black: nothing else in this world is black, and a black smudge
    under a warm little figure reads as a hole in the road.
90. ~~**Give the road a near edge and a far edge.**~~ Done: it was a
    flat bar of colour under everything else. A lit verge along the top and
    a darker one falling away at the bottom give it a ground plane.
    Constraint worth knowing before touching this again: `ROAD_TILE_WIDTH`
    is **load-bearing**, because the road scrolls exactly one tile per beat
    and that is what keeps the bard's footfalls on the music. So the tile
    cannot be widened to hide a repeat, and any detail that *varies* across
    its 64px repeats about fourteen times on a phone and reads as
    wallpaper. Edges running the full width have no period at all, which is
    why that is what got added.
91. ~~**Write the tune out, left to right.**~~ Done. In practice a
    correct note is now laid across the staff in the order it was played,
    so the phrase accumulates the way it would on paper instead of
    appearing wherever the finger landed and fading. Reading order is not
    obvious to a beginner — it has to be shown, and this shows it every
    time they play a bar. It wraps like a line of sheet music when the
    line fills, and clears when the tune comes round. A *wrong* note still
    appears under the finger and fades, so the two can never be confused.
92. ~~**Decide on promoting `headless-checks.yml` to a real gate.**~~ Done
    (Run 36, scheduled). Re-checked both standing blockers first, as this
    task's own note asked: the forest-song fetch still 403s (tried a plain
    Wikipedia page again via `WebFetch`, same result as every prior check),
    and the GitHub MCP toolset still has no tag/ref-write call (re-scanned
    the full tool list — `create_branch`, `create_or_update_file`,
    `enable_pr_auto_merge` and friends exist, nothing that writes a tag,
    release, or branch-protection rule). Both unchanged.

    The check itself has earned real confidence: `headless-checks.yml` has
    gone **19/19 green** across every merge to `main` since it landed
    (spanning ~19 PRs over ~7 hours) — comfortably past "a few more merges."
    But promoting it to an actual required gate turns out to be **blocked on
    human**, not just a matter of confidence: GitHub only lets a non-required
    check block a merge if branch protection names it as a required status
    check, and the GitHub MCP toolset available here has no call that writes
    branch-protection rules (confirmed by scanning the full tool list — nothing
    like `update-branch-protection` exists; only read/write calls for files,
    branches, PRs, issues and releases). That is a repository Settings action
    behind a permission this session doesn't have, the same shape of blocker
    as the v0.1 git tag. Logged as a new **Blocked on human** item in STATE.md
    with the exact steps.

    Also considered and **rejected**: adding a `pull_request` trigger to the
    workflow while leaving `continue-on-error: true`, purely for pre-merge
    visibility without gating anything. Not done — GitHub holds a PR
    non-mergeable while *any* check attached to it is still running, required
    or not, so this would add the check's own runtime (Playwright install +
    build + preview + nine checks, minutes) to every single merge in the
    three-times-daily autonomous cycle, for a check nobody is watching in real
    time between runs (no human sits between merges here). That is a real,
    not-quickly-reversible cost to the whole pipeline's cadence for a benefit
    (a red X on a PR nobody opens) that doesn't apply to this project's
    actual usage pattern. Left `headless-checks.yml` completely unchanged.

    No code touched this run; `npm test` (254 green) and `npm run build`
    re-confirmed as a baseline check before deciding not to change CI.
93. ~~**Soak the new mode.**~~ Done: `tools/practice-soak.mjs`.
    Practice is the one path that accumulates on purpose — every correct
    note appends to the written phrase — so "it clears" needed holding to
    over hundreds of passes rather than the six notes a functional check
    plays. 8576 notes, ~504 complete passes through Hot Cross Buns over
    eight minutes: objects hover 77–83 as the phrase builds and clears,
    tweens bounded, textures flat, frame rate steady. Nothing accumulates.
94. ~~**Stop free play running off the bottom of a landscape phone.**~~
    Done — third and last bug from probing the seams. `freePlayStaff`
    preferred overflowing to shrinking its touch targets, and on a 664x390
    landscape screen the default margins leave 260px for twelve 26px gaps.
    It overflowed: **middle C landed at y=386 on a 390px screen**, clipped
    at the edge and impossible to tap. There is no scrolling, so overflow
    is not "recoverable" as the old comment claimed — it is simply gone.
    It now squeezes the margins first (the song title and the hint both
    have somewhere else to be; an unreachable note does not), and only
    overflows if even the minimums cannot fit. C sits at y=346 now, 44px
    clear. Tested across all nine real viewports: every offered note on
    screen, every gap still at or above the finger floor.
95. ~~**Cover the last two seams.**~~ Done, and both were already
    correct — choosing "wander" from inside free play clears the previous
    tune's pips, cursor, written phrase and title and resets the hint,
    with no phantom road notes; and reloading out of free play comes back
    on the road, running, with the song choice intact. Locked into
    `freeplay-check` anyway. Every bug in this feature lived in a seam
    rather than a feature, so the seams are the thing worth holding still.
96. ~~**Stop the meter being drawn over the songbook and lute buttons.**~~
    Done. The buttons counted pixels from the left edge while the meter
    took 60% of the width and centred itself, and nothing had ever asked
    those rules to agree — they only do on a wide screen. On a 390px phone
    the meter track started at x=78 with the songbook at 68-90 and the
    lute at 103-125, both underneath it; on 320px it was worse. **The two
    ways into everything built the previous session were invisible on the
    devices this game is for**, and visible only in landscape. The
    songbook and lute touch zones also overlapped each other by 9px.
    `core/hud.ts` is now one rule for the whole bar — buttons at a pitch
    of exactly one 44px touch target, meter on a row of its own — and the
    meter got wider everywhere as a result (342px vs 234px on a phone).
    Chasing it turned up an older one: the song title had always sat
    inside the moon's vertical span, overlapping its glow by 34px on a
    320px screen. The moon now sits in whatever sky is left between the
    title and the top staff line. `tools/hud-check.mjs`, eight viewports.
97. ~~**Make the practice staff visible again.**~~ Done, and it was live.
    The staff, its letters and its pips had been drawn at **alpha 0 since
    the lay-in animation shipped in task 95** — two fade-ins ran back to
    back, the first zeroing every alpha and tweening it back, the second
    reading those same alphas on the same frame, capturing 0 as each
    part's *target*, and tweening 0 to 0. Both halves correct alone.
    The lesson is in the check, not the fix: every assertion in
    `freeplay-check` was about behaviour, and all of them passed against a
    build where nothing could be seen. A mode whose whole purpose is
    reading the staff now asserts the staff can be read — and that its
    landmark hierarchy survives the fade, not just that ink exists.
98. ~~**Give the world a ground, and keep it on screen in landscape.**~~
    Done. Two problems in the same strip of pixels. The lane was
    `height / 2` with the ground a flat 178px below it — a fixed offset on
    a proportional anchor — so on a 568x320 landscape phone the road ran
    48px off the bottom, leaving 12 of its 60px visible with the bard cut
    off at the shins. `core/worldLayout.ts` works from both edges and
    states its priority order where space runs out; it anchors on the old
    constant so every viewport that already fitted is pixel-identical.
    And below the road there had never been anything but the camera's
    background colour — the sky. The near band puts real earth there with
    verge growth per biome, and is the first plane in the game closer to
    the camera than the road (1.35 vs the road's 1.0), which is what makes
    the road read as a surface going away from you. `tools/ground-check.mjs`.
99. ~~**Let the practice staff be read.**~~ Done. In practice the staff
    spreads over the whole screen, so its lowest steps lie across the
    road — the brightest band in the scene — and cream lines at 0.55 alpha
    over a lit road was the one place in the game where the notation was
    hard to read, in the mode that exists for reading it. The world now
    sits behind a scrim while practising; the chrome does not, because the
    lute button is the way back out and dimming the exit is not a thing to
    do. Leaving drops it on the same frame, per the standing rule that the
    road is the game.
100. ~~**Give the meter back its cream.**~~ Done. Cream is the notation's
    colour, and the meter had been borrowing it. Survivable at 234px wide
    and squeezed between the buttons; not once task 96 gave it a full row
    and 342px, at which point a full meter was the largest and brightest
    thing on screen in exactly the colour the child is meant to read. It
    is gold now — the coin, the lit windows, the buckle — so it joins
    something rather than introducing a colour. Recorded as a standing
    rule in DESIGN.md's art direction.
101. ~~**Let the bard ease in and out of walking.**~~ Done. Every state
    change snapped every limb to neutral on the frame it happened, so
    stopping slammed his legs shut from mid-stride and starting teleported
    a leg out to a full 20-degree swing. The limbs ease to the next
    cycle's opening pose over 150ms now. `bard-check` took four wrong
    versions and every one of them passed — see its header; the working
    assertion is time-to-traverse, which is frame-rate independent.
102. ~~**Pin three seams that were already right.**~~ Done:
    mute x practice (silence costs sound and nothing else), tab-away x
    practice (the tune is where you left it), and rotation x the ground
    (the newest plane follows the screen). All three passed first time,
    which is the reason to write them down — every real defect of the last
    two sessions lived in a seam, so the seams are what is worth holding
    still. `tools/seam-check.mjs`, mutation-tested.

    One false alarm worth keeping: the probe first reported a staff part
    coming back invisible after backgrounding. It was the opening hint,
    which is *supposed* to vanish once the child plays a note — it fades
    and is destroyed but stays in `freeParts`, because that array is a
    teardown list and not a display list. Suspect the check first.
103. ~~**Make the meter's staff lines actually be lines.**~~ Done, and it
    was a claim that needed making true: task 100's changelog entry said
    the lines had been made legible against the new gold fill, and a pixel
    sample said otherwise. Five 1px lines in a 14px bar sit 2.33px apart,
    which is under what the renderer needs to keep them separate — they
    antialiased into each other and read as a smear. Worse, each line was
    centred on a whole pixel, so a 1px stroke straddled two rows and both
    got painted at half strength. The bar is 18px now, the lines carry a
    half-pixel offset so each covers exactly one row, and the alpha rose
    with the height. Five ruled lines, 2px of gold between them.
104. ~~**Next: nothing queued → re-check blockers, fix what's found.**~~
    Done (Run 37, scheduled). Both standing blockers re-checked exactly as
    this task's own note asked, both unchanged: `WebFetch` still returns
    HTTP 403 on a plain Wikipedia page (the forest-song transcription
    still can't be verified against a published source), and the GitHub
    MCP toolset still has no tag/ref-write or branch-protection-write call
    (re-scanned the full list of `mcp__github__*` tools). No playtest
    answer had arrived either.

    With nothing queued and the idea backlog down to one phone-dependent
    item, this run's slot went to fixing what the re-check itself turned
    up: the root `README.md` and `.github/workflows/headless-checks.yml`
    both still said "seventeen checks" / "the fast nine", numbers frozen
    from when CI was first wired up (task 79). Four checks (`hud-check`,
    `ground-check`, `bard-check`, `seam-check`) landed since then and never
    got counted — the suite is 24 checks now, 14 in the quick set, which
    `tools/README.md` and `verify-all.mjs`'s own `quick` comment already
    had right. Documentation-only: corrected both stale counts to match.

    No game code touched. `npm test` (279 green) and `npm run build`
    (1.27 MB) reconfirmed as a baseline, and the full quick suite
    (14 checks) run once end-to-end to confirm the re-check itself found
    no regression: all 14 green, no drift.
105. ~~**Next: nothing queued → re-check blockers, investigate what's found.**~~
    Done (Run 38, scheduled). Blockers re-checked, both unchanged (see
    STATE.md). No playtest answer had arrived.

    With nothing queued, this run's slot went to a candidate found by
    searching the code for a real, small task: `RoadScene.ts`'s
    `openPicker()`/`closePicker()` add a fade tween per part with no
    `killTweensOf` guard — the same *shape* as PR #125's practice-staff
    tween leak. Before shipping the obvious fix, built both versions and
    ran #125's own mutation-test discipline against it: mash the toggle
    (open/close faster than the 130ms fade, 40 times), then let it settle.
    Result: `tweens.getTweens().length` spikes mid-mash but **drains back
    to baseline every time** — no permanent leak. Re-ran the same
    diagnostic against #125's actual bug (temporarily reverting its fix)
    to confirm the method: that one holds elevated permanently (5 → 24 →
    25, still climbing after 4.5s settled). The difference is `repeat: -1`
    — #125's leak was the free-play cursor's infinite breathing tween
    (`fadeInFreeStaff`, ~line 1352) outliving its destroyed target; the
    picker's fades are one-shot and finish on schedule even when orphaned.
    Grepped the file for every other `repeat: -1` tween: only the bard's
    walk/idle/lute-sway loops, and their targets are never destroyed (they
    stop via `.stop()` in `bardTweens`, a different and already-correct
    mechanism) — so #125 already covers the only real instance of this bug
    shape in the codebase. Added the guard and a fifth seam-check pair
    anyway to see what they'd look like, then reverted both: the check
    would have passed with or without the underlying "fix," which is
    exactly the false-confidence a check must not provide. Shipped nothing.
    `RoadScene.ts` and `tools/seam-check.mjs` are unchanged.

    279 tests, `npm run build` green — reconfirmed as a baseline, no code
    touched in the final diff.
106. **Next.** Nothing queued.

    **First, check the blockers.** Re-checked this run (task 105): both
    remain blocked (forest-song fetch still 403s everywhere; the GitHub MCP
    toolset still has no tag/ref-write *or* branch-protection-write call).

    **Second, if a playtest answer has arrived**, fold it in — see task 79
    for the one open dial (`SESSION_GAIN_CAP`).

    **Third, CI gating is settled for now** (task 92): `headless-checks.yml`
    stays informational (`continue-on-error`, push-to-`main`-only) until a
    human configures branch protection — see STATE.md's Blocked on human.
    Nothing left to decide here autonomously; don't re-litigate it every run,
    just re-check whether the human item has been resolved.

    **Fourth, the idea backlog below.** Only sharper mobile rendering is
    left, and it still needs a real phone to judge the fill-rate trade.

    **What not to reach for.** The verification suite is comprehensive now
    (24 checks); adding another for its own sake is drift. So is another
    render extraction — `createBard` is the only drawing code left in the
    scene and it is genuinely entangled with scene state, so moving it would
    relocate the tangle rather than remove it. **Key signatures** remain a
    v0.4+ *direction* rather than a task, because they break naturals-only,
    which is load-bearing for the whole letter-fading model. **The picker's
    tween handling** (task 105) looked like a bug and mutation-tested clean
    — don't re-open it without a new, different repro.

107. ~~**Consolidation: split the songbook picker out of RoadScene.**~~ Done
    (Run 39, scheduled). Both standing blockers re-checked first and
    unchanged (forest-song fetch still 403s on a plain Wikipedia page; the
    GitHub MCP toolset still has no tag/ref-write or branch-protection-write
    call), no playtest answer had arrived, and the idea backlog is down to
    the one phone-dependent item — so this run picked up the consolidation
    STATE.md had already flagged as the obvious next one:
    `RoadScene.ts` had regrown to 2275 lines since the last extraction pass
    (task 66), entirely from the "two ways in" session — picker overlay,
    free-play staff, walk chrome, none of it existed when the scene was last
    split. Moved the picker overlay to `src/scenes/picker.ts`
    (`openPicker`/`closePicker`, the `PICKER_*` constants):
    2275 → 2172 lines. A genuinely different extraction from the earlier
    `render/*` ones — those are pure functions of their inputs with no game
    state; the picker owns `pickerParts`/`pickerOpen` (has to be torn down
    as a whole, and other input handling needs to know it's open) and reads
    the current song choice to highlight a row, so it takes a `PickerHost`
    interface (the slice of RoadScene it touches) plus a `chooseSong`
    callback rather than the scene itself. `pickerParts`/`pickerOpen`
    dropped their `private` modifier — a private class field can't satisfy
    a plain interface type, confirmed by `tsc` before the fix. `PICKER_CHOSEN_BG`
    is exported from the new module and re-imported by `RoadScene`, since
    it doubles as the free-play cursor/pip color and the practice-mode lute
    tint, not just the picker's chosen-row highlight.
    Free-play and walk-chrome were left alone — the first still touches
    substantial scene state (the whole staff-as-instrument mode) and the
    second is scattered rather than a single cohesive block; either is a
    task of its own if picked up later, not a natural continuation of this
    one.
    Verified behaviour-preserving rather than assumed: `npm test` 279 green
    (unchanged), build green (bundle unchanged at 1.27 MB), and the three
    checks that actually exercise the picker — `songpick-check` (a chosen
    song starts promptly, repeats, settles the biome, survives a reload),
    `freeplay-check` (switching songs from inside free play, which opens
    the picker from a different mode), `hud-check` (the picker's touch
    target geometry) — all still pass, plus the full 14-check quick suite
    green with zero regressions elsewhere.
108. ~~**Next: nothing queued → re-check blockers, investigate what's
    found.**~~ Done (Run 40, scheduled). Both standing blockers re-checked,
    unchanged: `WebFetch` still 403s on a plain Wikipedia page (re-tried
    against the forest-song candidate directly), and the full
    `mcp__github__*` toolset available this run still has no tag/ref-write
    or branch-protection-write call. No playtest answer had arrived. The
    idea backlog's two entries are both still correctly deferred (sharper
    mobile rendering needs a real phone; solfège is a deliberate locale
    question per DESIGN.md's "Considered and rejected"), and reading the
    actual free-play-staff and walk-chrome code (per this task's own
    instruction) confirmed task 107's caution was right: `buildFreeStaff`
    alone touches `songTitleText` (shared with the walk's own announcement),
    `songChoice`, and the fade/persistence fields, and `setWalkChromeVisible`
    touches nine unrelated fields including the meter and coin readouts —
    neither is a clean single-unit extraction the way the picker was, so
    task 109 does not attempt it.

    What this run's slot went to instead: five places in the codebase
    (`RoadScene.ts` ×2, `render/ui.ts`, `STATE.md`, `tools/README.md`, plus
    task 59's own summary above) assert as flat fact that "a resize re-runs
    Phaser's `create()`" — the reason the learning scaffold lives at module
    scope and texture baking is idempotent. No check had ever isolated that
    specific claim; `rotate-check.mjs` only ever proved *state survives* a
    resize, which it would either way given those defenses. Instrumented it
    directly with a `Phaser.Scenes.Events.CREATE` counter attached after
    initial boot, across two rotations (plus, in a throwaway scratch script,
    a third arbitrary resize and a direct GameObject-identity check on
    `bardUpper`): **`create()` fires zero additional times** — same scene
    instance, same GameObjects, throughout. The assumption does not hold in
    headless testing.

    Did not remove the defenses it produced (module-scoped scaffold, the
    `this.textures.exists()` guards) — they cost nothing, and this headless
    result can't rule out a real device behaving differently under actual
    WebGL context loss, which was the original (never independently
    tested) worry. What changed: the count is now asserted permanently in
    `rotate-check.mjs` rather than assumed, and the five misleading
    comments/docs are corrected to say what's actually been verified versus
    what's still just insurance against an untested case.

    `npm test` 279 green (unchanged), build green (bundle unchanged, same
    content hash), full 14-check quick suite reconfirmed green including
    the updated `rotate-check.mjs`.
109. ~~**Consolidation: split the free-play staff out of RoadScene.**~~ Done
    (Run 41, scheduled). Both blockers re-checked first (unchanged — see
    Blocked on human), no playtest answer had arrived, and the idea
    backlog held only the phone-dependent item, so this run took up the
    "legitimate work if someone scopes a real first piece" this task's own
    previous entry (108) left open. The free-play staff (scrim, ladder,
    cursor, written-phrase tracking, `playFreeNote`) moved to
    `src/scenes/freePlayOverlay.ts`, the same shape of split as the picker
    (task 107): a `FreePlayOverlayHost` interface is the exact slice of
    `RoadScene` the module reads and writes, including `songTitleText`
    (shared with the walk mode, exactly the entanglement task 108 flagged)
    and three small callbacks (`hitLineX`, `noteOriginY`, `strumLute`) for
    the handful of things that are genuinely the scene's own layout/
    animation rather than the staff's. `enterFreePlay`/`exitFreePlay`
    stayed on `RoadScene` as the mode-toggle orchestration, same as the
    picker's `openPicker`/`closePicker` wrappers.
    Two small shared-constant moves came out of scoping this correctly:
    `STAFF_LINE_STEPS` (the treble staff's five line positions) to
    `core/notation.ts`, and `NOTE_TINT_UPCOMING/HIT/MISS` to
    `render/engraving.ts` — both were RoadScene-local consts used by *both*
    the walk's markers and free play's notes, so leaving them in RoadScene
    would have forced a circular import between the two scene modules.
    `RoadScene.ts` 2172 → 1838 lines; new module 414 lines.
    Caught by the verification, not by reading: a transcription slip while
    moving `playFreeNote`'s fade-out tween (`delay: 220` misread as
    `ease: 'Quad.easeIn'` off a truncated file read) — the exact class of
    mistake this file's own "when a check fails, suspect the check first"
    lesson is really about in reverse: a *refactor* claiming
    behaviour-preservation needs the same suspicion applied to itself.
    Re-reading the untruncated original caught it before any check ran.
    Verified behaviour-preserving, not assumed: `npm test` 279 green
    (unchanged — no unit tests cover scene modules, same as the picker),
    build green (1266.81 KB vs 1267.23 KB, module boundary only), the full
    14-check quick suite green, plus `songpick-check`, `rotate-check` and
    `seam-check` (normally quick-mode-skipped, run explicitly since this
    touches the picker/free-play/rotation seams directly) all green — the
    same specific area (practice staff visibility) that shipped invisible
    to production once before (PRs #115–#122), so this run erred toward
    over-verifying rather than under.
110. **Next.** Nothing queued.

    **First, check the blockers** (re-checked task 109): both remain
    blocked — forest-song fetch still 403s, GitHub MCP toolset still has no
    tag/ref-write or branch-protection-write call.

    **Second, if a playtest answer has arrived**, fold it in — see task 79
    for the one open dial (`SESSION_GAIN_CAP`).

    **Third, CI gating is still settled** (task 92) — don't re-litigate.

    **Fourth, the idea backlog below** — only sharper mobile rendering is
    left, still needs a real phone.

    **Fifth, `RoadScene.ts` is 1838 lines**, down from 2172 after task 109's
    split. **Walk chrome** is the one remaining plausible extraction, and
    task 108 already found why it isn't a clean single-unit one the way the
    picker and free-play staff were: `setWalkChromeVisible` alone touches
    nine unrelated fields (staff lines, meter, clef, hit line, coins,
    distance) with no shared sub-grouping. Legitimate work if someone scopes
    a real first piece (e.g. just the meter bar, or just the staff/clef),
    not an automatic pick.

    **What not to reach for.** The verification suite is comprehensive now
    (24 checks); adding another for its own sake is drift. `createBard` is
    still the one drawing block genuinely entangled with scene state, not
    worth extracting. **Key signatures** remain a v0.4+ *direction*, not a
    task — they break naturals-only. **The picker's tween handling**
    (task 105) mutation-tested clean — don't re-open without a new repro.
    **The "create() re-runs on resize" question** (task 108) is now a
    checked fact, not folklore — don't re-investigate it without a reason
    (a Phaser upgrade, a `rotate-check.mjs` failure) to suspect it changed.
111. ~~**Consolidation: split the song meter out of RoadScene.**~~ Done
    (Run 42, scheduled). Both blockers re-checked first (unchanged — see
    Blocked on human), no playtest answer had arrived, and the idea
    backlog held only the phone-dependent item, so this run took up the
    "just the meter bar" first cut task 110's own entry named as
    legitimate work once task 108 had already ruled out
    `setWalkChromeVisible` as a whole (nine unrelated fields, no shared
    sub-grouping). The three meter GameObjects (`meterTrack`, `meterFill`,
    `meterStaffLines`) and their constants moved to
    `src/scenes/meterBar.ts` — the same `Host`-interface shape as tasks
    107 and 109: `MeterBarHost` is the exact slice of RoadScene the module
    reads and writes, via `createMeterBar` (build, called once from
    `create()`), `layoutMeterBar` (the per-frame resize/reposition,
    replacing the inline block that used to live in `updateMeterBar`) and
    `setMeterBarVisible` (called from `setWalkChromeVisible` in place of
    three inline `setVisible` calls). `RoadScene.ts` 1838 → 1783 lines;
    new module 125 lines.
    One deliberate departure from the picker/free-play shape, recorded in
    the new module's own header: the three fields stay plain fields on
    RoadScene rather than a returned handle. Both precedents dropped
    `private` for the same reason (a private class field can't satisfy a
    plain interface type) — here there was a second reason to keep them as
    scene fields rather than hiding them behind a handle:
    `tools/hud-check.mjs` already reaches `scene.meterTrack` directly to
    check the HUD chrome doesn't overlap itself, and a handle would have
    meant touching a passing check for no behavioural gain.
    Grepped every one of the meter's seven constants (`METER_HEIGHT`,
    `METER_FILL_COLOR`, `METER_FILL_COLOR_STOPPED`,
    `METER_STAFF_LINE_COUNT/COLOR/ALPHA/THICKNESS`) before moving any of
    them — all seven were meter-local, none shared with another file
    (`core/hud.ts`'s `HUD_METER_HEIGHT` is a different constant despite the
    similar name, confirmed by grep rather than assumed).
    Verified behaviour-preserving rather than assumed: `npm test` 279
    green (unchanged — no unit tests cover scene modules, same precedent as
    the other two splits), build green (1266.84 KB vs 1266.81 KB, a
    module-boundary-only difference), and the full 14-check quick suite
    green — including `hud-check`, which reads `meterTrack`'s rect directly
    at 8 viewports, and `autoplay`/`mash-check`/`seam-check`, which
    exercise the meter's per-frame layout and mode-toggle visibility
    continuously.
112. ~~**Consolidation: split the coin/distance readouts out of RoadScene.**~~
    Done (Run 43, scheduled). Both blockers re-checked first (unchanged —
    see Blocked on human), no playtest answer had arrived, and the idea
    backlog still held only the phone-dependent item, so this run took the
    next piece task 112's own "nothing queued" note had already named as a
    candidate: of the four things left in `setWalkChromeVisible` (staff
    lines, clef, hit line/flash, coin/distance readouts), the coin/distance
    pair was the cleanest cut — `updateCoinReadout`/`updateDistanceReadout`
    were already two small self-contained private methods touching only
    their own two GameObjects, unlike the staff lines/clef/hit line/flash,
    which are interleaved with `laneY`/`hitLineX`/`beatPhase` in the same
    per-frame block as the note markers.
    `src/scenes/readouts.ts` (new, 75 lines) now owns `coinIcon`, `coinText`,
    `distanceText` and their five margin/radius constants, via
    `createReadouts` (called once from `create()`), `layoutReadouts` (the
    per-frame text/position update, replacing the two removed methods) and
    `setReadoutsVisible` (called from `setWalkChromeVisible`). Same
    `Host`-interface shape as the picker/free-play/meter splits:
    `ReadoutsHost` is the exact slice of RoadScene the module reads and
    writes. `coins`, `distancePx`, `coinIcon`, `coinText` and `distanceText`
    all dropped `private` for the same two reasons as the meter's fields —
    a private class field can't satisfy a plain interface type, and
    `tools/hud-check.mjs`, `tools/freeplay-check.mjs` and five other checks
    already reach several of them directly. `RoadScene.ts` 1783 → 1747
    lines.
    Verified behaviour-preserving rather than assumed: `npm test` 279 green
    (unchanged — no unit tests cover scene modules, same precedent as the
    other three splits), `npm run build` green (1266.76 KB vs 1266.84 KB, a
    module-boundary-only difference), and the full 14-check quick suite
    green — including `hud-check` (reads `coinIcon`/`coinText` rects
    directly) and `freeplay-check` (reads `coinText.visible`,
    `distanceText.visible` and `coins` directly to confirm free play doesn't
    feed the coin/step counters). `node_modules` was missing at the start of
    this run (fresh checkout); `npm install` (54 packages, 0 vulnerabilities)
    was needed first. Playwright for the check suite was installed fresh
    into the scratchpad (`npm i playwright@1.56.1`, matching the pinned
    version) since it is deliberately kept out of `package.json`.
113. **Next.** Nothing queued.

    **First, check the blockers** (re-checked task 112): both remain
    blocked — forest-song fetch still 403s, GitHub MCP toolset still has no
    tag/ref-write or branch-protection-write call.

    **Second, if a playtest answer has arrived**, fold it in — see task 79
    for the one open dial (`SESSION_GAIN_CAP`).

    **Third, CI gating is still settled** (task 92) — don't re-litigate.

    **Fourth, the idea backlog below** — only sharper mobile rendering is
    left, still needs a real phone.

    **Fifth, `RoadScene.ts` is 1747 lines**, down from 1783 after task 112's
    split. What remains of `setWalkChromeVisible` is the staff lines, the
    clef, and the hit line/flash — all three still interleaved with
    `laneY`/`hitLineX`/`beatPhase` in the same per-frame block as the note
    markers (task 108's original finding stands: not a clean single-unit
    extraction the way the meter and the coin/distance readouts were).
    `createBard` remains the one drawing block genuinely entangled with
    scene state. Four small extractions in a row (tasks 107, 109, 111, 112)
    is a real pattern worth naming: the next one should have an actual
    reason (a bug, a new feature that needs the room, or the scene crossing
    some further threshold) rather than being picked by default just
    because it's there — see CLAUDE.md's drift-control note, which applies
    to over-refactoring as much as to over-adding.

    **What not to reach for.** The verification suite is comprehensive now
    (24 checks); adding another for its own sake is drift. **Key
    signatures** remain a v0.4+ *direction*, not a task — they break
    naturals-only. **The picker's tween handling** (task 105)
    mutation-tested clean — don't re-open without a new repro. **The
    "create() re-runs on resize" question** (task 108) is a checked fact —
    don't re-investigate without a reason to suspect it changed.

114. ~~**Delete the dead 2D/Phaser presentation layer.**~~ Done (Run 44,
    2026-07-29). v0.6 (below) replaced Phaser with Three.js and left
    `src/scenes/`, `src/render/` and `src/audio/AudioEngine.ts` unreferenced
    dead weight, plus 24 `tools/` Playwright checks driving a `window.game`
    global that no longer exists. All deleted; `phaser` dropped from
    `package.json` (bundle 1266 KB → 686 KB); `verify-all.mjs` now runs the
    one check that matches the live game (`shader-check`); docs
    (`tools/README.md`, root `README.md`, `headless-checks.yml`) updated to
    match. See STATE.md's Run 44 note for the full detail, including what
    wiring `shader-check` in for the first time found. This was the item
    STATE.md had flagged as "first on the v0.6 queue" since the v0.6 merge.

## The v0.8 queue: "the walk is played, not watched" (human-set, 2026-07-31)

Set by a human watching the live game on a real GPU. DESIGN.md's v0.8
section is the contract. Wave 1 (tasks 129-132) landed in one interactive
session; the open tasks follow.

129. ~~**The walk carries the tune.**~~ Done (2026-07-31, interactive):
    `core/walk.ts` (pace = pure function of meter, 13 tests), walking notes
    through the same SongNotes/judge/audio pipeline busks use, songbook
    pinning as a HUD corner + persisted `songChoice` (v0.5's choice, made
    diegetic), and the two observed trigger anomalies explained (4 m
    approach radius is deliberate; the "skipped" encounter was same-day
    visited-list dedup). Verified live: empty meter freezes s, taps restore
    stride same-frame.
130. ~~**Walking music.**~~ Done (2026-07-31, interactive): adaptive gains a
    'walking' mode (3-layer ceiling, +0.12 thresholds, 0.62 gain scale —
    sparser than the busk on purpose), `audio/mix.ts` hard-caps the ambience
    bus at half the music bus across ~9,000 tested scenes, ambience beds
    re-filtered (two-stage, defined top edges — the "white noise" fix),
    per-partial decay envelopes make each instrument's spectrum move like a
    real one. RoadStage wiring: music bus, per-frame ambience duck,
    arrangement running in every phase, melodyGain noodling at 0.10 when
    the meter is empty. fadeLayers now only at vista/encounter/camp.
131. ~~**The riverside has a river.**~~ Done (2026-07-31, interactive): a
    road-space ribbon carved relative to a level water surface (terrain
    averaged over ~96 m along the course), 17 extra terrain columns around
    the channel, per-side irregular waterline, paintWater generalised to
    vertex-coloured meshes, bank reeds/silt, 55 m band-edge fades, all
    deterministic from the daily seed. Plus: foliage flatShading bug found
    (see STATE), meadow clumping, boulder/log/bush silhouette grammar.
132. ~~**Figures become people.**~~ Done (2026-07-31, interactive): faces
    (eyes/nose under the brim — whose dip had an inverted sign), the lute
    rebuilt as bowl+soundhole+strings with a triangle-wave strum, wrist
    cuffs closing the "detached blocks", travellers get faces/raised brims/
    attention nods, camp's propped instrument rebuilt. Figure-ground at
    20 px: busk median step 16.0 → 20.1 sRGB.
133-136 landed 2026-07-31 (same interactive session, wave 2); 137+ queued
from the wave-2 blind re-critique and the human's stakes direction.

137. ~~**Replace the cast-shadow layer's read.**~~ Done (2026-07-31,
    wave 3) — with the premise CORRECTED by ablation: in the morning/noon
    frames the "smears" mostly SURVIVE `uShadowDepth = 1`, so they were
    never cast shadows — they were the foreground tier's smooth 30% ramp
    (now three frayed treads with hue rotation toward the fog colour) and
    the road's soft boundary against the grass (STILL OPEN, see 143).
    Real cast shadows: SHADOW_EDGE 0.34 → 0.13 plus a zero-mean
    world-space fray (~50 cm lobes) — binary mask, ragged painted edge,
    area preserved so the dawn/dusk ladder keeps its reach; plus
    CAST_SHADOW_SKY keyed on occlusion (not facing), because SKY_SCATTER's
    own arithmetic only ever coloured the *shade* side and a noon cast
    shadow was a pure multiply. Map resolution was measured NOT to be the
    lever (4096 A/B'd: indistinguishable once remapped). Also from this
    agent: `renderer.shadowMap.enabled=false` is not a valid ablation —
    materials keep sampling the stale map.
138. ~~**Notes must sit on the staff.**~~ Done (2026-07-31, wave 3). All
    five defects root-caused: glyph anchors were always exact — the
    depth-size makeup (0.24 → 0.10) inflated far heads past a staff
    space; portrait clipping was fitShare guarding the lane centreline
    while half a billboarded glyph hung past it; the "ghost" was
    consecutive same-pitch notes stacking in depth; urgency inverted
    because fading began at hitTimeMs exactly (now: notes swell to their
    boldest AT the barline, hold through the late tail); and the SIX-LINE
    DISPUTE settled — both camps right: five ink bands in the geometry,
    but the paper's dissolve boundary rendered rule-thick and landed one
    staff space above the top line on G5-range tunes. Now a 2.1-step
    gradient; a geometry-walking test pins exactly five lines forever.
    Worst-hour pitch contrast 6.18:1.
139. ~~**Lit side / shade side + tinted midground rung.**~~ Done
    (2026-07-31, wave 3). Root cause: skywardNormals(0.92) leaves ~0.08 of
    horizontal normal — the bearing survives scaled; normalising the
    horizontal component recovers WHICH WAY a surface faces. MODEL_SPLIT
    rotates hue between luminance-normalised sky (shade) and sun colours,
    MODEL_VALUE adds a banded mean-neutral step, gated off flat ground and
    below-horizon sun. Midground: FG_TIER stepped into 3 frayed treads
    with FG_TIER_HUE toward the fog colour (aerial perspective is a hue
    rotation before it is a veil). Gates all PASS; morning land p90 158 →
    163. Note for tuning: MODEL_VALUE is the dial that buys stops back.
140. ~~**Character construction at hero scale.**~~ Done (2026-07-31,
    wave 3). THE root cause, found by measurement: `boxPart` has been
    wound INSIDE-OUT since the file was written — 0% of normals pointed
    outward, so FrontSide materials culled the near wall of every limb
    and the player was looking at the inside of the bard. One line;
    explains three critique cycles of "decomposing geometry" (the knee
    plates were the thigh's own bottom cap seen through an undrawn
    thigh). Also: arms were occluded by a 220° cloak (now 187°, shoulders
    out, splay sign corrected — it was pressing both arms INTO the
    chest), sleeves recoloured off the cloak; busk strum re-solved by a
    5,400-combination sweep (bowl, rose and strings in the open, forearm
    crossing them); boots rebuilt as closed hulls (the box was centred
    4 cm behind the ankle — the "stray wedges" were sky-lit sole tops);
    travellers got real arms, hands, and one gesture each (staff-lean,
    raised hand, eye-shade, clasped lap). New pins: hand-outside-cloak in
    three poses, strum travel > 8 cm, zero lute vertices inside legs.
141. ~~**Campfire light and smoke.**~~ Done (2026-07-31, wave 3). Fire
    pool: per-vertex tint ramp (cream→gold→orange→deep red→violet-brown)
    with the mechanical find that the resting camera stood entirely
    inside the pool's inner orange half (radius 4.6 → 4.4, strength cut —
    a clipped channel has no hue); rim jitter moved per-vertex; ~13
    seeded pebbles give the light modelled ground. Night darkens:
    uHearthRadius was defaulting to 4.2 with nobody writing it — now
    driven at 3.0. Smoke: 7-sided (odd — no parallel edges) per-puff
    rotated/squashed/jittered wisp that swells and gives out at ¾ height,
    leaning off its root, drawn at 0.38 value. Camp props renamed
    themselves: pack got a carry loop (the one mark that can't be a lid),
    bedroll raised and pillow palest-in-camp. Layout test caught a real
    rigid-rotation bug in the new pebble scatter.
142. ~~**Stakes, not failure.**~~ Done (2026-07-31, wave 3; DESIGN v0.8
    item 8). Crowd dispersal: each gathered listener beyond the first has
    a warmth keep-threshold; only the marginal listener is ever timed
    (8 s grace, one departure at a time, visible stroll-out); recovery
    brings them back; THE FIRST LISTENER NEVER LEAVES. Closing journal
    line stays kind, pinned by a test banning fail/lose/wrong/penalty
    vocabulary. Asks: ~35% of traveller encounters (own sub-seed, share
    pinned) request the next 8 notes, 6 landed pays rarity-scaled
    coins+delight settled early; fumbled passes with a warm line and
    costs nothing. Not persisted — a reload lets the moment go quietly.
    +20 tests (performance 79, encounters 55).
## The v1.0 arc: "the Festival of the Long Road" (human-set, 2026-07-31)

DESIGN.md's "The true goal" section is the contract — read it first. This
arc gives the game its destination; the v0.9 retention queue and wave-5
visual queue below interleave with it (151 and 159 are the same campfire
scene — build once).

158. **The journey ledger.** Journey state gains the pilgrimage: legs
    walked (campfires) toward the festival at 12-15; hybrid pacing — the
    calendar day's first leg is the shared daily road, further legs are
    moonlit roads (seeded day+leg, deterministic). Pure core logic +
    tests first. (core/journey.ts, core/road.ts.)
    **Done (2026-08-01, overnight session). Core only, by design — no
    scene wiring yet, so zero behaviour change in the live build.**
    `FESTIVAL_LEGS = 13` (inside the human's 12-15 band; counted
    against `campfires`, so every night already slept counts — a night
    by the fire is a leg wherever it was slept). `legsToFestival` /
    `festivalReached` helpers. `JourneyState.legIndex` (persisted as
    optional `leg`, pre-v1.0 saves read as 0; day rollover always
    resets to the shared road). `startNextLeg` — only from `resting`,
    deliberately NOT an `enterPhase` transition: a new leg is a new
    road, so it resets s/visited/journal like the rollover while
    keeping the day's purse; nothing gates it and nothing rewards it
    beyond the walk (the kindness constraint is what's absent).
    `dayFractionAt` gained the night arc: moonlit legs walk dusk →
    midnight → next dawn ((DUSK + 0.32·t) mod 1), every leg the same
    night rather than an accelerating calendar. `rng.ts` gained
    `legSeed` (leg 0 === `dailySeed` by identity, pinned by test —
    communal first walk) and `legRoadKey` (`2026-08-01~2`-shaped, so a
    moonlit road's stop ids cannot collide with the morning's — the
    road.ts:76 trap). 1033 tests green (+16). Next up: the campfire
    scene (159/162) is where `startNextLeg` and the moonlit road build
    (`generateRoad(legSeed(k,n), legRoadKey(k,n))`) get wired.
159. **The first-campfire promise.** The journal opens, the festival is
    named, tomorrow's road silhouette glows (merge with task 151),
    rehearsal is introduced. The single most important scene in the game;
    success metric in DESIGN. (Campfire.ts, journal, Hud.)
    **First piece done (2026-08-01, overnight session): the journal
    opens and the festival is named.** Before this the journal was
    written all day and read back nowhere — the fire said one coins
    line and the day's story stayed in storage. Now `core/
    campfirePage.ts` (pure, 10 tests) composes tonight's page — the
    day's last `PAGE_MOMENTS_MAX` moments plus the festival line in
    three registers (first-fire full naming / "N campfires on" in
    storybook words / anticipatory at the gate, deliberately not
    promising the 163 scene) — and the Hud sets it in type above the
    instrument corner, each moment inked in the sky it happened under
    (the `dayFraction` stamp journey.ts always carried for exactly
    this), rows revealing one by one. Tap folds it away; strikeCamp
    folds it too. Festival copy measured in distance only (test bans
    calendar words) and the journal's no-verdict vocabulary (test bans
    fail/lose/wrong/missed/streak/score). Verified in the re-shot
    07-night-campfire postcard: page legible bottom-left, clear of
    fire and bard. **Still open on 159: tomorrow's road silhouette on
    the horizon (next piece), rehearsal introduction (waits for 162's
    mechanic), and the moonlit walk-on choice (needs mid-session road
    rebuild — its own task).**
    **Second piece done (2026-08-01, overnight session): tomorrow's
    road on the horizon.** `core/skyline.ts` (pure, tested) derives a
    16-sample normalized profile from tomorrow's actual shared road
    (`nextDayKey` + `legSeed(key, 0)` — honest anticipation, the same
    skyline at every fire on the same day); sky.ts raises it as a
    third, farthest ridge band in a ±0.6 rad wedge around the
    down-road heading, crest from the profile (hat-weighted loop, not
    computed indexing — this material is GLSL ES 1.00), tinted through
    the existing `ridgeTint` at haze 0.45 / value 0.86, with a warm
    first-light halo (peak 0.18) above the crest. Everything scales by
    one uniform `uTomorrow`, eased 0.8/s toward 1 only while resting —
    ablation is one dial, and walking frames are byte-untouched.
    A/B-verified on the campfire framing (band on: lifted warm glow +
    far ridge beyond the treeline; off: flat dark purple) and the dawn
    walking postcard confirmed unchanged. Footprint measured 5.11% of
    frame, confined to a 141-row horizon strip. 1051 tests green
    (+8 skyline/nextDayKey), build 828.23 kB.
    **Final piece done (2026-08-04) — TASK 159 COMPLETE: the moonlit
    walk-on.** Tonight's page now carries a fourth kind of row — a
    *door*: "Or tap here to walk on — the road goes a little further
    beneath the moon" (composed in campfirePage with the other copy,
    vocab-bound by the same tests; "tap here" because every other row
    folds the page). Taking it runs the game's first mid-session road
    rebuild: `startNextLeg` (task 158's core, live at last) resets the
    journey's road-shaped fields, then RoadStage strikes the camp and
    lays `generateRoad(legSeed(key, n), legRoadKey(key, n))` — new
    WorldStreamer, new travellers (seeded by the new road, so walking
    on and reloading are indistinguishable), tomorrow's skyline rehung
    on the new road's end heading, and the sky needs no seam because a
    leg's first light IS dusk, exactly where the evening already stood.
    The moonlit road introduces itself "by moonlight" as the morning's
    did. Three adjacent faults fixed while wiring: a resumed moonlit
    leg used to rebuild the *shared* road (constructor now seeds by
    `legIndex`); `tomorrowSkyline(road.dayKey)` would mis-seed on a
    `~N` road key (now always the plain day key); and a folded page
    put the door out of reach — a tap at the fire with nothing left to
    ask now re-opens tonight's page, recomposed current. The door is
    withheld on the festival eve only (the eve's one asking is the
    set; ordinary fires resume after) — composer always offers,
    RoadStage's eve override removes it, both under test. Verified
    live end-to-end (13 assertions): door → leg 1 at the trailhead at
    dusk on the `~1` road → the leg's own fire offers again → fold/
    re-open → leg 2 → reload resumes the SAME moonlit road, zero
    console errors; 07-night-campfire re-shot and read (door legible,
    clear of fire and bard). Harness lesson: Playwright's isVisible
    counts an opacity-0 fade-out as visible — assert computed opacity.
    1094 tests green (+7), build 863.74 kB.
160. **By-heart on the road.** A well-carried song's note heads fade to
    ghosts then to a clean staff; a recall stumble gently returns them.
    Extends the scaffold's fade machinery one level up (letters, then
    heads); same safety rule — fade the prompt, never the answer, and
    help returns instantly. "By heart" is a song state on diary facts.
    (core/scaffold or a sibling, SongNotes.ts.)
    **First slice done (2026-08-01, overnight session): the LETTERS
    level went live.** Discovery that reshaped the task: the scaffold
    model (complete and tested since v0.4) had NO live callers — no
    encounter() heard taps, no load/save ran, and every letter printed
    at spawn; "one level up" would have built on an unwired first
    floor. Now: `core/reveal.ts` (pure, 8 tests) bridges scaffold →
    per-note reveal leads (first-in-pass keeps a band more help — the
    teacher points at the note once per repeat; a FRESH scaffold
    yields full-flight letters, so a new player's staff is
    byte-identical to before — kindness by arithmetic, not special
    case); SongNotes gained an `aLetter` instanced attribute gating
    the atlas's green channel (letter hides inside an intact head,
    fades in over 150ms at its reveal moment; struck/softened notes
    always show the answer); RoadStage loads the scaffold, feeds every
    judged tap (`meterAlive` read BEFORE applyJudgement so collapse is
    judged on the tap's own meter), saves in persist(), and keeps the
    leads array parallel to the walk's in-place-extended beats (a
    fresh array each extension would strand the cursor). Verified
    live: seeded-strong scaffold → far note letter 0, approaching note
    mid-fade 0.246 (arithmetic exact), past-barline 1; fresh → all 1.
    Test-rig trap documented: seeding localStorage then reloading gets
    clobbered by pagehide's persist — seed via init script before the
    app boots. **Remaining on 160: the heads-to-ghosts level (by-heart
    proper) and its diary-facts song state.**
    **Second slice done (2026-08-01, overnight session) — TASK 160
    COMPLETE: heads fade to ghosts, then a clean staff.**
    `core/mastery.ts` (pure, 7 tests): `headsLevel` gates on BOTH the
    diary fact (`songWalks` — passes walked with the song pinned; a
    wander-rotation tune was never "carried") and the model (every
    position at band 0 — heads fading before letters would be a cliff,
    not one-level-up). Thresholds GHOST_WALKS 6 / CLEAN_WALKS 14; with
    SESSION_GAIN_CAP this means by-heart takes several real days plus
    real carrying — festival pacing by arithmetic. `shownLevel` pins
    the stumble demotion. scaffoldStorage gained `w` (same single
    anonymous key; absent reads as never-carried — errs toward help).
    SongNotes: `setHeadsAlpha` with asymmetric settle (help returns in
    ~0.3s, ink withdraws over ~2s — "quick to help, slow to withdraw"
    written as two rates); travelling heads take the fade, judged
    notes never do. RoadStage: earned level per pinned walking song,
    stumbles return ink instantly — BOTH tap-judged misses AND lapsed
    untapped notes (found in verification: at a clean staff the real
    stumble is silence, and lapses go through tickPerformance's sweep,
    not playNote; lapses are display help only, never fed to the
    scaffold); pass boundaries withdraw the help, and only passes with
    at least one hit count as carrying (idling is not carrying). Busks
    always perform from the full page. Verified live: earned 2 →
    target 0 → settled 0.04 while played; silence → 10 lapse-stumbles
    → ink fully back; the clean-staff frame read by eye (five empty
    rules riding the road — the design image exactly). 1066 tests
    green (+7), build 834.31 kB. The by-heart *song state* for
    162/163: a song is by-heart when `headsLevel(...) === 2` — the
    rehearsal and the festival book read the same function the staff
    does, so the state can never disagree with the ink.
161. **Pitch recall in practice.** Practice mode's unguided tier: no pip,
    find the melody's positions yourself; wrong note sounds and costs
    nothing; the kind fallback restores guidance. The only surface that
    exercises true pitch recall. (core/freePlay.ts, practice UI.)
    **PREMISE GAP found 2026-08-01 (same class as 160's): practice mode
    does not exist in the live game.** `core/freePlay.ts` has zero
    consumers in src/three — the practice UI died with the 2D build in
    Run 44 and was never rebuilt. So this task is really "build the
    practice surface into the Three game, with the unguided tier",
    which needs a position-CHOOSING input model the tap-anywhere game
    deliberately lacks (tap-on-staff-line regions? — an input-design
    question a 5-9-year-old's fingers should settle, not a scheduled
    run). Arc-sized and design-sensitive; split before attempting, and
    consider asking the human about the input model first.
162. **Campfire rehearsal.** Each campfire offers one attempt at the
    carried song without notes — no-fail, notes return on a stumble, the
    journal writes it warmly either way. (Campfire/RoadStage + core.)
    **Done (2026-08-01, overnight session).** The fire's asking rides
    tonight's page as an `invitation` line (this is also 159's
    "rehearsal is introduced" beat — introduced by being offered, in
    the fire's own voice); a tap anywhere at the fire begins one pass
    of the carried song from a clean staff (`headsEarned` set to 2 for
    the attempt, so 160's whole stumble machinery — tap-misses AND
    silent lapses — returns ink level by level); the walk's gentle
    meter judges it; taps feed the scaffold as real evidence; the
    journal writes one of three registers from `core/rehearsal.ts`
    (vocab-banned by test, kindest at the bottom: "Tunes are learned
    exactly this way"), and `journey.rehearsed` (persisted `rh`,
    reset by every new leg and day) keeps it one attempt per fire so
    the asking stays an occasion. A rehearsal cut short by a closed
    tab is simply not written — the next fire asks again. Verified
    live end-to-end: invitation on page → tap → mode 'rehearsal',
    staff clean → silence returns ink (6 stumbles → full) → warm
    journal line persisted → second tap inert. Bonus bug found by
    reading the frame: a day RESUMED at the fire stood the bard in
    the flames all night (constructor path never set the seated
    pose; only live setPhase did) — fixed in makeCamp, idempotent.
    1077 tests green (+11), build 837.32 kB. Note for the resting
    camera: the ribbon lies over the road behind this framing —
    fine while the staff is clean, worth a look when ink returns
    (human playtest note in STATE).
163. **The festival.** Arrival scene at journey's end: the bard performs
    the by-heart book to the festival crowd; warm payoff; then the
    choice — Book Two's invitation (showing a real sharp sign and what
    it would teach), free revisiting, or walking on. (New scene + core.)
    **First piece done (2026-08-01, overnight session): the festival
    eve.** `core/festival.ts` (pure, 7 tests): `isFestivalEve`
    (festivalReached && festivals === 0), `festivalSetList` (the songs
    genuinely CARRIED — songWalks order, pinned tune opening, capped at
    3, an all-wandering player met with the rotation's tune: nobody
    walks thirteen campfires to be told their book is too thin — this
    is the no-fail reading of "performed from the by-heart book"),
    arrival copy and closing line (vocab-banned). The gate camp's page
    becomes the festival's; one tap plays the set as a CHAINED
    rehearsal, each song performed AS IT STANDS (by-heart from the
    clean staff, still-learning with its ink — headsLevel per song,
    unlike the ordinary rehearsal's forced clean staff); per-song
    journal lines, then the closing line, `journey.festivals` banked
    (persisted `fests`, +2 round-trip tests) and the next fire is
    ordinary. Interrupted set = whole eve returns. Queue dedupes on
    RESOLVED song id (an unknown carried id falls back to the rotation
    — two unknowns must not play the same tune twice; found live).
    Verification-harness lesson recorded: addInitScript re-seeds on
    EVERY navigation — guard with a seed-once flag or reload checks
    test the seed, not the game. **Remaining on 163: the post-festival
    choice (Book Two invitation with a real engraved sharp, revisit,
    walk on) and the festival grounds visuals (lanterns, stalls,
    crowd, stage).** 1086 tests green (+9), build 841.46 kB.
    **Second piece done (2026-08-01): the post-festival choice.** After
    the closing line, a quiet sheet (`Hud.showSheet`, the title card's
    family) offers three doors, none marked correct: "Hear what Book
    Two would teach" (a second sheet with a large F♯, three honest
    lines including "still being written", and F then F♯ SOUNDED
    through the real instrument voice — `playPitch`, exactly tuned
    because the engine already is; a journal line records the leaning),
    "Wander the songbook" (opens the book), "Walk on" (dismisses).
    Missing the sheet costs only the demonstration. Copy vocab-banned
    (+1 test). Verified live: both sheets render, the door chain works,
    the journal line lands. **Remaining on 163: the festival grounds
    visuals only.** 1087 tests green, build 844.13 kB.
    **Final piece done (2026-08-01) — TASK 163 COMPLETE; the v1.0
    festival arc SHIPS and the v1.3 queue unlocks.** `FestivalGrounds`
    (new scene class, Campfire idiom, ~2.5k tris, fully seeded): three
    catenary lantern lines (~18 lamps, three alternating warm hues via
    per-instance colour, gentle phase-offset sway), three closed
    stalls, a knee-high plank stage with banner-prism poles, and a
    warm ground pool sized deliberately against wave-5's night fault —
    the lamps and pool give the night frame the mid-value ladder it
    measured as missing. Placement derives from campfireLayout(seed)
    so it cannot disagree with the built camp; outside the extent,
    off the road, and off the bard's sightline column (the agent hit
    and fixed the stick-through-hat fault the layout's checks exist
    for). Festival eve only; ordinary-night control verified empty.
    Frame read: lantern strings cross the mid-ground with visible sag
    and hue variety, stalls/stage silhouette against the pool. 1087
    tests green, build 853.12 kB. Ops note: the task-172 service
    worker caches index.html on the preview server — unregister
    between rebuilds in verification sessions or a stale bundle
    white-screens.
164. **The title card.** One warm card for returning players: "Continue
    the journey" (default, one tap) / "The songbook". New players skip
    straight to the road. Playable-in-5s holds. (main/App/Hud.)
    **Done (2026-08-01, overnight session).** `Hud.showTitleCard`: a
    radial dark-plum veil with the dawn road glowing through (a
    bookmark lifted, not a menu), title + "The road kept your place." +
    two doors, staggered reveal. The WHOLE sheet is the default door —
    one tap anywhere continues; "The songbook" stops propagation,
    dismisses, and opens the book via the new public `Hud.openBook`.
    Gated in RoadStage's constructor on `resumed.totalMetres > 0` (a
    record with no walking behind it has nothing to continue — DESIGN's
    "nothing to choose goes straight to the road"). The stage loads and
    runs beneath the veil, so playable-in-5s holds; the card costs one
    tap. Verified live: fresh profile → no card; returning → card,
    tap-anywhere dismisses, songbook door opens the book; frame read
    by eye. 1077 tests green (unchanged — DOM layer, no unit precedent),
    build 838.95 kB.
165. **Book Two: true keys.** The accidentals volume — real key
    signatures, sharps/flats correctly engraved and exactly sounded.
    Engine is chromatically exact already; notation needs accidental
    glyphs; songbook needs volume structure. Arc. (notation, songs,
    engraving in SongNotes.)
    **First piece done (2026-08-05, overnight session): the notation
    core.** `core/notation.ts` gains the key layer, majors only, four
    sharps to four flats (the method-book span; minors wait for the
    songs that need their raised-seventh rule): `majorKey` (unknown
    names answer null, Book One's own stance), `alteredLetters` /
    SHARP_ORDER / FLAT_ORDER, standard treble signature glyph steps,
    and `spellInKey` — total over every pitch and key, separating
    what a note *carries* (F♯ in G carries the sharp) from what the
    engraver *shows* (nothing — the signature says it; F natural
    shows the cancelling sign, which is the lesson a signature
    teaches). Spelling policy pinned by test: chromatic notes spell
    in the key's own direction, always one letter away, so B♯/E♯/
    C♭/F♭ and double accidentals can never appear. The inviolable
    round-trip is swept: every spelling in every key across four
    octaves sounds back as the semitone it was spelt from
    (`semitoneOfSpelling`), and Book One's naturals-only functions
    are pinned untouched. Pure core, zero live-build change. 1106
    tests green (+12), build green. Next pieces: accidental glyph
    engraving in SongNotes; songbook volume structure; the first
    Book Two song.
    **Second piece done (2026-08-05): the song data model.** `Song`
    gains optional `key` (a name, resolved via `majorKey`; absent IS
    C major — keyless is Book One's contract, not an error) and
    `songKey()`. Deliberately nothing per-note: pitches stay
    semitone-exact and the spelling derives from the key at engraving
    time, so the page and the ear cannot drift. The Book Two
    engraving rules bind NOW, on fixtures, in songs.test.ts
    (`keyedSongFaults`): notes must be diatonic to the key — the
    signature does ALL the work; a shown accidental is a later,
    deliberate step — every spelling must round-trip to the exact
    pitch, spelt steps must stay on the drawable staff, and a test
    pins that no shipped song carries a key until the volume
    structure exists. 1111 tests green (+5), build green. Next: the
    engraving (signature + accidental glyphs in SongNotes), then the
    volume structure, then the first Book Two song.
    **Third piece done (2026-08-05): the signature on the paper.** The
    glyph atlas's three spare cells become the sharp/flat/natural
    marks (body channel only — an accidental carries no letter);
    `SongNotes.setKey` raises a key's signature as fixed instances on
    the paper's tail, PAST the barline on the player's side — the
    written line's left edge is at this ribbon's vanishing distance,
    and the near end is where the eye lives — with the tail extended
    (TAIL_M 0.46 → 1.14) so the marks stand on paper, staggered in
    entry order at the standard treble steps (pure `signatureGlyphs`,
    pinned by test: G = one sharp on F5's line). With a key set,
    every head's step is SPELT through it (`stepOf` → spellInKey):
    a G-major F♯ sits on F4's space showing its plain F letter — the
    signature carries the alteration, which is the notation being
    taught (single-letter heads stay legible at phone size; flagged
    for human playtest). Book One's path is byte-identical: no key →
    staffStepAt's refusal, and all three RoadStage tune sites now
    pass `songKey(song)`, which is C for every shipped song.
    Verified live: baseline ribbon unchanged; setKey(G) raises the ♯
    on the extended tail; a fixture F♯4 renders mid-flight at step 3
    (screenshot read); setKey(null) takes it all down; zero console
    errors. 1116 tests green (+5), build green. Remaining on 165:
    the songbook volume structure, then the first Book Two song
    (needs a verified public-domain transcription — same sourcing
    bar task 60 set).
    **Fourth piece done (2026-08-05): the first Book Two song.** *My
    Bonnie Lies Over the Ocean* (traditional Scottish, published
    1881 — unambiguously public domain), a waltz in G whose F♯ is
    the leading tone a child already sings without knowing its name.
    Task 60's sourcing bar finally met — this machine has network:
    transcribed from TWO independent settings on thesession.org
    (tune 6023, one in G and one in D), which agree note-for-note
    once transposed, cross-checked against the tune as sung. Two
    engine-honest normalizations, documented in songs.ts: the
    source's cross-barline ties become note + written rest (duration
    here is arrival spacing, not sustain — one tap and the breath
    the singer holds), and the closing G is short by the one-beat
    pickup so a looping pass hands its own upbeat back. That pickup
    needed the data model's last piece: `Song.pickupBeats`
    (anacrusis — engraving fact only, expansion untouched), with the
    bar-integrity test offsetting its grid (and a -0/Object.is trap
    found on the way: Math.floor(-0) fails toBe(0)). Lives in
    `BOOK_TWO_SONGS`, its own list — Book Two is a post-festival
    choice, not road scenery — NOT yet reachable in game; the whole
    per-song engraving suite now runs over both books (keyless =
    naturals-only; keyed = diatonic, spelt-range, no shown
    accidental). 1125 tests green (+9), build green. Remaining on
    165: the volume structure — the songbook UI's Book Two shelf,
    unlocked by `festivals >= 1`, which makes this song reachable
    and completes the task.
    **Final piece done (2026-08-05) — TASK 165 COMPLETE; the v1.0
    arc stands finished except 161 (blocked on human).** The
    songbook grew a shelf: `refreshSongbook` appends a small-caps
    "Book Two — true keys" heading and the BOOK_TWO_SONGS beneath it
    once `festivals >= 1` (refreshed the moment the festival's
    closing line lands, so the shelf appears that same night); a
    pre-festival household sees the book exactly as it always was.
    `songForPass` resolves both books for a PINNED song while the
    rotation stays Book One (wandering never deals a keyed song —
    pinned by test), and a Book Two song has no home biome: the road
    keeps wandering. Sizing the shelf exposed a PRE-EXISTING fault
    and fixed it: `songBookBox`'s fold silently cut every row past
    what fit — on a 844x390 landscape phone that was everything past
    FOUR, so the far end of Book One was already unreachable exactly
    where screens are smallest. The book now PAGES: pure `bookPage`/
    `bookCapacity` in hudLayout (tested incl. the full-cycle-shows-
    every-row sweep), the last slot becoming a "turn the page ⤵" row
    when needed, page reset on reopen. Verified live end-to-end:
    post-festival save → shelf + My Bonnie in the book → pinned →
    the walk plays it with the ♯ on the paper and B3 wearing its
    ledger (frame read); 844x390 book pages through to Book Two;
    zero console errors. 1133 tests green (+8), build green.

## The v1.3 queue: "the family songbook" (human-set, 2026-08-01, post-festival)

Book Three: the songs you bring. The human's idea, sized honestly: the
pedagogy's own safety argument (fading is safe because the child already
knows the tune) is BEST satisfied by a song the family chose themselves.
All content stays local (localStorage; the CC0 rule governs what the game
ships, not what a player brings). Sequenced after the v1.0 festival arc.

176. **The song maker.** Practice mode already lets a child point at
    staff positions and hear them; let them SAVE what they tap as a
    named song and walk the road with it. Zero parsing, existing
    surface, and composing is itself pedagogy. (freePlay + songChoice +
    journey save.)
177. **MIDI import.** Dependency-free parser (the format is simple);
    melody extraction (single track direct, polyphonic via top-note
    skyline); quantize to the songbook's note values; auto-transpose
    into staff range; validate through the SAME engraving tests the
    built-in songbook passes — an uploaded song that cannot be engraved
    correctly is declined kindly, never mangled. Accidentals route into
    the Book Two machinery. (New core/midi.ts + songs plumbing.)
178. **MusicXML import.** Second format, richer (it is already
    notation); reuses 177's validation path.

Rejected on principle: **audio upload / transcription** (MP3, humming).
Automatic transcription is wrong often enough that it would mis-teach —
the exact failure that got the forest This Old Man rejected — and it
breaks "the notation is never musically wrong" at the feature's core.
Revisit only if browser-side transcription someday reaches
engraving-test reliability.

## The v1.1 queue: "the crafted frame" (human-set, 2026-08-01)

From docs/research/art-quality.md (primary-sourced: adamgryu's own posts,
Campo Santo's sky/color-script writing, Sable and Monument Valley
interviews) — read it before taking any task; its not-recommended list
(outline pass, bloom chains, shipped image LUTs) binds.

166. **Write the color script.** Authored per-hour/per-biome palette
    keyframes with INTENDED value structure, Firewatch-style — design
    noon on purpose instead of letting the palette imply it. Fixes the
    "anchorless noon" gap at the authorship level; zero runtime cost.
    (sky.ts keyframes + palette.ts, documented as a script.)
    **Piece 1 done (2026-08-05, run 68): the script is written —
    `docs/color-script.md`.** Eight hours, each with intended mood,
    what carries the frame (the structural claim: low sun = value
    carries, high sun = COLOUR must carry), the value structure
    (darkest dark / lightest light / eye's first stop), measured
    state, and owed work. Enforcement wired to the existing gauges
    (frame-quality pinned-road floors, shadowcast photometrics,
    land-histogram, postcards). Night/golden/dawn marked CARRYING —
    spend no runs there. Noon is THE designed hour, with measurable
    targets for the enacting run: shadowed land keeps ≥ 50% of lit
    saturation (ASH reference: 63%) rotating ≤ ~60° cool of the lit
    hue (ASH: +31°), instead of today's 180° flip to blue-grey at
    ~35% (183's numbers). Named non-levers: lightening shadows
    (reference shadows are DARKER than ours), lowering the noon sun
    (measured worse twice), full-frame passes (banned). Biome
    section names village-noon's special case (no treeline anchor —
    colour must come from accents and coloured shade). No runtime
    values changed in this piece.
    **Piece 2 done (2026-08-05, run 69): the cast-shadow rotation now
    restores its chroma.** One variable, per the house law: the
    CAST_SHADOW_HUE rotation's own claim ("chroma all the way along")
    was measured false — an equal-luminance mix toward a near-
    complement crosses grey, which is why shadowed land kept 34-49%
    of its saturation and read as the panel's banding. The rotation
    now expands the mixed hue's deviation from neutral back toward
    the fragment's own chroma magnitude, capped
    (CAST_SHADOW_CHROMA_CAP 2.2) so an opposed hue (warm road) stays
    quiet slate instead of garish blue, and luminance is
    re-normalised so the value gate holds exactly. Measured:
    S-kept dawn 43→50%, noon 49→66% (script target ≥50% MET),
    golden 34→40% (least-weighted hour by design). Frames: dawn's
    stripes carry plum/deep-green instead of grey-mauve; noon's bard
    shadow is a clean saturated blue; golden's grass shadows keep
    their teal (the panel's protected read) while its road stripes
    now carry warm violet — bolder, flagged for wave 8 to judge.
    frame-quality all poses PASS on the pinned road (noon 3.45,
    noon-village 1.93, hue spreads healthy). 1160 tests green,
    build green. Remaining 166 work if wave 8 asks: the skylight
    ambient saturation lever and per-biome noon accents were NOT
    touched this piece.
    **Piece 3 done (2026-08-05, run 85): the horizon stops
    dissolving.** Three waves running (8, 9, 10) read the day
    frames' distance as milky — wave 10's value lens: "distant
    terrain bleached to sky value so the horizon dissolves".
    Ablated in order before touching anything: tree-material
    fogScale 0.85 moved the measured far band 0.3 luminance levels
    (the band is not tree pixels), the noon/afternoon fog keys'
    value −5% moved it 1 (not fogged geometry either) — the milky
    band is the SKY DOME'S OWN painted ranges. The enacting change
    is dome-local: ridgeTint values 0.79/0.64 → 0.62/0.48, which
    moved the painted range 12.5 levels below its old value on the
    same-day frame while the sky above it stayed put. The horizon
    and fog keys are untouched (their do-not-darken history holds);
    the band-order argument survives by construction (the ridge is
    still the sky's own base × value, darker than air, lighter than
    real geometry). Frames read: 10-tablet's horizon is land meeting
    air; dawn's ridges stay gentle behind the mist. frame-quality
    ALL POSES PASS. NOTE for comparability: the UTC day rolled
    mid-run, so measurements were re-baselined on the new road —
    postcard A/B pairs must always be same-day. Remaining 166:
    per-biome noon accents + skylight ambient saturation (the
    "unmodulated khaki road" halves of wave 10's noon verdict).
    **Piece 5 done (2026-08-07, run 112): the flowers become drifts —
    the village-noon accent voice.** The script's village-noon section
    ("colour must come from its accents — it has no treeline to lean
    on") measured against the noon-village frame: both accent hues
    were on screen and INAUDIBLE — a 3-flower clump with 6 cm petals
    is a speck at postcard distance. Two calibrated moves of the one
    lever (the flower's voice), each shot separately: clump 3 → 7
    over 0.8 m (the grass entry's own "patches over specks"
    redistribution — a patch of terracotta or periwinkle instead of
    confetti) read as real drifts but left the frame-level voice
    flat; density 0.07 → 0.12/m² (×2.4 village multiplier, so the
    raise lands in the biome that needs it while forest stays at
    0.042 effective) peppers the meadow with coherent drifts — the
    wildflower-pasture read. INSTRUMENT FINDING, recorded in the
    script's changelog: frame-quality's hueSpread is blind to this
    lever (2.63/0.401 → 2.63/0.401 — flowers are too few pixels for
    a percentile spread), so the gauges gate regressions only and
    the panel judges the win: re-shot noon-village + 02/08 at wave
    16. All poses PASS, 02-morning unharmed by eye, 1235 tests,
    build green. Remaining 166: skylight ambient saturation;
    village noon's built accents (roofs/painted doors) belong to
    the props queue, not scatter.
    **Piece 4 done (2026-08-06, run 87): the road changes colour
    along its length.** Wave 10's loudest colour fault by area —
    "the largest area of every frame is one unmodulated hue", the
    khaki road at 50-60% of the day frames — against the reference's
    dirt path running "rust into ochre into sienna within one
    stretch". The road's base was a single flat `palette.road`
    swatch from first metre to last while the meadow has carried a
    ~170 m drift since the tone-field work. Same mechanism, road's
    turn: two slow sines of s (~200 m and ~80 m, several mesh rows
    per cycle so interpolation cannot kink; two independent
    zero-corner drifts per meadowAt's crease lesson) drift the
    track's base between the palette's own silt (`bank`, rust end,
    ×0.30) and sun-baked pale (`grassDry`, ×0.20 — held short so
    the road never meets the meadow at equal value). Shoulder
    inherits through trackAt; ruts/crown unchanged on top. Frames:
    03 and 08's roads read as travelled earth in stretches. All
    gauges PASS (noon 3.81, village 2.76), 1209 tests. Remaining
    166: per-biome noon accents proper (flowers/terracotta/water at
    full voice) + skylight ambient saturation.
167. **No framing without an anchor.** A composition rule the rig
    enforces: every camera mood guarantees a near-field anchor silhouette
    (telegraph props, landmarks, canopy mass), Monument Valley's
    screen-first lesson. Headlessly testable. (CameraRig + WorldStreamer
    placement bias; merges with task 145.)
    **First piece done (2026-08-05, run 82): the wayside cadence is now
    a rule.** Task 180's sentinel system leaked three ways — 15% of
    chunks rolled no sentinel, an exclusion collision (river, landmark,
    stop dressing) silently deleted the tree, and a uniform draw let
    gaps cluster — which is wave 9's "four unused edges on 8 frames"
    stated as arithmetic. Placement now lives in the pure exported
    `waysideSentinelSites` (the `stopDressingSites` pattern): every
    chunk holds at least one sentinel in its central band, so two
    consecutive sentinels are never more than 96 m apart on any road
    (pinned by test across 24 seeds); static exclusions REDRAW the site
    (12 bounded tries, the late tries alternating verges so a river
    owning one side cannot starve the slot) instead of deleting it;
    each slot draws from its own subseeded stream so a crowded slot
    cannot reshuffle its neighbour, and no other chunk's trees can
    move. The camp clearing is the one dynamic exclusion and still
    drops the tree at build time — a dusk rebuild must never move one.
    Deliberately NOT guaranteed: an anchor in frame at every instant
    (that is an avenue, and the sides alternate precisely so the road
    is not a hedge); the dial, if wave 10 still reads empty edges, is
    SENTINEL_BAND, not more trees. Frames read: 10-tablet (the one
    anchorless frame left) gains a corner-cropped canopy and a near
    broadleaf; 08-phone a top-edge-cropped sentinel; busk/campfire
    scenes untouched, road clear. frame-quality all poses PASS (noon
    3.86 stops). 1209 tests (+9). Remaining 167: a projection-level
    per-mood anchor audit only if wave 10 asks for it.
168. **The finishing pass.** Render to target at ~0.8 scale + a
    CODE-GENERATED 3D-LUT grade (Data3DTexture built at boot — no image
    asset, no constraint exception). A Short Hike's unifier translated
    to painterly: forgives close-range crudeness, can be net-cheaper on
    phones (fewer shaded fragments). Measure fps both ways on the
    quality tiers. (App.ts render path + painterly.)
    **Done (2026-08-06, run 95).** `finishing.ts` (FinishingPass) +
    `finishingGrade.ts` (the pure grade + LUT builder, delegated to an
    agent, 12 tests). The pipeline fact that shaped it: three r180
    applies NO tone mapping and NO sRGB encode when rendering into a
    render target (WebGLPrograms gates both on `currentRenderTarget ===
    null`), so the offscreen target must be HALF FLOAT (linear light
    overshoots 1.0; bytes would clip every highlight) and the composite
    owns the whole display transform — ACES + sRGB via three's own
    chunks, then the LUT in display space, where LUTs belong. Scene
    renders at 0.8 scale (samples 4, matching the old canvas MSAA; 0 on
    'low'), composited by one fullscreen triangle; devices without
    renderable half float fall back to the exact pre-168 path. The
    grade: gentle per-channel S-curve (CONTRAST 0.14), vibrance
    protecting saturated colours (0.18), split-tone cool shadows / warm
    highlights (SPLIT 0.035, zeroed at the endpoints so black stays
    black). KNOWING CONSEQUENCE: transparency now blends in linear
    light (tone mapping moved after blending) — the references' own
    compositing; frames read: noon road ochre and shadow blues gain
    conviction, dawn clouds warm, campfire pool richer, paper veil NOT
    re-brightened. frame-quality ALL POSES PASS (noon 3.73 stops, up).
    Pressed postcard routes through App.renderFrame so the capture
    matches the screen. MEASURED both ways: real-GPU desktop 100.1 vs
    100.4 fps at DPR 1 (free), 100.3 vs 98.5 at DPR 2 (the 0.64×
    fragment saving already pays for the composite); phone-tier numbers
    remain the standing real-hardware item (127). HARNESS LESSON:
    SwiftShader "timings" of this pass were pure sync artifacts —
    gl.finish() does not serialize the remote GL command stream, and
    forcing completion via readPixels showed the direct path costing
    3.5 s/frame, so no SwiftShader ratio of RT-vs-canvas cost is ever
    actionable. 1221 tests (+12), build green.
169. **Terrain as the hero surface.** Journey's lesson restated for this
    game: broad PLANNED shadow masses (task 144's remake), winner-take-
    all ground-material edges (adamgryu's splat trick — kills the soft
    road edge, task 143), clustered ground-cover patches inheriting
    ground colour with distance fade (task 149's fix, with LESS
    overdraw). One coherent pass, three existing tasks folded in.
    **Done (2026-09-01, run 139) — all three folded tasks now resolved.**
    143 shipped (run 137, the road's soft edge). 144's shader-knob family
    was exhausted (run 84) and its figure-shadow half shipped long ago
    (task 179); only its terrain self-shadow half stays parked, which this
    task never claimed to cover. 149's one remaining sliver (07's night
    spikes / the dark-meadow wavy read) closed this run — see its own
    done-note: the ground-cover-colour hypothesis is REFUTED, not merely
    unconfirmed, for a positive, measured reason (a harness pose bug puts
    zero grass/fern in the pinned frame at all; where grass/fern IS in
    view, its colour shows no real spatial banding beyond ordinary
    variance). Nothing left blocking this task's closure; docs-only, no
    code changed here.
170. **Bake vertex AO at generation time** on props and the bard — the
    strongest "crafted" signal at close range; precomputed into vertex
    colours, no UVs, feeds the existing lighting model. (geometry.ts
    builders + actors.)
    **Done (2026-08-05, overnight session; implemented by a delegated
    agent, verified in the main loop).** `bakeVertexAO` in geometry.ts:
    cosine-weighted hemisphere rays (16/vertex) against the mesh's OWN
    triangles via hand-rolled Möller-Trumbore (two-sided — backface
    culling would miss exactly the inside corners this exists for),
    distance-attenuated, multiplied into the existing `color`
    attribute with a hard floor (`AO_FLOOR` 0.55 — a painterly hint,
    never a render), deterministic by construction (one mulberry32
    stream, drawn unconditionally so stream position cannot depend on
    geometry content), with a 6000-vertex budget guard and two
    per-vertex prefilters (AABB distance + tangent-plane reject,
    3-5× faster). Wired into all 11 prop builders behind
    `cachedGeometry` (whole set ≈15 ms once; broadleaf worst at
    ~7 ms); the bard gets a figure bake on exactly hat/cloak/
    instrument-body (his other parts are closed convex hulls — AO 1.0
    by construction, so their shared material was left alone).
    Measured means: canopy undersides 0.85-0.94, cairn/shrub crevices
    floor ~0.56, bard hat min 0.70. Five property tests (determinism,
    only-darkens-to-floor, flat = unshaded, inside corner darker,
    budget guard) — plus a recorded engraving fact: an EXACT knife-
    edge crevice bakes to zero occlusion (rays hit at t=0 in the
    occluder's plane); real interpenetrating geometry is unaffected.
    Frames read: shrub masses and lute body gain soft crevice
    gradation, nothing reads as dirt. 1149 tests green (+5), build
    873.34 kB. The dial if a critique ever calls canopies dirty:
    broadleaf/willow maxDist.
187. ~~**Fix `postcard.mjs`'s resting-pose `s` mismatch.**~~ Done
    (2026-09-01, run 140). Run 139's ground-cover-probe.mjs finding named
    this as a genuine tooling bug and deliberately deferred it to its own
    run rather than fixing it as a side effect: `postcard.mjs`'s pinned
    `07-night-campfire` shot posed at a hardcoded `s: 1400`, but
    `RoadStage.makeCamp` (the resting-phase handler) ignores whatever `s`
    a pose asks for and always builds the camp at `road.stops[stops.length
    - 1]` — the road's real last stop, which moves every UTC day since the
    road is seeded from the day. Once the two diverged far enough, the
    camera posed at the stale `s` while `WorldStreamer`'s grass/fern LOD
    window (which follows `journey.s`, the value the pose call DID set)
    streamed nothing in — a resting frame with zero ground cover anywhere
    on screen, not a rendering fault but a harness pose bug. Fixed by
    querying `road.stops` at runtime, once per postcard run, before the
    shot loop, and overwriting the resting shot's `s` with the road's true
    last stop — the same pattern `ground-cover-probe.mjs` already used to
    build its own corrected-pose measurement. The SHOTS entry's literal
    `s: 1400` is now an unused placeholder (commented as such); the pose's
    *intent* (resting, day 0.95, at the camp) stays pinned, only the
    number that can't hold a fixed value does not. `frame-quality.mjs` has
    its own separate `night` pose at `s: 1400` but never sets `phase:
    'resting'`, so `makeCamp` never fires for it — checked, and it does
    not share this bug, so it was left untouched. Verified live, not just
    read: re-shot `07-night-campfire` against the running preview server
    and it now shows blade geometry and a stippled ground texture around
    the fire (screenshot compared against run 139's "featureless flat
    terrain" description of the old, mis-posed frame) — the fix does what
    the diagnosis predicted. Docs/tool-only: no game `src/` file touched,
    1249 tests and the build unchanged and green, `shader-check` PASS
    (quick verify-all; `frame-quality` is the slow half and wasn't run,
    since nothing it measures was touched). Next: the scatter lower-left
    design question (run 136), the app.renderer/finishing.render
    discrepancy still standing in the OTHER pixel tools (land-histogram/
    frame-quality/figground/figground-partition/shader-check — flagged in
    runs 138 and 139, still unfixed), the hue-free distance wall, or
    wave 20 (now clearly overdue — four visual-change tasks have landed
    since wave 19 with none of this run's own tool-only work counting
    toward that tally).
188. ~~**Fix the `app.renderer.render()` vs `app.renderFrame()` discrepancy
    across every remaining pixel-reading tool.**~~ Done (2026-09-01,
    run 141). Runs 138 and 139 found and flagged, but deliberately did not
    chase, the same bug in the harness's own measurement tools: several of
    them call the bare `renderer.render(scene, camera)` and read the
    result straight back with `gl.readPixels`, which skips `App.renderFrame`
    (task 168's finishing pass — the offscreen half-float render + 3D-LUT
    composite that is the LAST thing that happens to a frame a player
    actually sees). A tool built this way samples a pre-grade, pre-tonemap
    buffer and reports numbers about a frame nobody ever looks at.
    `ground-cover-probe.mjs` (run 139) already carried the fix for itself;
    this run applied the identical one-line swap
    (`app.renderer.render(stage.scene, stage.camera)` →
    `app.renderFrame(stage.scene, stage.camera)`) to every other tool still
    carrying the bug: `postcard.mjs`, `frame-quality.mjs`,
    `land-histogram.mjs` (both its measurement render and its post-`finally`
    restore render), `figground.mjs`, `figground-partition.mjs`,
    `shader-check.mjs` and `shadowcast.mjs`. `FinishingPass.render` (
    `src/three/finishing.ts`) was read first to confirm the swap is safe:
    it is a pure, stateless per-call composite (scene → offscreen half-float
    target at `RENDER_SCALE` 0.8 → LUT-graded to the full-resolution canvas),
    so repeated calls behave exactly like repeated `renderer.render()` calls
    for a tool's purposes, just through the pipeline a player's screen
    actually runs. Found one more bug while in these files: `figground.mjs`
    and `figground-partition.mjs` both imported their shared browser helper
    via a hardcoded Windows path (`file:///G:/WanderingBardGame/tools/
    browser.mjs`, apparently left over from whatever machine first wrote
    them) instead of the relative `./browser.mjs` import every other tool in
    the directory uses — both scripts were unconditionally broken (a
    `MODULE_NOT_FOUND` crash) outside that one machine, not just carrying
    stale pixel data. Fixed the import in both. Verified live, not just
    reasoned about: ran `shader-check` (part of `verify-all quick`) and
    `frame-quality` (the slow half, run in full since this task touched it
    directly) against the running preview server — both PASS, `frame-quality`'s
    seven-pose gauge table reads in the same range prior runs recorded
    (night gauge 6.39, in line with run 116's 6.47 baseline and the small
    run-to-run drift STATE.md already documents); also ran `land-histogram`,
    `postcard` (all eight shots, including the `07-night-campfire` pose task
    187 fixed last run), and `figground`/`figground-partition` (which could
    not run AT ALL before this run's import fix) end to end, all completing
    without error. `shadowcast.mjs` was launched against the live preview
    server too; it is the slowest tool in the directory (many caster-family
    render passes per shot), and its first shot produced a real, sane
    result (33.1% shadow share, trees owning 66.9% of it, plausible
    photometrics) before this run moved on rather than waiting out its
    other two shots — its one touched line (the `capture()` closure) is
    mechanically identical to the swap verified working in every other
    tool, and the live first-shot result confirms it. `tools/README.md`'s discrepancy note (in the
    `ground-cover-probe.mjs` section) updated to record that the older
    tools are fixed rather than still flagged. Docs/tool-only: no game
    `src/` file touched, 1249 tests and the build unchanged and green
    (902 KB, unchanged). Next: the scatter lower-left design question (run
    136), the hue-free distance wall, or wave 20 (now five visual-change
    tasks past wave 19, since neither this run's nor run 140's tool-only
    work count toward that tally).
189. **Size the "hue-free distance wall" lead** (wave 19's colour-lens fault,
    STATE.md's run-131 handoff — "distance fade resolves to a single
    hue-free wall" across 10 of 13 frames), the way run 139's
    ground-cover-probe sized task 149: build the instrument, measure, don't
    tune blind.
    **Piece 1 done (2026-09-02, run 142) — a real tooling bug found and
    fixed first, then a first, inconclusive measurement of the actual
    question.** Building `tools/fog-hue-band.mjs` (a new per-distance-band
    hue probe — no existing tool separates near/far *hue*, only near/far
    *value* or whole-frame hue) surfaced that `land-histogram.mjs`'s sky
    mask has been silently broken since task 168 (run 95): it classifies
    background by comparing pixels to hardcoded pure magenta (0xff00ff),
    an assumption from before the finishing pass's ACES tonemap + LUT grade
    existed. That grade moves pure magenta clear to roughly (253, 40, 240)
    — outside every tolerance the file used — so `isSentinel` matched
    almost nothing and every run of the tool since has measured land AND
    sky together while its own `landShare` column read ~100% on poses that
    are visibly half sky, unnoticed until this run looked at that column.
    Same family as the run 138/141 `renderer.render()`/`renderFrame()`
    bug: a pixel tool built one assumption behind a pipeline change. Fixed
    in both `land-histogram.mjs` and the new tool by calibrating live
    (hide the whole scene, render once, read back whatever colour is left)
    instead of hardcoding a target — deterministic for a fixed clear
    colour and grade, so one extra render pays for the whole measurement.
    Re-measured land-only stats moved materially (`03-noon`'s land p50
    158→174, landShare 100%→78%), so any land-only number read from this
    tool between run 95 and this fix should be treated as whole-frame, not
    land-only. With masking corrected, `fog-hue-band.mjs`'s first real
    reading does **not** cleanly confirm "everything converges on the
    fog's hue": `04-golden-vista` shows real convergence (far-band hue 28°
    against a live fog hue of 20°, with *higher* saturation than nearer
    bands) but golden hour is a CARRYING hour by the colour script's own
    ruling — off-limits to tune. The two enacting hours (`02-morning`,
    `03-noon`) instead show far-band hue SPREAD rising above their near
    band (0.458 vs 0.276; 0.331 vs 0.038) with only a modest saturation
    drop — a milkier, less confident distance, not a literal one-hue wall.
    Deliberately not chased into a shader change this run: the metric is
    new and unvalidated against an actual blind panel (wave 20 is
    network-blocked this session — CONNECT to `ashorthike.com` and
    `store.steampowered.com` both get a 403 from this environment's proxy
    policy; logged under Blocked on human in STATE.md), and pulling
    FOG_HUE_LEAD/FOG_CHROMA/the fogAmount cap on one unvalidated reading
    would be exactly the "blind tune" this task's own framing (and the
    scatter lower-left question's precedent) warns against. `npm test`
    1249 green (unchanged), `npm run build` green (902 KB, unchanged),
    `verify-all quick` (`shader-check`) PASS. See `tools/README.md`'s new
    sections for both the bug and the tool. Next: re-read
    `fog-hue-band.mjs`'s numbers against a wider pose set or a real panel
    once the network block lifts, before deciding whether this is a real
    lever or a dead end; the scatter lower-left design question (run 136);
    or wave 20 once un-blocked.

    **Piece 2 done (2026-09-02, run 143) — widened the pose set to 5 and
    found a sharper, falsifiable hypothesis than "enacting vs carrying
    hours": the far-band spread rise tracks `landKey.ts`'s pull amount,
    not the hour.** `fog-hue-band.mjs` now also reports each pose's
    `sunHeight` and the exact `landKeyAmount` (`landKey.ts`'s own formula,
    duplicated into the page-evaluated function with a comment pointing
    back — it can't import the module, see the file's existing note on
    why). Two poses reused from `postcard.mjs`'s already-vetted set were
    added specifically to separate the two candidate explanations:
    `11-morning-vista` (day 0.35, a different biome/vista than 02, sun
    height 0.267 — below `LAND_KEY_RISE_START` 0.3, so a second
    **zero-pull** control alongside golden) and `10-tablet-afternoon`
    (day 0.7, sun height 0.445 — a partial-pull regime past noon that
    nothing here had tested, distinct from morning's partial pull on the
    way up). Result, landKeyAmount vs (far hueSpread − near hueSpread):
    `04-golden-vista` 0 → −0.063 (far cleaner than near), `11-morning-
    vista` 0 → −0.060 (far cleaner than near, same direction, different
    hour and biome), `02-morning` 0.034 → +0.182, `10-tablet-afternoon`
    0.217 → +0.193, `03-noon` 0.35 → +0.297. Every zero-pull pose has far
    ≤ near; every nonzero-pull pose has far substantially > near, and the
    two afternoon/noon partial-to-full-pull poses land close together
    despite one being on the falling side of the sun's arc — a pattern
    "enacting vs carrying hour" alone doesn't predict (afternoon's sun is
    lower than noon's, but its landKeyAmount and its spread-rise both sit
    near noon's). The likely mechanism, not yet tested: `landKey.ts`'s
    pull only rotates chroma within 90° of the biome key, leaving anything
    outside that cone (the road, rock, a dissenter) untouched by
    construction — which turns one loose cluster into two tighter ones (a
    majority pulled toward the key, a minority left alone), and the
    circular hueSpread formula (1 − resultant length) reads that as MORE
    spread than the original single loose cluster, not less, because it
    scores overall variance rather than modality. Still not chased into a
    shader change — this is a mechanism hypothesis inferred from the
    correlation, not itself measured, and confirming it means comparing
    the same poses with the land-key pass forced off, which is next
    piece's work rather than this one's. `npm test` 1249 green
    (unchanged), `npm run build` green (902 KB, unchanged), `verify-all
    quick` (`shader-check`) PASS. Next: a piece 3 that toggles
    `landKeyAmount` to 0 (a temporary in-page override, no shader edit)
    on the three nonzero poses and re-measures — if the far/near gap
    collapses with the key off, that confirms the mechanism and turns
    this from a correlation into a real lever description ready for a
    validated (panel or wave-20) tune; if it doesn't collapse, the
    hypothesis above is wrong and the search moves elsewhere.

## The v1.2 queue: "the pocket road" (human-set, 2026-08-01)

From docs/research/mobile-friendly.md — read it first. The urgent fact:
Safari's ITP deletes ALL script-writable storage (the child's whole
journey) after 7 days without site interaction; home-screen-installed
web apps are exempt (WebKit first-party). Install-to-home-screen IS the
save system's protection on iPad. Store distribution (Play TWA $25,
Apple $99/yr + Mac + review risk) is a SEPARATE human-gated track — the
iPad household needs none of it; logged under Blocked on human.

171. **PWA save-protection bundle (urgent).** Web manifest + generated
    PNG icons + standalone display + `viewport-fit=cover` and safe-area
    CSS + `navigator.storage.persist()` + a diegetic save keepsake
    (export/import the journey as a small file/code — the journal page
    as a token). This is data-loss protection, not polish.
    **Done (2026-08-01, overnight session).** All five pieces:
    `public/manifest.webmanifest` (relative `start_url`/`scope`, so the
    Pages base needs no hardcoding; `display: standalone`; `purpose:
    "any maskable"`), `tools/make-icons.mjs` (pure-Node deterministic
    PNG encoder — zlib + hand-rolled CRC32, 8×8 supersampled render of
    the favicon mark at 512/192/180, full-bleed for iOS mask
    compositing; committed under `public/icons/`), index.html metas
    (`viewport-fit=cover` is what finally makes Hud.ts's existing
    `env(safe-area-inset-*)` probe return non-zero on notched phones;
    apple-touch-icon; theme-color), a one-shot
    `navigator.storage.persist()` on first gesture (main.ts), and the
    keepsake: `core/keepsake.ts` exports/imports the three storage keys
    as a human-readable JSON file, deliberately NOT re-validating
    record contents (every load path already normalizes on read — a
    second validator would drift). UI: two dim "endpaper" rows in the
    instrument CASE — first written into the songbook, where a
    screenshot showed them permanently below `songBookBox`'s
    whole-rows fold behind 11 songs; the case fits always, is the
    bard's own luggage, and its corner is now pickable on a fresh
    device (which is exactly the device that needs "Unfold a
    keepsake"). RoadStage guards every save path behind a `restoring`
    flag after import, because the pagehide save fired by the reload
    would otherwise overwrite the just-restored records. Verified
    live end-to-end in headless Chromium: export via the real row →
    downloaded file → storage wiped → import via the real file chooser
    → reload → journey metres restored byte-true. 1017 tests green
    (+17 keepsake), build 817.70 kB.
172. **Precache service worker.** Offline-capable shell (the bundle is
    one JS file + HTML); cold-load speed on flaky school wifi.
    **Done (2026-08-01, overnight session).** No plugin dependency — a
    workbox pipeline for one JS file is a lorry for a letter. A ~40-line
    plugin in vite.config.ts lists what actually shipped (hashed bundle
    + the task-171 shell) and emits `sw.js` with the list baked in;
    the cache name carries an FNV hash of the list so identical builds
    produce byte-identical workers and new deploys clean old caches on
    activate. Cache-first for precached files, cached-shell fallback
    for navigations, network for the rest. Registered in main.ts,
    production-only (a worker caching the dev server would serve
    yesterday's code forever), after `load`. Verified live: worker
    active with 7 URLs cached, then `context.setOffline(true)` +
    reload → the road boots ("11/1670 m · forest · first light").
    Also new: `src/vite-env.d.ts` (the repo had never used
    `import.meta.env` before). 1077 tests green, build 839.09 kB.
173. **Audio that survives the pocket.** iOS audio-session behaviour:
    silent-switch handling (WebKit bug 237322), interruption/resume on
    calls and backgrounding, Low Power Mode's 30fps rAF (WebKit 168837)
    — the beat clock must stay honest at 30fps.
174. **Quality tiers that actually detect.** detectQuality() reads
    Chromium-only deviceMemory, so every iPad lands 'medium'; the 'low'
    tier still enables shadow maps. Detect by GPU/UA signals available
    on WebKit; make 'low' genuinely low (no shadow map); re-measure the
    730k-triangle scene against mobile budgets.
    **Done (2026-08-05, overnight session), with the prescribed fix
    partly REFUTED by the code's own record:** "detect by GPU
    signals" is what the old comment already ruled out — the GPU
    string is privacy-gated and reads "Apple GPU" on every iOS
    device. The honest WebKit signals are the ones Apple ties to
    hardware anyway: the OS major in the UA (an iPad stuck below
    iOS 15 is old hardware, because updates stop with the silicon),
    Safari's Version/N for the iPadOS-13+ devices that masquerade as
    Macs (maxTouchPoints > 1 is the tell), and WebGPU's presence.
    `tierFor(probe)` is now a pure exported decision over a
    `CapabilityProbe` bag — one unit test per device family (old
    iPad → low, incl. the masquerading-as-Mac case caught by Safari
    version; modern iPhone/iPad → medium; real Mac never demoted via
    the Apple-touch path; Chromium heuristics preserved word for
    word, including the pre-existing quirk that engines without
    deviceMemory read as 4 → medium). 'low' is genuinely low now:
    shadows false, shadowMapSize 0 — the one renderer-wide cost the
    old low tier still paid — and the bard keeps his grounding
    because 179's contact shadow is a textured disc, not a shadow
    map. Modern WebGPU iPads deliberately stay 'medium' until the
    scene is measured on real hardware (the task's re-measure half —
    headless desktop GL says nothing; standing real-iPad playtest
    item in STATE). Boot-smoked live (high/shadowed on this desktop,
    zero errors). 1156 tests green (+7), build green.
175. **Touch-target and orientation audit.**
    **The scrim ruling (2026-08-07, run 127), settling four waves of
    the same mobile verdict.** The no-panel idiom STANDS — no plate,
    no border, no hard edge — and the wash now enforces its own
    premise: "the sky going quiet behind the words" means a BRIGHT
    sky must go quieter. Every wash's peak alpha scales with the
    sky's own luma (1x at the dusk/night tones all previous
    calibrations were judged against — those hours keep their tuning
    to the byte — rising to ~1.45x, peak 0.44 → 0.64 capped 0.68,
    under a noon-white sky). Wave 16's exact complaint — "contrast is
    a lottery decided by time of day" — is answered by making the
    contrast a function OF the time of day. Verified live at the
    style level: peak 0.596 at the noon-phone pose, purse ellipse
    intact. ALSO FIXED en route: setTone was clobbering run 117's
    purse wash with the generic trailing ellipse on the first sky
    change — the purse now keeps its tight geometry through every
    hour. 1249 tests, build green. Wave 19 judges the bright-hour
    captions.
    **Corner-presence piece (2026-08-07, run 117), aimed by wave 16's
    mobile lens.** Two of its five families answered inside the
    no-panel idiom: (1) "the coin counter is thin cream with no
    weight, haloed by a grey artifact" — the artifact IS run 100's
    trailing wash, an ellipse spanning a purse box sized for the
    longest readout while the content right-justifies into a corner
    of it; the purse now gets its own tighter wash (radiusX 34 at
    78%, hugging the mark + digits) and fontWeight 600, so the
    backing reads as the sky going quiet behind the numbers rather
    than "a stray unlit quad" (04/09/12's smudge). (2) The corner
    labels take fontWeight 500 with the caption (run 100's own move,
    never extended to the corners it was derived from — "hairline"
    was the lens's word both times). Frame read: 08's counter and
    both corner labels hold their stroke on a bright sky; the purse
    smudge is gone. NOT taken from the same list, with reasons in
    STATE: the "sub-threshold counter" arithmetic (the judge scales
    desktop shots to phone width — the phone frames render it at
    17-18 CSS px), and the chevron tap-affordance question (needs
    its own design pass, not a weight knob). 1239 tests, build
    green. WCAG 2.2 24px minimum /
    Apple 44pt on every HUD control at phone sizes; verify the landscape
    recommendation for the road; palm-rejection kindness already exists
    (stray taps are free) — pin it with a test.
    Wave-5 adds two concrete finds for this audit: the corner labels in
    the 03 postcard are sheared mid-glyph by the BOTTOM frame edge
    (desktop viewports get no bottom inset at all — check hudChrome's
    bottom margin, not just safe-area plumbing), and 08's two corner
    labels sit inside the phone's home-indicator swipe band in
    low-contrast grey-on-tan.
    **Chrome piece done (2026-08-05, run 71), aimed by wave 8's
    loudest family (six lenses: "unbacked text floating on world
    geometry", thumb-strip corners, orphan coin numeral).** Three
    changes inside the no-panels idiom: (1) the corner labels get the
    journal's own tone-following radial wash (biased toward each
    corner's content — a wash centred in the box would peak beside
    the words), so text stands on the sky going quiet rather than on
    raw world pixels; (2) INK_SOFT 0.72 → 0.84 and the corners take
    the journal's two-layer text shadow — the softness the alpha was
    buying now comes from the wash's quiet; (3) hudLayout gains
    BOTTOM_KINDNESS 12: a compact screen reporting no bottom inset
    still clears the gesture strip (a real inset replaces the
    kindness, never stacks — pinned by test; the moves-by-exactly-
    the-inset claim was re-derived accordingly). Touch targets were
    already 44px by construction (isTouchable pins them); layout
    unchanged otherwise. Frames read: 08's corners sit clear of the
    bottom edge with visibly stronger ink; 06/desktop washes read as
    quiet pools, not plates. 1161 tests (+1), build green. Remaining
    on 175: the walk-on door affordance (07 — an input-design
    question flagged for the human: child-wins says a door should
    look tappable, the no-menus idiom resists), and the orientation
    recommendation audit.
    **Caption piece (2026-08-06, run 100), aimed by wave 13's mobile
    lens ("every caption is unbacked hairline italic — it fails the
    moment the background is light or busy", nine frames).** Three
    steps inside the idiom plus one diegetic fix: (1) the journal
    wash's peak alpha 0.34 → 0.44 — down from the original 0.55 that
    read as a panel, up from the retreat that four waves have called
    invisible; still radial, still sky-toned; (2) the caption takes
    font-weight 500 (the lens's exact word was "hairline" — a book
    serif's italic at 400 thins to threads at phone size); (3) the
    caption's compact shrink eased 0.88 → 0.94 (corners can afford
    0.88; the one line of prose is read at arm's length). (4) The
    road greeting's hour word now follows the SHOWN sky — run 94's
    find ("this morning" over a dusk frame): composed in a new
    sayRoadAside() from shownDayFraction, and pose() recomposes it
    when it moves the clock, so a resumed evening save (and every
    posed frame) greets honestly. Frames read: 08's caption stands
    on a quiet pool against bright sky; 12 reads "this evening" over
    dusk. 1229 tests, build green.

## The v0.9 queue: "the road home" (human-set, 2026-07-31)

Retention as design work, grounded in docs/research/retention-design.md
(read it first — its rejected-on-principle list binds every task here).
DESIGN.md's "The road home" section is the contract. These interleave with
the wave-5 visual queue below; a scheduled run may take whichever list's
top task fits its energy.

151. **Campfire bookend: today closed, tomorrow glimpsed.** At the fire
    the journal writes today's page (where you walked, who you met, what
    you carried); on the horizon, the silhouette of tomorrow's road —
    genuinely renderable, the next UTC day's seed is knowable. Pure
    anticipation, zero loss-framing. (Campfire.ts, journal, road.ts.)
    **Closed as absorbed (2026-08-05, run 81 — audit, no new code).**
    Both halves shipped inside task 159: tonight's page (159 first
    piece — campfirePage composes the day's moments, the Hud sets
    them in type, each inked in the sky it happened under) and
    tomorrow's road on the horizon (159 second piece — core/skyline
    derives the profile from tomorrow's real seed; the sky raises it
    only while resting). 159's own done-entries named the merge both
    times; this entry closes the loop so the retention queue reads
    honestly. With it, v0.9 stands: 151 ✓ (via 159), 152 ✓ (name +
    traveller lines; 3D signage text deferred), 153 ✓, 154 first
    slice ✓, 155 first slice ✓, 156 ✓ — leaving only 157 (two
    bookmarks, arc-sized, scaffold-separation care) open.
152. **Name the shared road.** Diegetic sharedness: each daily seed gets a
    deterministic road name ("Larchwind Road"), on the signposts and in
    traveller lines that speak as if everyone walks it today — because
    everyone does. (road.ts name generator + world signage + encounter
    lines.)
    **Core done (2026-08-01, overnight session).** `core/roadName.ts`
    (pure, 5 tests): 28×8 curated names from
    `mulberry32(subSeed(seed, 'road/name'))` — naming cannot shift any
    other stream; moonlit legs name themselves (2026-08-01 is
    Bramblegate Way; its first moonlit leg, Willowbend Way). Surfaced
    at the trailhead ("Bramblegate Way, this morning." — construction
    only, s < 50) and as tonight's page title ("BRAMBLEGATE WAY —
    TONIGHT'S PAGE"; festival eve still wins its override). Verified
    live at both points. 1093 tests green (+6), build 861.57 kB.
    **Deferred: world signage + traveller lines that speak the name.**
    **Traveller lines done (2026-08-05, run 80; delegated to an opus
    agent, verified in the main loop).** Encounter prose gained its
    composer: `encounterLine(seed, roll, road)` draws from a NEW
    subSeed stream ('encounter/road' — existing draw order untouched,
    the sentinel precedent), and 22% of TRAVELLER meetings speak the
    road's name communally ("Half the county seems to be on
    Bramblegate Way today") — travellers only; a fox has no news.
    The aside lands in the journal too, so tonight's page carries
    the shared road. Anti-pressure regex bans obligation/comparison
    and ALL digits (no counts of other walkers, ever); null-name
    fallback byte-identical. 3D signage text remains deferred (no
    fonts in world). 1200 tests (+7), build green.
153. **The campfire postcard.** Optional share: a small painted frame of
    today's road with its name and the song carried. Shares presence,
    never performance — no accuracy, no coins, nothing gradable (Wordle's
    rule, and the research's leaderboard ban). Canvas-render + download;
    no network. (Campfire/HUD.)
    **Done (2026-08-05, run 76; delegated to an opus agent, verified
    live in the main loop).** `core/postcardCard.ts` (pure, 11
    tests): road name as title, the song carried or a wandering
    line, campfires in storybook words — never a digit, and a
    test-enforced vocabulary ban (accuracy/coins/score/streak/fail/
    missed/best/record/%) across all outputs. Tonight's page gains a
    row ("Or press a postcard of today's road, to keep or to send."
    — registered-handler contract like walkOn; pressing does NOT
    fold the page, a souvenir shouldn't end the evening).
    RoadStage.pressPostcard: explicit render + gl.readPixels (the
    preserveDrawingBuffer trap), rows flipped, parchment card with
    6% border and the HUD's own serif, canvas.toBlob download — no
    network, no dependency. Verified live end-to-end: row present at
    the fire, download saved, PNG read by eye (orientation correct,
    title and lines set well). Needs human playtest: long road
    names on a phone postcard. 1172 tests (+11), build green.
154. **Songbook pages wear in.** First slice: a song's page shows its
    walked-count as wear and marginalia (diary facts ONLY — never the
    scaffold model; a page that got prettier as letters faded would be a
    grade in costume). (songChoice/journey diary facts + Hud songbook.)
    **First slice done (2026-08-05, run 77; delegated to an opus
    agent, verified in the main loop).** `core/pageWear.ts`:
    wearTier(walks) 0/1/2/3 at 1/6/14 walks — thresholds IMPORTED
    from mastery.ts so the page and the staff age on one clock, but
    reading WALKS ONLY (the diary fact; the header cites the
    grade-in-costume rule). Songbook rows wear quietly by tier: ink
    warms (1+), a middot marginalia (2+), the fleuron ❧ with a
    breath of letterspacing (3) — no numbers, no badges, no
    tooltips; both volumes wear (a carried Book Two page is exactly
    as thumbed). Needs human playtest: tier 1 is deliberately
    near-invisible on a dim phone. 1178 tests (+6), build green.
155. **Mementos, not checklists.** Lovely encounter outcomes leave a
    keepsake drawn on the journal page — no collection screen, no counts,
    no empty slots; missed rarities recur on later roads (Sky's
    returning-spirits stance; encounters already reseed daily). (
    encounters.ts payouts + journal.)
    **First slice done (2026-08-05, run 78; delegated to an opus
    agent, verified in the main loop).** "Lovely" was already in the
    module's own vocabulary — nothing invented: any roll that leaves
    a GIFT (encounters.ts literally calls them keepsakes; they were
    shown once in the HUD and evaporated) plus the rare/wondrous
    tiers. `leavesMemento(roll)` exported; such meetings journal as
    kind 'memento' (same prose), and tonight's page presses a small
    upright ✽ into the line's own ink before the text. Measured
    share ~11% of encounters, pinned inside (0.02, 0.3) so a table
    retune can't make the mark wallpaper. No counts, no collection
    surface, no empty slots; missed rarities recur by construction.
    The resolved-ask entry deliberately NOT marked (a fulfilled ask
    marked too would read as reward for performance — flagged for a
    later slice if wanted). Needs human playtest: the ✽ on a real
    fire page. 1185 tests (+7), build green.
156. **Welcome-back, never weeds.** Returning after days away gets a small
    campfire welcome beat — the case's idle takings, a journal line about
    the roadside days. No counter of days kept or missed, ever. (idle.ts
    describeIdleYield + campfire/journal.)
    **Done (2026-08-05, run 79; delegated to an opus agent, verified
    in the main loop).** The fire's half of the beat: tonight's page
    opens with WELCOME_LINE ("The fire is glad of the company —
    there was noodling at the roadside all the while, and the tunes
    kept warm.") whenever the day's journal carries the idle-return
    entry — found across the WHOLE journal, not the 6-moment window,
    so a busy return day doesn't lose its welcome (regression-
    tested). Composed from the entry's existence only; ban sweeps
    cover digits, calendar words, and the debt register (no "you
    were gone", no "finally"), proven against a fixture that puts
    countable numbers right next to the fact. IDLE_JOURNAL_KIND
    exported so writer and reader can't drift. 1193 tests (+7),
    build green.
157. **Two bookmarks on one bench.** Local family profiles: two
    localStorage bookmarks, each with its own song pin and scaffold
    state, each able to see the other's journal PAGES (never anything
    gradable). Arc — scaffold-state separation needs care. (
    scaffoldStorage/journey save + Hud.)
    **Piece 1 done (2026-08-07, run 121): the storage layer, with a
    zero-migration design.** `core/profiles.ts` (pure, 6 tests):
    BOOKMARK 0 IS THE LEGACY KEYS, byte for byte — `bookmarkKey()`
    passes `wb.journey.v1`/`wb.learn.v1`/`wb.idle.v1` through
    unchanged for the first bookmark and suffixes `.b1` only for the
    second, so an existing family's save is never migrated, moved, or
    rewritten; a stale service-worker build interoperates; the
    task-171 keepsake keeps meaning what it meant (its export reads
    the ACTIVE bookmark's records but writes base names, so a
    keepsake stays bookmark-agnostic). The active pointer
    (`wb.bookmark.v1`) is REMOVED rather than written when 0 is
    chosen — absent IS bookmark 0, so pre-bookmark builds can never
    disagree about whose save the legacy keys hold. All nine storage
    call sites (journey/scaffold/idle/keepsake) route through
    bookmarkKey at ACCESS time. THE SWITCH CONTRACT, found by
    probing before writing the UI: a pointer moved under a LIVE
    session makes that session's unload save land in the NEW
    bookmark's keys — the design's one data-loss shape. The UI piece
    must switch the way the keepsake import restores (force-save,
    guard the save paths, move the pointer, reload) — contract
    recorded in profiles.ts. Verified live across three sessions:
    bookmark 0 walks to 121 m → bookmark 1 boots FRESH at 4 m →
    bookmark 0 resumes at 125 m; keys cleanly separated. NOT yet
    reachable by players (no UI). Remaining 157: the bookmark door
    (title-card family, the guarded switch), then the shared journal
    pages. 1246 tests (+6), build green.
    **Piece 2 done (2026-08-07, run 122): the bookmark door.** The
    title card gains its third, quietest door — "The second bookmark"
    / "The first bookmark" — and the card's gate widens by exactly
    one case: it ALSO shows when the OTHER bookmark holds a journey,
    because a fresh second bookmark has walked nowhere and this card
    is its only way back. A fresh bookmark's card greets honestly ("A
    fresh page on the same bench." / "Begin the walk") instead of
    claiming a kept place. The switch enacts piece 1's contract to
    the letter (`switchBookmark`): persist under the leaving
    bookmark → `restoring = true` (the keepsake import's guard — the
    reload's own pagehide would otherwise write the leaving session
    into the arriving bookmark) → move the pointer → reload. The
    door label never says anything about how far either bookmark
    walked (pages, not progress). Verified live with REAL TAPS:
    walked card → "The second bookmark" → pointer 1, fresh world at
    4 m, fresh-page card → "The first bookmark" → pointer removed,
    world resumed at 154 m, save intact. Remaining 157: the shared
    journal pages (each bookmark reading the other's PAGES, never
    anything gradable). 1246 tests, build green.
    **Piece 3 done (2026-08-07, run 123) — TASK 157 COMPLETE, and
    with it the whole v0.9 retention queue (151-157).** The shared
    pages: `peekJournal(bookmark)` (journey.ts) reads the sibling's
    stored record raw and side-effect-free — loadJourney normalizes
    and rolls the day for the bookmark about to PLAY, and reading a
    sibling's pages must never do either — returning ONLY the day's
    name and the prose lines by construction ("pages, not progress"
    enforced by the return type: no coins, metres, legs, or festivals
    can pass through it). `otherBookmarkPage` (campfirePage.ts, 3
    tests) composes a read-only page: their last six moments, the
    quiet line for an empty day, NO festival line (their progress),
    no invitation, no walk-on door (their road is not yours to walk).
    Tonight's page gains its quietest row — "Or turn to the other
    bookmark's page" — offered only when the other cushion holds a
    journey, gated to the fire's own page by the festival-line tell
    so the doors never recurse onto the sibling's sheet; their road
    is named from their own day's shared-leg seed. Verified live:
    seeded sibling record → row on tonight's page → tap → their fox
    line on their page, no festival distance anywhere. Journal lines
    are prose-only by construction (coins live in hud.say, never in
    recordEntry), re-checked across all six entry kinds. 1249 tests
    (+3), build green.

The wave-5 queue, from the wave-4 panel (mean ~5.5; take these next):

144. **Remake the terrain self-shadow as a presentation decision.** Three
    fix rounds (edges, fray, chroma) and fresh eyes still read the low-sun
    terrain self-shadowing as "casterless plaid bands". Options to
    evaluate: suppress terrain self-shadow bands at grazing sun and keep
    only object shadows; break the bands' uniform width with the landform
    (they are currently map-resolution uniform); or lean in and paint them
    as deliberate cloud-shadow shapes. ALSO REAL: the bard and props cast
    NO shadow ("the world casts, the bard doesn't") — give figures cast
    shadows; a shadowless hero reads as pasted.
    **Ablation run (2026-08-05, run 84 — no code shipped; all three
    licensed shader levers measured and REFUTED).** Run 75's handoff
    licensed "fray amplitude or shadow-map resolution" for the dawn
    smear wave 10 re-confirmed; both were measured this run, plus a
    third: (1) shadowMapSize 2048 → 4096 on the high tier moved NO
    number (penumbraShare 0.77/0.26/0.83 identical to baseline) — the
    low-sun penumbra is GEOMETRIC (a 3-6 m canopy's silhouette
    projected ×8 at 7° sun), not texel-bound; (2) SHADOW_GAIN_CAP
    0.55 → 0.40 moved dawn valueDrop not at all (0.10) — the cap's
    residue is too small to deepen the band; (3) SHADOW_FRAY_COARSE
    0.34 → 0.55 turned the foreground mottle into the leopard spots
    run 72 warned about while the main band stayed a film. WHAT THE
    MEASUREMENTS SAY INSTEAD: shadowcast attribution shows the dawn
    "casterless bands" are 94.3% TREE shadows (63 casters, 36% of
    the frame in shadow) whose casters stand off-frame — the smear
    is the ×8 projection scale itself, and its edges are ALREADY
    ragged in-frame (run 75 landed; the interior film and the scale
    are what read). Remaining levers are PRESENTATION decisions,
    not shader knobs: raise the dawn/dusk sun-elevation floor (fights
    the load-bearing long-shadow ladder and the color script's
    "dawn is CARRYING — spend no runs there"), or accept the hour.
    The shader-knob family (edge/fray/depth/chroma/resolution/cap)
    is EXHAUSTED — six measured rounds; do not reopen without new
    evidence. The figure-shadow half of this task (bard casts
    nothing) remains real and untouched.
    **Correction (2026-08-31, run 137): the figure-shadow half was
    already done by this point, this note was just stale.** Checked
    while scoping 143/169: `Bard.ts` already sets `castShadow = true`
    on the torso/thigh/shin/boot/cloak/arm/head/hat/lute-body meshes,
    `App.ts`'s shadow-camera frustum was widened to 110 m specifically
    so mid-ground actors would contact-shadow (see its own comment),
    ground sets `receiveShadow = true`, and `tools/shadowcast.mjs`
    already treats "bard" as a named caster family it measures
    photometrically — task 179 (figure/ground value floor, run ~108)
    is the entry that shipped it and later tuned it. Nothing to do
    here; only the terrain self-shadow "casterless plaid bands" half
    stays EXHAUSTED/parked as written above.
    **The low-sun value floor (2026-08-07, run 116) — the 144/169
    crush family's lever, enacted.** Three independent sites had
    converged on one mechanism (runs 105-107's dusk-stripe
    partition, wave 16's blind "bimodal frame — midtones scooped
    out", run 115's NPC-void refutation): surfaces at V ~0.2 lose
    their chroma through ACES + the finishing curve, and the
    painterly SKY FLOOR — the existing hue-carrying additive term
    gated on darkness — is sized from the ambient, so it shrinks at
    dusk/golden exactly when that crush is worst ("the floor comes
    down with the sky" is right at night and is the fault at the
    horizon hours). `valueFloor.ts` (pure schedule, 3 tests):
    uLowSunFloor boosts the SAME floor term ×2.6 across sun heights
    −0.16..0.15 (golden, dawn, dusk full; ZERO at the night pose
    −0.296 and at morning/noon by construction — the darkness gate
    keeps choosing the fragments, the hour gate only funds it).
    Measured: 05's pedlar V 0.205 → 0.292 with S HELD (0.386 →
    0.393) — value without chroma loss, the exact NPC prescription;
    12-dusk moves 64% of pixels, midtones open, figures read as lit
    people (frame read); 07-night 0.6% (byte-close), night gauge
    6.47 IDENTICAL. The trade, stated honestly: golden/landscape
    give back ~0.7 stops of range (4.29 → 3.59, still far above
    floors) and buy hueSpread 0.083 → 0.105 — the crushed band now
    carries colour. The colour script's "golden is carrying — spend
    no runs there" was traded against three waves of measured fault
    convergence; wave 17 judges on re-shot 05/09/12/13. ALL POSES
    PASS, 1239 tests (+3), build green.
145. **Anchor the anchorless frames.** 03/08/10 are one chalky plane: no
    dark mass, no authored landmark inside the first third. Noon and the
    phone framings need a composed anchor (landmark placement bias near
    postcard s-positions, a darker canopy mass, or a mid-frame prop).
146. **Portrait ribbon legibility, round three.** 08/10 still clump D-E-F-G
    into a blob (the governor's hard floor is not enough at 390 px).
    DISPUTED and must be measured first: "noteheads ride above the top
    line on lollipop stems" — anchors measured exact twice before; check
    the depth-makeup and the specific pose before re-fixing pitch.
    Wave-5 adds a measurement: in 08 the staff ENTERS AT x=0 — the one
    interactive surface is cropped by the left screen edge on the
    device with the most spare vertical, and the two visible pills fuse
    into one "DE" mass at x 140-290. The crop is a framing/fitShare
    fact, checkable in hudLayout/SongNotes constants before any pitch
    re-litigation.
147. **Commit to night.** 07: ring stones stay daylight-grey inches from
    flame, nothing throws radiating shadows from the fire, off-fire land
    sits within a stop of the sky. Needs the palette-side night ambient
    drop (the campfire agent's recorded ceiling), fire-warmed ring
    stones, and possibly cheap radial blob shadows from fire-lit props.
    Wave-5 RECONCILIATION — the panels collide here: wave 4 said
    "commit to night" (darker, moodier); wave 5 measured 59.4% of 07's
    pixels below L*10 (median L*6.4) against a reference night whose
    p5 never drops under L*32, with near/far conifers merged into one
    silhouette. The shared symptom is an UNDIFFERENTIATED dark. The
    fix is structure, not direction: a moonlit ambient that grades the
    treeline near/far, fire-warmed stones, radiating prop shadows —
    while the fire pool itself and the sky-to-treeline boundary stay
    untouched (every lens's keeps list).
148. **The postcard must catch the verb.** 05's busker reads as standing
    idle (the strum exists — the postcard shutter catches the arm at
    rest; consider posing the strum mid-sweep for the busk framing) and
    06 reads as a walking shot mislabeled (the encounter framing needs
    its own identity: two figures, mutual facing, closer camera — the
    staging landed but the postcard pose may predate arrival).

The wave-5 additions, from the wave-5 blind panel (2026-08-01; anchor
"ships beside ASH without apology", mean 4.42 — see STATE.md for the
full verdict map and the measure-first suspicion list):

186. **Stage the creatures (emotion arc, wave 17).** The emotion lens's
    sharpest finding: "the caption carries the feeling; the picture
    doesn't stage it — 06 says a deer held still through the whole
    verse; there is no deer in the frame." Worse than unstaged: every
    encounter, creature and weather alike, stood a random HUMAN through
    placeMeeting, so on a deer day the frame actively contradicted its
    own caption. Eleven creature encounters exist and all were
    prose-only. Give the most-met creatures real figures, one or two
    per run, in the travellers' own build idiom (boxPart, painterly,
    outline-first).
    **Piece 1 done (2026-08-07, run 119): the deer, and honest
    staging.** `actors/Deer.ts` — horizontal body over four legs, a
    steeply-risen ALERT neck and two splayed pale-lined EARS (the two
    marks no other silhouette has; at eighty metres a head-high
    quadruped with tall ears is unmistakable), quiet russet family at
    traveller values, the travellers' own lifted shadow floor. It
    breathes and occasionally flicks one ear — nothing else, because
    the line is about stillness and a fidgeting deer would unwrite it.
    Stood at 6.5-9 m (a wild thing choosing to stay, not a tame one at
    conversation distance), facing the bard; when the walk resumes it
    turns and leaves at 0.8 m/s — "without hurrying", staged. AND the
    staging now follows the writing generally: pure
    `meetingFigureFor(def)` (pinned by test over the whole table)
    routes traveller → person, creature → its own figure where one
    exists, and NOTHING otherwise — an unstaged line is honest, a
    mis-staged one contradicts the caption; weather stands nothing and
    the bard stays square. The bard still turns toward a described-but
    -unshown creature (it happened in a particular direction). Frame
    verified live through the real staging path: dusk, deer off-road
    right, ears reading, caption agreeing. 1240 tests (+1), build
    green. Remaining creatures by meet-frequency for later pieces:
    cat/dog/fox (village/forest commons), then the birds.
    **Piece 2 done (2026-08-07, run 124): the fox and the cat.**
    `actors/SmallCreatures.ts`, same idiom, one life signature each:
    the FOX ("sits down to listen, and pretends... it was only
    resting") is a seated triangle with tall pointed ears and the
    pale-tipped brush curled round its feet, whose only motion is a
    slow head-turn aside every ~9 s — the pretending, staged; the CAT
    ("tail going, deciding whether you are worth getting up for") is
    the game's smallest silhouette, a loaf whose tail is the entire
    performance and the only thing that moves. The deer's machinery
    generalized: a creatures Map + one drift record in RoadStage, a
    CREATURE_FIGURES table in meetingFigureFor (table-swept test
    extended), per-animal distances (deer 6.5-9 m, fox 5-7, cat
    3.5-5 — a cat concedes nothing by proximity). Both verified
    staged through the real path. Remaining: the escort-dog (needs
    walk-along behaviour, its own piece), then the birds. 1249
    tests, build green.
179. **Figure/ground value floor.** The panel's one measured-everywhere
    fault: bard-vs-surround dL 0.7 (02), 2.0 (01), 2.4 (07), 4.0
    (04/06) against the reference floor of 13.6-25.2 — the protagonist
    vanishes in greyscale; the red cloak's hue does all the work. START
    by measuring what 03 (dL 16.3) and 10 (12.1) already do right
    (likely the lit road behind the figure) and extend that mechanism;
    do NOT invent a rim light first. Keeps to honour: 08's inverted
    band order is load-bearing, and wave 11's diagnosis stands (value,
    not pose).
    **MEASUREMENT PHASE DONE (2026-08-01) — three premises DISPROVED
    with a flood-partition harness (now `tools/figground.mjs` +
    `tools/figground-partition.mjs`: silhouette-diff the bard, then
    flood his albedos white to partition figure pixels from his cast
    shadow).** Findings: (1) in every PASSING frame the knees-down
    "figure" is 0% bard — it is his cast shadow on a bright road; the
    panels compared shadow-vs-road in passers with legs-vs-road in
    failers. (2) At dawn there is NO shadow band swallowing the legs —
    the fault is the ABSENCE of a contact shadow under the figure (low
    sun casts it long, out of frame). (3) At low sun the figure is the
    BEST-LIT thing in frame (1.9x the road, white-flood measured) —
    the darkness is pure albedo, and the required correction INVERTS
    across the day (dark-on-bright at noon, light-on-dark at dawn), so
    no static albedo can serve both; the near-black-trousers attempt
    in Bard.ts's history already failed this way. (4) REAL DEFECT: at
    04-golden the bard's cast shadow renders LIGHTER than the road it
    falls on (L*31.3 on 28.7) — an inversion no shadow may have.
    **The re-aimed task (next run): guarantee a grounded contact
    shadow under the bard at low sun, and fix the 04 inversion (a cast
    shadow must never render lighter than its receiving surface).**
    Arithmetically sufficient (04: shadow to ~15 on a 28.7 road → dL
    ≈14; 01: ~22 points of headroom), ground-side (no halo terms),
    precedent in 144, and cannot regress 03/08/10 because it IS their
    mechanism. Measure with the partition harness, which must exclude
    cast-shadow pixels from the figure mask.
    **IMPLEMENTED (2026-08-01), with two corrections to the above.**
    (1) The "04 inversion" was ITSELF a measurement artifact — the
    partition harness compares shadow pixels against DIFFERENT road
    pixels; same-pixel ablation (clear castShadow, re-render) shows
    shadows properly 4-6 L* darker everywhere. The unguarded
    arithmetic was real though, so the guarantee shipped anyway:
    SKY_SCATTER's shade lift now reads sunFacing (orientation) not
    sunAmount (orientation×shadow), and residual cast-shadow gain is
    capped at SHADOW_GAIN_CAP 0.55 of the luminance removed. (2) The
    "22 points of headroom at 01" was arithmetically false: at dawn
    the FIGURE is the darker body, so darkening ground moves figure
    and surround TOGETHER — a contact mark cannot raise whole-figure
    dL there. What shipped: `ContactShadow.ts` (a draped, blended,
    edge-soft mark under the bard — three bugs en route: three.js's
    MultiplyBlending silently not honoured on this material, backface
    culling, and the fire-pool falloff shape being wrong for shadow),
    landing every daylight frame's contact in the passing frames' own
    8-15 dL-under-road band (01/04 previously had ZERO contact); no
    noon fade because THIS WORLD'S NOON IS 21.8° — the ramp was inert
    and was deleted. figground: 03 +2.1, 10/04 held, 01/02/08 small
    moves either way per the arithmetic above. **RESIDUAL, re-queued
    as the true remainder of 179: the dawn/low-sun figure-side value
    (dynamic, day-aware — no static albedo works; measurement phase
    proved the requirement inverts across the day).** ALSO FOUND:
    frame-quality's noon gate ALREADY FAILS ON MAIN (1.91 stops vs
    2.5 floor, pre-existing; this change nudges 1.91→1.93) — some
    earlier merge regressed it unnoticed; investigate separately.
180. **Close the frame: foreground occluders.** All ten postcards open
    on a clean ground plane; every ASH reference crops canopy, cliff or
    rock masses through its edges. Give the postcard framings (and the
    live camera's near field) occluding foreground masses cut by the
    frame — a canopy edge at top, a verge rock at a lower corner —
    per-framing, composed, not scattered. The composition lens's most
    repeated note and the cheapest depth the set can buy.
    **Done (2026-08-05, run 73): the wayside sentinels.** One large
    tree per ~60 m chunk (85% chance, sometimes two), stood INSIDE
    the ordinary tree verge (lateral ROAD_HALF_WIDTH + 2.8-4.2 m),
    sides alternating by chunk parity with a seeded flip, scale
    1.35-1.7 — a WORLD object, not a camera wing, because the walk
    is live and a mass that moves with the camera is a sticker on
    the lens. Own seeded stream (`sentinel:${index}`) so the
    existing tree placement is byte-stable; same exclusions as every
    tree (river/clearing/landmark/dressing). Frames: 02 gains a
    broadleaf crossing its left edge plus near canopy masses; 08
    gets the canopy-edge-at-top the task named, whose cast shadow is
    the dark anchor behind the noon-portrait gauge jumping 1.99 →
    3.16 stops. frame-quality all PASS. The road ahead stays clear
    (the VERGE fern lesson honoured). 1161 tests green, build green.
    Watch for wave 9: sentinel hit-rate on the busk/vista framings.
182. **The noon gate is red on main — bisect it.** `frame-quality.mjs`
    reports noon at 1.91-1.93 stops vs the 2.5 floor on pristine main;
    CI never runs this gate, so some merge regressed it unnoticed.
    Gauge facts already established (2026-08-01): stops =
    log2(p90/p10) over linear Rec.709 luminance, every pose shot
    through phase 'vista' (the vista framing is the whole gate's
    lens), noon pose = s 620 / day 0.55 / 1600x900; the file's own
    header ("every pose measures 3.3-6.8") is now stale — carry that
    into whatever gets written. Protocol: confirm reproduction, bisect
    main (build+measure per step), then judge honestly — real visual
    regression (fix the change), accepted-cost compression like task
    121's (adjust the noon floor with the full argument, per
    phone-portrait's minStops precedent at lines 74-85), or gauge
    artifact (fix the gauge). A failing check is a claim about the
    check first. Needs a fresh session — the bisect is many
    build+measure cycles.
    **Done (2026-08-05, overnight session) — gauge artifact; no merge
    ever regressed noon, and no commit bisect was needed.** The
    disproof: one build, twelve dates (Date pinned via init script),
    noon ranging 1.81-3.44 stops in perfect correlation with the
    biome the DAILY road lays at s 620 — forest days 2.7-3.4 (the
    treeline is the frame's dark anchor; p10 ~0.06-0.10), village
    days 1.8-2.2 (bright walls over bright ground; p10 ~0.17),
    riverside between, p90 essentially constant throughout. The
    2026-08-01 "red on pristine main" was a village noon; the header's
    "3.3-6.8" was written on a forest-flavoured day. The gate was
    rolling dice on the road of the day. Fix, per this task's own
    third disposition: the gauge now walks a PINNED road —
    `GAUGE_DAY = 2026-07-30` (forest at the noon s, mid-band of the
    forest dates swept), argless `new Date()`/`Date.now()` redirected
    per page, `performance.now` untouched so the loop runs normally.
    Measured on the pins: morning 2.89, noon 3.44, golden 3.94, night
    6.05, phone-landscape 3.94 — floors unchanged and honest again,
    morning now the pose nearest its floor. Byte-stable across
    re-runs. The true finding underneath the false alarm is KEPT as a
    new `noon-village` pose (gaugeDay 2026-08-01, minStops 1.6, the
    phone-portrait precedent): a village noon genuinely is the
    flattest family the game draws — that is an art observation for
    the value-ladder queue (145/179 family), and the pose exists so
    the flattest family getting flatter is caught. Tools-only change;
    1094 tests and build untouched-green. Standing lesson extended:
    postcard.mjs and land-histogram.mjs still shoot TODAY'S road, so
    wave-over-wave critique deltas ride the same dice — pin or note
    the dayKey when comparing waves (logged in STATE).

183. **Phantom shadows — measure who casts them (wave 7).** Three
    lenses independently named long dark streaks crossing road and
    grass "with no visible caster", reading as render banding and
    cutting the bard's silhouette (01/03/09). Suspicion-list
    discipline applies: they are almost certainly REAL shadow-map
    casts from offscreen trees — the symptom is true, the "banding"
    attribution is not. Instrument first: identify the casters per
    postcard framing, measure the shadow's value/softness against the
    references' (ASH shadows are softer and hue-carrying), and only
    then choose the lever (shadow radius? sun-shadow value floor?
    caster culling near framings? — NOT existence; grounded shadows
    are the 179 family's win). The colour lens adds the fix that
    "moves every frame at once": shadows should carry hue, cooler and
    still saturated, not grey — measure current cast-shadow S values
    before believing that too (wave 4 proved CAST_SHADOW_HUE
    chroma-gaining at noon once already).
    **Measured (2026-08-05, run 67) — the family SPLITS IN TWO, and
    each side vindicates a different judge.** New instrument
    `tools/shadowcast.mjs`: freezes the frame (app.stop), re-renders
    with the sun's shadows off and with each caster family silenced
    in turn, and diffs pixels — ownership by measurement, not theory.
    (1) DAWN 01: 31.8% of the frame is cast shadow, 96.5% tree-owned
    — the raking streaks are real offscreen-tree casts, as the
    suspicion list said. GOLDEN BUSK 09: 8.3% in shadow — trees 34%,
    the encounter's travellers 49% (pedlar+elder). (2) NOON 03: only
    2% of the frame is cast shadow (two-thirds of it the bard's own)
    — the huge diagonal bands crossing road and grass are NOT
    shadow-map casts. Confirmed by ablation: they persist with the
    shadow map off AND stay put when the sun (light + shader L both)
    is rotated 90°, while the bard's true shadow swings. They are the
    terrain's own BAKED tone field — `meadowAt`'s landform shade term
    (ground below lane height pulls 0.5 toward grassShade) plus the
    aToneLo/aToneHi world-noise drift — i.e. at noon the panel's
    "render banding" attribution was RIGHT, third case this session
    of a twice-refuted panel read proving partially true. That half
    belongs to the 144/166 value-ladder family, not to shadows.
    (3) THE COLOUR CLAIM CONFIRMED WITH NUMBERS: our cast shadows
    flip hue family (lit H≈39° warm → shadow H≈222° blue) and keep
    only 34-43% of their saturation (S 0.46→0.20 dawn, 0.47→0.16
    golden) — grey-blue drain. A Short Hike's shadow-side ground
    (screen1, measured rects): H44→H75 (same family, deeper green),
    S 0.73→0.46 (63% kept), V 0.77→0.46. So ASH shadows are DARKER
    than ours (V drop 0.31 vs our 0.09-0.12) but hue-carrying —
    the lever is saturated same-family-cooler shadow colour, NOT
    lighter shadows and NOT softness: our penumbra share is already
    0.73-0.8, reference-soft. Fix task queued as the skylight/
    CAST_SHADOW_HUE saturation pass; judge on re-shot 01/09 (casts)
    separately from 03 (bands — different system). Measurement-only
    run; no game code touched.
    **Depth run done (2026-08-05, run 72).** With the colour fix
    (166 piece 2) landed first, the depth lever: terrain shadowDepth
    0.42 → 0.14. Shadow value bite 18-29% of lit → 30-33%
    (reference 40%; the remainder is the ambient floor, correct to
    keep — a shadow with no skylight is night, not shade).
    Saturation retention in shadow now 72-82%: the deepening arrives
    as colour because the two runs landed in that order.
    frame-quality IMPROVED on the pinned road (golden 3.94 → 4.18,
    landscape → 4.39, all PASS) — deep coloured shadows are value
    structure, the "companion darks" wave 8's value lens measured as
    missing. Frames: dawn's raking ladder has real depth; 04's
    ground breaks into separately-valued patches. One variable;
    fray/edge untouched — if wave 9 still reads smear, softness is
    its own run. WATCH: dappled shrub-shadow density at golden hour
    (could read as leopard spots to a fresh panel).
    **Form run done (2026-08-05, run 75): SHADOW_EDGE 0.13 → 0.08.**
    Waves 8 AND 9 put shadow FORM top of the fault list under four
    lenses after colour and depth had landed — two independent panels
    flipping 183's "softness is not the fault" is the licence the
    narrowing waited for. Riser-to-fray ratio moves to ~4 lobes per
    ramp. Measured: noon penumbra share 0.50 → 0.13 (deep 0.8 —
    hard-edged noon shadows); dawn/golden stay soft (the ×8 low-sun
    projection stretch dominates — if wave 10 still reads smear
    THERE, the lever is the fray amplitude or the map resolution,
    not this riser). Frames: dawn's stripes carry ragged brush-lobed
    edges. All gauges PASS, 1161 tests green.
184. **Note-head overlap — measure the governor at last (wave 7).**
    Five frames name "fused brown blobs" where notes are close in
    musical time (01/02/03/08 portrait/10 tablet), while 05/09 with
    real spacing are excellent. This is the twice-refuted "noteheads
    ignore pitch" symptom, now with a sharper claim: a COLLISION at
    close musical spacing on certain aspects. Measure
    songNotes' worst-pair gap per viewport across the songbook
    (the laneSpan test claims eighths stay apart — re-derive that
    claim on the postcard aspect ratios with the CURRENT governor,
    including 6/8 Mulberry's quarter+eighth pairs), then fix the
    governor or the claim, whichever is wrong. Also from wave 7's
    mobile lens, fold into task 175: corner HUD labels are thin
    italic, plateless, low-contrast in four lightings, and sit in
    thumb/gesture zones; and 07's walk-on door reads as prose — an
    affordance question for the human (child-wins says a door should
    look tappable; the no-menus idiom resists).
    **Measurement done (2026-08-05) — THE PANEL WAS RIGHT ON THE
    THIRD LOOK; the twice-refuted symptom is real, and the CLAIM was
    what was wrong.** New instrument `tools/headgap.mjs`: at six
    sampled moments per viewport it projects every lit glyph (alpha
    > 0.25) through the live camera, using the same aPos/aScale
    buffers the GPU draws, and measures neighbouring centre gaps
    against summed projected head radii. Verdict: OVERLAP ON EVERY
    VIEWPORT — worst pairs at ratio 0.56 (desktop), 0.23 (phone
    portrait: heads 77% fused), 0.57 (landscape), 0.58 (tablet),
    where ratio < 1 is geometric overlap of lit heads. The laneSpan
    test's "tightest pair stays apart" claim pins NOMINAL arc
    spacing; the eye sees PROJECTED spacing, and the lane's
    perspective compresses gaps faster than the spawn-scale envelope
    shrinks heads — the claim measured the wrong space, which is why
    it survived two refutations while the symptom kept returning.
    **Re-aimed lever (next visual run, frame-judged):** make the far
    half of the lane honest in projection — candidates: steepen the
    envelope's far-scale, lengthen far spacing (arc easing), or lift
    far-note alpha floor so overlapped pairs are never both lit;
    tune against headgap ratios (target: no lit pair under ~0.9 on
    any postcard viewport) AND the frames, since a too-aggressive
    fix empties the runway the wave-2 urgency work built. The
    175-fold items above stand unchanged.
    **Diagnosis deepened (2026-08-05, before attempting the fix —
    read this first):** the overlaps are TWO problems wearing one
    symptom. (1) Pre-runway (small radii, mid-lane): the envelope
    saturates scale to full at runwayStart (~57% of flight), so the
    far half carries full-size heads into compressed projection —
    an envelope-curve fix (slower scale growth, lower cruise ink)
    is available and stays inside every pinned contract. (2) INSIDE
    the runway on phone portrait (the measured 0.23 pair has ~30 px
    radii — that is NEAR the barline): head size there is pinned by
    the letter-legibility floor (the pedagogy) while lane length is
    pinned by the viewport, so an eighth-pair's nominal spacing is
    simply narrower than two heads. No envelope can fix (2); the
    honest levers are per-viewport (longer portrait lane? staggered
    pitch offsets making overlap read as a chord? eighth-pair
    special-casing?), and each trades against a standing contract —
    a design decision needing fresh-session frame iteration, not an
    end-of-queue tweak. Left deliberately unfixed rather than
    half-fixed.
    **Problem (1) FIXED (2026-08-05, run 66): the envelope grows for
    the whole flight now.** The old envelope saturated scale at a
    sixth of the flight and rode 0.74 cruise ink — full-size,
    fully-lit heads through the whole compressed far lane. The pinned
    test was part of the fault: "full nominal presence (alpha 0.7,
    scale 0.95) for the entire last 1500 ms" is a NOMINAL-space
    blanket, and nominal 0.95 at the far end projects too small to
    read anyway — the ink bought nothing but fusion. Same death as
    the laneSpan claim: measured the wrong space. New shape
    (`glyphEnvelope`): scale climbs continuously SPAWN_SCALE 0.5 →
    full across the flight (SCALE_GROWTH_END 0.95), so nominal growth
    runs WITH projection growth; ink arrives over INK_BORN_SHARE 0.35
    and cruises at 0.55, so a close pair sits on visibly different
    rungs of the ramp (depth-ordered, not fused); the urgency ramp
    (0.45→0.95, swell 1.14) is untouched — the barline note is still
    unmistakably boldest, wave-2's inversion stays answered. The test
    pin was re-derived into eye-tiers: legible-and-climbing at
    1000 ms out (alpha ≥ 0.55, scale ≥ 0.7), plainly readable at
    600 ms (0.7/0.85), near-full through the scaffold's 350 ms answer
    window (0.85/0.95), plus a ceiling pin that the far half may
    never carry a full-size head. Headgap before → after (same day's
    road): desktop 0.79 → 1.2-1.7 mid-lane, landscape 0.53 → 0.68+,
    tablet 0.48 → 0.9+, portrait mid-lane 0.34 → 0.88. Every
    remaining sub-0.9 pair is the IN-RUNWAY eighth pair (summed radii
    50-60 px — two full-size heads near the barline): that is problem
    (2), still open, still the per-viewport design decision above.
    Frames read: depth-ordering visible on 01/03 (small dim D behind
    mid E behind bold near E), runway not emptied, imminent note
    still boldest; 08/10's in-runway pair still touches, as expected.
    1160 tests green (+3), build green.

185. **The daylight land key (wave-13 arc, piece 1).** Wave 13's
    strongest cross-lens agreement: colour and value independently
    named the SAME five daylight frames (02/03/08/10/11) "engine
    defaults" — "the greens are an unbound ladder at equal
    saturation", "nothing dominates and nothing accents" — while the
    sunset hours are authored. The sunset frames get their unity free
    from a low warm sun tinting every surface; a high near-white sun
    shows every albedo raw. The colour script's noon section licenses
    the fix and its hour verdicts bind it (dawn/golden/dusk/night are
    CARRYING — untouchable).
    **Done (2026-08-06, run 98).** `landKey.ts` (pure: per-biome key
    colours = the palettes' own grass hexes; `landKeyAmount(sunHeight)`
    zero through dawn/golden, full 0.35 at the noon sun, 8 tests) +
    a chroma-plane ATTRACTION in the painterly fragment: albedos whose
    chroma points within 90° of the biome key rotate part-way toward
    it, luma preserved exactly, magnitude up to the chord; chroma
    pointing away — terracotta road, the bard's red, flowers,
    firelight — is untouched BY CONSTRUCTION, the palette's
    one-family-one-dissenter rule enforced by the hour. sky.ts sets
    the amount from sun height (the hour's half); RoadStage sets the
    key colour from the bard's biome (the place's half). Frames: 03's
    meadow reads as one warm family, 10-tablet's Kelly-green blast is
    bound, the rogue teal water comes into family; golden/night
    gauges byte-identical (p10/p90 unchanged — the carrying hours
    never see it). All poses PASS (noon hueSpread 0.317 → 0.271,
    above floor: bound, not collapsed). REMAINING PIECES of the arc:
    the lerp-to-sky hueless distance (fog hue authorship), the cloud
    medium mismatch on 10, the unhued white building, noon-village
    accents. 1229 tests (+8), build green.
    **Piece 8 (2026-08-07, run 114): first light reaches the ground —
    the handover trough closes.** Wave 16's dominant colour fault
    ("the hour lives in the sky and never reaches the ground",
    01/02/12/13) cross-checked against run 111's probe: pose 01's sun
    height is 0.060, which sat BETWEEN night's fade-out (ending 0.08)
    and the warm band's rise (starting 0.08) — a violet key at amount
    ~0.02 under a salmon sky. The schedule reshaped: NIGHT_KEY_OUT
    0.08 → 0.0 (night ends AT the horizon — once the sun is up, the
    ground keys to the horizon's wash, which is what a sunrise is)
    and LOW_SUN_IN 0.08-0.13 → 0.0-0.06 (full by first light).
    Continuity by construction: both modes exactly zero at 0.0.
    Measured: 01 re-shot moves 39% of pixels +5.9° warm — the meadow
    leans sage-rose inside the salmon wash instead of "midday
    olive-green no dawn light has touched"; 06-dusk (sun below
    horizon) BYTE-IDENTICAL; all gauges PASS unchanged. 12/13's dusk
    side of the same wave-16 family stays parked with 144/169 (the
    value-floor attribution runs 105-107 proved). 1236 tests (+1),
    build green. Judge on re-shot 01/02 at wave 17.
    **Piece 7 (2026-08-07, run 111): the pull stops draining what it
    binds, and the committed hours get their grip.** Wave 15's other
    family ("terrain green refuses the hour", 7 frames, identical in
    both samples — the grass tufts stay yellow-olive inside committed
    washes) taken to measurement first, and the cone attribution was
    HALF-RIGHT: the chroma-plane arithmetic confirms olive sits at
    sim ≈ 0 to the warm key in forest/riverside (breadth 0.5 → exactly
    half capture) and ANTI-family to the violet night key (pull ≈ 0 —
    the fire's exemption protects dry grass too, as run 105 recorded
    for the dusk seam). But the binding constraint was elsewhere:
    ablating breadth 0.5 → 0.85 changed under half a per cent of
    golden-frame pixels. Two shipped changes, each measured alone:
    (1) the painterly attraction was a chord LERP that lost up to a
    fifth of chroma magnitude near 90° — the fix was literally
    desaturating the grass it bound (mean dS −0.03 at amount 0.45),
    manufacturing the "chroma-dead" read three waves have faulted;
    it is now a true magnitude-preserving rotation (renormalised
    post-mix; safe because the chord only nears zero where the weight
    is already zero). Noon 03 re-shot: 16% of pixels move, dS +0.011,
    hue shift −0.4° — chroma returned, hue untouched. Night/dusk dS
    +0.036/+0.014. (2) LOW_SUN_KEY_MAX 0.22 → 0.45, re-derived from
    piece 4's own "gentlest mode" claim after two waves repeated the
    fault family against it: the committed wash is the hour whose
    light is the frame's law, so the albedo constraint is tightest
    there, not loosest (test re-derived with the argument, not
    weakened; 0.5 erasure ceiling holds; anti-family exempt by
    construction). Golden 04/05 re-shot: lit grass crests lean into
    the amber (hue +3.5-5.5° warm, dS now POSITIVE), shadow stays
    cool. ALL GAUGES PASS (golden 4.29 stops, night 6.47, noon 3.72,
    hueSpread floors held). 1235 tests, build green. Judge on re-shot
    01/04/05 at wave 16. Remaining family sites: the night-side olive
    exemption (parked — it is the 144/169 value family per runs
    105-107), escape hatches, noon-village accents.
    **Piece 6 (2026-08-06, run 110): the road stops being a colour
    hole.** Wave 15's new family, identical in both panel samples
    ("the lowest-chroma region in the image while taking the most
    area", six daylight frames) with the reference policy stated:
    ASH makes the path a saturated ochre, THE WARMEST OBJECT IN
    FRAME. The three biome road albedos chroma-scaled 1.35 about
    their exact lumas (village 0xb19065 → 0xbb8f55 S 0.43 → 0.55;
    forest 0x8f785d → 0x967752 S 0.35 → 0.45; riverside 0x9b8870 →
    0xa18767 S 0.28 → 0.36) — the value break each entry's comment
    defends is untouched by construction, and run 87's drift still
    rides on top. 02's road reads as warm sienna earth, the warmest
    large shape in frame; morning hueSpread 0.419 → 0.447; ALL
    POSES PASS. 1235 tests, build green.
    **Piece 5 (2026-08-06, run 108): the deep water follows the
    hour.** The "escape hatch" family's biggest member (waves 13/14:
    "rogue cyan/teal water and marsh materials that belong to no
    frame's palette", 01/04/09/11): paintWater's SHALLOW end has
    always been the horizon (the puddle entry's own argument — water
    shows you the sky) but the deep end mixed toward palette
    waterDeep at a FIXED hue, so a deep cell at golden hour stayed
    teal inside a fully amber frame. Deep water is the same sky
    attenuated by depth: the deep colour now leans 30% into the
    hour's horizon before the mix runs — a near no-op at noon, a
    warm lean at golden. 04's marsh pools read as cool notes inside
    the wash instead of foreign tiles; the biome's waterDeep still
    names the water's identity. All gauges PASS. 1235 tests, build
    green.
    **Seam measurement (2026-08-06, run 105 — measurement only, the
    next run's brief).** The 12/13 gold-to-slate midground seam
    sampled row-by-row (x 400-1400 of 3200, y 600-1100): it is TWO
    stacked cliffs. (1) A value cliff at y~620-650 (V 0.80 → 0.38) —
    the backlit-glow-to-unlit-land boundary, legitimate dusk
    structure. (2) The real fault, a CHROMA cliff at y~780-800:
    warm-dark S 0.35 → S 0.13 near-grey — the "cold slate" is not
    cold, it is chroma-DEAD. Re-measured after the run-102/103 hour
    key shipped: byte-identical, and the reason is structural — the
    dusk ground albedo is warm-OLIVE, which is anti-family to the
    violet night key, and the anti-family exemption that protects
    the fire protects it too. The attraction cannot fix this family.
    The actual mechanism is the complementary-multiplication drain
    the codebase already names (FOG_HUE_LEAD's comment: "a
    low-saturation cool mixed into a saturated warm lands on grey"):
    warm-olive albedo × violet dusk ambient = grey. The codebase's
    own answer to exactly this class is the ADDITIVE sky-scatter
    term (SKY_SCATTER: "a warm albedo cannot be multiplied into a
    cool shadow, so the shade side is given its colour additively")
    — and LOW_SUN_SCATTER's note records it starving at low sun
    once before. THE NEXT RUN'S LEVER: the scatter strength at and
    below the horizon (dusk sun height ≈ −0.14), tuned against this
    exact row sample (target: the y 800-1000 band keeps S ≥ ~0.25 in
    the violet family) and judged on re-shot 12/13; NOT more key
    amount, NOT albedo work, NOT the value cliff (structure).
    **THE SCATTER LEVER REFUTED SAME RUN (run 106), twice more, and
    the family re-attributed.** Widening lowSun's below-horizon fade
    (-0.22,0 → -0.30,-0.06; dusk moves from 30-55% to near-full
    scatter): the band byte-identical. Enriching the dusk fog's
    chroma ×1.8 luma-pinned (0x8a7c96 → 0x9178a7, the daylight-fog
    move): byte-identical again. Both REVERTED — nothing unverified
    ships. The row pattern is the tell the first reading missed: the
    grey rows ALTERNATE with warm-lit rows (y900 S0.32 warm, y950
    S0.06), so the "slate band" is the raking band STRIPES — and at
    dusk sunHeight = max(0, -0.14) = 0 gates every cast-shadow
    colour term (castShade, CAST_SHADOW_SKY) to zero by
    construction, while the stripes themselves are most plausibly
    the terrain's BAKED tone field, the same family the run-67
    shadowcast ablation exposed at noon ("the big diagonals are NOT
    shadows"). This is the 144/169 value-ladder family wearing dusk
    light, and its lever is a presentation decision (the tone
    field's dusk chroma), not a lighting knob. Three refuted levers
    is the stopping rule; the next attempt on this family should
    START with shadowcast.mjs on the 12 pose to partition
    band-ownership before touching anything.
    **Shadowcast partition run (run 107) — the shadows are innocent
    and the family is now fully attributed.** At the 12-dusk pose:
    cast shadows cover 17.6% of frame (61.7% trees, 12.3% the bard),
    and their photometrics are HEALTHY — vShadow 0.19 vs vLit 0.24,
    sShadow 0.36 vs sLit 0.31 (MORE saturated than lit), hue 220°
    blue vs 129° green lit: the dusk cast shadows carry hue exactly
    as the colour script demands. The grey S 0.13 band rows are
    therefore LIT ground: dark albedo at V ~0.21, where ACES (and
    the finishing S-curve's quarter-tone dip) crush chroma toward
    the display floor. The family's true owners: the baked terrain
    tone field's dusk values + the display transform at low V — a
    value/exposure design decision for the 144/169 pass (raise the
    dusk midground's VALUE floor so its chroma survives the
    transform; hue work alone cannot reach it, as three refuted
    levers and this partition now jointly prove).
    The family's second site (wave 14: "noon-green bushes under a
    saffron dawn sky" in 01; "bushes stay forest green inside a fully
    golden wash" in 05/12): hourKeyMode gains a LOW-SUN band —
    key = the HORIZON's own warm colour, amount 0.22 (the gentlest of
    the three modes; these hours carry themselves), breadth 0.5,
    active for sun heights 0.08-0.30 (dawn ~0.16 and golden ~0.12
    inside, morning out), fading to zero before the daylight biome
    rise begins — no hour pulled two ways. Cast-shadow coolness
    untouched by construction (the attraction is albedo-side; the
    complement rule lives in lighting). Frames: 05's midground
    bushes lean olive-warm into the wash; 01's greens calm. Golden
    gauge 4.30 stops (was 4.32), hueSpread up a step, ALL PASS.
    Remaining: 12/13's gold-to-slate midground seam (a different
    fault — the seam is the fog/terrain band boundary, not albedo),
    escape hatches, noon-village accents. 1235 tests (+1), build
    green.
    **Piece 3 (2026-08-06, run 102): the ground takes the night.**
    Wave 14's dominant family ("the sky is graded, the ground is not"
    — a chlorophyll-green field under a violet night sky in 07)
    measured to its arithmetic: `albedo * lighting` can only COOL a
    green with a pale moon (0x8f9ed6), never pull it into the night
    family — references grade sky-to-soil. The land key gains an HOUR
    MODE (hourKeyMode in landKey.ts): at night the key colour is the
    night sky's own zenith and the attraction gains BREADTH 0.65 —
    weight = max(cos,0) + breadth·(1−|cos|) — capturing the orthogonal
    case (green under violet) at full strength while the anti-family
    (the fire's warmth, the bard's red) stays at zero BY CONSTRUCTION;
    amount 0.38 fading out entirely before dawn's sun height, so the
    carrying hours between night and high day still see nothing.
    Frames: 07's field beyond the firelight reads violet-dark instead
    of chlorophyll; the fire pool untouched. Night gauge 6.42 → 6.45
    stops, hueSpread 0.164 → 0.201, ALL POSES PASS. Remaining family
    pieces: the golden-hour version (bushes staying forest green in
    the amber wash — needs the same mode with a warm key and its own
    care not to fight the sun's real tint), 12/13's gold-to-slate
    midground seam, the escape hatches. 1234 tests (+5), build green.
    **Piece 2 (2026-08-06, run 99): the air gets its colour back.**
    The "hueless cutout distance" half of the family, fixed with the
    lever sky.ts's own fog comments already licensed twice: the three
    daylight fog colours chroma-scaled 1.6 about their EXACT lumas
    (morning 0xa4c3e3 → 0x94c6f9 S0.278 → 0.406; noon 0xa9c8e8 →
    0x99cbfe S0.272 → 0.398; afternoon 0xd2c299 → 0xdbc280 S0.271 →
    0.415) — value untouched for the third time, because every value
    argument in those comments (distance sits below the sky, above
    the treeline) still binds. ASH's distance is a SATURATED blue;
    ours was half-way. Frames: 10-tablet's far treeline reads as
    blue woods instead of grey-lavender cutouts; 11's distance
    carries hue under the morning fog; carrying hours untouched
    (golden/night gauges byte-identical again). All poses PASS.
    1229 tests, build green.

181. **Smoke as soft forms.** The campfire smoke still reads as a stack
    of hard-edged translucent polygons ("a hovering boulder", "a render
    bug" — wave 2 called it stacked glass octagons; three waves on it
    is unchanged). The vertical mass in that quadrant is compositionally
    right (keeps list) — soften the FORMS: alpha-feathered edges,
    fewer/larger overlapping shapes, or a shader dissolve toward the
    top. Judge only by the re-shot 07.
    **Done (2026-08-05, overnight session): alpha-feathered edges, the
    first option, and it sufficed alone (one variable changed, per the
    house law).** The blocker was recorded in the geometry's own
    comment — "the painterly shader carries one opacity for a whole
    material and no per-vertex alpha" — so painterly gained its one
    per-vertex-alpha door: an opt-in `fadeAttribute` (define + `aFade`
    varying, SQUARED in the fragment so density biases toward puff
    centres; a linear ramp still reads a rim). Each puff plane became
    a fan around a centre vertex (fade 1) with rim corners at 0 — two
    extra triangles a plane buys the whole soft edge. Opacity 0.36 →
    0.52 because the squared falloff halves average coverage and the
    400 m telegraph must survive. The geometric climb-dissolve stays
    and still earns its keep (an evenly stacked soft column would be a
    glowing pillar). Judged by the re-shot 07 against this morning's:
    the stacked plates are simply gone — a soft warm haze at the fire
    dissolving into faint smudges up the frame, vertical mass intact.
    NOT yet verified: telegraph legibility at 400 m with the new
    falloff — eyeball a distant-camp frame in the next critique wave.
    1157 tests green, build green.
149. **Ground cover, round three: patches over specks.** The read is still
    "debris": individuated dark-stemmed spikes and litter-like pebble
    decals. References do broad tonal patches that disappear. Consider
    fewer, larger, softer tufts; merge pebble scatter into ground-tone
    variation; break 04's visible clone repetition.
    **First piece done (2026-08-06, run 91): the clones break and the
    litter thins.** Wave 11 named it exactly — "the same low ovoid
    bush lump... visibly the identical polyhedron duplicated": grass
    and ferns have had four silhouettes each since the meadow work,
    but the two LARGE masses were single seeds. Shrubs now draw from
    four seeds, rocks from three (density, albedo, scale untouched —
    the shrub's dark mass is noon-gate load-bearing and did not move:
    all poses PASS). Roadstone density 0.5 → 0.34/m², a third fewer
    "litter-like pebble decals" now that the ruts and the along-road
    tone drift carry the road's structure. 1209 tests. Remaining 149:
    the grass-card edge-on chevron read (a geometry question — blades
    crossing at the root — sized for its own run) and 07's black
    night spikes (value at night, possibly the same fix).
    **Second piece done (2026-08-06, run 92): the cross-blade.** The
    wedge fan (which fixed the asterisk read) was the chevron's
    cause: all five blades inside one ~70° wedge means an instance
    rotation that turns the wedge edge-on turns the whole tuft into
    five floating lines. The LAST blade now stands across the
    prevailing direction — every camera bearing sees at least one
    blade's face, the other four keep the clump's lean, same blade
    count and stream order (zero triangle cost). The wedge test was
    re-derived, not weakened: the first four blades still pin < 2.6
    rad, and the whole tuft pins < 3.0 (a rosette's back-to-back
    blades would exceed it). Frames: 03's foreground tufts read as
    grounded clumps. All gauges PASS, 1209 tests. Remaining 149:
    07's night spikes only (value-at-night question).
    **Investigated, not fixed (2026-08-31, run 138): the first candidate
    cause was measured and REFUTED.** `grassTuftGeometry`'s root-to-tip
    vertex colour gradient (dark root, pure-white tip — a fixed,
    hour-blind contrast) looked like a plausible source of a bright/dark
    pair once night's ambient crushes everything else dark. A fix was
    built (soften the tip) but checked against `07-night-campfire`
    before shipping and found to change NOTHING — the actual spike
    sampled turned out, via a per-instance camera-projection raycast
    (the method `scatter-probe.mjs` uses), to be a conifer tree in one
    sample and, on a second sample elsewhere in the open meadow, an
    isolated single-pixel ~46-47 luma fleck consistent with a
    campfire-scene firefly/ember particle — neither is ground cover. The
    fix was reverted; tests and build confirmed back to the unmodified
    green baseline. The wavy/streaky texture across the dark meadow that
    motivated the original complaint is still visible by eye in real
    screenshots and was NOT explained this run — the right next
    instrument is a ground-cover-colour probe (raycast every grass/fern
    instance, sample its own rendered colour, exclude everything else),
    not a blind scan line, which is too easy to snag a tree edge or a
    particle on. See STATE.md's run-138 handoff for the full account,
    including the incidental finding that `land-histogram.mjs`'s direct
    `app.renderer.render()` measurement method skips task 168's
    finishing/LUT pass and reads a pre-finishing buffer — worth knowing
    for whoever next trusts a number out of that tool.
    **Final piece done (2026-09-01, run 139) — TASK 149 COMPLETE: the
    ground-cover-colour probe, and the sliver closes as NOT ground cover.**
    Built the instrument run 138 sized: `tools/ground-cover-probe.mjs`
    extends `scatter-probe.mjs`'s per-instance camera projection (narrowed
    strictly to `grass`/`fern` — never roadgrass/flower/reed/bankgrass/
    shrub/log/rock, a different vocabulary question) with actual
    rendered-pixel sampling through `app.renderFrame` (task 168's
    finishing/LUT pass — not the bare `renderer.render()` run 138 caught
    the older tools skipping it with). Posing the exact pinned
    `07-night-campfire` (`s: 1400`) turned up something better than a
    variance number: **zero grass/fern instances land on screen at that
    pose at all.** Cause, traced and confirmed: `RoadStage.makeCamp`
    always places the fire at `road.stops[stops.length - 1]`, ignoring
    whatever `s` a resting pose asks for, while `WorldStreamer`'s
    grass/fern LOD window (~90 m) follows `journey.s` itself — on the day
    measured the road's real last stop sat at `s: 1790`, 390 m past the
    pinned pose's LOD window. Real play never hits this (`arriveAt` only
    fires `setPhase('resting')` once `journey.s` is already within the 4 m
    `ARRIVE_RADIUS` of the stop), so this is a HARNESS mismatch, not a game
    fault — but it means the exact pinned postcard everyone has been
    reading the "wavy/streaky" complaint off has no grass/fern in it at
    all, confirmed both by the probe and by eye in a re-shot postcard (the
    dark meadow is bare terrain, no blade geometry visible). Whatever
    texture is there is provably not ground-cover colour. Reposing at the
    road's actual last stop (queried at runtime, matching what real play
    produces) DOES put grass/fern in view (~970 instances, almost all
    `grass`): dark-meadow-only luma CV measured 0.49-0.52, higher than a
    `03-noon-forest` daylight baseline's 0.32-0.33 — expected from the
    much lower absolute luma at night (CV's denominator) and a single
    falloff point light rather than a diffuse sun, not evidence of a
    texture fault on its own. The decisive number: a variance-decomposition
    "banding" check (does an instance's screen position predict its luma,
    independent of its own random per-instance colour) put only 7-9% of
    the dark meadow's luma spread on screen-x position and 10-13% on
    depth — LOWER than or comparable to the SAME check on the
    never-complained-about noon baseline (16% screen-x, 2% depth). If real
    spatial streaking were present in grass/fern colour, this share would
    be elevated, not merely in line with an ordinary daylight frame's own
    banding. Both threads point the same way: the ground-cover-colour
    hypothesis for 149's sliver is REFUTED, this time with a positive
    mechanism (a harness pose bug) rather than a shrug. TASK 149 IS DONE.
    What is left, explicitly out of this task's "ground cover" remit: the
    postcard.mjs `s: 1400` resting-pose mismatch itself (a real tooling
    bug, unfixed — see STATE.md's run-139 handoff), and an incidental
    observation from the corrected-pose screenshot that the wider meadow's
    lumpy look may be SHRUB silhouette density rather than grass colour at
    all — a different vocabulary question, sized as its own future task if
    a critique names it again. `frame-quality`/`shader-check` both PASS
    unchanged, 1249 tests green, build green (docs+tool-only run — no
    game code touched).
150. **Close-range character pass.** Near-frontal face is eyeless in 06
    (face marks exist — check angles/culling), rear head reads as a void
    cube (hair mass value), hat crown-brim gap leaks background in 02,
    NPC limb joins still gap at close range.
    Wave-5 extends: the travellers in 05 decompose entirely (hip gaps,
    hairline tapering legs, and two unsupported boxes floating near the
    banner pole — the last is likely a staging bug worth checking
    independently), and the emotion lens's top finding across ALL ten
    frames is that the bard has no readable facial feature at any
    postcard distance — ASH's whole charm budget is one large white
    eye on a small sprite. A face readable at distance is a character-
    design decision, not a bug fix; try it behind a comparison shoot.
    **Audit + second piece (2026-08-06, run 96).** The list re-measured
    against the current build, because most of it predates the face
    work that shipped inside Bard.ts/Traveller.ts iterations: the bard
    HAS a test-pinned face (eyes/nose/mouth, clearance-pinned after the
    buried-eyes fault); 06's near-frontal traveller face READS (eyes,
    nose, brim — read off the shot frame); 02's "crown-brim gap" is the
    brim's own lit top face seen from behind — correct hat anatomy, a
    stale wave-5 read, no leak reproduced; the 05 floating boxes do not
    reproduce (the cart's load sits on the tray). WHAT WAS STILL TRUE:
    the elder read as "a rock with a hood on" at every range — her file
    twice rejected lightening (lamp effect both times), and the design
    that survived ("dark mass, one small light note at the top") had no
    light note: the face patch sat flush with the hood, in its shade,
    on the shared skin material. Fix inside her own design: patch a
    fifth larger, a centimetre prouder so low sun finds its edge, own
    material one step past shared skin (rim 0.85, floor 0.8); eyes and
    mouth ride out with it. A/B same-frame crops + re-shot 05/06: the
    light note exists at postcard distance, no lamp effect, palettes
    untouched. ALSO measured en route: the finishing grade is NOT what
    darkens her (pass-off crop identical) — her read is palette + hood
    shade + backlit staging. Remaining 150, honestly: the mannequin
    family is now stiffness/pose-variety, not anatomy — an idle-pose
    piece if a wave asks again. 1221 tests, build green.
    **NPC-void measurement (2026-08-07, run 115) — the "unlit navy
    voids" family REFUTED as an albedo problem and re-attributed to
    the 144/169 value family.** Waves 15+16 both named the travellers
    "flat unlit navy-black voids at the exact focal point" of the
    golden frames (05/09). Sampled before obeying: the NPC bodies sit
    at the SAME value as the bard's praised cloak (V 0.20-0.24) with
    warm hues — the light lands; "unlit" is false — but at HALF his
    saturation (S 0.29-0.39 vs 0.66). The prescribed-looking fix
    (raise the palettes' chroma, cloth/under/crown ×1.7 about exact
    luma, values pinned) was BUILT, SHOT AND REVERTED: it moved 0.63%
    of frame pixels and the body samples by ±0.03 S — because V ~0.21
    is the ACES + finishing-curve chroma-crush regime run 107
    partitioned at the 12/13 dusk band. Albedo chroma cannot survive
    the display transform at that value. THE FAMILY'S TRUE LEVER is
    the shade-side VALUE floor at low sun — the same 144/169 lever as
    the dusk band, now with a THIRD independent site (dusk stripes,
    wave-16 value lens's "midtones scooped", NPC voids). The
    traveller palettes' own guardrails (never lighten a part) bind
    the albedo, not the lighting — the value floor is lighting-side
    and does not collide. No code shipped (measurement + revert).

143. **The road's soft edge.** Wave 3's ablation identified the road's
    soft-blended boundary against the grass as the biggest remaining
    soft-shape offender in 01/02/03 (it reads as part of the "smear"
    family). A crisper, more deliberate carriageway edge — wheel-rut
    lines, verge break — in RoadStage/world geometry. Flagged by the
    shadow agent, not yet attempted.
    **Done (2026-08-31, run 137): the shoulder commits instead of
    dissolving.** `buildTerrain`'s shoulder blend (`WorldStreamer.ts`)
    carries the road-to-meadow transition in vertex colour across two
    intermediate columns (u 2.1, 2.5) between the carriageway edge
    (1.7) and the shoulder's end (2.9) — the blend WEIGHT's shape is
    what those intermediate vertices commit to, and it used to be
    `t * t`, spending the whole 1.2 m band easing gradually toward
    meadow from the road edge onward. art-quality.md's adamgryu note
    names exactly this ("winner-take-all... kills the soft road edge",
    the splatmap's highest-channel-wins trick) as the fix family. Full
    winner-take-all (a hard per-vertex step) was rejected: this file's
    own recurring lesson is that a value corner at a vertex survives
    as a crease no tuning removes, and a stepped edge would be exactly
    that. The middle path: `smoothstep(0.55, 1, t)` — track holds
    essentially unchanged through both intermediate columns (0%, 17%
    meadow at u 2.1/2.5) and the transition concentrates into the
    final 0.4 m, while staying zero-slope at both ends like every
    other blend in this function. Postcard pairs shot before/after on
    01/02/03 (the walking-phase frames closest to the road): the
    carriageway now reads as ending at a place instead of bleeding
    into the field, no new seam or crease visible at any of the three.
    `frame-quality`/`shader-check` both PASS unchanged, 1249 tests
    green, build green. Untouched: the wheel-rut lines themselves
    (already crisp per task 149/166's earlier work) and RoadStage —
    the whole fix lives in the terrain vertex-colour function, no
    RoadStage change was needed.

133. ~~**The songboard as presentation, not billboard.**~~ Done
    (2026-07-31, wave 2 — superseded mid-task by the human's "notes coming
    at you from the front"): the plank is gone; SongNotes draws a
    translucent parchment ribbon leaving a barline beside the bard,
    fanning off the road and dissolving before its own vanishing point,
    notes riding it toward the player. Ink more opaque than paper (the
    rules survive a bright sky; the paper gives way to the world); straight
    staff rules (the wobble was painterly band-noise, not geometry — the
    ribbon runs its own shader with per-vertex alpha, sharing the painterly
    light via a GLSL chunk); paper sized per song; closed-loop frame fit
    (`fitShare`) after the camera moved mid-task; pitch contrast re-floored
    at LIGHT_FLOOR 0.34, worst hour 5.74 WCAG measured on rendered pixels.
    Lane width in the walking frame: 29% → 12%. With notes in every
    walking frame, the board is now the composition's biggest problem: a
    beige plank sitting on the vanishing point. Rework toward diegetic
    lightness — size to the live note span, off-axis placement scaling with
    aspect, material that belongs to the world (parchment translucency?),
    straighter staff rules (the hand-drawn wobble reads as damage at DSF2).
    The staff must stay musically correct and legible at phone sizes.
134. ~~**Light and air, second pass.**~~ Done (2026-07-31, wave 2). The
    grey haze was never the fog keys (STATE item 10's hexes had been
    rotated rounds ago): ACES tone mapping desaturates the haze on its
    shoulder (S0.274 in → S0.122 out, measured), and the 60/40
    warm-olive/cool-blue mix cancels toward neutral. Fixed with
    FOG_CHROMA/FOG_HUE_LEAD — value blends as before, hue blends most of
    the way to the air's own. Golden-hour shadows: LOW_SUN_SCATTER 3.0
    gated by a lowSun term (0.05 → meaningful cool component; night gated
    off after measuring a 0.77-stop cost ungated). Warm bounce: the
    critique's own prescription (warm upward faces) MEASURED WORSE
    (hueSpread 0.167 → 0.106 — at low sun everything faces up); replaced
    with warmth along the sun's horizontal bearing (0.182). Shadow
    smudges: edges restored with SHADOW_EDGE 0.34 (the penumbra was
    map-texel stretch ~8× along a 7° sun). All six gates PASS; morning
    land p90 held at 145 (did not fall; raising it toward 170 is task
    122's pale-ramp re-derivation, deliberately not half-done here).
135. ~~**Camera variety and phone framing.**~~ Done (2026-07-31, wave 2).
    Per-mood framings through the existing damping: vista rebuilt as a
    TALL shot (horizon 0.32 → 0.25, bard 0.42 → 0.24 of frame height —
    distance/fov deliberately unchanged, see below); encounter in, down
    and turned (lookYaw −0.22 rad toward placeMeeting's fixed bearing
    band; bard 0.41 of frame, hat breaks the skyline); walking gains
    imperceptible drift/sway (~3%/min) so consecutive moments differ;
    posed shots zero both (postcards stay deterministic). Phone:
    WIDEN_RISE_SHARE is gone — replaced by TALL_LIFT_MAX camera-height
    ramp (skyline 0.29 → 0.21 on 390x844, midground band 1/14 → 1/4 of
    frame). Finding recorded in the vista comment: frame-quality shoots
    every pose through the vista mood, whose noon has 0.10 stops of
    headroom — distance and fov cost stops, height is free.
136. ~~**Blind re-critique, then reassess.**~~ Done (2026-07-31, wave 2):
    same six-lens panel, same references, fresh frames. Mean 4.3 → 5.4;
    04-golden-vista 6.75 and 07-night-campfire ~6.5 brushing the bar;
    03-noon-forest weakest at 4.25. Verdict: "one focused wave below
    shippable." Re-derived gaps became tasks 137-141 above.

## The v0.7 queue: "human eyes on it" (human-set, 2026-07-31)

The v0.6 queue above is superseded. A human is taking the repo local, where
the game runs on a real GPU and can actually be played and compared against
the reference games. That changes what is worth doing here: the cheap
measurable bugs have largely been found, and the remaining questions are ones
no agent in this environment can answer.

Read STATE.md's HANDOFF block before picking any of these up.

122. **Verify the land actually got lighter — with the right statistic.**
    Task 121 (scheduled) raised grass/road albedo 35% across all biomes and
    measured the morning pose's MID-BAND SHARE going ~1.3% -> ~24%. That is a
    real result and it is not the same statistic as land p90, which is what
    'the land never carries a light value' is about. An interactive wave
    reached the same conclusion independently and lifted only each biome's
    `*Dry` tone; main's larger lift superseded it in the merge, and the pale
    ground ramp fix from that wave (painterly.ts, a ramp documented as
    narrower that measured wider) is still in the tree ON TOP of main's 35%,
    a combination neither change was tuned against. So: build a land-masked
    histogram (hide the sky dome, set the clear colour to a sentinel, so
    'land' is every pixel of real geometry) and measure p90 on 02-morning and
    03-noon. Whole-frame p90 is dominated by sky and proves nothing. Then
    check the two changes have not compounded into blown-out ground.
    SUPERSEDED TEXT, kept for its method: commit `f510ab4` lifted each
    biome's `*Dry` tone and widened the pale ground ramp, claiming a land-
    masked p90 in L170-190. THAT CLAIM IS UNVERIFIED — the agent died before
    reporting. Build a land-masked histogram (hide the sky dome, set the clear
    colour to a sentinel, so "land" is every pixel of real geometry) and
    measure p90 on 02-morning and 03-noon. Whole-frame p90 is dominated by sky
    and proves nothing. If it did not move, the albedo lift is cosmetic and
    the item is still open.

123. **Explain noon and night losing value in the same commit.** noon 3.66 ->
    3.08 stops, night 7.06 -> 6.65, hue spread at golden 0.024 -> 0.185 and
    phone-landscape 0.021 -> 0.212. All still pass the gate. A dry-grass
    albedo lift should not obviously do any of that. Bisect it.

124. **Figure-to-ground separation at the busk.** Measured: the bard separates
    from the ground behind him by 2.0 sRGB levels at 20 px and the dusk
    traveller by 0.4, against 16.4 for the campfire frame. Cause is diagnosed
    and should not be re-diagnosed: at day 0.82 the sun is on the FAR side
    from the busk camera, so the only side an instrument can be carried on and
    be seen is the shade side (busking lute L49 against L36-45; walking lute,
    sunlit, L132 against L95). It is a VALUE problem, not a pose problem.
    Levers in order: `uRim` on the figure and instrument materials (0.32
    today); `grain` (0.35) so more pale colorVariant mixes in; or accept that a
    busk at a low back-sun is a rim-light shot and light it as one. The
    instrument albedo lives in `core/instruments`.

125. **The gate rewards darkening and should not.** `tools/frame-quality.mjs`
    measures whole-frame stops, so a wave that darkens the near ground passes
    it while making nothing lighter — which is exactly what happened in wave
    11 and was only caught by a critic building a control tree. Add a
    land-masked p90 floor alongside the existing stops floor, so the gate can
    tell "more range" from "darker darks".

126. **Play it.** Nobody ever has. The busking mechanic is the core of the
    design and has never been judged for feel: whether the timing window is
    forgiving enough, whether the letter-fading scaffold teaches, whether idle
    busking is satisfying or just idle. `tools/autoplay.mjs` proves the notes
    are right and structurally cannot answer any of this.

127. **Check the performance tiers on real mobile hardware.** `detectQuality()`
    has three tiers that have never run on a phone. Logged under "Blocked on
    human" in STATE.md since the v0.6 merge.

128. **Re-baseline the critique against real reference frames.** Every "not
    shippable" verdict in this project was scored against a written rubric by
    an agent that has never seen A Short Hike or Spiritfarer. With reference
    screenshots available locally, a genuine side-by-side becomes possible for
    the first time — and the standing 3-of-10 count should be re-derived
    rather than inherited.

## The v0.6 queue: "the road in three dimensions" (human-set, 2026-07-28)

Seeded from the harsh frame-by-frame critique in STATE.md's "At a glance"
("Still wrong, in the order a next run should take them") — read that
section before picking one up, since it has the reasoning each item here
is a one-line pointer to. Take them roughly in order; reprioritize freely
if a bug turns up that matters more.

115. ~~**Scatter on the road.**~~ Done (Run 45, scheduled). Investigated
    before writing any code, because the claim didn't match a read of
    `WorldStreamer.ts`: `roadgrass` and `roadstone` — tufts on the crown and
    the outer lip, loose stone spilling onto the shoulder — were already
    real `ScatterKind`s, present since the v0.6 initial commit (3ef8d0c),
    with their own keep-out zones around the wheel ruts and the bard's own
    footfall. A headless scan (`window.bard.stage.scene.traverse`, counting
    `InstancedMesh`es by name) confirmed both render with real instance
    counts at every point sampled along the road, and a screenshot confirmed
    they're visible, if sparse in the middle of the carriageway. So the
    critique this task was seeded from was wrong about two of its three
    items — worth recording since "suspect the check first" (STATE.md's
    standing lesson) applies the other way too: this time a *finding* was
    the thing to suspect, and it would have been cheap to skip straight to
    "add more tufts and pebbles" without ever opening the file.
    The third item was real: nothing painted standing water anywhere. Added
    it. `puddleGeometry` (`src/three/world/geometry.ts`) is a flat, low,
    irregular ellipse — not a circle, which reads as a coin dropped on the
    road — fanned from a centre vertex, wound so its normal faces +Y (the
    only direction the camera ever looks at it from) since `solidMaterial`
    is front-face-only. A new `puddle` `ScatterKind` places it in the rut
    band alone (`RUT_BAND`, the same `RUT_CENTRE`/`RUT_HALF` geometry every
    other carriageway kind treats as a keep-out zone) — the one place on the
    cross-section real rain would actually collect, and the reason
    "puddles in the rut" and "tufts in the rut" were never both going to
    happen: the rut stays bare of growth *because* it's the low, worn,
    sometimes-wet part of the road, which is exactly the ground a puddle
    wants. Colour is a fixed cool grey-blue mixed toward each biome's own
    road tone (`0x3c4d54` toward `p.road`) rather than a per-biome palette
    field — no real-time reflection exists to differentiate, so one water
    colour, biome-tinted by the earth it sits in, was enough. `density.puddle`
    is a new `BiomePalette` key: driest in village (open, sun-dried, 0.35),
    wettest in riverside (low ground, near the water table, 1.3), forest
    between the two (shaded, holds rain longest, 1.0).
    Verified with a 19-point headless scan along a full day's road: puddle
    `InstancedMesh` counts present and increasing with distance (never
    zero once past the first chunk), zero console/page errors. Screenshots
    at several of those points, cropped and inspected directly, show the
    puddles reading clearly as water — cool and pooled in the rut, distinct
    from the warm road and the green verge — alongside the pebbles and
    tufts that turned out to already be there. `npm test` 745 green
    (unchanged — no unit tests cover `src/three/world/`, the established
    precedent for this whole module; verification is screenshots and a
    live-scene instance scan, same as every other Three.js-era change),
    `npm run build` green (691.65 KB vs 690.96 KB, the new geometry
    function only).
    **Flagged for whoever picks up task 119 next**: the same "already built,
    never marked" pattern applies there too. Skyline landmarks
    (`Landmark` interface, `landmarksNear`/`chooseLandmark`/`raiseLandmark`,
    chapel/stones/trilithon/tree geometry) are fully wired into chunk
    building, not stubs — worth a screenshot check before assuming task 119
    means starting from nothing.
116. ~~**Fix the campfire sitting pose.**~~ Done — already built, closed here
    rather than by new code (Run 50, scheduled consolidation). Task's own
    claim ("`resting` calls `setPose('sitting')` and the bard stands upright
    anyway") doesn't match `Bard.ts`: `update()` already blends a full seated
    rig off `sitAmount` — bent knees with the shin composed from
    `SIT_SHIN`/`SIT_PELVIS`/`SIT_THIGH`, a dropped hip, a torso lean that pays
    back the pelvis rotation before leaning toward the fire, and — the part
    the file's own comments call load-bearing — the cloak's hem is
    *shortened*, not just slid, so it doesn't swallow the lap or drag the
    collar up over the head the way a naive fix did first. All of this has
    been in the file since the v0.6 initial commit (`3ef8d0c`), the same
    commit this task's own text describes as broken. Fourth instance of the
    "already built, never marked" pattern tasks 115/119/120 flagged.
    Verified visually rather than trusting the code read alone (STATE.md's
    standing lesson): `tools/postcard.mjs`'s `07-night-campfire` shot (fresh
    this run) shows the bard seated on the ground at the fire, knees bent,
    torso leaned in, cloak gathered — not standing.
117. ~~**The camp lantern.**~~ Done — already built, closed here rather than
    by new code (Run 50, scheduled consolidation). `Campfire.ts`'s
    `buildLantern` already carries a full housing — a roofed cap that
    overhangs the glass so the lit pane doesn't run out into the sky, a
    base, a hook and bail so the lantern hangs rather than sits — and its own
    header comment narrates fixing *exactly* this task's complaint ("the
    version before this one was a bare post with a bright cube... a stray
    primitive"). Same commit (`3ef8d0c`) as the task text describing the bug
    it had already fixed. Verified in the same `07-night-campfire` postcard:
    the lantern reads as a small warm housing on a post to the bard's right,
    not a bare glowing quad.
118. ~~**Busk caption vs. top note collision.**~~ Done — already built, closed
    here rather than by new code (Run 50, scheduled consolidation).
    `hudLayout.ts`'s `hudChrome` already handles the exact 844x390 case this
    task names: `JOURNAL_SKY_FRACTION` keeps the journal card's bottom edge
    above the line the staff's top note reaches, and where the roomy
    placement (card under the purse row) would break that on a short screen,
    the card moves beside the purse instead — the file's own comment walks
    through the 390-tall/72px-purse/92px-card/109px-note arithmetic that
    makes that necessary. `hudLayout.test.ts` pins it directly: a case named
    "phone landscape, no notch" at `{844, 390}` with a comment noting it's
    "the one the collision was found in", asserting `journal`/`instrument`
    and `journal`/`coins` never overlap. Verified visually too: a fresh
    `09-phone-landscape` postcard shows the busk caption clear at the top,
    no overlap with the songboard below it.
119. ~~**Skyline landmarks.**~~ Done — already built before this task was
    ever started, and closed here rather than by new code (Run 47,
    scheduled). Task 115's done-entry flagged this in advance: `Landmark`,
    `landmarksNear`/`chooseLandmark`/`raiseLandmark` and four landmark
    geometries (chapel, standing stones, trilithon, tree) were fully wired
    into chunk building since the v0.6 initial commit, not stubs. What was
    genuinely missing was visibility, not existence — STATE.md item 12
    (fixed by PR #143, human-directed session, and reconciled into
    STATE.md/ROADMAP.md by this run) found a chapel at 150 m sitting within
    a few percent of the sky, fogged less visible than a nearby tree; #143's
    per-material `fogScale` (halved on landmark meshes only) fixed that
    without touching placement. Verified independently this run with a fresh
    `tools/postcard.mjs` shot of `02-morning-open`: a trilithon reads as a
    clearly separated dark shape against the pale sky on the ridge. Nothing
    left to build here — reprioritize if a *specific* landmark placement or
    frequency complaint ever surfaces, but don't re-open this as "add
    landmarks."
120. ~~**Instrument picker.**~~ Done — already built, closed here rather than
    by new code (Run 48, scheduled). Task's own claim ("`unlockedInstruments`
    is never appended to — earned but not choosable") does not match the
    code: `RoadStage.noteUnlocks()` already calls `unlockInstrument()` to
    append to `journey.unlockedInstruments` every time a campfire is reached
    with something new earned (per real lifetime totals, via
    `unlockedInstruments()` in `instruments.ts`), and the HUD's "case" —
    tap the instrument corner to open a row list, tap a row to take it out —
    is fully wired: `Hud.setCase`/`onInstrumentChosen` on the UI side,
    `RoadStage.takeOut`/`chooseInstrument` on the state side, refused mid-busk
    on both ends so a swap can't desync a tune's baked tempo. Same pattern as
    tasks 115 and 119: a critique or an old read of the code named a gap that
    a later feature already closed without the roadmap being told.
    Verified live rather than trusting the reading: a headless Playwright
    session gave the journey real earned distance (900m, Reed Flute's actual
    `unlock.metres`, not a hand-set unlock list — that would have desynced
    `journey.unlockedInstruments` from the derived-from-totals list
    `RoadStage.instrument()` actually reads, which is a mismatch that
    cannot occur in real play but did on the first pass of this check, worth
    naming since it cost most of this run), ran `noteUnlocks()`, tapped the
    instrument corner, tapped the "Reed Flute" row, and confirmed all three:
    `journey.instrumentId` changed, the HUD label changed, and the choice
    persisted to `localStorage` — zero console/page errors throughout. No
    code touched. `npm test` 753 green (unchanged), `npm run build` green
    (696.77 kB, unchanged).
121. ~~**Time-of-day lighting.**~~ Done (Run 49, scheduled) — for the real
    fault underneath this task's text, not the one its own words named.
    `shader-check`'s "luminance range of 3" premise was already stale before
    this run started: PR #136 (Run 40-ish) fixed that gauge itself, and the
    check now reports a range of ~102. What was still true, and is what this
    task actually meant by "the light on everything else barely does" and
    "the near ground reading dark by albedo": STATE.md item 8, the daylight
    frames' bimodal value histogram — land in one hump, sky in another,
    under 1.5% of pixels in the band between them, and never more than 0.5%
    of the land itself above L170 even at noon. No sunlit grass, no
    light-struck road, nothing bridging land to sky.
    Fixed the way the critique that raised item 8 said to: raised `grass`,
    `grassVariant`, `grassDry`, `road` and `roadShoulder` a uniform 35% in
    all three biomes (`world/palette.ts`), the lever the critique named as
    valid (the other being "lower the sky", left alone since it would have
    re-tuned all eight `sky.ts` keyframes at once). Canopy and rock untouched
    — the critique measured grass and road as the missing surfaces, not
    those. Measured: the morning pose's mid-band (L128-175) pixel share went
    from ~1.3% to ~24%. Confirmed by eye, not just by histogram — postcards
    at dawn, morning, noon, golden hour and night all read as a better-lit
    meadow, not a flattened one, and dusk/night keep their existing mood.
    One real, measured, and accepted cost: `tools/frame-quality.mjs`'s
    phone-portrait pose (almost all foreground, barely any sky) scores less
    whole-frame value range than before (2.71 → 1.83 stops) because closing
    the land/sky gap this change targets mechanically narrows a pose with
    hardly any sky to show that gap in. Gave that one pose its own
    `minStops: 1.6` floor rather than lowering the shared one — see the note
    in `frame-quality.mjs` and the file-level note in `world/palette.ts`
    before touching either number again. `npm test` 753 green (unchanged —
    no unit coverage of `world/palette.ts`, same precedent as the rest of
    the Three.js build), `npm run build` green (696.77 kB, unchanged),
    `shader-check` and `frame-quality` both PASS.
    **Left open, deliberately**: item 8's own note flagged golden hour and
    the "haze cancels to grey" fault (STATE.md items 9/10) as likely sharing
    a root cause with this one. Neither was touched here — this run raised
    albedo, which is orthogonal to both the additive skylight term (item 9)
    and the fog hue (item 10) — and both should be re-measured against the
    new palette before assuming they still read the way STATE.md describes.

## Idea backlog (pull from here when nothing is queued)

Unnumbered, unordered, deliberately small — promote one to a numbered
task at the start of a run if nothing above is actionable. Each respects
the one-mechanic rule and the art direction (notation icons,
warm-vs-cool palette).

- ~~**Signposts at transitions**~~ — shipped as task 53 above.
- ~~**Sharper mobile rendering**~~ — stale, struck without action (Run 50,
  scheduled consolidation). Measured 2026-07-26 against the Phaser renderer:
  the canvas backing store matched CSS size 1:1 regardless of
  `devicePixelRatio`, so a phone rendered at a third of its native
  resolution. The recipe wanted a Phaser-specific fix (`zoom: 1 / dpr` in
  the scale config). v0.6 replaced Phaser with Three.js entirely (2026-07-28)
  and the new renderer already does the capped version of this: `App.ts`
  calls `renderer.setPixelRatio(quality.pixelRatio)` with
  `Math.min(dpr, 1.5)` or `Math.min(dpr, 2)` depending on the device's
  quality tier, since `3ef8d0c`. Nothing here to port — the finding and its
  recipe were about a renderer that no longer exists, and the Three.js one
  already ships the resolution/performance trade this item was asking for.
- ~~**Coin chime cap**~~ — shipped as task 78 above.
- ~~**Stylized treble clef**~~ — shipped (2026-07-25, second overnight
  session) at the staff's left edge, where real sheet music puts it: a
  stroked-arc stylization (top curl, stem, spiral wrapping the G line,
  bottom hook), faint cream at 0.5 alpha so passing notes stay
  dominant. Screenshot check agreed it reads as a treble clef; the
  spiral sits correctly on the G line, so it is stylized but not
  *wrong*.
- **Solfège (do-re-mi) letter option** — locale question, letters ship
  first.
- **Large-form scatter anchor per near-camera quadrant?** (run 136,
  `tools/scatter-probe.mjs`) — a measured, not inferred, finding: vista
  frames occasionally show a screen quadrant with zero rock/shrub/log
  (only thin grass/flower/roadgrass cover), because each scatter clump's
  side is an independent coin flip with no cross-side guarantee, unlike
  trees (`waysideSentinelSites`). 2 of 8 sampled frames showed this, not
  just the one that prompted the question, so it reads as ordinary rather
  than broken. A `waysideSentinelSites`-style guarantee (at least one
  large-form clump per near-camera quadrant per chunk) is the shape a fix
  would take, but it's a real design call — does a guaranteed anchor
  object read as "the world was arranged for the camera"? — not an
  obvious bug fix, so it wasn't done blind. Worth a proper look, not a
  blind tune.

## Needs human playtest

- Round 2 (see PLAYTEST.md): re-judge the four retuned areas — tighter
  90ms hit window, faster meter refill, recomposed melodies, beat-synced
  walk/scroll, stronger biome palettes — plus the overnight additions
  (bard sprite/animation, scenery bands, notation UI, the player's-note
  pluck, night sky) and the still-unanswered round-1 verification items
  (mobile fixes, batch boundary, audio phase).
