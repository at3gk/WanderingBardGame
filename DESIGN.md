# DESIGN — Wandering Bard

## Concept

You are a bard walking an endless road. You don't stop to fight anything or
manage a stat sheet — you just keep playing. The road scrolls past at a
walking pace; you keep a single melody going by tapping a beat in time as it
arrives, and as long as you keep the tune alive, the bard keeps walking,
coins land in the case, and the scenery drifts from one cozy vignette to the
next (a sleepy village, a forest at dusk, a riverside camp). Miss too many
beats and the tune fades out — the bard stops walking and busks quietly in
place until you pick the rhythm back up. There is no game over. There is
only the walk.

**And the walk teaches you to read music.** (v0.2 direction, human-set,
2026-07-25.) The lane the notes travel down is a real treble staff. Every
marker is a real note sitting at its true pitch position, carrying its
letter name, sounding at its written pitch — and when you tap it, you play
it. A kid who plays this game is doing a motor task they already understand
(tap to the beat) while position ↔ letter ↔ sound quietly bind together in
the background. Nobody is quizzed. Nobody fails. They just walk the road
enough times, and one day the notes have names.

## The one core mechanic

**Single-lane rhythm tapping.** Beat markers scroll toward a hit line at a
steady, gentle tempo. Tap (or press a key) when a marker crosses the line.
Hits keep a "song meter" full; the bard walks forward and the procedural
backing track layers up. Misses drain the meter; below a threshold the bard
stops walking (but never fails permanently) until the player taps back into
rhythm. That's it — one input, one lane, one meter. No combos, no multipliers,
no difficulty select. The only depth is in the tempo/pattern variety fed to
the player as the road changes scenery, and in how good it feels to lock
into the beat.

Everything else in the game (scenery, coins, distance, unlockable
backdrops) is a *readout* of how well you're keeping the tune, not a
separate system competing for the player's attention.

## Pedagogy (v0.2 — "the road teaches the scale", 2026-07-25)

Audience: kids (~5–9) meeting written music for the first time — and
anyone else, because none of it gets in the way of just playing.

**Stance: exposure, never examination.** The mechanic stays exactly what
it was — one lane, one tap, timing only. The teaching is entirely in the
presentation: every note is simultaneously *seen* (its true position on a
real staff), *named* (its letter, baked into the note head), *heard* (the
backing loop plays the written pitch), and — on a hit — *played* (the
player's pluck sounds it an octave up). Multi-sensory, simultaneous,
repeated: that's paired-association learning, and the looping road is the
spaced repetition. There are no quizzes, no "name this note" prompts, no
wrong answers. This is how kids learn song lyrics — nobody tests them;
they just hear the song enough times.

**What v0.2 teaches, deliberately scoped:**

1. **The staff itself** — five lines, notes live on lines and in spaces,
   higher on the staff = higher pitch (the ear confirms what the eye sees,
   every beat).
2. **Letter names A–G, naturals only.** The whole game lives in C major /
   A minor: no sharps, no flats, no key signatures. Every melody note is a
   white key with a one-letter name.
3. **Middle C's ledger line** — the iconic first lesson of every beginner
   book, met as a real thing the low notes wear.
4. **Stem direction** (passive exposure only): notes at or above the
   middle line point their stems down, below point up. Never mentioned,
   always correct — the game's notation is simply never wrong.

**The curriculum is the biomes.** Each vignette's melody draws from a
different region of the staff, so a full loop of the road is a walking
tour of it:

- **Village Dusk** — first notes: C D E G A around middle C. Where every
  beginner starts; introduces the ledger line.
- **Forest Dusk** — climbing: G A C D E in the staff's upper half; stems
  flip down; higher position, audibly higher pitch.
- **Riverside Camp** — leaps: C D G A D across the whole range; reading
  bigger intervals at a glance.

The road loops (task 35), so the sets return in order, forever — natural
spaced repetition with zero menus.

**Considered and rejected:**

- *Color-coded note names* (Boomwhacker-style): breaks the art direction,
  and color knowledge doesn't transfer to real sheet music. Position and
  letter do.
- *Quiz/recall modes* ("which note is this?"): a second mechanic and a
  failure state — both against the pillars. Recognition-by-exposure is
  the whole bet.
- *Rhythm values* (half/whole notes needing holds): changes the input
  mechanic. Logged as a possible v0.3 arc, not v0.2.
- *Solfège (do-re-mi) labels*: worth considering later as a locale
  option; letters first, they're what beginner books here use.

## Tone

Cozy, unhurried, warm. Soft pixel-art silhouettes, a muted pastel palette
that shifts with time-of-day-per-biome, chiptune/procedural instrumentation
that sounds intentional even when generated. No fail states, no punishing
feedback (no harsh buzzers or red flashes) — a missed beat just lets a note
drop out of the tune, which is disappointing in a "the song lost its
harmony" way, not a "you lost" way. The game should feel like it wants you
to relax, not perform.

## Art direction (adopted 2026-07-25, tasks 30–32)

One rule: **the world is cool and quiet; warmth belongs to the bard and
the music.**

- The warm palette (tunic rust, coin gold, cream) is reserved for the
  bard, the musical notation, and anything lit by human warmth — village
  windows, the riverside campfire.
- Each biome's world is a cool dark-dusk palette (plum, green, blue):
  sky lightest, scenery silhouettes darkest, road band in between.
- Everything the player reads or touches is musical notation: beat
  markers are real quarter notes on a real staff (v0.2 — correct pitch
  position, letter in the head, stem direction right), the coin is
  stamped with a note, the mute toggle is a note. If a future element
  needs an icon, it comes from the same songbook. Because kids are now
  learning from it, the notation is never allowed to be *wrong* — cute
  is fine, incorrect is not.
- All art is Graphics-drawn procedural shapes — flat fills, soft
  silhouettes, tiny accent lights. No image assets, no outlines, no
  gradients (the one exception: a faint radial glow is allowed around
  literal light sources like the campfire).
- Feedback is gentle, per the Tone section: a hit makes the note pulse
  as if plucked; a miss just dims it to mauve. Nothing flashes red.

## What makes it distinct

Most rhythm games are about accuracy under pressure (many lanes, punishing
combos, fail-and-restart). Wandering Bard strips rhythm gameplay down to a
single, forgiving lane and reframes "performance" as "companionship" — you're
not scoring points, you're keeping a traveling companion's song alive as
they walk somewhere peaceful. The walk itself (procedurally sequenced
biomes/vignettes) is the progression system, driven entirely by the one
mechanic, with no menus, upgrades, or currency spend loop layered on top.

## Definition of done for v0.1

- Loads and is playable (first beat tappable) within 5 seconds on a cold
  load, no login/account.
- Single-lane rhythm mechanic implemented: beat spawn → scroll → hit
  window → hit/miss → song meter response, fully covered by headless
  Vitest tests (timing math, hit-window logic, meter drain/fill).
- Bard sprite walks/idles based on song-meter state; road background
  scrolls at a speed tied to walking state.
- At least 2 distinct scenery biomes that the road transitions between
  based on distance traveled.
- One procedural backing loop (Web Audio, generated or CC0 samples) that
  layers a new instrument/voice in as the song meter rises, and drops
  layers out as it falls.
- Touch input works on a real mobile viewport (tap anywhere = beat input),
  keyboard/mouse works on desktop.
- Bundle builds under 5 MB, deploys green to GitHub Pages via the existing
  CI/deploy workflow.
- No menus, no login, no save system required to reach "playable" — the
  game opens directly into the walk.

## Changelog

- 2026-07-15 — Run 0. Initial vision: single-lane rhythm-walking bard game.
  DESIGN.md and ROADMAP.md authored from the seed prompt.
- 2026-07-18 — Run 10 (consolidation pass). No vision drift found — the game
  still matches this document task-for-task (single lane, one meter, bard
  states, scrolling road, two biomes, layered audio). One noted gap: the
  Concept section's "endless road" framing isn't literally true yet — the
  beat schedule is a bounded 300-beat run (~3 min at 96 BPM) generated once
  at scene start, not regenerated. Doesn't violate the Definition of Done
  below (nothing there requires unbounded length), so left as-is rather
  than expanded into a new system this run; tracked in ROADMAP.md for
  after v0.1 ships.
- 2026-07-19 — Run 12 (v0.1 ship check). Every Definition of Done item
  below verified against a real production build; all met, nothing cut.
  v0.1 shipped. Next work (ROADMAP task 13, unbounded beat schedule) is
  post-v0.1 scope.
- 2026-07-19 — Run 14. Added the third scenery biome (Riverside Camp) named
  in the Concept section above but never implemented until now — the biome
  system was hardcoded to exactly two entries. Generalized it to support N
  biomes instead. ROADMAP task 14 (human playtest pass) was next in line
  but can't run without an actual human; logged as blocked and this run's
  slot went to the biome work instead (see STATE.md).
- 2026-07-21 — Run 20 (consolidation pass). No vision drift found — the
  game still matches this document task-for-task (single lane, one meter,
  bard states, scrolling road, three biomes, layered audio, coin readout,
  mute toggle), and a full read-through of every source file found no
  rough edges worth fixing in code. The only cleanup was documentation
  bloat in STATE.md (redundant "Previous status" write-ups duplicating its
  own "Recent runs" log, plus one chronological-ordering bug in that log)
  — see STATE.md. Nothing cut, nothing reprioritized.
- 2026-07-22 — Run 22. Added a "tap to the beat" onboarding hint, shown
  until the first input. Not a mechanic change — every readout this game
  has added so far (coins, distance, mute) assumes the player already
  knows to tap; nothing previously told a first-time player that at all.
  Fades out permanently after the first tap and never returns, so it stays
  out of the way of the "no menus" pillar.
- 2026-07-25 — Human playtest round 1 + overnight art session (tasks
  30–32). The playtest verdict was blunt and correct: the mechanic was
  tuned but the game *looked* like accumulated placeholders. Constants
  were retuned the same day (hit window, meter refill, recomposed
  melodies, beat-synced walk/scroll, stronger biome palettes), then the
  three art tasks executed: a real multi-part bard with a lute, per-biome
  scenery silhouettes, and one unified visual language. The new "Art
  direction" section above codifies it so future runs extend the style
  instead of re-inventing it. Tone section's "soft pixel-art" phrasing
  now reads as "soft procedural shapes" in practice — same intent,
  honest wording for what the game actually is.
- 2026-07-25 (later the same night) — tasks 33–37. Two Concept/Tone
  promises finally became true: the endless road now literally loops
  (village → forest → riverside → village forever, task 35) and the
  palette shifts with time of day (slow dusk cycle, task 36 — world
  darkens, stars and moon brighten, the bard is never darkened). The
  mechanic also gained its own sound: a hit plays that beat's melody
  note an octave up (task 33), so a good run is the player performing
  the tune's top voice — misses still just drop a note out, silent.
  Night sky added (task 34). Consolidation (task 37) found no drift:
  everything remains a readout of the one mechanic. The game as shipped
  tonight is, for the first time, the game this document described on
  Run 0.
- 2026-07-25 (second overnight session) — **v0.2 direction, set by the
  human: teach kids to read music.** New Pedagogy section above; Concept
  extended. The insight that makes this a deepening rather than a pivot:
  the lane already scrolls notes toward a line in time — that IS a
  staff. v0.2 makes it a real one: treble staff lines in the lane,
  markers become true quarter notes at their real pitch positions with
  letter names in their heads and correct stem directions, melodies
  re-voiced to C major (root moves A3 → C4, naturals only) so every
  note a kid meets is nameable, middle C wears its ledger line. The
  mechanic, pillars, tone, and no-fail stance are all unchanged — the
  teaching is pure presentation, and the biome loop is the spaced
  repetition. Rejected on the way: color-coded notes (doesn't transfer
  to real reading), quiz modes (a second mechanic and a failure state),
  rhythm values (v0.3 candidate, changes the input).
