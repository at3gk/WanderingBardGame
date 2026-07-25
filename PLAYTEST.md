# PLAYTEST.md — one-session human playtest checklist

This consolidates every **Needs human playtest** item from STATE.md (tasks
3–29) into a single ~10-minute session you can run on a real phone with
sound on. Answer inline (check a box, scribble a note), commit, or just
relay answers in a session — the next run folds them into constant changes
and closes ROADMAP task 14.

**Build:** https://at3gk.github.io/WanderingBardGame/
**Best on:** a real phone (touch + speakers), one continuous walk of 3–4
minutes to cross both biome transitions and at least one beat-batch
boundary.

Legend per item: the question, the current eyeballed constant(s) and where
they live, and what a fix would touch.

---

## A. Core tap feel (task 3)

- [ ] **Hit window** — do taps that *felt* on-beat register as hits?
  - Too strict / too loose / fine: ______
  - `HIT_WINDOW_MS = 120` — `src/scenes/RoadScene.ts`
- [ ] **Marker read speed** — are approaching beat markers comfortable to
  read and anticipate on a phone screen?
  - `TRAVEL_TIME_MS = 1800`, `BPM = 96` — `src/scenes/RoadScene.ts`

## B. Meter, coins, steps (tasks 4, 11, 21)

- [ ] **Forgiveness** — stopping after ~3 consecutive misses, refilling in
  ~5 hits: does that match the cozy no-fail tone, or feel punishing?
  - `DEFAULT_SONG_METER_CONFIG` (hitGain 8, missDrain 14,
    walkingThreshold 40, max 100) — `src/core/songMeter.ts`
- [ ] **Coin pacing** — does the coin count climb at a pleasing rate over a
  real walk, or too slow/fast to notice?
  - `COIN_RATE_PER_SEC = 5` at full meter — `src/scenes/RoadScene.ts`
- [ ] **Steps readout** — does "N steps" (bottom-left) read as a satisfying
  sense of progress, or is it ignored / climbing at a weird rate?
  - 64 px per step via `ROAD_TILE_WIDTH` — `src/scenes/RoadScene.ts`

## C. Audio (tasks 7, 8, 13, 16/18, 28)

- [ ] **Volume** — comfortable on phone speakers? Too quiet/loud?
  - Layer gains 0.05 / 0.04 / 0.03 — `src/audio/manifest.ts`
- [ ] **Base loop coziness** — does the melody feel intentional and cozy,
  or random? (root 220 Hz triangle, `[0, 0, 7, 5]` pattern)
  - `AUDIO_MANIFEST.baseLoop` — `src/audio/manifest.ts`
- [ ] **Layering** — after a stretch of good hits, do the harmony
  (meter ≥ 50%) and sparkle (≥ 85%) layers blend in cozily, and does the
  0.6 s crossfade feel natural?
  - Thresholds/voicings — `src/audio/manifest.ts`, `src/audio/layering.ts`
- [ ] **Per-biome melody shift** — when scenery changes biome, the melody
  pattern follows up to ~20 s later (batch quantization). Does the late
  shift still read as connected to the scenery change, or as a glitch?
  - `patternByBiome` — `src/audio/manifest.ts`;
    `BEAT_BATCH_SIZE = 32` — `src/scenes/RoadScene.ts`
- [ ] **Batch boundary** — anywhere past ~20 s intervals, any audible
  dropout or visible marker pop-in? (That would be a bug, not tuning.)
- [ ] **Phase** — do the backing-loop notes land *on* the beat markers
  (Run 28 fixed a reaction-time offset — first real-device confirmation)?

## D. Visuals (tasks 5, 6, 9, 15)

- [ ] **Walk cycle** — does the bard's leg swing read as walking (not
  jittery), and does idle breathing read as calm?
  - `BARD_WALK_SWING_DEG = 20`, `BARD_WALK_STEP_MS = 260`,
    `BARD_IDLE_BREATH_MS = 1400` — `src/scenes/RoadScene.ts`
- [ ] **Scroll match** — does the ground scroll at the same apparent pace
  as the legs, or visibly faster/slower?
  - `ROAD_SCROLL_PX_PER_SEC = 90` — `src/scenes/RoadScene.ts`
- [ ] **Biome transitions** — first fade starts ~44 s in, resolves ~67 s;
  second at ~100–122 s. Does the timing feel earned? Do Village → Forest
  Dusk → Riverside Camp read as three distinct moods on a real screen?
  - `BIOME_TRANSITIONS` + palettes — `src/core/biome.ts`

## E. UI & onboarding (tasks 20, 22)

- [ ] **Mute toggle** — is the top-left icon reachable/discoverable
  one-handed on a phone? (Tap target is 44×44 even though the icon is
  20 px.)
  - `MUTE_ICON_RADIUS = 10` + placement — `src/scenes/RoadScene.ts`
- [ ] **Onboarding hint** — as a first-time player, do you read "tap to
  the beat" in time before the first marker arrives, and is it clear you
  can tap anywhere on screen?
  - Wording/size/position — `src/scenes/RoadScene.ts`

## F. Mobile fixes — verification, not tuning (tasks 23, 26, 27, 29)

These are shipped correctness fixes that headless browsers can't fully
confirm; each just needs a yes/no on a real device.

- [ ] **Viewport fill** — on cold load with the address bar visible, does
  the game fill exactly the visible area — no gap, no scrollable sliver
  below? (Runs 27 + 29: `display:block` canvas, `100dvh`.)
- [ ] **Gestures locked** — rapid same-spot taps never trigger double-tap
  zoom, pinch zoom, or a long-press text callout? (Run 26:
  `touch-action: none`.)
- [ ] **Audio resume** — background the tab mid-walk (switch apps or lock
  the screen) for a few seconds, return: is the backing track audible
  again? (Run 23: `AudioContext.resume()` on `visibilitychange`.)

---

## Also blocked on human (not playtest)

- **v0.1 tag** — must be pushed from a clone with real push access; both
  the scheduled-run environment and the interactive remote session get
  HTTP 403 pushing tags, and the GitHub MCP toolset has no tag/release
  write call. From your own machine:

  ```
  git tag -a v0.1 021410f -m "v0.1 ship — see DESIGN.md Definition of Done"
  git push origin v0.1
  ```
