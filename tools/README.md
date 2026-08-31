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

## `shot.mjs [prefix] [settleMs]`

Plain screenshot of the running game after a delay. For far-off states
(later biomes, deep night, a loop wrapping) use the throwaway-build trick
documented in STATE.md's process notes: temporarily shrink the relevant
constants, build, shoot, then restore and confirm with `git diff --stat`.
