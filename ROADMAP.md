# ROADMAP

One task per run, in order. Reprioritize/cut freely (log cuts in DESIGN.md's
changelog) but don't skip ahead — each task assumes the previous ones landed.

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
44. **(v0.3 candidate, do not start without a human yes) Rhythm
    values.** Half/whole notes via tap-and-hold would teach durations
    but changes the one input. Design question first, not code.

## Idea backlog (pull from here when nothing is queued)

Unnumbered, unordered, deliberately small — promote one to a numbered
task at the start of a run if nothing above is actionable. Each respects
the one-mechanic rule and the art direction (notation icons,
warm-vs-cool palette).

- **Signposts at transitions**: a small silhouette signpost scrolls by
  with the scenery as each biome transition starts — the world
  announcing the next vignette. Scenery-tile addition, no logic.
- **Sharper mobile rendering**: check `devicePixelRatio` handling in the
  Phaser config; procedural shapes may render noticeably crisper on
  phones with `resolution`/zoom set correctly. Measure first.
- **Riverside water shimmer**: slow alpha pulse on the water-glint
  dashes — one tween on the scenery TileSprite's tint, if it reads.
- **Coin chime cap**: coins currently tick silently; a very quiet chime
  every 25th coin could be pleasant — or annoying. Prototype behind a
  screenshot/listen check before committing.
- **Stylized treble clef** at the hit line — only if it can be drawn
  without looking wrong; the notation is not allowed to be incorrect.
- **Solfège (do-re-mi) letter option** — locale question, letters ship
  first.

## Needs human playtest

- Round 2 (see PLAYTEST.md): re-judge the four retuned areas — tighter
  90ms hit window, faster meter refill, recomposed melodies, beat-synced
  walk/scroll, stronger biome palettes — plus the overnight additions
  (bard sprite/animation, scenery bands, notation UI, the player's-note
  pluck, night sky) and the still-unanswered round-1 verification items
  (mobile fixes, batch boundary, audio phase).
