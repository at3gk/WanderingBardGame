# PLAYTEST.md — human playtest rounds

**Build:** https://at3gk.github.io/WanderingBardGame/
**How:** one 3–4 minute walk on a real phone with sound; answer inline or
relay verdicts in a session. The next run folds answers into code.

---

## Round 1 — 2026-07-25 (answered; folded in same session)

| Question | Verdict | Action taken |
| --- | --- | --- |
| Tap feel | **Window too loose** | `HIT_WINDOW_MS` 120 → 90 |
| Meter/pacing | **Refills too slowly** | `hitGain` 8 → 12 (~3.3 hits to walk, ~8.3 to full) |
| Audio | **Melody feels random** | All layers recomposed: 8-beat pentatonic phrases, one arch contour; village = major pent., forest = minor pent., riverside = open 4ths/5ths; harmony/sparkle = +1/+2 octaves |
| Visuals/mobile | **Walk/scroll mismatch; biome shifts weak; "need better bard animation, no background features, focus on art/sprite style"** | Walk + scroll now beat-derived (1 footfall/beat, 1 tile/footfall); palettes re-pitched (plum/green/blue). Art direction → ROADMAP tasks 30–32 |

## Round 2 — open

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
