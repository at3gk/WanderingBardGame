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

## Two ways in (v0.5, human-set, 2026-07-26)

The road above is still the game. But the human set two directions on
2026-07-26 — *"we need to be able to choose a single song to learn rather
than having songs rotate"*, and *"if there's another idea besides the
walking bard as a way to learn, go for it"* — and both are now built.

**Choose a song.** Rotation is right for a long walk and wrong for learning
a piece: repetition is the entire mechanism by which the letters come off a
note. A songbook button pins one tune, and the road settles in that tune's
home biome, because the three biomes *are* the three registers and letting
the scenery wander would have the world disagree with what the child is
reading. "Wander" gives the rotation back.

**Free play, and practice.** The walk hands you notes and asks for timing.
This document has always been honest that a tap proves timing rather than
reading — knowing how the tune goes tells you when to tap whatever is
written. So the second way in is the inverse: the staff spread out big and
still, every position labelled, nothing scrolling, nothing that can be
missed. You point at a line or a space and hear what it is.

With a song chosen it becomes **practice**: that tune as a list of positions
to find, a pip marking the next one, and a wrong note that sounds and costs
nothing. This is the only place in the game where *reading the staff* —
rather than remembering the melody — is what moves you forward, and it is
therefore the only place that closes the gap the Pedagogy section admits to
below.

Two rules hold across both. Free play never feeds the learning model: a note
the child picked is not evidence they can read one the game picked, and
fading letters on the strength of poking about would corrupt the only signal
the scaffold has. And finishing a tune gets a chime and a ripple, not a
score — the no-fail stance cuts both ways, and a game that celebrates loudly
has started grading quietly.

## The road in three dimensions (v0.6, human-set, 2026-07-28)

A human set a new direction on 2026-07-28: build the wandering road as a
low-poly 3D world with painterly, storybook stylisation — *A Short Hike*'s
readability with *Spiritfarer*'s warmth — in Three.js, browser-first. Along
with it came the scope that road should carry: a procedural **daily road**
shared by every player, **busking** as the performance mechanic, **instrument
unlocks** with distinct voices and identities, **variable-reward encounters**,
**idle busking**, and a **campfire** as the day's anchor.

This is the largest change the project has taken, and it is worth being
precise about what it does and does not throw away.

**What is kept.** The whole brain. `beats`, `song`, `songs`, `songMeter`,
`notation`, `scaffold`, `biome`, `coins`, `distance` are pure TypeScript with
no rendering in them, and they carry forty runs of tuning and 279 tests. They
are the reason this is a rebuild of the *presentation* rather than a new
game. The no-fail stance, the no-grading stance, the retrieval-without-
examination pedagogy, and the rule that the notation is never allowed to be
musically wrong all survive intact and still constrain everything below.

**What is replaced.** Phaser, and every 2D drawing routine that depended on
it. A parallax stack of five planes is the correct answer to "how do you
suggest depth in 2D" and the wrong answer to "how do you build a world you
walk through".

**What changes about the mechanic.** The single lane becomes a single lane
*in the world*: notes travel toward the bard along the road rather than down
a screen. The input is unchanged — one tap, no combos, no difficulty select —
and the windows get **wider**, not narrower, because "rhythm-lite" is the
brief and because a forgiving window is what lets a player look at the
scenery. Missing is still free.

**The one thing that must not drift.** The walk is the game. Encounters,
instruments, idle progress and the campfire are all *readouts of the walk*,
in exactly the way scenery and coins were readouts of the tune in v0.1. The
moment any of them becomes a system the player manages instead of a thing
that happens to them, this document has been broken.

### Art direction, restated for 3D

The v0.2 rule — *the world is cool and quiet; warmth belongs to the bard and
the music* — was written for flat fills on a dusk-coloured 2D road, and it
does not survive contact with a sun. It is replaced, not deleted; the intent
behind it (warmth is earned, not ambient) carries forward as the rule that
**the warmest light in any frame comes from the music or the fire**.

The standing rules for the 3D world:

- **One lighting model, no exceptions.** Every solid surface runs the same
  painterly shader. The fastest way to make low-poly 3D read as an asset pile
  rather than an illustration is to let two objects be lit by different rules.
- **Shadows are coloured, never grey.** Unlit faces take a cool tint from the
  sky and a warm bounce from the ground. This single substitution is most of
  the difference between "flat" and "painted", and it is what makes dusk work.
- **Silhouette before detail.** Readability at a glance beats polygon count
  everywhere. A fresnel rim in the sky's colour separates shapes from the
  background; there is no outline pass, because outlines read as comic-book
  rather than painting and cost a phone a full-screen pass.
- **The sky is the light source.** Sky, horizon, sun, fog and bounce are one
  palette moved by one call. Nothing in the world is allowed to pick its own
  light colour.
- **Texture comes from noise in world space, not from image maps.** Assets
  stay procedural (the CC0-or-procedural rule is unchanged, and it is also
  what keeps the bundle a fraction of the 5 MB pillar).
- **Cream is still the notation's**, and the furniture still may not borrow
  it. That rule was a real hierarchy failure once and it is not repealed by
  a change of renderer.
- **Nothing flashes, nothing shakes.** Feedback is gentle: a hit blooms, a
  miss softens. There is nothing in this game that should shake a camera.

### Definition of done for v0.6

- Opens directly into the walk, playable within 5 seconds, no login, no menu.
- The road is procedurally generated from the UTC day and is *provably* the
  same for every player on that day, covered by tests.
- Busking works end to end: approach a spot, perform with rhythm-lite input,
  earn coins and delight, leave. No fail state anywhere.
- At least six instruments, each audibly and visibly distinct, unlocking on a
  pacing that is generous rather than grindy.
- Encounters along the road with a reward distribution that is mostly small
  and occasionally lovely.
- Idle busking accrues while away, tapers honestly, caps, and never punishes.
- A campfire rest scene anchors the end of the day.
- Time of day advances with distance, not wall clock, so the light is
  narratively meaningful.
- Runs smoothly in a browser on a mid-range phone; bundle well under 5 MB.
- `npm test` and `npm run build` green; deploys via the existing CI.

## The walk is played, not watched (v0.8, human-set, 2026-07-31)

A human watched the 3D game live and set the next direction with three
observations and two goals. The observations: during the walk there are no
notes anywhere (they exist only at busk stops), the walk's audio is
literally filtered noise (the adaptive music only exists while busking),
and the riverside has no river. The goals: *"the goal should be being
active to be able to move, and other side quest things as you're moving"*,
and *"a game where kids/users can learn the songs they want"*.

This is not a new mechanic — it is v0.1's core mechanic restored in 3D.
v0.6 quietly made walking automatic and inputless, which DESIGN.md's own
"one core mechanic" section never sanctioned. The corrections:

1. **The walk carries the tune.** Notes scroll along the songboard *during
   the walk*, not only at busk stops. Tapping in time keeps the tune alive;
   the tune keeps the bard walking. Stop playing and the bard slows to a
   stop and noodles quietly in place — no fail, no punishment, walking
   resumes the moment the rhythm does. Busk stops remain as denser social
   moments (audience, coins, delight), not as the only place music exists.
2. **The bard is always playing.** Walking music = the player's melody on
   the current instrument plus the adaptive layers, with ambience mixed
   *underneath* as air, never as the foreground. A game about a bard in
   which the default soundscape is noise is broken by definition.
3. **Choose the song you're learning.** The songbook choice (v0.5) comes to
   the 3D game: a diegetic song pick pins the tune the road plays, because
   repetition is how the letters come off the note. Wander gives rotation
   back. Same rules as v0.5: free choice never feeds the learning model.
4. **The riverside has a river.** Real water in the world, not just rut
   puddles.
5. **Encounters are small side quests.** Travellers and moments along the
   road can ask something tiny of the player and pay off in delight —
   optional, missable, never gating the walk.

Three more, set later the same day watching the build:

6. **The notes come at you.** *"I kind of like the idea of the notes coming
   at you from the front and you have to hit it when it reaches the bard."*
   This is what the v0.6 section above already promised ("notes travel
   toward the bard along the road rather than down a screen") before the
   implementation settled on a roadside board. The staff becomes a lane in
   the world: a receding ribbon over the road carrying real notation toward
   a barline at the bard. The pedagogy is untouched — positions, letters,
   pitch height and note values all survive; only the geometry of arrival
   changes.
7. **You can see events coming.** A stop should announce itself down the
   road before you reach it — a lit signpost, listeners already gathered at
   a busk spot, campfire smoke on the evening sky — so walking toward
   something is anticipation, not surprise.
8. **Stakes, not failure.** The human floated *"perhaps the ability to
   fail."* Resolved as: *moments* can be failed — a side quest can be
   missed, a crowd can drift away from a poorly-kept busk, an opportunity
   can pass — but the walk itself never fails and nothing is ever taken
   away. This keeps real consequence (what you play determines what the
   road gives you) without reintroducing the anxiety the pedagogy section
   forbids: a child can lose a chance, never progress.

## The true goal (v1.0 direction, human-set, 2026-07-31, grilled to shared understanding)

Shaped in a one-question-at-a-time session with the human; each decision
below was explicitly confirmed.

**Who it is for.** The household — a parent who plays it like A Short
Hike and a child (5-9) it gets handed to, on the same walk. When a
feature helps the adult but confuses the child, **the child wins the
tie-break**. The pedagogy is the defensible identity; the premium cozy
craft is what makes the adult respect it enough to hand it over.

**The destination.** The bard is walking to the **Festival of the Long
Road** — 12-15 legs (campfires) away — where they perform the songs the
player actually carried. The arc is measured in **walked days, not
calendar days** (hybrid pacing): the first leg on any calendar day is
the shared daily road everyone walks; walking on past the campfire opens
a **moonlit road** (seeded day+leg, deterministic, just not communal).
The campfire's craft makes stopping feel complete; nothing gates an
eager Saturday.

**The end goal is playing without the notes.** The mastery ladder —
*learning it → know it → by heart* — runs on two surfaces: on the road,
a well-known song's note heads fade to ghosts and then to a clean staff,
kept alive from memory (rhythm recall), with a stumble gently bringing
the notes back (quick to help, slow to withdraw, one level up); in
practice, *by heart* means unguided pitch-finding — playing the melody
by choosing positions yourself. At **each campfire the player may
attempt the song they carried without the notes** — rehearsal for the
festival, no-fail, journalled warmly. The festival is performed from the
by-heart book. "By heart" is a *song's state, not a child's score*: the
page's ink quietly stops being needed; no badge, no fraction, ever.

**Musical accuracy is inviolable.** E sounds exactly like E; if the game
ever writes C-sharp it sounds exactly C-sharp (equal temperament,
verified to the cent by the harness); engraving is never wrong; register
shifts are octave-only so the letter is always the pitch class heard.

**Book Three: the songs you bring** (idea-stage, human-set 2026-08-01).
After the festival, families will be able to add their own songs — made
in practice mode (tap a tune onto the staff, name it, walk with it) or
imported from MIDI/MusicXML, locally only, validated through the same
engraving tests as the shipped songbook. The pedagogy's safety argument
(fading is safe because the child already knows the tune) is best
satisfied by a song the family chose. Audio transcription is rejected on
principle: it mis-transcribes often enough to mis-teach, and the
notation is never allowed to be wrong. ROADMAP v1.3 carries the tasks.

**After the festival, the choice** (autonomy is the design): an
invitation to **Book Two** that *shows what it would teach* — real key
signatures and accidentals, correctly engraved and exactly sounded — or
freely revisiting any Book One song, choosing songs at will, or simply
walking on. Book One stays naturals-only C-major; growth is a new
volume, not a breaking change.

**The first five minutes' promise, sequenced:** minute one is the tune
working under your fingers (no front-loading, straight into the walk);
the **first campfire** (~8-10 minutes in) is where the journal opens,
the festival is named, tomorrow's road glows on the horizon, and
rehearsal is introduced. Stated success metric: a new household reaches
the first campfire in one sitting, sees the festival named, and wants
tomorrow's road.

**A small title card** (evolving pillar 1, not breaking it): returning
players get one warm card — "Continue the journey" (default, one tap)
and "The songbook" (pick a song to learn again). A brand-new player has
nothing to choose and goes straight to the road; playable-in-5-seconds
holds either way.

## The road home (v0.9 direction, human-set, 2026-07-31)

The human asked for the game to become one "users want to come back to,"
grounded in research rather than instinct, and for that research to stay a
living part of the project (CLAUDE.md pillar 5). The founding note is
`docs/research/retention-design.md` — primary-sourced (Wordle, Animal
Crossing's real-time design, Sky's returning spirits, Duolingo's own
streak research and its critics, self-determination theory, the Project
Horseshoe coziness report) and ranked against this game's constraints.
Read it before building anything that touches returning-player behaviour.

The stance it supports: **the return must be a ritual the player is glad
they kept, never a hook they resent.** Anticipation is the kind version of
the appointment; absence becomes story, never debt. Concretely, the queued
work (ROADMAP v0.9): the campfire closes today's page and shows
tomorrow's road on the horizon (the seed is knowable — render the
silhouette); the sharedness of the daily road becomes visible (roads get
names; an optional campfire postcard shares presence, never performance —
Wordle's exact rule); songbook pages wear in with care (keyed to diary
facts only — the learning model stays invisible, a page that got prettier
as letters faded would be a grade in costume); encounters leave mementos,
not checklists (no counts, no empty slots, missed rarities recur — Sky's
stance); returning gets a welcome-back beat while absence costs nothing;
and one device can hold two bookmarks, because for an audience of
five-to-nines the retention target is the household.

**Rejected on principle** (binding, from the research's own list): streak
counters of any kind including "kind" ones, daily login rewards and
appointment decay, one-time-only content, near-miss staging on rares, any
visible fraction or "mastered" state on learning content, accuracy
comparison in sharing, re-engagement nags, and idle earnings that decay.
These retain players in the literature; they are what "addicting" is NOT
licensed to mean here.

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

## Art direction, 2D era (adopted 2026-07-25, tasks 30–32; superseded for the world by v0.6 above, and kept because its notation and hierarchy rules still bind)

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
- **Cream is the notation's, and nothing else's** (2026-07-27). Note
  heads, letters, staff lines and the clef own `0xe8d9c0`. Anything else
  that needs to be bright takes gold — the coin, the lit windows, the
  bard's buckle, the song meter. This started as a real hierarchy
  failure: once the meter got a full-width row of its own it became the
  largest and brightest thing on screen, in exactly the colour a child is
  meant to be reading. Whatever the teaching surface uses, the furniture
  cannot borrow.
- **The world has five planes, and one of them is in front of the road**
  (2026-07-27): stars 0.08, far ridge 0.19, scenery 0.45, road 1.0, near
  verge 1.35. Until the fifth existed nothing moved faster than the
  surface the bard walks on, and below the road there was nothing at all —
  the camera's background colour, which is the sky. A road has to be lying
  on something.
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

- 2026-09-03 (runs 136-144, consolidated at 145) — **the hue-band
  investigation, and two harness lessons worth more than the fix it
  didn't land.** Task 189 (v1.1's "hue-free distance wall" lead) ran three
  measurement pieces without ever landing a shader change: piece 1 found
  and fixed a real bug on the way in (`land-histogram.mjs`'s sky mask had
  been silently broken since run 95's finishing-pass grade, reading
  land-and-sky together on every measurement since); piece 2 found a clean
  correlation (far-band hue spread tracks `landKey.ts`'s pull amount) and
  proposed a mechanism; piece 3's toggle test refuted that mechanism
  outright — the gap grew, not collapsed, with the key forced off. Task
  143 shipped alongside it: the road's shoulder now commits to meadow in
  its final 0.4 m instead of dissolving across the whole band. Both
  lessons — audit every offline pixel-reading tool when a post-process
  pass ships, and a real correlation still needs its own direct test
  before the mechanism built on it is trusted — are now recorded in
  `docs/research/art-quality.md`'s "Findings from shipped work" section.
  Drift check clean: every run in the block was measurement, a tooling
  fix, or a small verified-live terrain fix on the existing world; no new
  systems, bundle 902 KB of 5 MB. STATE trimmed: the individual handoffs
  for runs 134 and 136-143 compressed to a run index (ROADMAP's numbered
  done-entries carry the full accounts) — this file's "At a glance"
  section 4227 → 3858 lines. NOTHING CUT.

- 2026-08-30 (runs 121-134, consolidated at 135) — **the v0.9 arc closes
  for good, and the art loop turns to characters and shapes.** Task 157
  (two device bookmarks, zero-migration) shipped across three pieces,
  closing the v0.9 "road home" retention queue entirely — all seven of
  its ranked recommendations are now shipped or standing design. The rest
  of the block was the wave 18/19 art-quality loop: two more creatures
  (fox, cat, escort dog — 186 pieces 2-3), a settled scrim ruling
  (HUD wash contrast now scales with the sky's own luma instead of being
  a per-wave argument), canopy asymmetry (the true fix for "clone-stamped
  foliage," after tree *placement* was measured innocent), a listening
  posture that finally reads at silhouette level (after two waves of
  "mannequin audience" turned out to be a real posture invisible at
  render distance, not staging), and a first piece of rock shape
  vocabulary (three archetypes replacing one re-jittered lozenge). Three
  panel-named complaints were individually measured and REFUTED before
  any code changed — see the new finding in `docs/research/art-quality.md`
  for the pattern. Drift check clean: every run was a readout, a
  retention arc closing, or rendering/posing fidelity on the existing
  world; no new systems, bundle 902 KB of 5 MB. NOTHING CUT.

- 2026-08-07 (runs 105-120, consolidated at 120) — **the hour reaches
  the ground, and the picture starts agreeing with the prose.** The
  colour arc that wave 13 licensed ran to its honest end: the land key
  became a true chroma rotation (it was measurably desaturating what it
  bound), the committed hours got real grip, the dawn handover trough
  closed, the road and the flowers took their hours, and the low-sun
  value floor finally enacted what three independent measurements
  (dusk-stripe partition, a blind panel's "midtones scooped", the NPC
  "navy voids" refutation) had converged on. Five same-rubric panels
  (13-17) read flat at 4.3-4.45 overall — but the engine lenses now sit
  at 5+ and the deficit moved to design: characters, silhouette
  vocabulary, HUD scrim. The first design answer shipped the same day:
  the deer (task 186) — encounters now stage what their captions
  describe, and stand NOTHING rather than a wrong understudy. Drift
  check clean: every run was a readout of the one mechanic, no new
  systems, bundle 905 KB of 5 MB. Nothing cut.

- 2026-08-05 (overnight loop session, runs ~51-61) — **the v1.0 arc
  closes and Book Two opens.** Six tasks across ten PRs: the moonlit
  walk-on (159 complete — tonight's page gained its one door row and
  the game's first mid-session road rebuild; a leg opens at dusk where
  the evening stood, so the sky needs no seam); task 182 resolved as a
  gauge artifact (the "red noon gate" was the daily road rolling dice —
  frame-quality now measures a pinned road, and the true finding, that
  village noons are the flattest family the game draws, became a gated
  noon-village pose); task 165 complete in five pieces (key-signature
  notation core with carried-vs-shown accidentals, Song.key +
  pickupBeats anacrusis, the signature engraved on the paper's
  extended tail with spelt head steps, My Bonnie Lies Over the Ocean
  from a two-source verified transcription, and the songbook's Book
  Two shelf unlocked at festivals >= 1 — which also fixed the
  pre-existing fold fault by making the book PAGE, so every song is
  reachable on every viewport for the first time); task 60 unblocked
  after a month (Mulberry Bush, the fourth forest song, the book's
  first 6/8 tune — the July entry's prediction held exactly); task 170
  (deterministic baked vertex AO on props and the bard's hat/cloak/
  lute); task 174 (quality tiers that detect on WebKit via OS-major/
  masquerade signals; 'low' finally means no shadow map). Drift check
  clean: every addition is a readout, a pedagogy surface, or rendering
  on the one tap mechanic; no new runtime dependencies; bundle 873 kB
  of the 5 MB budget. Standing law reinforced twice more: a failing
  check is a claim about the check first (182), and a task's
  prescribed fix can be refuted by the code's own record (174's "GPU
  signals"). NOTHING CUT.

- 2026-07-31 (second interactive session, wave 2) — **v0.8 items 6-8 set
  and largely built.** The human, watching the live build: notes should
  come at you from the front and be hit at the bard (built — the songboard
  plank is gone, replaced by a receding parchment ribbon); events should
  announce themselves down the road (built — banner-pole busk pitches,
  wayside cairns, campfire smoke visible from 380 m); "perhaps the ability
  to fail" (resolved as stakes-not-failure, new item 8 — failable moments,
  never a failing walk; queued as ROADMAP task 142). Also this wave: the
  light pass (fog carries hue through ACES now; golden-hour shadows are
  cool; shadow smudges have edges), per-mood camera framings, and the
  walking meter retuned so casual timing holds the walk (miss drain 14 →
  6 on the road only — the busk keeps the human-playtested original).
  Blind re-critique vs the reference games: mean 4.3 → 5.4, best frames
  at 6.75; verdict "one focused wave below shippable." NOTHING CUT.

- 2026-07-31 (second interactive session the same day) — **v0.8, the walk is
  played, not watched** (human-set, watching the live game). New section above.
  Four parallel builds landed in one wave: the walk carries the tune (notes
  during walking, meter-gated stride, song pinning in the HUD — restoring
  v0.1's core mechanic in 3D); walking music exists (adaptive arrangement in a
  sparser walking mode, ambience hard-capped under the music bus, per-partial
  instrument envelopes); the riverside has a river (carved channel, level
  water, banked reeds, deterministic per daily seed); and the figures became
  people (faces, a readable bowled lute, a real strum, listeners that face the
  performance). Two load-bearing rendering bugs found on the way, recorded in
  STATE.md: the foliage material's flatShading was discarding every blade
  normal (the entire "dark shard litter" critique), and the hat brim's dip had
  an inverted sign (why the head vanished from behind).
  NOTHING WAS CUT. The busk remains the social crescendo; vistas still rest
  the tune.

- 2026-07-31 — Twelve interactive critique waves (human-directed, not
  scheduled runs). No vision change: the game is still the v0.6 concept, the
  core mechanic is untouched, and nothing was cut from the Definition of Done.
  What changed is entirely execution — the road corridor stopped grading flat
  the ground the camera looks at, the shader gained a foreground value tier
  where it had no depth term inside 40 m, the songboard moved off the
  vanishing point, the seated pose and the held lute were fixed, and pitch
  contrast was put on a floor that holds at every hour.
  ONE DESIGN RULE WAS DELIBERATELY OVERTURNED, and it is recorded here because
  it contradicts the art-direction section below: "nothing on the ground comes
  within a stop of the sky" is struck. It was a rule about ALBEDO written as
  though it were a rule about rendered value. A sky is bright because it is a
  large dim emitter; the sun is a small ferocious one, and sunlit grass at
  0.22 albedo sits near 7000 cd/m^2 against a clear sky around 5000 — a
  sunlit field is level with the sky it stands under, and what makes a
  photograph of one read front-to-back is that the SHADOWS are three stops
  down. The replacement rule is about spread, not ceiling: the ground's dark
  end stays, its pale end may come within half a stop of the sky. The full
  argument and its measurements are in `src/three/world/palette.ts`.
  NOTHING WAS CUT. The clef on the songboard remains unbuilt and is now
  understood to be blocked on placement rather than merely unchosen (both ends
  of the staff are at their arithmetic floor); that was already true before
  this session.

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
- 2026-07-26 (fifth session, human-directed) — **v0.5: two ways in.** The
  first genuinely new *design* since v0.4, and both halves were human-set:
  pick one song to learn instead of letting the songbook rotate, and find
  another way to learn besides the walking bard. See the new "Two ways in"
  section above. The walk is unchanged and remains the game; free play is a
  complement, not a replacement, and exists precisely because the walk
  cannot ask a child to *read* — only to keep time. Also an art pass: a
  fourth parallax plane (a far ridge) and scenery tiles doubled to 512px
  with silhouettes that differ within a single tile, because the old 256px
  tile repeated three and a half times across a screen and the repeat was
  the first thing you saw.
  Rejected on the way: making the walk itself require pitch accuracy (it
  would turn one tap into aiming, break "playable in under five seconds",
  and add a failure state); and celebrating a finished tune with a score or
  stars.
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
- 2026-07-27 — Polish pass (human-directed: "smooth out the art,
  animation, and game"). Nothing cut, nothing added to the mechanic. What
  it actually found was three shipped bugs rather than cosmetics: the
  practice staff drawn at alpha 0 on the live site, the songbook and lute
  buttons drawn underneath the song meter on every portrait phone, and the
  road running off the bottom of the screen in landscape. All three were
  correct in a desktop-sized landscape window and wrong on a phone.

  Two art-direction rules came out of it and are recorded above rather
  than here, because they are standing rules and not history: cream
  belongs to the notation and the furniture may not borrow it, and the
  world has five parallax planes with one of them in front of the road.

  Rejected on the way: shrinking the bard on very short screens to buy his
  hat clearance from the lowest notes (a 28% shrink to fix a 20px overlap
  on one orientation of one device, where notes already draw legibly over
  him); and deleting the song meter's five staff lines when they read as
  mush at 14px — making them legible against the new gold fill was the
  more honest fix than dropping a deliberate idea.

- 2026-07-28 — **v0.6, the road in three dimensions** (human-set). The game
  moves from Phaser 2D to Three.js low-poly 3D with a painterly storybook
  look, and gains a shared daily road, busking, instrument unlocks,
  variable-reward encounters, idle busking, and a campfire. Written up in
  full in its own section above.

  **Cut, and logged here as CLAUDE.md requires:** the five-plane parallax
  stack (answered a 2D question), every Phaser-drawn procedural texture in
  `render/`, and the flat-fill no-gradients rule for the *world* (the
  notation keeps it). The 2D art-direction section is retained rather than
  deleted because its notation rules — cream belongs to the staff, the
  notation may never be musically wrong — still bind in 3D.

  **Not cut, and deliberately so:** the entire `core/` brain, the no-fail
  stance, the no-grading stance, and the pedagogy. A renderer swap is not a
  licence to redesign the game underneath it.
