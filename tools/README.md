# tools — headless verification

Scripts that let a run **check its own work** instead of deferring
everything visual or audible to a human. They drive a real browser against
the production build, so they exercise the same code a player would.

They are deliberately *not* wired into `package.json`: Playwright is a
heavy dependency and the game itself must stay dependency-free (CLAUDE.md).
Install it ad hoc, outside the project, and run the scripts directly.

## Setup

```bash
npm run build && npm run preview &        # serves http://localhost:4173
cd "$(mktemp -d)" && npm init -y && npm i playwright   # anywhere but the repo
```

Then run a script with `node --experimental-...`-free plain node, from the
directory where Playwright is installed, pointing at the script:

```bash
node /path/to/repo/tools/autoplay.mjs 60
```

All three launch the browser with
`executablePath: '/opt/pw-browsers/chromium'` — the pre-installed binary in
this environment. Change it if you're running elsewhere.

## `autoplay.mjs [seconds]`

Plays the game by itself and asserts on what happened **and what was
heard**:

- Instruments `AudioContext.createOscillator` before boot, recording every
  scheduled pitch. Each one is converted back to a semitone from middle C
  and checked: it must be within a cent of equal temperament **and** be a
  natural note. This is how "does it play the written song, in tune" gets
  answered without ears.
- Taps every note as it reaches the line using real (trusted) CDP input.
  Synthetic `PointerEvent`s do **not** reach Phaser's input manager — don't
  bother trying.
- Samples meter, coins, steps, live-marker count, texture count and FPS
  every 10s, then asserts: perfect play keeps the meter full, the walk
  accrues, no page errors, and neither the marker list nor the texture
  cache grows without bound (both are real leak risks in an endless game).

Prints `PASS` / `FAIL` and exits non-zero on failure.

Caveat: headless Chromium renders through software GL, so the FPS number is
only a floor check for pathological slowness — it says nothing about frame
rate on a real device.

## `proofsheet.mjs`

Bakes **every** note-value × staff-position combination the songbook can
produce and lays them out in a labelled grid, then screenshots it
(`proofsheet.png`). This is the fastest way to verify engraving — filled vs
hollow heads, stem direction flipping at the middle line, stemless whole
notes, flags, augmentation dots, ledger lines, and letter legibility — all
at once, deterministically, instead of trying to catch moving notes.

It reaches into the live scene through `window.game` (exposed in
`src/main.ts`) and calls the scene's own texture baker, so what it shows is
exactly what the game draws.

## `shot.mjs [prefix] [settleMs]`

Plain screenshot of the running game after a delay. For far-off states
(later biomes, deep night, the biome loop wrapping) use the throwaway-build
trick documented in STATE.md's process notes: temporarily shrink the
relevant constants, build, shoot, then restore and confirm with
`git diff --stat`.
