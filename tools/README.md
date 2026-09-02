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
perfectly and only shows up as a black screen. Also renders the smoke stage
at four times of day and reports the average pixel colour of each, a cheap
objective check that the time-of-day palette actually moves the world's
light rather than just the sky dome.

Prints `PASS` / `FAIL` and exits non-zero on failure.

## `frame-quality.mjs [only]`

Turns the three complaints every art critique of this game has returned into
numbers, sampled from the real renderer at six fixed poses (four times of day
plus both phone aspect ratios):

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
included, not the land alone.

## `fog-hue-band.mjs`

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
mean saturation, against `02-morning`, `03-noon` and `04-golden-vista`.

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

## `shot.mjs [prefix] [settleMs]`

Plain screenshot of the running game after a delay. For far-off states
(later biomes, deep night, a loop wrapping) use the throwaway-build trick
documented in STATE.md's process notes: temporarily shrink the relevant
constants, build, shoot, then restore and confirm with `git diff --stat`.
