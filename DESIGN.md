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

**Stance: retrieval without examination.** The mechanic stays exactly what
it was — one lane, one tap, timing only. Every note is simultaneously
*seen* (its true position on a real staff), *named* (its letter, in the
note head), *heard* (the backing loop plays the written pitch), and — on a
hit — *played* (the player's pluck sounds it an octave up).

But exposure alone is not learning, and this is the correction that
defines v0.4. A letter printed in every note head *forever* is a crutch: a
child can read the letters fluently and never once encode the position, so
the position→name association is never retrieved and never consolidates.
**So the letter is a scaffold, and scaffolds have to fade.**

It fades in **time**, not in opacity. As a staff position becomes
familiar, its letter arrives later and later in the note's 1800ms flight —
present from spawn, then 1350ms before the line, then 900, 450, and
finally not before the tap at all. A half-transparent letter would still
be perfectly readable and would teach nothing; a letter that arrives 900ms
late buys 900ms of genuine attempted recall. That silent naming, followed
by the letter surfacing, is a retrieval-and-confirm loop — the testing
effect, without ever externalising an answer the game could mark wrong.

The safety rule that makes it humane, and which must never be traded away:

> **Fade the prompt, never the answer.**

Every letter surfaces *before* its note reaches the line — even at full
fade, the lead floor (350ms) is comfortably wider than the hit window
(±90ms). So the answer always lands on a bright, upright note the child is
still about to play, and missing costs exactly what it cost before — a
dimmed note and a little meter — never information.

This is stronger than the reveal-on-strike and reveal-on-miss handlers the
code also carries, and it is what actually runs: instrumenting a real
90-second walk found 86 letters revealed, every one of them on the
scheduled mid-flight path, none from a strike or a miss
(`tools/reveal-check.mjs`). The handlers are unreachable backstops. That
matters because the weaker version is a trap — a letter that only appears
*after* a miss appears on a note that is already dimmed, already scrolling
away and already fading out, visible for about 400ms at declining opacity.
The relationship between the two constants is therefore a tested contract
(`scaffold.test.ts`, "the answer always beats the tap"), not a coincidence:
tightening the fade to make the game harder must not quietly downgrade the
promise.

**Songs they already know are what make this safe.** If a child knows how
*Twinkle* goes, the pitch is free even when the letter is gone; they are
never stuck, never anxious, and never unable to play. That frees the whole
note's flight for the one genuinely new thing on screen: the symbol at its
position. Fading like this would be reckless with generated melodies. It
is only defensible because the songbook is nine tunes a child can already
sing.

**What the game can and cannot know.** A tap proves *timing*, not reading —
it is confounded by melodic memory, by repeated phrases, and by the fact
that steady tapping hits most quarter notes anyway. So the fade is a
**dosage schedule driven by exposure**, not an assessment, and the model
never claims to measure what a child knows. The one inference it trusts is
asymmetric: an isolated miss during otherwise-good play means that note
just asked too much, so help returns. Quick to help, slow to withdraw. The
honest limit: this game can teach note names to a child who attends; it
cannot make a child attend.

Still true, and still non-negotiable: no quizzes, no "name this note"
prompts, no wrong answers, no score, and nothing about the model is ever
displayed. The only visible sign of progress is the staff quietly starting
to look like real sheet music.

**What v0.2 teaches, deliberately scoped:**

1. **The staff itself** — five lines, notes live on lines and in spaces,
   higher on the staff = higher pitch (the ear confirms what the eye sees,
   every beat).
2. **Letter names A–G, naturals only.** The whole game lives in C major /
   A minor: no sharps, no flats, no key signatures. Every melody note is a
   white key with a one-letter name. Where a tune is transposed to sit in a
   different part of the staff, the transposition is chosen so that the
   melody still needs no accidental — Twinkle and London Bridge centre on G
   but never touch F, and Old MacDonald centres on F but never touches B,
   so no key signature is required and none is written. A transposition
   that *would* need one is not allowed in; the songbook tests enforce it.
2b. **Note values** (v0.3): eighth, quarter, dotted quarter, half, whole —
   drawn correctly (filled vs hollow heads, stems, flags, augmentation
   dots) and felt as the time until the next note.
2c. **Rests** (v0.3): a written silence is a symbol, not an empty gap. A
   rest scrolls down the staff like anything else, but nothing sounds and
   nothing is tapped — which is exactly what it means. *Hot Cross Buns*
   carries the first one, a beat of breath at the end of each phrase.
3. **Middle C's ledger line** — the iconic first lesson of every beginner
   book, met as a real thing the low notes wear.
4. **Stem direction** (passive exposure only): notes at or above the
   middle line point their stems down, below point up. Never mentioned,
   always correct — the game's notation is simply never wrong.

**The curriculum is the songbook.** (v0.3, 2026-07-25 — this replaced
generated note patterns, which taught positions but were nothing anyone
could hum.) Each vignette plays a real, public-domain tune a child is
likely to already know, and the three are ordered so the walk is at once a
tour of real music and an ascending tour of the staff:

- **Village Dusk** — *Mary Had a Little Lamb*, C major (C4–G4). Five
  notes, the simplest tune there is, sitting around middle C so the
  ledger line is met in the first bar.
- **Forest Dusk** — *Twinkle Twinkle Little Star*, G major (G4–E5).
  Longer, wider, mid-staff; stems begin to flip.
- **Riverside Camp** — *Ode to Joy*, C major up an octave (C5–G5).
  Stepwise motion across the upper staff, and the only tune with a dotted
  rhythm — the advanced vignette.

Recognition is the point: a child who already knows how *Twinkle* goes has
something to attach the symbols to, which a generated phrase can never
offer. The road loops (task 35), so the songs return in order, forever —
spaced repetition with zero menus.

**Note values, without changing the input.** Real songs need quarter, half
and whole notes, and drawing them correctly is half of learning to read. A
half note is *not* held down — it simply takes twice as long to arrive, so
its length is felt in the waiting rather than in the finger. One tap per
note, always. That keeps the one core mechanic exactly as it was while
adding the second axis of notation for free.

**Considered and rejected:**

- *Color-coded note names* (Boomwhacker-style): breaks the art direction,
  and color knowledge doesn't transfer to real sheet music. Position and
  letter do.
- *Quiz/recall modes* ("which note is this?"): a second mechanic and a
  failure state — both against the pillars. Covert retrieval plus an
  unconditional reveal (see Stance) recovers most of the testing effect
  without ever externalising an answer, which is the whole trick: the game
  cannot evaluate the child, therefore it cannot fail the child.
- *Fading the letter by opacity* rather than by time: a 40%-alpha letter is
  still legible, so it produces no retrieval at all — just a uglier game
  that teaches exactly as much.
- *Treating a hit on a letterless note as proof of reading*, and driving
  the fade off a mastery estimate: the inference is invalid (melodic memory
  and steady tapping both produce hits), and building on it would
  confidently strip help from a child who never looked at a letter.
- *Showing progress* — a "notes you know" collection, badges, a lit-up
  staff: the obvious motivator, and exactly what would convert companionship
  into performance, create a score, and make every restoration of help
  legible as a loss.
- *Rhythm values as held taps*: a hold would change the one input.
  Superseded in v0.3 by writing note values as *spacing* instead — same
  teaching, same single tap (see "Note values" above).
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
- 2026-07-26 (third overnight session) — **v0.3: the songbook.** The
  melody stopped being generated and became *music*: Mary Had a Little
  Lamb, Twinkle Twinkle Little Star and Ode to Joy, one per biome, with
  real note values. A generated phrase could teach where E sits on the
  staff, but a child cannot hum it back, and humming it back is what
  makes the symbols stick. Note values arrived without touching the one
  input, by writing length as spacing. Architecturally this also
  *removed* machinery: markers and audio are now built from one list of
  song notes, so the staff and the sound cannot disagree, and the old
  per-biome pattern plumbing and its batch-quantization caveat are gone.
  The session also built `tools/` — a headless harness that plays the
  game by itself and verifies the pitches it hears — so future runs can
  check their own work instead of queuing questions for a human.
- 2026-07-26 (fourth overnight session) — **hardening, not new design.**
  No pillar, mechanic or tone changed. Two songs joined the book (*This
  Old Man*, *The Itsy Bitsy Spider*, both verified against published
  sources) and one real defect was fixed: the audio clock was anchored
  once when play began, so over a long sitting the tune drifted away from
  the staff — it is re-anchored every song now. The rest of the session
  went into being able to *trust* what this document claims.
  Two claims turned out to be wrong. "Fade the prompt, never the answer"
  was credited here to the reveal-on-strike and reveal-on-miss handlers;
  measurement showed those can never fire, because the 350ms reveal floor
  always beats the 90ms hit window. The real guarantee is stronger, and
  the Pedagogy section above now says so, with a test pinning the two
  constants together. And the design pillars — "playable in under five
  seconds", "mobile-friendly" — had never been measured at all; they now
  are, across six viewports.
  Rejected this session, with reasons: a fourth **forest** song
  (*Mulberry Bush* is chosen and fits, but no transcription could be
  verified note-for-note without network access, and the forest *This Old
  Man* draft was already rejected for matching the real tune in 6 of 32
  notes — a wrong contour actively mis-teaches a child who knows the
  song); *Wheels on the Bus* (attributed 1939, fails the CC0-only rule);
  and a browser-side audio-sync assertion (five attempts, five different
  answers, the instrument wrong every time — the unit tests carry it
  instead).
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
