# ROADMAP

One task per run, in order. Reprioritize/cut freely (log cuts in DESIGN.md's
changelog) but don't skip ahead — each task assumes the previous ones landed.

## Start here

This file is an append-only record of every task and why it was done, which
makes it long. You do not need to read it top to bottom.

- **What to do next** is the **v0.7 queue**, task 122 onward, right below
  this list — it supersedes the v0.6 queue, which follows it. Read STATE.md's
  HANDOFF block first.
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
159. **The first-campfire promise.** The journal opens, the festival is
    named, tomorrow's road silhouette glows (merge with task 151),
    rehearsal is introduced. The single most important scene in the game;
    success metric in DESIGN. (Campfire.ts, journal, Hud.)
160. **By-heart on the road.** A well-carried song's note heads fade to
    ghosts then to a clean staff; a recall stumble gently returns them.
    Extends the scaffold's fade machinery one level up (letters, then
    heads); same safety rule — fade the prompt, never the answer, and
    help returns instantly. "By heart" is a song state on diary facts.
    (core/scaffold or a sibling, SongNotes.ts.)
161. **Pitch recall in practice.** Practice mode's unguided tier: no pip,
    find the melody's positions yourself; wrong note sounds and costs
    nothing; the kind fallback restores guidance. The only surface that
    exercises true pitch recall. (core/freePlay.ts, practice UI.)
162. **Campfire rehearsal.** Each campfire offers one attempt at the
    carried song without notes — no-fail, notes return on a stumble, the
    journal writes it warmly either way. (Campfire/RoadStage + core.)
163. **The festival.** Arrival scene at journey's end: the bard performs
    the by-heart book to the festival crowd; warm payoff; then the
    choice — Book Two's invitation (showing a real sharp sign and what
    it would teach), free revisiting, or walking on. (New scene + core.)
164. **The title card.** One warm card for returning players: "Continue
    the journey" (default, one tap) / "The songbook". New players skip
    straight to the road. Playable-in-5s holds. (main/App/Hud.)
165. **Book Two: true keys.** The accidentals volume — real key
    signatures, sharps/flats correctly engraved and exactly sounded.
    Engine is chromatically exact already; notation needs accidental
    glyphs; songbook needs volume structure. Arc. (notation, songs,
    engraving in SongNotes.)

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
167. **No framing without an anchor.** A composition rule the rig
    enforces: every camera mood guarantees a near-field anchor silhouette
    (telegraph props, landmarks, canopy mass), Monument Valley's
    screen-first lesson. Headlessly testable. (CameraRig + WorldStreamer
    placement bias; merges with task 145.)
168. **The finishing pass.** Render to target at ~0.8 scale + a
    CODE-GENERATED 3D-LUT grade (Data3DTexture built at boot — no image
    asset, no constraint exception). A Short Hike's unifier translated
    to painterly: forgives close-range crudeness, can be net-cheaper on
    phones (fewer shaded fragments). Measure fps both ways on the
    quality tiers. (App.ts render path + painterly.)
169. **Terrain as the hero surface.** Journey's lesson restated for this
    game: broad PLANNED shadow masses (task 144's remake), winner-take-
    all ground-material edges (adamgryu's splat trick — kills the soft
    road edge, task 143), clustered ground-cover patches inheriting
    ground colour with distance fade (task 149's fix, with LESS
    overdraw). One coherent pass, three existing tasks folded in.
170. **Bake vertex AO at generation time** on props and the bard — the
    strongest "crafted" signal at close range; precomputed into vertex
    colours, no UVs, feeds the existing lighting model. (geometry.ts
    builders + actors.)

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
173. **Audio that survives the pocket.** iOS audio-session behaviour:
    silent-switch handling (WebKit bug 237322), interruption/resume on
    calls and backgrounding, Low Power Mode's 30fps rAF (WebKit 168837)
    — the beat clock must stay honest at 30fps.
174. **Quality tiers that actually detect.** detectQuality() reads
    Chromium-only deviceMemory, so every iPad lands 'medium'; the 'low'
    tier still enables shadow maps. Detect by GPU/UA signals available
    on WebKit; make 'low' genuinely low (no shadow map); re-measure the
    730k-triangle scene against mobile budgets.
175. **Touch-target and orientation audit.** WCAG 2.2 24px minimum /
    Apple 44pt on every HUD control at phone sizes; verify the landscape
    recommendation for the road; palm-rejection kindness already exists
    (stray taps are free) — pin it with a test.

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
152. **Name the shared road.** Diegetic sharedness: each daily seed gets a
    deterministic road name ("Larchwind Road"), on the signposts and in
    traveller lines that speak as if everyone walks it today — because
    everyone does. (road.ts name generator + world signage + encounter
    lines.)
153. **The campfire postcard.** Optional share: a small painted frame of
    today's road with its name and the song carried. Shares presence,
    never performance — no accuracy, no coins, nothing gradable (Wordle's
    rule, and the research's leaderboard ban). Canvas-render + download;
    no network. (Campfire/HUD.)
154. **Songbook pages wear in.** First slice: a song's page shows its
    walked-count as wear and marginalia (diary facts ONLY — never the
    scaffold model; a page that got prettier as letters faded would be a
    grade in costume). (songChoice/journey diary facts + Hud songbook.)
155. **Mementos, not checklists.** Lovely encounter outcomes leave a
    keepsake drawn on the journal page — no collection screen, no counts,
    no empty slots; missed rarities recur on later roads (Sky's
    returning-spirits stance; encounters already reseed daily). (
    encounters.ts payouts + journal.)
156. **Welcome-back, never weeds.** Returning after days away gets a small
    campfire welcome beat — the case's idle takings, a journal line about
    the roadside days. No counter of days kept or missed, ever. (idle.ts
    describeIdleYield + campfire/journal.)
157. **Two bookmarks on one bench.** Local family profiles: two
    localStorage bookmarks, each with its own song pin and scaffold
    state, each able to see the other's journal PAGES (never anything
    gradable). Arc — scaffold-state separation needs care. (
    scaffoldStorage/journey save + Hud.)

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
145. **Anchor the anchorless frames.** 03/08/10 are one chalky plane: no
    dark mass, no authored landmark inside the first third. Noon and the
    phone framings need a composed anchor (landmark placement bias near
    postcard s-positions, a darker canopy mass, or a mid-frame prop).
146. **Portrait ribbon legibility, round three.** 08/10 still clump D-E-F-G
    into a blob (the governor's hard floor is not enough at 390 px).
    DISPUTED and must be measured first: "noteheads ride above the top
    line on lollipop stems" — anchors measured exact twice before; check
    the depth-makeup and the specific pose before re-fixing pitch.
147. **Commit to night.** 07: ring stones stay daylight-grey inches from
    flame, nothing throws radiating shadows from the fire, off-fire land
    sits within a stop of the sky. Needs the palette-side night ambient
    drop (the campfire agent's recorded ceiling), fire-warmed ring
    stones, and possibly cheap radial blob shadows from fire-lit props.
148. **The postcard must catch the verb.** 05's busker reads as standing
    idle (the strum exists — the postcard shutter catches the arm at
    rest; consider posing the strum mid-sweep for the busk framing) and
    06 reads as a walking shot mislabeled (the encounter framing needs
    its own identity: two figures, mutual facing, closer camera — the
    staging landed but the postcard pose may predate arrival).
149. **Ground cover, round three: patches over specks.** The read is still
    "debris": individuated dark-stemmed spikes and litter-like pebble
    decals. References do broad tonal patches that disappear. Consider
    fewer, larger, softer tufts; merge pebble scatter into ground-tone
    variation; break 04's visible clone repetition.
150. **Close-range character pass.** Near-frontal face is eyeless in 06
    (face marks exist — check angles/culling), rear head reads as a void
    cube (hair mass value), hat crown-brim gap leaks background in 02,
    NPC limb joins still gap at close range.

143. **The road's soft edge.** Wave 3's ablation identified the road's
    soft-blended boundary against the grass as the biggest remaining
    soft-shape offender in 01/02/03 (it reads as part of the "smear"
    family). A crisper, more deliberate carriageway edge — wheel-rut
    lines, verge break — in RoadStage/world geometry. Flagged by the
    shadow agent, not yet attempted.

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

## Needs human playtest

- Round 2 (see PLAYTEST.md): re-judge the four retuned areas — tighter
  90ms hit window, faster meter refill, recomposed melodies, beat-synced
  walk/scroll, stronger biome palettes — plus the overnight additions
  (bard sprite/animation, scenery bands, notation UI, the player's-note
  pluck, night sky) and the still-unanswered round-1 verification items
  (mobile fixes, batch boundary, audio phase).
