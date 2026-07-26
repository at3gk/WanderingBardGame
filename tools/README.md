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

## A note on audio/visual sync — and why there is no check for it

Visuals run off Phaser's time (`performance.now`), audio off
`AudioContext.currentTime`, which is driven by the sound hardware. The two
are never exactly the same rate, so a rhythm game has to keep re-locking
them or what you see and what you hear slide apart.

`AudioEngine.schedule` now re-anchors the audio clock to the visual one on
every pass, which bounds that error to a single song instead of a whole
sitting. That change is covered by unit tests (`AudioEngine.test.ts`,
"corrects audio-clock drift at every pass"), where both clocks can be moved
by hand and the arithmetic checked exactly.

**There is deliberately no browser-based sync assertion.** Five attempts at
measuring it in a live page produced five different answers — 17s, 1.2s,
scattered ±900ms, −22s, −566ms — and every single time the bug was in the
instrument, not the game:

- concurrent Chromium instances starving the audio thread (the 17s figure
  was pure CPU contention from other checks running alongside);
- comparing the raw gap between the two clocks, which *should* grow and is
  harmless on its own, rather than comparing when a note sounds against
  when it is seen;
- matching "next unresolved marker" against "soonest pending oscillator" —
  a tap lands up to a hit-window early, so those are routinely different
  notes;
- indexing oscillators as if the layers were interleaved, when
  `scheduleLayer` emits all of one layer's notes before starting the next.

Reading the anchor directly out of a live `schedule()` call gives ~7ms,
which agrees with the unit tests. But a check that has been wrong five
times has not earned the right to fail a run, so it is not wired up.
Headless is also the wrong place to judge this: with no audio device
Chromium's clock runs ~0.17% slow against a software sink, where real
hardware is orders of magnitude tighter.

`autoplay.mjs` reports the raw clock gap as information only. If this is
ever picked up again, measure a note against **its own** scheduled
oscillator, captured at scheduling time — not by matching lists afterwards.

## `timeaway-check.mjs`

What a child comes back to after days away. `loadScaffold` reads the saved
record, works out how long it has been, and applies the decay; that
arithmetic is unit-tested, but the round trip through real `localStorage`
with a real backdated timestamp was not — and it is a path where a mistake
is both silent and unkind, either wiping a week of practice or leaving a
child with letters that quietly vanished.

It plays two sittings until positions fade, backdates the stored timestamp,
and checks what survived. Results, 2026-07-26:

```
after practice     {"0":24,"1":24,"2":18,"3":14,"4":23,"5":2,"7":6}  bands {0:1,1:1,2:1,3:2,4:1,5:4,7:3}
after 1 day away   {"0":24,"1":24,"2":15,...}                        bands unchanged
after 30 days away {"0":24,"1":24,"2":12,...}                        bands {...,2:2,...}
corrupt record     game still starts = true
```

Well-practised positions held; a mid-strength one decayed and was handed a
band of help back; no record was ever wiped; and a deliberately corrupted
record starts the game fresh rather than breaking it. It asserts that a gap
can only ever return support, never remove it, and never raises a position's
`peak`.

Two traps this fell into, both worth knowing before writing anything similar:

- **A reload force-saves.** Reloading fires `visibilitychange` → hidden,
  which is the scene's force-save path — so backdating the record and *then*
  reloading writes the live state and a fresh timestamp straight over the
  backdate, and the gap never happens. Settle first, backdate second.
- **Saves are throttled to 5s**, so reading storage right after playing can
  be several hits out of date. The baseline and the post-gap readings must
  be taken the same way, or a stale baseline makes the gap look as though it
  *added* practice.

## `scenery-sheet.mjs`

The scenery equivalent of `proofsheet.mjs`: bakes every world texture the
game can draw — road band and silhouette tile for all three biomes, both
water-glint phases, the star field and the trail signpost — into one
labelled sheet (`scenery-sheet.png`).

A live screenshot only ever shows the biome you happen to be walking
through, so scenery changes used to be checked by temporarily shrinking the
transition distances and rebuilding. This is deterministic instead, which
makes a refactor of the drawing code checkable byte-for-byte — that is
exactly what it was written for, and the sheet came out identical across
the move to `src/render/scenery.ts`.

It deletes its own output before regenerating, deliberately: see the
`proofsheet.mjs` note above for the run where a crashed script "proved"
nothing had changed by comparing against its own leftover file.

## `rotate-check.mjs`

Rotates a phone mid-game — portrait → landscape → portrait, playing
continuously throughout — and checks that coins, walk distance, the audio
engine, the marker list and (above all) the child's saved learning progress
survive. Rotation re-runs Phaser's `create()`, which is the path that forced
the scaffold to module scope in the first place, so it deserves a check
rather than an assumption.

Verdict as of 2026-07-26: **rotation is fine.** Meter holds at 100 across
both rotations, coins and steps rise monotonically, and no staff position
ends weaker than it started.

That verdict took three attempts, and the two wrong ones are the reason this
file exists rather than a one-off script:

1. The first version **paused tapping for 1.2s** after each resize. Those
   are perfectly genuine misses, and the resulting strength loss read as
   "rotation costs the child progress". It does not.
2. The second version tapped a **fixed (200, 520)**. In landscape the
   viewport is only 390px tall, so every tap landed outside the page and the
   meter crashed to zero — which again looked like rotation breaking the
   game. It now taps a point derived from the current viewport.

Both times the harness was the bug and the game was innocent. A
self-verifying project has to treat a failing check as a claim about the
*check* first.

## `pillar-check.mjs`

Checks the two CLAUDE.md design pillars that had never actually been
measured — "playable in under 5 seconds, no login" and "mobile-friendly" —
across six viewports from iPhone SE to desktop.

Layout is read from the scene's real geometry rather than eyeballed from a
screenshot, so a regression fails a run instead of waiting to be noticed.
It asserts that every drawable staff position (one ledger below middle C to
one above the staff) lands on screen with room for its stem, that the hit
line leaves both an exit lane and enough approach runway to read a note,
that a tap in the lower half registers, and that the game becomes *playable*
— a note in flight, not merely a painted page — inside five seconds.

Baseline, 2026-07-26:

```
viewport              size       ready   runway  minNoteGap
iPhone SE             375x667    884ms   281px   49px
iPhone 12             390x664    764ms   293px   51px
Pixel 5               393x727    708ms   295px   51px
iPhone 12 landscape   664x390    721ms   498px   86px
iPad portrait         768x1024  1290ms   576px  100px
desktop               900x600    899ms   675px  117px
```

`minNoteGap` is the tightest the songbook can draw — two eighth notes at 96
BPM — against a note head of roughly 24px. It is **computed** from tempo,
flight time and runway, not sampled. Sampling was the first attempt and it
quietly measured nothing: over a few seconds of play only quarter notes came
around, so it reported a comfortable 110px and passed without ever seeing
the case it was written for. Confirmed visually at 375px on This Old Man's
run of eighth-note C's — clearly separated, letters legible.

Frame rate is deliberately **not** checked here. Headless software GL says
nothing about a real phone; see the sharper-mobile-rendering note in
ROADMAP, which is still waiting on a device.

## `reveal-check.mjs [seconds]`

Answers *which* mechanism actually shows a child the letter — the question
behind DESIGN.md's "fade the prompt, never the answer".

The code carries three reveal paths (scheduled mid-flight, on the strike,
on a miss) and only one of them can be doing the work. This hooks
`revealLetter`, attributes every genuine reveal to its caller, plays well
enough to fade the letters, and then deliberately drops notes while the
meter is still high.

Verdict as of 2026-07-26: **86 reveals over 90s, all scheduled, none from
strike or miss.** The lead floor (350ms) clears the hit window (±90ms), so
the letter is always already showing before a tap can land — the strike and
miss handlers are unreachable backstops.

That is the *stronger* guarantee, which is why it's worth pinning: the
answer arrives on a bright, upright, full-alpha note the child is still
about to play. The weak version — a letter that first appears after a miss,
on a note that is dimmed, scrolling away and fading out over ~400ms — is
what you'd silently fall back to by lowering the fade floor. So the script
fails if any reveal arrives via the miss path, and `scaffold.test.ts` ("the
answer always beats the tap") guards the same invariant in Vitest.

Note the trap this script fell into first: **never tapping is the wrong
test.** The meter drops, the scaffold restores full support, and every note
is then born lettered, so nothing is revealed at all. Letters only go
missing for a child who is doing well, so that is the child whose misses
have to be measured.

## `proofsheet.mjs`

Bakes **every** note-value × staff-position combination the songbook can
produce and lays them out in a labelled grid, then screenshots it
(`proofsheet.png`). This is the fastest way to verify engraving — filled vs
hollow heads, stem direction flipping at the middle line, stemless whole
notes, flags, augmentation dots, ledger lines, and letter legibility — all
at once, deterministically, instead of trying to catch moving notes.

It reaches into the live page through `window.engraving` (exposed in
`src/main.ts`) and calls the game's own texture baker, so what it shows is
exactly what the game draws.

It used to reach a *private method* on the scene instead, which broke
silently the moment the engraving moved to `src/render/engraving.ts`. Worth
remembering how that nearly passed: the comparison was made against a
`proofsheet.png` left over from the previous run, so the file matched
byte-for-byte while the script had actually crashed. **Delete the artefact
before regenerating it**, or a screenshot diff will happily confirm that
nothing changed about an image nothing rewrote.

## `shot.mjs [prefix] [settleMs]`

Plain screenshot of the running game after a delay. For far-off states
(later biomes, deep night, the biome loop wrapping) use the throwaway-build
trick documented in STATE.md's process notes: temporarily shrink the
relevant constants, build, shoot, then restore and confirm with
`git diff --stat`.
