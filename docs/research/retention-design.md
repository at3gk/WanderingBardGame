# Retention design research — why players return to cozy games, and what fits this one

Research notes, 2026-07-31. Question: what makes players return daily to cozy
games, and which retention mechanics fit a no-fail music-learning game whose
constraints are: no fail states, no visible grades, no dark patterns, no
accounts/payments/analytics, shared daily road, audience includes children
~5-9. "Addicting" here must mean warmly magnetic. Every claim below carries
its source and what kind of source it is; where the primary source was
unreachable, that is said instead of papered over.

## Honest summary of what the evidence supports

The strongest, most repeatable finding is not about streaks or rewards at
all: players return to games that satisfy competence, autonomy, and
relatedness (self-determination theory, peer-reviewed across four studies),
and the *same* need satisfaction that predicts return also distinguishes
"I want to play" from "I feel compelled to play." Everything else is
designer testimony and first-party data, which is weaker but consistent:
the shared daily puzzle works through scarcity plus a communal object
(Wordle); daily rhythm works when absence costs almost nothing (Animal
Crossing deliberately capped the penalty at weeds); ritual and familiarity
— not novelty — are what the practitioner literature on coziness credits
for return visits; and gentle collection pulls (feathers, spirits, bundles)
work because they are finite, legible, and never graded. The streak
evidence is the most compromised: Duolingo's own numbers show streaks
retain, and the same sources plus independent criticism show they retain
partly through loss-aversion anxiety — which this game's constraints
correctly forbid. Variable-ratio reward research is unambiguous that
unpredictable rewards produce persistent behavior; the ethics literature
draws the line at unpredictability *tuned to compel* (near-misses, paid
pulls, decay timers), not at "the road sometimes gives you something
lovely," which is closer to what field researchers file under curiosity
than under gambling.

Net: this game's constraints do not cost it the well-evidenced retention
levers. They cost it only the coercive ones.

## Findings

### 1. The shared daily ritual

- Wardle kept Wordle to one puzzle a day so it "encourages you to spend
  three minutes a day," and credits the sharedness, not just the scarcity:
  "it's one puzzle, and everybody is solving it… if everybody was getting a
  different word… it wouldn't have caught on." He also says he
  "deliberately did what you're not meant to do if growth is your goal,"
  and that "people have an appetite for things that transparently don't
  want anything from you." Creator interview:
  https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/ (fetched;
  the NYT interview itself was not fetched — Time's account corroborates:
  https://time.com/6143715/wordle-sale-josh-wardle-interview/).
- The emoji-grid share he calls "a really comforting way of letting other
  people know that you're thinking about them" — note it shares *that* you
  played, and a shape, never a score in points. Same interview.
- Animal Crossing's real-time clock came from Eguchi wanting "a play
  experience where even though we're not playing at the same time, we're
  still sharing things together" — his family on one cartridge, at
  different hours. Crucially, he capped the cost of absence at "weeds do
  pop up, and cockroaches can appear," deliberately refusing "disaster
  type situations," and framed motivation as positive ("wow, your stuff
  looks so nice!") rather than penalty. Developer interview, Game
  Developer/Gamasutra 2006:
  https://www.gamedeveloper.com/design/crossing-into-the-mainstream-katsuya-eguchi-on-i-animal-crossing-i-
  (fetched).
- Sky: Children of the Light runs on daily rituals (candle runs, one
  realm's daily quests, seasonal candles capped per day) — structure
  documented first-party at
  https://thatgamecompany.helpshift.com/hc/en/17-sky-children-of-the-light/faq/519-what-are-seasonal-candles-and-how-do-i-obtain-them/
  — but note the same structure includes season passes and daily caps,
  i.e. appointment pressure this game forbids. Chen's design testimony
  that I could reach is about social safety (consent-gated chat, hidden
  usernames, "players should be motivated to spend time with one another
  because it feels good, not because they have to") rather than about the
  daily loop specifically:
  https://www.thegamer.com/sky-children-of-the-light-interview-jenova-chen-online-gamers-friendly/
  (interview). Sky's "Traveling Spirits" — past seasonal content that
  returns on rotation — is the one piece of its economy worth stealing:
  it is an explicit anti-FOMO valve (wiki, secondary:
  https://sky-children-of-the-light.fandom.com/wiki/Seasonal_Events).

What the daily ritual actually does, per these sources: bounds the session
(you can be done), synchronizes players into a communal object (today's
puzzle/road is a shared experience even without any network), and creates
tomorrow's appointment out of anticipation rather than threat. This game
already owns the rare part — a provably shared daily road — and lacks only
the framing that lets a player *feel* it is shared.

### 2. Streaks, and why the kind version is still not for this game

- Duolingo's own account: streaks build habit ("if you repeat an action
  often enough in the same context, the act of doing it will start to feel
  automatic"), early streaks are celebrated as gains, and long streaks
  work by "loss aversion." They concede losing a streak is "quite
  demotivating" and sell/give Streak Freezes as slack, citing a
  Penn/UCLA finding that slack in goal pursuit beats rigid rules.
  First-party blog: https://blog.duolingo.com/how-duolingo-streak-builds-habit
  (fetched).
- Friend Streaks (shared two-person streaks) are their gentler social
  variant, first-party: https://blog.duolingo.com/friend-streak/.
- The criticism is substantial and specifically about children and
  anxiety: streak maintenance decoupling from learning ("logging in so
  they didn't lose"), cortisol-framing in parent guidance
  (https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids,
  secondary), and the abstinence-violation effect — one missed day
  triggering full quit — discussed across practitioner UX writing
  (https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame,
  secondary). None of this is peer-reviewed at the level of the SDT work;
  all of it converges.
- The academic anchor for why loss-framed dailies are a dark pattern:
  Zagal, Björk & Lewis, "Dark Patterns in the Design of Games" (FDG 2013,
  peer-reviewed paper) names *playing by appointment* — habits built via
  loss aversion, Farmville's withering crops the canonical case — as a
  pattern working against player interest.
  https://www.semanticscholar.org/paper/Dark-patterns-in-the-design-of-games-Zagal-Bj%C3%B6rk/19a241378b06d868eb5f6b76027172c3aaca86f4

The honest read: streak *counters* retain by manufacturing a thing that
can be lost. Every mitigation Duolingo ships (freezes, repair) exists to
manage anxiety the counter created. A game that may never take anything
away cannot field a streak, only its inverse: memory without debt (see
recommendations).

### 3. Intrinsic motivation — the peer-reviewed core

- Ryan, Rigby & Przybylski, "The Motivational Pull of Video Games: A
  Self-Determination Theory Approach," *Motivation and Emotion* 30 (2006)
  — four studies; in-game autonomy and competence satisfaction predict
  enjoyment, preference for future play, and pre-to-post well-being;
  relatedness adds pull in multiplayer. Paper (abstract reached; full
  text paywalled): https://link.springer.com/article/10.1007/s11031-006-9051-8
- Przybylski, Rigby & Ryan's 2010 motivational model (full PDF, first
  party to the theory):
  https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf
- Rigby & Ryan's book *Glued to Games* (2011) draws the line this project
  needs: need *satisfaction* fosters harmonious "I want to" engagement;
  need *frustration* feeds obsessive "I have to" play. Retention built on
  satisfaction is the only kind compatible with "warmly magnetic."
  https://selfdeterminationtheory.org/glued-games-video-games-draw-us-hold-us-spellbound/
- Lazzaro's "Why We Play Games: Four Keys to More Emotion without Story"
  (XEODesign field study, 2004, practitioner white paper): Hard Fun
  (fiero), Easy Fun (curiosity), Serious Fun (relaxation/real-world
  value), People Fun (amusement together).
  https://www.scirp.org/reference/referencespapers?referenceid=2598293 and
  GDC 2004 talk transcript:
  https://archive.org/stream/GDC2004Lazzaro/GDC2004-Lazzaro_djvu.txt

Mapping to a cozy walk: this game's competence channel is real (the tune
stays alive under your hands; letters quietly come off the notes — actual
skill growth, the strongest possible competence signal because it is
true); autonomy is the songbook choice and wander; relatedness is thin by
constraint (no accounts) and mostly has to come from in-fiction warmth —
listeners, travellers, the bard himself — which the SDT authors accept as
a real relatedness channel (parasocial need satisfaction in single-player
is explicitly part of the PENS work). Lazzaro's Easy Fun (curiosity —
what's around the bend) and Serious Fun (playing to *become* — a parent
choosing this game so a child learns; an adult unwinding) are the two
keys this game should consciously serve; Hard Fun is deliberately mostly
absent and that is fine.

### 4. Gentle collection and completion

- A Short Hike: Robinson-Yu's GDC 2020 talk is actually titled "Crafting
  a Tiny Open World: 'A Short Hike' Postmortem" (the brief's "Making a
  Mountain" title appears to be wrong — noting it rather than citing a
  talk that doesn't exist). Talk: https://gdcvault.com/play/1026613/ and
  https://www.youtube.com/watch?v=ZW8gWgpptI8 (video only — no transcript
  reached, so specific design quotes about feathers are NOT cited here).
  The structure itself is documented: golden feathers are the one
  currency, they are capability (higher climbs), sourced from coins,
  quests, and exploration, and the mountain is climbable well before
  completion — collection is capability-shaped and finishable, never a
  checklist score. Secondary accounts:
  https://www.gamedeveloper.com/design/finding-smart-shortcuts-in-a-short-hike-postmortem-unlocking-the-vault-4
  (fetched; production-focused) and https://en.wikipedia.org/wiki/A_Short_Hike
- Spiritfarer: the collection is *people* — each spirit an arc of care
  (favorite meals, listened-to memories) that ends by letting go. Guérin:
  the team built "a playground and framework for you to deal with your own
  emotions." Interviews: https://www.cbr.com/spiritfarer-nicolas-guerin-director-interview/
  and https://www.redbull.com/int-en/spiritfarer-developer-thunder-lotus-games-interview
  The retention shape: finite arcs you finish and grieve, not meters you
  optimize.
- Stardew's community center is the canonical long pull — dozens of small
  bundles, each item a reason to engage some system on some day — but
  primary ConcernedApe commentary on the community center *as retention
  design* was thin in what I could reach. What is first-party: Barone's
  intent that the game be "a really relaxed and joyous experience. I don't
  want it to be stressful at all or for you to feel bad that you didn't
  please Grandpa" (interview:
  https://talesfromthecollection.com/eric-barone-intervie/) — i.e. even
  the game's judgment moment was softened on principle.

The transferable lesson: cozy collection retains when it is (a) finite
and completable, (b) made of qualitatively distinct things (spirits,
feathers, bundles — not +1s), and (c) never displayed as a fraction or
grade. This game already owns a natural collection nobody had to invent:
songs learned, instruments voiced, staff positions internalized. The trap
to refuse: the Pedagogy section forbids surfacing the learning model, so
the collection must be keyed to *what the player did* (walked this song
nine times, met this traveller, carried this instrument through a rain)
— diary facts — never to what the model believes the child knows.

### 5. Variable reward, and where the ethical line is

- The behavioral finding is real and old: variable-ratio schedules
  produce persistent, extinction-resistant behavior; applied studies show
  ratio reinforcement extends play duration (e.g. UTas thesis on
  ratio-reinforcement in gaming,
  https://figshare.utas.edu.au/articles/thesis/The_influence_of_ratio-reinforcement_on_video-gaming_behaviour/23239106).
- The ethics literature locates the harm not in unpredictability itself
  but in its deployment: loot boxes share "variable-ratio reinforcement
  schedules with gambling" where the pull is purchased or engineered
  around near-misses and spending (survey of dark patterns in F2P:
  https://www.researchgate.net/publication/390642492_Dark_Patterns_in_Games_An_Empirical_Study_of_Their_Harmfulness;
  Zagal et al. 2013, above, for the taxonomy).
- Lazzaro's Easy Fun gives the benign frame for the same neurology:
  curiosity — what's over the hill — is a variable reward the player
  walks toward, with nothing at stake and nothing for sale.

This game's encounters ("mostly small and occasionally lovely," already
in DESIGN.md) sit on the safe side as long as three things stay true: the
lovely outcomes are never purchasable, never near-missed ("the rare bird
almost landed!" is a slot-machine trick), and never *only today* — a
missed lovely thing can come round again (Sky's Traveling Spirits
pattern). Missable within a day (v0.8 stakes) is fine; missable forever
is FOMO.

### 6. Why players say they return to cozy games

- Project Horseshoe 2017, "Coziness in Games: An Exploration of Safety,
  Softness, and Satisfied Needs" (practitioner working-group report —
  Daniel Cook, Tanya X. Short, Chelsea Howe et al.):
  https://projecthorseshoe.com/reports/featured/ph17r3.htm (fetched).
  Directly on retention: cozy games retain by "minimizing churn" through
  low-stress mechanics; "repeated, meaningful actions can create
  familiarity and contentedness" — ritual and familiarity, not novelty,
  are the return engine; coziness must be "opt-in," and it explicitly
  frames cozy design as serving SDT's autonomy/competence/relatedness
  rather than extrinsic reward. It also warns what breaks coziness:
  extrinsic reward pressure, danger, urgent responsibility.
- Unpacking: Brier's GDC 2023 talk "'Unpacking' Zen: Designing a Game
  Without Fail States or Scores" (talk: https://gdcvault.com/play/1029400/
  — vault listing reached, video paywalled; her earlier GCAP 2019 version
  is free: https://www.youtube.com/watch?v=LwJSpsJBazk). Her stated
  method, "subtractive design" — "strengthening the core of a game by
  removing anything that isn't serving the core ideas" — removed scores,
  timers, and fail states and, per her account, the game is better for it
  (secondary write-ups:
  https://www.gamedeveloper.com/design/unpacking-the-design-pillars-of-a-chill-puzzle-game).
- Barone, above: relaxation as an explicit design goal, judgment
  softened even at the finale.

The through-line across all three: the cozy contract is *safety plus
ritual*. Players return because return is cheap, warm, and familiar — the
game is a place, and you visit places you feel safe in. Retention harm
comes precisely from the mechanics this game already bans.

### Findings from shipping (added as features teach — CLAUDE.md pillar 5)

- **2026-08-05, the moonlit walk-on (ROADMAP 159).** The research frames
  the daily road as the appointment made kind; what it did not name is
  the *eager day* — the Saturday a household wants more than one leg.
  Every conventional answer to "more" is an appointment mechanic in
  disguise (energy, bonus multipliers, streak credit). The shipped
  answer that fits the contract: **more is the same walk again, under a
  different sky** — a deterministic, non-communal leg that nothing
  gates, nothing rewards beyond the walk, and that every dawn quietly
  resets away. Retention shape without a single retention mechanic; the
  kindness lives in what is absent.
- **2026-08-05, the paged songbook (ROADMAP 165's shelf work).**
  Reachability is retention-adjacent: the fold had silently cut the far
  end of the songbook on small screens for weeks — a song a child
  cannot reach is a page that can never wear in (recommendation 3's
  whole surface). Any future collection surface should carry a
  reachability test at the smallest viewport, not just a fits-on-
  desktop check.
- **2026-08-06, the v0.9 queue as shipped (runs 76-81; recorded at the
  run-90 consolidation).** The kind-ritual stance survived contact with
  implementation only because every promise was turned into a
  test-enforced vocabulary ban swept against adversarial fixtures: the
  welcome line is composed from an entry's *existence* (day-counts and
  debt-register phrasings banned by test), the postcard's prose is
  presence-only (accuracy vocabulary banned by test — Wordle's rule as
  a regression suite), traveller road-lines carry an anti-pressure ban.
  The research names the principles; what shipping taught is that the
  principles hold under iteration ONLY as tests — a later run tuning
  copy would otherwise reintroduce a streak in adjective form. Second
  finding: the campfire postcard (rec 2's optional piece) turned out to
  double as the project's own art instrument — the frame a player would
  share is the frame the critique waves judge, so share-surface quality
  and press-frame quality are one budget, not two.

## Recommendations, ranked by fit

Existing systems referenced: daily road / campfire / journal / songbook /
instruments / encounters / idle busking.

1. **Make the campfire the ritual bookend: today closed, tomorrow
   glimpsed.** At the fire, the journal writes today's page (where you
   walked, who you met, what you played); on the horizon, the silhouette
   of *tomorrow's* road — which the game can genuinely render, because
   tomorrow's seed is knowable. Anticipation is the kind version of the
   appointment: nothing is lost by not coming, but you know the mountains
   are waiting. Builds on: campfire + journal + daily road. Ethics: pure
   anticipation, zero loss-framing. Size: one run (silhouette + journal
   page); the journal page may already mostly exist.

2. **Let the player feel the road is shared.** The rarest asset here is
   Wordle's property — everyone walks the same road today — and it is
   currently invisible. Diegetic first: signposts and traveller dialogue
   that name today's road ("Larchwind Road, third of its mornings") and
   speak as if every traveller walks it. Optional second piece: a
   share/postcard from the campfire — a small painted frame of today's
   road with the road's name and the song you carried. Wordle's rule
   applies exactly: share *that* you walked and what it looked like,
   never accuracy, coins, or anything gradable. No accounts needed;
   sharedness is a fact about the seed, not a network feature. Builds on:
   daily road + campfire. Size: one run for naming/signage; postcard is a
   second run.

3. **Songbook pages that wear in.** Repetition is already the pedagogy's
   engine; make it visible as *care*, not score: a song walked many times
   gets a worn, illustrated, dog-eared page — margins gaining little
   drawings of things met while carrying that tune. This is the gentle
   collection: the songbook slowly becomes a beautiful object. Hard rule:
   keyed to diary facts (times walked, roads carried on) and never to the
   scaffold/learning model — the Pedagogy section forbids displaying what
   the model believes, and a page that gets prettier as letters fade
   would be a grade in costume. Builds on: songbook + journal facts.
   Ethics: no fractions, no "mastered" badge, no per-song meter. Size:
   arc (art + state), first slice one run.

4. **Mementos, not checklists, in the journal.** The occasionally-lovely
   encounter outcomes leave a keepsake on the journal page — a feather, a
   pressed flower, a traveller's note. No collection screen, no count, no
   silhouettes of unfound items (an empty slot is a checklist and a
   FOMO generator). Rare things you missed can recur on later roads —
   adopt Sky's returning-spirits stance so nothing is lost forever.
   Builds on: encounters + journal. Ethics: no "X of Y", recurrence over
   exclusivity. Size: one run once the journal page exists.

5. **Welcome-back, never weeds.** Go one kinder than Animal Crossing:
   absence costs nothing at all (idle busking already "tapers honestly,
   caps, and never punishes" — keep that), and *returning* is what gets
   celebrated: the campfire scene plays a small welcome-back beat — the
   case with what busking brought in, a journal line about the days the
   bard noodled by the roadside. Absence becomes story, not debt. Builds
   on: idle busking + campfire. Ethics: this is the anti-streak; there
   must never be a counter of days, kept or missed. Size: one run.

6. **Family on one bench.** Eguchi's asynchronous family cartridge,
   without accounts: the songbook can hold a second bookmark ("someone
   else walks here too"), so a parent and child on the same device each
   keep their own song and scaffold state, and each sees the other's
   journal pages accumulate. This is the only relatedness channel the
   constraints allow, and the audience (kids 5-9) makes it the right one
   — the retention target is arguably the *household*, not the player.
   Builds on: songbook + journal + localStorage profiles. Ethics: no
   comparison of anything gradable between bookmarks — pages, not
   progress. Size: arc; needs care with scaffold-state separation
   (free-play/model rules already isolate the signal).

7. **Instruments as the long, finishable arc.** Already designed
   ("generous rather than grindy"); the retention note from A Short Hike
   is only this: keep the set finite and qualitatively distinct, let each
   unlock change how the walk *sounds* (capability, like feathers, not
   inventory), and let the game be complete-feeling before the last one.
   Builds on: instruments. Size: already on the roadmap; no new task.

## Rejected on principle

These retain players in the literature and are forbidden here, each for a
named reason:

- **Streak counters of any kind** — including "kind" ones with freezes.
  A freeze is an admission the counter manufactures loss; loss-framing is
  banned, and the audience includes children the criticism literature
  specifically worries about. (Duolingo first-party + criticism, §2.)
- **Daily login rewards / appointment decay** — Zagal et al.'s "playing
  by appointment" dark pattern; Farmville's withering crops. The daily
  road must be a gift that renews, never an obligation that spoils.
- **One-time-only content (FOMO timers, exclusive days)** — a missed
  lovely thing must be able to come round again. Miss-a-day-lose-a-thing
  is a loss-framed streak wearing scenery.
- **Near-miss staging on rare encounters** — the gambling tell. Rare
  stays rare and quiet; the game never advertises what almost happened.
- **Any visible fraction, count-toward-complete, or "mastered" state on
  learning content** — grading by another name; the Pedagogy section
  already forbids surfacing the model, and a completion meter would
  surface it.
- **Leaderboards / any accuracy comparison in sharing** — the postcard
  shares presence, never performance.
- **Notifications and re-engagement nags** — structurally impossible
  (no accounts) and would stay banned if it weren't.
- **Idle earnings that decay to punish absence** — the existing "tapers
  honestly, caps" rule is the line; taper limits the reward for absence,
  never fines it.

## Source access notes

Reached directly (fetched): the TechCrunch Wardle interview; the 2006
Game Developer Eguchi interview; the Project Horseshoe 2017 coziness
report; Duolingo's first-party streak-habit post. Reached as
listings/abstracts: Ryan/Rigby/Przybylski 2006 (Springer abstract; full
text paywalled), Zagal et al. 2013 (Semantic Scholar), GDC Vault entries
for the A Short Hike and Unpacking talks. Not reached: transcripts of the
A Short Hike GDC talk (video only — no design quotes cited from it, and
the talk's real title differs from folklore), Jenova Chen speaking
specifically about Sky's *daily* design (his reachable interviews cover
social safety; Sky's daily economy is cited from thatgamecompany's help
center instead), the NYT's own Wardle interview (corroborated via
TechCrunch/Time), and ConcernedApe on the community center specifically
(his reachable statements cover the no-stress stance). Nothing in this
file is quoted from a source that was not reached.
