# tools — headless verification

Scripts that let a run **check its own work** instead of deferring
everything visual to a human. They drive a real browser against the
production build, so they exercise the same code a player would.

They are deliberately *not* wired into `package.json`: Playwright is a
heavy dependency and the game itself must stay dependency-free (CLAUDE.md).
Install it ad hoc, outside the project, and run the scripts directly.

**A note on history**: this directory carried 24 scripts through the 2D
Phaser build of the game. v0.6 (STATE.md) rebuilt the presentation in
Three.js — a different renderer, different scene graph, different global
handle (`window.bard` instead of Phaser's `window.game`) — and every one of
those 24 scripts drove `window.game.scene.scenes[0]`, which no longer
exists. They were deleted rather than kept as dead weight; look at git
history before this cleanup if you want to see how a 2D check was written,
several of the *lessons* in those old checks (frame-rate-independent
assertions, sampling from the trigger frame, treating a failing check as a
claim about the check first) still apply to whatever gets written here next.

## Setup

```bash
npm run build && npm run preview &        # serves http://localhost:4173
cd "$(mktemp -d)" && npm init -y && npm i playwright && npx playwright install chromium   # anywhere but the repo
```

(Skip `playwright install chromium` if a browser is already reachable via
`PLAYWRIGHT_BROWSERS_PATH` — true in this environment, where one is
pre-installed. Point `PLAYWRIGHT_PATH` at **1.56.1**
(`/opt/node22/lib/node_modules/playwright`) specifically — a newer copy
fails every check on a browser-build mismatch that looks like a real
regression.)

Then point `PLAYWRIGHT_PATH` at that install and run the scripts **in
place**, from the repo:

```bash
export PLAYWRIGHT_PATH=/path/to/that/dir/node_modules/playwright
node tools/verify-all.mjs
node tools/postcard.mjs
```

Running them in place matters more than it looks. The old instructions had
you copy the scripts next to Playwright and run the copies — and a past
session twice ran a **stale copy** of a script it had just edited, once
letting a crashed run "prove" that nothing had changed by comparing against
its own leftover output. Running the file you actually edited removes that
whole class of mistake.

Artefacts (screenshots, postcards) are written to the working directory and
are gitignored.

None of the scripts hardcode a browser path — `chromium.launch()` is called
with no `executablePath`, so Playwright resolves its own binary the normal
way (via `PLAYWRIGHT_BROWSERS_PATH` if set, as it is in this environment; via
its own install cache otherwise). That's what makes them portable to CI or
any other machine without editing a path first.

## `browser.mjs`

Not a check — the shared browser-launch helper every script below imports
(`launch()`, `BASE_URL`, the SwiftShader WebGL flags headless Chromium needs
to get a real GL context at all rather than passing vacuously against a
blank canvas).

## `verify-all.mjs`

Runs the automated pass/fail suite and prints one summary. **Start here.**

```bash
node tools/verify-all.mjs
```

Two checks (`shader-check`, `frame-quality`) — see the note on history above
for why this list is short. New automated checks against the Three.js game
belong here as they're written. `node tools/verify-all.mjs quick` skips the
ones marked slow.

## `shader-check.mjs`

Boots the render foundation in a real browser and fails on any shader that
does not compile or any frame that does not draw — the one class of bug
unit tests structurally cannot catch, since a GLSL typo type-checks
perfectly and only shows up as a black screen. Also renders whatever
`window.bard.stage` currently is (`RoadStage` — the game has no `SmokeStage`
any more, see this script's own header comment) at four times of day and
reports the average pixel colour of each, a cheap objective check that the
time-of-day palette actually moves the world's light rather than just the
sky dome.

Prints `PASS` / `FAIL` and exits non-zero on failure.

## `frame-quality.mjs [only]`

Turns the three complaints every art critique of this game has returned into
numbers, sampled from the real renderer at seven fixed poses (morning, noon,
a village-biome noon, golden hour, and night, plus both phone aspect
ratios):

- **valueStops** — the frame's usable value range, as log2 of the ratio
  between the 90th and 10th percentile of *linear* luminance. Under about a
  stop there is nothing to compose with and the frame reads as one grey mass
  when you squint, which is what "flat" means.
- **hueSpread** — saturation-weighted circular spread of hue, 0..1. Near zero
  means every pixel that carries colour carries the *same* colour.
- **modalShare** — the largest fraction of the frame inside one coarse colour
  bucket, i.e. how much of it is a single uninterrupted area.

Prints a table and `PASS`/`FAIL`. The thresholds are **floors set well under
what the game currently measures**, so this reports a regression rather than
litigating taste — `postcard.mjs` is still the tool for judging whether a
frame is any good.

Two things this check learned the hard way, both worth knowing before you
trust a number out of it:

**`hueSpread` is not "higher is better".** A global floor failed exactly two
frames — golden hour and the golden-hour busk — which are the two frames
every critique has named as the best in the set. A low sun washing a whole
landscape in one warm hue is not a fault; it is what golden hour is. The
floor is therefore per-pose and only the plain daylight frames carry one.

**It is a whole-frame measure.** A blue sky over a green field over a brown
road scores as varied even when the land, which is most of what the player
looks at, is one hue. Noon measures 0.28 while still reading green-on-green
underfoot. It catches a palette collapsing; it does not certify that a
frame's colour is working.

## `postcard.mjs [outDir] [only]`

Not a pass/fail check — a visual-QA tool. A critic (human or agent)
reviewing the art direction cannot play the game, so the game has to be
able to *pose* for it: drive to a known point on the road, set a known time
of day, set a phase, settle, shoot. Every shot is deterministic (the road
comes from a fixed seed and the clock is driven, not observed), so two runs
differ only where the rendering actually changed.

Shots are written as individual PNGs to `outDir` (default `postcards/`) so
a critic can open them at full size — a contact sheet is deliberately not
produced, since judging a painterly look from thumbnails is how you ship
something that falls apart at 1x. Pass a shot name as `only` to bake a
single frame instead of the whole set.

## `staging-probe.mjs`

Not a pass/fail check — the instrument the busk and encounter *staging*
numbers were measured with. Poses `05-golden-busk` and `06-dusk-encounter`
and, for every figure the stage has put on the ground, reports three things
the postcards can only hint at:

- **sink** — the figure's own y against the drawn terrain ribbon's triangles,
  interpolated barycentrically at its exact x and z. This is the only honest
  answer to "is that person standing in the ground": `roadSurfaceHeight` is
  what *placed* them, so asking it again would agree with itself.
- **screen position** — feet, chest and head projected through the live
  camera, as fractions of the frame.
- **the staff ribbon's screen box** — measured from the notation's own
  vertices, so "that listener has a stave drawn across her face" becomes a
  pair of numbers.

`BARD_SWEEP=1` additionally sweeps a grid of bearings and radii around the
bard and reports where each would land, which is how the slot table in
`src/three/roadStaging.ts` was chosen. Its screen constants — the ribbon's
box, the bard's own column — are pinned in `roadStaging.test.ts`; re-run this
if the notation or a framing moves.

## `scatter-probe.mjs`

Not a pass/fail check — a census of the ordinary scatter (grass, fern,
flower, reed, bankreed, bankgrass, shrub, log, rock, roadgrass, roadstone,
puddle; never trees, which have their own `waysideSentinelSites` balance
guarantee). Where `staging-probe.mjs` answers "is this figure where it
should be", this answers "what is actually inside this frame" for the
much larger, much more random population of background dressing — the
question STATE.md's run-134 handoff left open when a vista shot's
lower-left quadrant read as visually empty and the camera rig and the
tree system were both cleared by measurement.

Poses the exact pinned vista shots plus a sweep of unpinned points along
the same `vista` mood, walks the live scene for every scatter
`InstancedMesh`, projects each instance through the live camera (same
`v.project(camera)` staging-probe.mjs uses), and buckets what actually
lands inside the frame by screen quadrant — with a further breakdown by
kind, since a quadrant full of thin grass and a quadrant full of nothing
read very differently on screen but can both show up as "low count" if
mass isn't distinguished from headcount. Prints a table; always exits 0.

## `ground-cover-probe.mjs`

Not a pass/fail check — the instrument STATE.md's run-138 handoff sized to
settle task 149's last open sliver: is the faint wavy/streaky texture across
the dark meadow in `07-night-campfire` crops real grass/fern *colour*
banding, or another false positive like the tree/particle run 138 already
caught? Extends `scatter-probe.mjs`'s instance-projection method (world
matrix → camera projection → screen-space filtering) with actual rendered-
pixel sampling, the way `land-histogram.mjs`/`frame-quality.mjs` sample —
through `app.renderFrame(scene, camera)` (task 168's finishing/LUT
composite), not a bare `renderer.render()`, which is the exact pre-finishing-
buffer bug run 138 found in the older tools. **Run 141 fixed that
discrepancy everywhere else it lived**: `postcard.mjs`, `frame-quality.mjs`,
`land-histogram.mjs`, `figground.mjs`, `figground-partition.mjs`,
`shader-check.mjs` and `shadowcast.mjs` all now render through
`app.renderFrame()` too, so every pixel-reading tool in this directory
samples the same finished/graded buffer a player actually sees.

Narrowed strictly to `grass`/`fern` InstancedMesh instances (never
roadgrass/roadstone/puddle/flower/reed/bankreed/bankgrass/shrub/log/rock —
scatter, but a different vocabulary question from task 149's "ground
cover"). For every instance that projects on screen, averages a 3×3 pixel
patch at its projected position and reports luma statistics (mean, stdev,
CV, percentiles) split into a firelit near band and a "dark meadow" far
band (`>= 20m` from camera), plus a variance-decomposition "banding" check
in both screen-x and depth — what share of the dark meadow's luma spread is
explained by an instance's *position* in frame rather than its own random
per-instance colour. A real spatial streak inflates that share; ordinary
per-instance noise does not.

**Run 139's finding, worth knowing before trusting a `07-night-campfire`
screenshot again**: `postcard.mjs`'s pinned resting pose (`s: 1400`) does
not match where `RoadStage.makeCamp` actually builds the camp
(`road.stops[stops.length - 1]`, ignoring the pose's own `s`) — on the day
measured the real last stop sat at `s: 1790`, 390 m past the grass/fern LOD
window that follows `journey.s`. The pinned pose therefore measures **zero**
grass/fern instances anywhere on screen — confirmed both by this tool and by
eye in the postcard itself — so whatever texture a human sees in that exact
image cannot be ground-cover colour. A second pose, built at runtime by
querying `road.stops` for the real last stop, reproduces what a resting
frame actually looks like (matching real play, where `arrivedAt` only fires
`resting` once `journey.s` is already within 4 m of the stop): grass/fern
*is* present there, with an elevated-but-explicable CV (~0.5, vs. ~0.32 on
a daylight baseline — expected from the low absolute luma and a single
falloff point light rather than a diffuse sun) and a LOW banding share
(7-13%, comparable to or below the uncomplained-about daylight baseline's
own 16%/2%) — no evidence of real spatial streaking beyond ordinary
per-instance variation. See ROADMAP task 149 and STATE.md's run-139 handoff
for the full account and the caveat about small far-band bucket counts.
Each pose gets its own fresh page (a resting pose's camp state was found to
leak into a later pose sharing one page — see the file's own comment).

## `figground.mjs [only]` / `figground-partition.mjs`

ROADMAP task 179's instrument (built 2026-08-01): silhouette-diff the bard
by rendering with and without his group visible (`stage.bard.group.visible`
toggled, same page, same pose — the diff mask, not a guess), then measure
figure-vs-surround L* (CIE lightness) in a lower ("knees-down") and upper
band plus the full silhouette, at seven pinned poses spanning the daylight
hours. `figground-partition.mjs` extends this with an albedo-flood step
(paint the bard's own materials white and re-render) to separate his own
pixels from his cast shadow — needed once the panel's "figure vanishes"
complaint turned out to be shadow-vs-road contrast in some frames, not
figure-vs-road at all (see ROADMAP task 179's measurement-phase done-note).
Pass a pose name as `only` to run `figground.mjs` against a single pinned
pose instead of all seven; `figground-partition.mjs` has no such filter
and always runs the full set.

**Run 174 addition**: mean hue/saturation (ordinary HSL over the same
figure/surround pixel sets `dL` already uses) alongside the existing L*
columns, plus a `behindL` column (the lower band's surround luma with the
bard hidden — "what does the road actually read as here"). Built to test
task 179's own original hint — "measure what 03/10 already do right,
likely the lit road behind the figure" — quantitatively instead of by eye,
after this residual sat untouched since 2026-08-01 and re-measuring showed
one pose (04-golden-vista) had gotten worse. It held up: every pose passing
the figure/ground floor has a bright road behind the bard's legs
(`behindL` in the high 40s-60s), every failing pose has a dim one (high
teens to low 30s). See ROADMAP task 179's 2026-09-12 done-note for why that
confirmed mechanism still doesn't hand this task a safe lever (the color
script's CARRYING-hours rule and a same-`sunHeight` collision with the
passing poses both block the obvious next move) and why it moved to
STATE.md's Blocked on human instead of staying an open engineering item.
Approximate on purpose: a mean-of-channel hue over a whole band is a
diagnostic, not a colorimetric claim — good enough to find a clean gap
between two clusters, not precise enough to tune a shader constant from.

## `shadowcast.mjs [outDir]`

ROADMAP task 183's instrument (built run ~150): three wave-7 lenses named
long dark streaks crossing road and grass "with no visible caster" on
frames 01/03/09, reading them as render banding. Suspicion-list discipline
says the symptom is real and the attribution probably isn't — this answers
three questions with numbers before anyone touches a lever, on three
pinned poses (`01-dawn-road`, `03-noon-forest`, `09-phone-landscape`):

- **who casts each streak** — freeze the frame (`app.stop()`), re-render
  with the sun's shadows off entirely, then again with each caster family
  (trees / shrubs / logs / rocks / the bard / everything else, bucketed by
  object name/ancestry) individually silenced, and diff pixels against the
  base capture. A pixel that only lightens when one family stops casting
  belongs to that family.
- **what it looks like** — value drop, saturation and hue shift between
  the shadowed and sun-off renders, computed only on the pixels the
  sun-off diff itself flagged as shadow.
- **how soft it is** — the share of shadowed pixels sitting in the
  25-75%-of-full-depth penumbra band vs. the deep (>75%) core; a
  hard-edged cast is bimodal, a soft one carries a wide penumbra.

Every capture re-renders the same frozen state through `app.renderFrame()`
(task 168's finishing/LUT composite — see the `land-histogram.mjs`
discrepancy note below for why a bare `renderer.render()` would silently
read the wrong buffer), so the diffs contain rendering changes only, never
wind/particle/camera drift between captures. Pass an `outDir` to also save
a frozen screenshot of each pose's sun-off state. Prints one JSON block per
pose (caster families found, shadow-pixel share of the frame, per-family
ownership counts, the photometrics and softness numbers above); always
exits 0 — this is a measurement tool, not a pass/fail gate. `skylight-sat.mjs`
below reuses its sun-off diff as the shadow mask for a related question
(non-cast, sky-lit saturation) rather than re-deriving one.

## `skylight-sat.mjs [outDir]`

ROADMAP task 194's instrument (built run 183): does a non-cast,
form-shaded terrain face (a slope turned away from the sun, lit only by
the sky) actually lose saturation the way `docs/color-script.md`'s noon
section suspects — the `skyLight` term (`painterly.ts:1604`), not the
cast-shadow one `shadowcast.mjs` already measures and task 166 already
fixed. Swaps every `terrain-<index>` mesh (only terrain — trees/shrubs/
rocks/logs are instanced and this tool's debug material doesn't apply
`instanceMatrix`) for a tiny debug shader outputting
`dot(worldNormal, sunDirection)` as grayscale, reads it back, and
compares HSV saturation between painterly.ts's own band1/band3 luma
edges (0.46 shaded / 0.86 lit) on the pixels the shadow mask (the same
sun-off diff `shadowcast.mjs` uses) says are genuinely non-cast. Pass an
`outDir` to also save a frozen screenshot of each pose's state.

**The pitfall worth knowing before writing another debug-shader probe**:
the debug passes must call `renderer.render()` directly, not
`App.renderFrame()`. A constant 0.5 gray written straight to
`gl_FragColor` came back as 0.80 through the full pipeline — the
finishing composite's ACES tonemap + 3D LUT grades the *whole* render
target, debug shader output included, and `material.toneMapped = false`
does not stop it (that flag only suppresses a material's own tonemapping
shader chunk, irrelevant to a post-process that runs after the material
already wrote its color). Bypassing `finishing` with a direct
`renderer.render(scene, camera)` call round-trips a written constant
exactly (0/0.25/0.5/0.75/1.0 → 0/64/128/191/255) — confirmed live while
building this tool. `base`/`noShadow` (the shadow mask and the actual
saturation values) still want the full pipeline; only the two debug
passes bypass it.

Run against the three pinned poses shadowcast.mjs uses: the strict
lit/shade buckets came back empty or tiny at all three (in-frame terrain
rarely sits past *either* band edge — noon especially, where the camera
mostly frames sun-facing ground, not a face turned away). `litGradient`
(five even luma bins across the full range) reports the shape anyway, and
it's consistent across all three poses and worth acting on: saturation
rises monotonically with how directly a face turns toward the sun (dawn
0.227 → 0.365 → 0.528; golden 0.384 → 0.67 → 0.734; noon's populated bins
0.478 → 0.555) — the suspicion holds, `skyLight`'s ambient does read
less saturated on a face it alone is lighting. Treat the strict `lit`
bucket's own mean with caution when its `n` is small (noon's was 60 out
of ~800k terrain pixels, likely edge/highlight noise, well below the
gradient's own top-bin mean from a much larger sample) — the gradient's
bins are the trustworthy read, the two-bucket numbers are a bonus when
they happen to have enough pixels behind them.

## `land-histogram.mjs`'s sentinel bug (found run 142, building `fog-hue-band.mjs`)

`land-histogram.mjs` masks the sky by hiding the sky dome and painting the
clear colour pure magenta (0xff00ff), then classifying any pixel within a
tolerance of that literal value as background. That assumption predates task
168's finishing pass (the offscreen half-float render + ACES tonemap + a
code-generated 3D LUT, the last thing that happens to a frame before a
player — or this tool — sees it): the grade moves pure magenta clear to
roughly **(253, 40, 240)**, a 40-level green shift that blew every tolerance
this file ever used. The result: `isSentinel` matched almost nothing, and
every run of this tool since task 168 shipped measured LAND and SKY pixels
together — silently, because nobody had looked hard at its own `landShare`
column, which read **~100%** on poses that are visibly half sky. Same root
family as run 138/141's `renderer.render()` vs `renderFrame()` bug: a
pixel-reading tool built one assumption behind a pipeline change.

Fixed by calibrating live instead of hardcoding a target: hide the whole
scene (not just the sky), render once, read back the one colour left — that
*is* the sentinel, whatever the current grade makes of pure magenta — then
proceed as before. Deterministic for a fixed clear colour and grade, so one
extra render pays for the whole measurement. Re-measured land-only stats
changed materially (e.g. `03-noon`'s land p50 158→174, landShare 100%→78%),
so anything anyone concluded from this tool's land-only numbers between task
168 (run 95) and this fix should be treated as measuring the whole frame, sky
included, not the land alone. Pass a pose name as `only` (`process.argv[2]`)
to run against a single pinned pose instead of the whole set, the same
convention as `frame-quality.mjs`/`postcard.mjs`/`far-band-objects.mjs`/
`figground.mjs`/`fog-hue-band.mjs`.

## `fog-hue-band.mjs [only]`

Built to size ROADMAP/STATE's long-standing "hue-free distance wall"
pointer (STATE.md's run-131 handoff: wave 19's colour lens named "distance
fade resolves to a single hue-free wall" across 10 of 13 frames, a fault
family independent of the FOG_CHROMA/FOG_HUE_LEAD fix `painterly.ts` already
carries for the plainer "distance goes grey" complaint — see the file's own
long comment on those two constants). No existing tool separates near from
far *hue*, only near from far *value* (`land-histogram.mjs`) or whole-frame
hue (`frame-quality.mjs`'s `hueSpread`, which a blue-sky-over-green-field
frame can pass while the land alone reads as one hue underfoot).

Same land-only masking as `land-histogram.mjs` (calibrated sentinel, same
bug independently hit and fixed while building this), then splits land
pixels into near/mid/far bands by their position within the land pixels' own
row extent (GL readback convention: row 0 is the bottom/near, the top row is
whatever's furthest away that's still on screen) — not the viewport's full
height, since the horizon sits wherever the camera's pitch and the terrain's
silhouette put it. Runs `frame-quality.mjs`'s own saturation×value-weighted
circular hue-spread formula separately per band, plus the mean hue angle and
mean saturation, against five poses (`02-morning`, `03-noon`,
`04-golden-vista`, `11-morning-vista`, `10-tablet-afternoon` — the last two
added run 143, see below) and reports each pose's `sunHeight` and
`landKeyAmount` (`landKey.ts`'s own pull-amount formula, duplicated into the
page-evaluated function since it can't import the module). Pass a pose name
as `only` to run against a single one of these five poses instead of the
whole set.

**First real reading (run 142, post-fix), and it does NOT cleanly confirm
the "everything converges on the fog's hue" hypothesis**: `04-golden-vista`
is the one pose where the far band's hue (28°) sits close to the live fog
hue (20°) with *higher* saturation than nearer bands — but golden hour is a
CARRYING hour by the colour script's own ruling (`docs/color-script.md`),
off-limits to tune regardless. The two enacting hours read differently:
`02-morning`'s far-band hue spread (0.458) is *higher* than its near band
(0.276), and `03-noon`'s far band (0.331) dwarfs its near band (0.038) —
distance is adding hue variety, not collapsing it, while far-band mean
saturation is only modestly lower than near (0.399 vs 0.408/0.51). That
reads as a milkier, less confident distance rather than a literal
one-hue wall, which is a different lever (or no lever at all) from what the
wave-19 wording suggested. Not chased further this run — the metric here is
new and unvalidated against an actual blind panel (wave 20 is
network-blocked this session; see STATE.md's Blocked on human section), so
pulling FOG_HUE_LEAD/FOG_CHROMA/the fogAmount cap on this single reading
alone would be exactly the "blind tune" ROADMAP's own discipline warns
against. Whoever picks this up next: re-read this section's numbers, decide
whether they still support the "hue-free wall" framing at all, and treat a
panel confirmation (once the reference-image network block clears) as the
real judge, not this instrument alone.

**Piece 2 (run 143): widened to 5 poses, and the pattern sharpened into a
falsifiable hypothesis.** `11-morning-vista` and `10-tablet-afternoon` (both
reused from `postcard.mjs`'s vetted set) were chosen to separate "is this
about the hour" from "is this about `landKey.ts`'s pull": `11-morning-vista`
has sun height 0.267, below `LAND_KEY_RISE_START` (0.3) — a second zero-pull
pose, different biome/vista than golden — and `10-tablet-afternoon` has sun
height 0.445, a partial-pull regime on the *falling* side of the sun's arc
that nothing here had tested. Result (`landKeyAmount` → far hueSpread minus
near hueSpread): `04-golden-vista` 0 → −0.063, `11-morning-vista` 0 → −0.060,
`02-morning` 0.034 → +0.182, `10-tablet-afternoon` 0.217 → +0.193, `03-noon`
0.35 → +0.297. Every zero-`landKeyAmount` pose has far ≤ near; every nonzero
one has far well above near — including the afternoon pose, whose sun is
*lower* than noon's but whose pull amount and spread-rise both land close to
noon's, which "enacting vs carrying hour" alone doesn't predict.

Likely mechanism, proposed but **not yet measured**: `landKey.ts` only
rotates chroma within 90° of the biome key, leaving anything outside that
cone untouched by construction. That can turn one loose hue cluster into two
tighter ones (most pixels pulled toward the key, a dissenter left alone),
and the circular hueSpread formula scores overall variance, not modality —
so two tight clusters can read as *more* spread than one loose one, not
less. Confirming this means comparing the same poses with the land-key pass
forced to 0 (an in-page override, no shader edit) and checking whether the
far/near gap collapses — that's the next piece, not this one. Still not
worth a shader change yet: the panel/wave-20 validation this section already
asked for is still network-blocked.

**Piece 3 (run 144): the toggle test, and it refutes piece 2's mechanism.**
`measureFogHueBands` now accepts an optional `forcedLandKeyAmount`, applied
by writing `app.globals.uLandKeyAmount.value` directly for one render and
restoring it afterward — no shader edit, since every material already
shares that one uniform object (`painterly.ts`'s `bindGlobals`). Run
automatically against the three nonzero-pull poses right after their
natural reading, on the same page. Piece 2's mechanism predicted the
far/near gap should **collapse** toward the zero-pull controls' negative
gaps when the key is forced off; instead it grows on every pose:
`02-morning` 0.243 → 0.301, `03-noon` 0.294 → 0.298 (flat), `10-tablet-
afternoon` 0.194 → 0.464 (more than doubles). The near band barely moves
either way; the far band jumps up substantially every time the key is
turned off (afternoon's far hueSpread 0.215 → 0.489) — the opposite of
"the key manufactures far-band spread". If anything the key mildly damps
far-band spread, just less than it damps the near band. Piece 2's
mechanism is falsified: the landKeyAmount correlation was real but not
causal. What actually drives the far-band spread rise on enacting hours is
still open — camera distance to the horizon, the object mix in the far row
band, or the fog uniforms are the next candidates, not the land key.

**Piece 4 (run 164): the camera-mood lead, refuted, plus a methodology
finding.** Every pose piece 1-3 called "risen" was shot in the `walking`
camera mood; both "flat" ones (`04-golden-vista`, `11-morning-vista`) were
`vista` — a confound nobody had controlled for, visible once you look at
`CameraRig`'s own `FRAMINGS` (vista pulls back to 7.5 m/3.5 m, horizon at
0.25 of frame; walking sits at 4.0 m/1.85 m, horizon at 0.32). `RoadStage
.pose`'s `mood` option sets `CameraRig`'s mood independently of `phase`, so
`measureFogHueBands` is now called a second time per pose, on the same
page, same `s`/`dayFraction`/world, camera forced to `ALT_MOOD`'s entry
(the mood it was NOT naturally shot in) — printed per-pose and in a
same-scene "gap by mood" summary table. Mood is not inert (`03-noon`
0.02→-0.153, `10-tablet-afternoon` 0.242→-0.184, both flip sign) but does
not drive the pattern: `04-golden-vista` stays deeply negative in both
moods (-0.555 natural / -0.834 forced-walking) and `11-morning-vista` stays
strongly positive in both (0.675 natural / 0.822 forced-vista) — forcing a
"flat" pose's camera into the "risen" mood does not make it rise. Object
mix at the far row band is the one candidate left from piece 3's list.

A second, arguably bigger finding surfaced confirming this: `road.ts`
builds the entire road from `dailySeed()`/`dayKey()` (`src/core/rng.ts`), a
real-calendar-date seed, so the *same* `s`/`dayFraction` coordinates are a
*different generated world* on a different real day. `11-morning-vista`
read -0.060 on 2026-09-02 (piece 2) and +0.675 on 2026-09-09 (this piece)
— not a game regression, a different road under the same pose numbers,
consistent with an ad-hoc screenshot (not committed) showing a heavily
hazed background treeline at the top of the land pixels on today's road.
**Every absolute gap number this file has ever printed is only comparable
within the run that produced it.** A future piece may reuse
`forcedLandKeyAmount`- or `ALT_MOOD`-style same-session deltas freely
(every piece so far already has, piece 4 included), but must not read this
section's or ROADMAP's older absolute numbers as ground truth for what
today's build would print.

## `far-band-objects.mjs [only]`

Task 189 piece 5 (run 166): tests the one lead piece 3 left untried —
"object mix at the far row band" — by ablation rather than inference, the
same house method piece 3 used on the land key. Reuses `fog-hue-band.mjs`'s
own far-band hueSpread measurement (same sentinel-masking, same near/mid/far
row split) but adds a same-session `.visible` toggle per whole object
category before each render, restored after: `scatter` (`scatter-probe.mjs`'s
own regex — grass/fern/flower/reed/bankreed/bankgrass/shrub/log/rock/
roadgrass/roadstone/puddle), `trees` (`tree-*`), `landmarks` (`landmark-*` +
`stop-*`). Terrain itself isn't a togglable category — hiding the ground
mesh would leave nothing to sample — so it's the implicit baseline every
ablation reads against. Same five poses as `fog-hue-band.mjs`, natural mood
only (piece 4 already settled the mood question there, no need to
re-litigate it here).

**Result: no category holds up as a general cause.** Landmarks collapse
`10-tablet-afternoon`'s gap 91% (0.409 → 0.037, the largest single effect
this whole investigation has produced) but are inert on `03-noon` (−7%) and
both flat controls (both effectively 0%) — a placement coincidence (a camp
happens to sit in that one pose's far band), not a mechanism. Trees move
every pose but in opposite directions depending which one: collapse toward
zero on `10-tablet-afternoon` (29%) and both flat controls (04: 64%, 11:
53%) while more than doubling `03-noon`'s gap (0.144 → 0.331) — they don't
even agree with themselves pose to pose. Scatter's effects are smaller
throughout and inconsistently signed too.

Before any of that could be read cleanly, this run's own natural (nothing
hidden) numbers broke the piece 1-4 risen/flat pose classification: `02-
morning`, RISEN every prior day this investigation ran, read flat/negative
today (−0.234); `11-morning-vista`, a FLAT zero-pull control since piece 2,
read risen today (+0.127). This is the same `dailySeed()` fact `fog-hue-
band.mjs`'s own section above already flagged, but sharper — it isn't just
the absolute number that moves day to day, the *classification* built from
those numbers can flip too, for coordinates nothing about the session
changed. Any future piece must re-derive which poses are rising from that
session's own natural reading, never from an earlier piece's label. See
ROADMAP task 189's piece-5 done-note and `docs/research/art-quality.md`'s
findings section for the full account.

## `shot.mjs [prefix] [settleMs]`

Plain screenshot of the running game after a delay. For far-off states
(later biomes, deep night, a loop wrapping) use the throwaway-build trick
documented in STATE.md's process notes: temporarily shrink the relevant
constants, build, shoot, then restore and confirm with `git diff --stat`.

## `headgap.mjs`

ROADMAP task 184's instrument: wave 7 named "fused brown blobs" where
notes sit close in musical time, on five frames, while frames with wide
musical spacing were called excellent — the third appearance of the
twice-refuted "noteheads ignore pitch" family, so before anything is fixed
the claim gets a number. Runs the live walking tune at four viewports
(desktop, phone portrait/landscape, tablet) and, at several sampled
moments per viewport, projects every travelling glyph through the live
camera using the same instanced `aPos`/`aScale`/`aAlpha` buffers the GPU
draws (not positions re-derived from beat-timing theory), then measures
each on-screen neighbouring pair's centre distance against the pair's
summed head radii. A pair counts as overlapping only when both glyphs are
lit above alpha 0.25, so a dissolved gone-by note under a fresh one isn't
a false blob.

Each measured glyph is correlated back to its own `SongBeat` (via
`SongNotes`'s live-beats insertion order, which is ascending `hitTimeMs`),
so a reported overlap can be blamed on that pair's real musical gap in ms
rather than guessed from BPM arithmetic — the correlation run 192 added
after finding the residual overlap `headgap.mjs` still reports is the
tune's own ordinary beat spacing, not a rare eighth-note case as
previously assumed (see ROADMAP task 184's own done-notes). Prints a
per-sample table plus a worst-pair-per-viewport summary; a ratio under 1
means the pair overlaps. Always exits 0 — a measurement tool, not a gate.

## `make-icons.mjs`

Not a browser check — a pure-Node build utility, ROADMAP task 171's
instrument, with no Playwright and no `browser.mjs` dependency at all.
Renders the favicon mark — a full-bleed square background and two
concentric circles, deliberately *without* the rounded corners the SVG
favicon draws (`index.html`'s inline SVG has `rect rx='6'`; the script's
own header comment explains why the PNGs drop it: iOS composites its own
rounded mask over `apple-touch-icon`, and the manifest's `purpose: "any
maskable"` needs an edge-to-edge background so a masking shape can crop
it safely) — to the three PNG icons (`icon-512.png`, `icon-192.png`,
`apple-touch-icon.png`, all under `public/icons/`) the web app manifest
needs so the game is installable as a home-screen app on iOS/Android —
which matters here because an installed PWA is exempt from Safari's 7-day
storage eviction, so these icons are part of the save-persistence chore,
not branding. Hand-rolls its own PNG encoder over `node:zlib`'s
`deflateSync` (no image library, no native build step) and rasterises each
icon with 8x8 supersampling for clean anti-aliased circle edges. Output is
byte-for-byte deterministic (no PNG timestamp chunk is written), and the
script self-checks by reading each file back and verifying its PNG
signature and dimensions before exiting; exits non-zero if any icon fails
that check. Run with `node tools/make-icons.mjs` whenever the mark itself
changes in `index.html`'s inline SVG (the two files are meant to stay in
sync by hand — see the script's own header comment for the shared
coordinate constants).
