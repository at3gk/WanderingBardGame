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

Currently one check (`shader-check`) — see the note on history above for
why this list is short. New automated checks against the Three.js game
belong here as they're written.

## `shader-check.mjs`

Boots the render foundation in a real browser and fails on any shader that
does not compile or any frame that does not draw — the one class of bug
unit tests structurally cannot catch, since a GLSL typo type-checks
perfectly and only shows up as a black screen. Also renders the smoke stage
at four times of day and reports the average pixel colour of each, a cheap
objective check that the time-of-day palette actually moves the world's
light rather than just the sky dome.

Prints `PASS` / `FAIL` and exits non-zero on failure.

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

## `shot.mjs [prefix] [settleMs]`

Plain screenshot of the running game after a delay. For far-off states
(later biomes, deep night, a loop wrapping) use the throwaway-build trick
documented in STATE.md's process notes: temporarily shrink the relevant
constants, build, shoot, then restore and confirm with `git diff --stat`.
