# PLAYTEST.md — human playtest rounds

**Build:** https://at3gk.github.io/WanderingBardGame/
**How:** one 3–4 minute walk on a real phone with sound; answer inline or
relay verdicts in a session. The next run folds answers into code.

---

## If you only do one thing

**Round 4, first bullet: the fade pace.** It is the only question left that
the project genuinely cannot answer about itself, and it needs a child, not
an adult.

Everything else in the learning model is now checked mechanically — letters
fade with practice, come back when the child struggles, survive a reload,
survive a month away, and always arrive before the note reaches the line
(`node tools/verify-all.mjs`, ten checks). What no harness can judge is
whether the *rate* suits a five-year-old.

What to do: let a child play two or three separate sittings, a few minutes
each, on different days if you can — the fade is deliberately slow within
one sitting. Then answer one question: **were the letters disappearing
faster than they were ready for?**

- Too fast → lower `SESSION_GAIN_CAP` in `src/core/scaffold.ts` (currently
  12, meaning at most two support bands per sitting). That is the dial.
  Not the band thresholds, not the lead times.
- Too slow / never noticed → raise it, but only after checking they were
  actually getting letterless notes at all.
- Distress on a bare note → say so loudly. That would mean the premise is
  wrong and fading should be reverted, not tuned. See Round 4.

A one-line answer is enough. "Felt about right", "too fast by the third
go", or "she never got to a bare note" are all actionable.

---

## Round 1 — 2026-07-25 (answered; folded in same session)

| Question | Verdict | Action taken |
| --- | --- | --- |
| Tap feel | **Window too loose** | `HIT_WINDOW_MS` 120 → 90 |
| Meter/pacing | **Refills too slowly** | `hitGain` 8 → 12 (~3.3 hits to walk, ~8.3 to full) |
| Audio | **Melody feels random** | All layers recomposed: 8-beat pentatonic phrases, one arch contour; village = major pent., forest = minor pent., riverside = open 4ths/5ths; harmony/sparkle = +1/+2 octaves |
| Visuals/mobile | **Walk/scroll mismatch; biome shifts weak; "need better bard animation, no background features, focus on art/sprite style"** | Walk + scroll now beat-derived (1 footfall/beat, 1 tile/footfall); palettes re-pitched (plum/green/blue). Art direction → ROADMAP tasks 30–32 |

## Round 2 — open

Note (2026-07-26): several of these have since been answered *mechanically*
rather than by eye, and can be skipped unless something looks wrong —
scenery, notation legibility and the night sky are all baked into
deterministic sheets now (`tools/scenery-sheet.mjs`, `proofsheet.mjs`,
`ui-sheet.mjs`), and layout is checked across nine viewports down to 320px
(`pillar-check.mjs`). What remains genuinely subjective here is *feel*:
the hit window, the meter refill, whether the music is cozy, and whether
the walk reads as one motion.

### Re-judge the retuned values

- [ ] **Hit window at 90ms** — did tightening overshoot? On-beat taps
  should still land; clearly-off taps should miss.
  (`HIT_WINDOW_MS` — `src/scenes/RoadScene.ts`)
- [ ] **Meter refill at hitGain 12** — recovery now feels responsive, not
  trivial? (`src/core/songMeter.ts`)
- [ ] **Recomposed melodies** — do the 8-beat phrases now read as
  intentional, cozy music? Do the three biome moods (warm / darker /
  open-watery) come through? (`src/audio/manifest.ts`)
- [ ] **Beat-synced walk** — do legs, ground scroll, and music finally
  read as one motion? Footfalls land on the beat? (`src/scenes/RoadScene.ts`)
- [ ] **Stronger palettes** — do the plum → green → blue shifts now
  register as three distinct moods? (`src/core/biome.ts`)

### New since round 1 (overnight session, tasks 30–34)

- [ ] **Bard sprite & animation** — does the new bard (tunic, cap,
  feather, lute) read at phone size? Walk cycle natural, idle alive?
- [ ] **Scenery bands** — do village houses / forest trees / riverside
  camp read as places? Parallax depth visible while walking?
- [ ] **Notation UI** — eighth-note markers legible as beats on a small
  screen? Hit pulse satisfying? Miss dim gentle enough?
- [ ] **The player's note** — on each hit you now play the melody note
  yourself (+1 octave). Volume sit right on top of the loop
  (`pluck` gain = 1.6x base in `AudioEngine.ts`)? Does a good run feel
  like *performing* rather than just timing?
- [ ] **Night sky** — moon/stars read without stealing attention? Star
  drift too slow/fast? (`STAR_PARALLAX` — `src/scenes/RoadScene.ts`)
- [ ] **The road loops home** — walk past Riverside Camp (~156 steps in):
  does returning to the village feel like coming home or like a repeat?
- [ ] **Dusk cycle** — over a long walk (~13 min per full cycle), does
  the slow darkening read as night deepening, or go unnoticed / too
  dark? (`DUSK_CYCLE_PX`, `DUSK_MAX_DARKEN` — `src/core/dusk.ts`)
- [ ] **Strum on hit** — does the lute's kick-and-spring on every hit
  read as a strum, or too subtle/too sharp? (`BARD_STRUM_KICK_DEG`,
  `BARD_STRUM_MS` — `src/scenes/RoadScene.ts`)
- [ ] **Meter as staff** — do the five faint lines on the song-meter bar
  read as sheet music, or just clutter? Legible at phone size while
  walking? (`METER_STAFF_LINE_COLOR`/`_ALPHA` — `src/scenes/RoadScene.ts`)

## New since the last playtest (2026-07-26 overnight session)

Worth a glance while you are in there, though none of it is blocking:

- [ ] **Two more songs** — *This Old Man* now rotates in the village and
  *The Itsy Bitsy Spider* at the riverside, so a long walk plays four
  tunes per biome instead of three. Do they land as songs the child
  recognises? (Forest is still three — see STATE.md, *Blocked on human*.)
- [ ] **Audio/visual sync over a long sitting.** The audio clock used to
  be anchored once at the first tap, so the tune drifted away from the
  staff the longer you played; it is re-anchored every song now. On a
  ten-minute walk, does what you *hear* still line up with what you
  *see*? This is the one fix this session that a person can feel.
- [ ] **The moon** has craters now, rather than being a flat disc. Still
  reads as moonlight and not as a face?

## Round 4 — does the fading actually suit a real child? (v0.4)

The one question the game cannot answer about itself. Everything else about
the learning model is verified mechanically by `tools/learning-check.mjs`
(letters fade with practice, come back when struggling, persist across
sessions). What no harness can judge:

- [ ] **Pace.** After 2–3 sittings, do notes lose their letters faster than
  the child is ready for? The single dial is `SESSION_GAIN_CAP`
  (`src/core/scaffold.ts`, currently +12 = two bands per sitting) — *not*
  the band thresholds. Turn that down first if it's too fast.
- [ ] **Do they notice the letter arriving?** At the faded bands it appears
  350–950ms before the tap. Does the child's eye catch it, or is it lost
  because they're watching the hit line? If lost, the floor (350ms) is the
  dial to raise.
- [ ] **Does a bare note cause distress?** It must not. The tune is one
  they know, so the pitch should carry them. If a child freezes on a
  letterless note, the premise is wrong and fading should be reverted.
- [ ] **Does the pop read badly?** The letter appears by an instant
  texture swap rather than a fade (a deliberate trade — see STATE.md — it
  eliminated five rendering hazards). If it reads as a glitch rather than
  as the answer arriving, that trade needs revisiting.
- [ ] **The real prize, weeks later:** show them a note on paper. Do they
  name it? That, and only that, tells us whether any of this worked.

## Round 3 — test with a kid (v0.2 teaching goals)

The v0.2 direction is "teach kids typical musical notes" (DESIGN.md
Pedagogy). This round needs a child (~5–9), a phone with sound on, and
one instruction only: **"tap when the notes reach the line."** Observe,
don't coach.

- [ ] **Mechanic accessible** — are they tapping at roughly the right
  moments within the first minute?
- [ ] **Labels noticed** — after one village stretch (~2 min), point at
  an approaching note: "which one is that?" Do they answer with the
  letter?
- [ ] **Pitch-position link** — do they remark, unprompted or asked,
  that higher notes sit higher on the lines? ("why is that one up
  there?")
- [ ] **Melody lands** — can they hum a bit of the tune after a loop?
- [ ] **Transfer (the real win)** — afterwards, away from the screen,
  draw five lines on paper and put a dot in the bottom space: "what
  might this one be called?" *Any* reasonable attempt at a letter is a
  pass — this is exposure, not examination.
- [ ] **Letter legibility** — readable at their arm's length? (13px
  baked into `qnote-*` textures — `NOTE_LETTER_STYLE`,
  `src/scenes/RoadScene.ts`)
- [ ] **The pause reads as rest** — when the meter empties and the bard
  stops to busk, is it neutral/cozy for them, or do they read it as
  losing? (DESIGN.md's no-fail tone is the promise to check.)
- [ ] **Silent metronome** — does the hit line's per-beat brightening
  help them find the rhythm before they can read anything?

Fold answers into constants/patterns exactly like rounds 1–2.

### Round-1 items never explicitly answered

- [ ] **Viewport fill** — cold load, address bar visible: game fills
  exactly the visible area, no scrollable sliver? (tasks 27/29)
- [ ] **Gestures locked** — rapid same-spot taps never zoom or pop a
  text callout? (task 26)
- [ ] **Audio resume** — background the tab mid-walk, return: backing
  track audible again? (task 23)
- [ ] **Batch boundaries** — any audio dropout or marker pop-in at ~20s
  intervals? (would be a bug, not tuning — task 13)
- [ ] **Phase** — backing-loop notes land *on* the markers crossing the
  hit line? (Run 28 fix, first real-device confirmation)

---

## Still blocked on human (not playtest)

- **v0.1 tag** — must be pushed from a clone with real push access (both
  automation environments get HTTP 403 on tag refs):

  ```
  git tag -a v0.1 021410f -m "v0.1 ship — see DESIGN.md Definition of Done"
  git push origin v0.1
  ```
