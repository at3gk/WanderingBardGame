# STATE

Run counter: 13

## Current status
Run 12 complete — ROADMAP task 12 (v0.1 ship check). No code changes; this
run verified every Definition of Done item in DESIGN.md against a real
production build. All items met.

The live Pages URL (`https://at3gk.github.io/WanderingBardGame/`) is not
reachable from this sandbox — the network policy denies `*.github.io`
(confirmed via the proxy status endpoint, `connect_rejected`/403). Verified
against `npm run build` + `vite preview` instead (same artifact the deploy
workflow ships), which is what every prior run's headless check has also
used. Noted below in case the policy allows it in a future run.

Checked each DoD item:
- **Loads in <5s, first beat tappable on cold load**: headless Playwright,
  390×664 mobile viewport, touch+mobile emulation. `canvas` present and a
  touch tap accepted at 671ms/700ms cold-load time across two runs, well
  under 5s.
- **Single-lane mechanic, fully Vitest-covered**: `npm test` — 39 tests
  green across `beats`, `songMeter`, `coins`, `biome`, `distance`,
  `baseLoop`, `layering` — unchanged from Run 11.
- **Bard sprite walk/idle tied to meter state, road scroll tied to walking**:
  confirmed visually — first tap loop used a naive fixed-cadence tap (every
  625ms) that drifted outside the 120ms hit window over time and visibly
  drained the meter (screenshots showed the fill shrinking run-over-run);
  a tightened tap loop (every 90ms, well inside the hit window) kept the
  meter full and the bard's legs mid-stride throughout.
- **≥2 biomes, distance-driven transition**: the tight-tap-loop run held
  `walking = true` continuously for 70s of real time (`BIOME_TRANSITION_START_PX
  4000 / ROAD_SCROLL_PX_PER_SEC 90 ≈ 44.4s` to start, `~66.7s` to fully
  resolve) and the screenshot at ~70s showed the sky/road palette fully
  shifted from the default (dark purple/mauve) to Forest Dusk (dark green)
  — confirms the crossfade actually reaches and completes, not just that
  the math is unit-tested.
- **Procedural backing loop + meter-driven layering**: code-verified
  (`AudioEngine`/`AUDIO_MANIFEST` wiring unchanged since Run 8, tests green)
  plus no Web Audio console errors during either headless run. Headless
  Chromium can't confirm how it sounds — that's still a human-playtest item
  (see below), not a ship blocker (DoD only requires the layering to exist
  and respond to the meter, which it does).
- **Touch input on mobile viewport, keyboard/mouse on desktop**:
  `this.input.on('pointerdown', ...)` (fires for touch and mouse alike —
  confirmed via the touchscreen taps above) and
  `this.input.keyboard?.on('keydown-SPACE', ...)` in `RoadScene.ts:111-112`,
  both wired to the same `handleInput()`.
- **Bundle <5 MB, deploys via CI/deploy workflow**: `npm run build` →
  `dist/assets/index-*.js` 1.22 MB (gzip ~336 KB), well under the cap.
  `.github/workflows/deploy.yml` unchanged and gated on CI per README;
  deploy itself not re-verified this run since Pages is unreachable from
  this sandbox (see above) — the workflow's shape hasn't changed since it
  last shipped Run 11's PR.
- **No menus/login/save, opens directly into the walk**: `src/main.ts`
  boots a single `Phaser.Game` with one scene (`RoadScene`); headless
  check's `document.body.innerText` was empty (canvas-only page, no DOM
  menu/login markup).

All items met — nothing to cut. PR #13 merged (squash commit `021410f` on
`main`). ROADMAP task 13 (unbounded beat schedule) is the first post-v0.1
task.

**The `v0.1` git tag itself could not be pushed — see Blocked on human.**

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
- Run 12 (2026-07-19): v0.1 ship check per ROADMAP task 12 (see Current
  status above). No code changes — verified every DoD item against a real
  production build, found nothing unmet. `v0.1` tag pending the squash-merge
  landing on `main` (see Current status above for why).

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
