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

## `learning-check.mjs [playSeconds] [sulkSeconds]`

Proves the **learning model** (`src/core/scaffold.ts`) works in the running
game, which unit tests cannot: it plays well for a stretch and checks the
note letters **fade**, then deliberately stops playing and checks they
**come back**.

It measures the only thing that matters to a child: `leadMs` — how long
before the hit line each note's letter becomes readable. 1800 means the
letter is present for the whole flight (full help); 350 is the floor, where
the child gets ~1450ms of blank note to recall against.

Why the stop-playing phase matters: `autoplay.mjs` is a *perfect* player, so
it can only ever demonstrate the fade half of the loop and would report
success even if the return-on-struggle path were completely broken. Support
returning is the accessibility mechanism — there is deliberately no "show
the letters" button, because that would be a menu — so it is the half worth
testing hardest.

Note what it does and does not prove. It shows *displayed* support
recovering, which is what the child experiences; that recovery comes partly
from stored strength dropping and partly from the meter-driven modifiers
(help is restored instantly while the bard is stopped). Both are intended.

## `multisession-check.mjs [playSeconds] [sittings]`

Proves the learning model's *central* promise, which is a claim about days
rather than minutes: **a note reaches full fade only across several
sittings, never inside one.** That is what `SESSION_GAIN_CAP` exists to
guarantee — a scaffold must not vanish faster than the memory forms — and
it is the one property that unit tests can assert but only a real browser,
with real `localStorage`, across real page reloads, can actually
demonstrate.

It plays well, reloads, plays again, and reports each position's support
band after every sitting. Measured on the shipped build:

```
after sitting 1: {"0":2,"1":2,"2":2,"3":4,"4":3,"7":4}
after sitting 2: {"0":1,"1":1,"2":1,"3":4,"4":2,"7":3}
after sitting 3: {"0":0,"1":0,"2":0,"3":3,"4":1,"7":3}
```

Band 4 is full help, band 0 is fully faded. C4/D4/E4 (steps 0/1/2, the
village set's common notes) take exactly three sittings to fade
completely, while the rarer F4 (step 3) correctly lags well behind — the
fade follows real exposure rather than a clock.

It fails if any position reaches band 0 within a single sitting (the cap
is broken) or if no further fading happens across sittings (persistence or
the per-sitting reset is broken).

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
