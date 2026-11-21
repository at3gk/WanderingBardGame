# Wandering Bard

A cozy, no-fail rhythm game that quietly teaches a child to read music.

You tap the beat to keep a wandering bard's song alive as they walk an
endless road through drifting scenery. One tap, no login, no fail state.

The teaching is the part that makes it more than a rhythm game. The lane
the notes scroll along **is a treble staff**, and every note is drawn where
it really sits, with its letter name inside the head. As a child meets a
position often enough, that letter stops appearing early and starts
appearing **late** — 1800ms before the tap, then 950, then 350 — so the
flight of the note becomes a moment of genuine recall. What fades is the
*prompt*, never the answer: the letter is always shown before the note
reaches the line, however familiar the position has become. There is no
quiz, no score and no wrong answer.

The songs are the reason that is safe: nineteen tunes a child already knows
(*Twinkle*, *Mary Had a Little Lamb*, *This Old Man*, *Ode to Joy*, *The
Itsy Bitsy Spider*…), seven of them (*My Bonnie*, *Yankee Doodle*, *Clementine*, *Good King Wenceslas*, *When the Saints Go Marching In*, *Oh! Susanna*, *Amazing Grace*) on a Book Two
shelf that opens after the festival and teaches the key signature (pick
*Hear what Book Two would teach* at the festival's end, then find the tunes
under *Book Two — true keys* in the songbook, each tune marked with its key, e.g. "in B♭"). If you
know how the tune goes, the pitch is free even when the letter is gone, so
you are never stuck.

A family can also add its own songs — tap one out in free play (*Make a song ♪*
in the songbook: a ladder of every position the books write, from the low B
under middle C up to the A above the staff; ● records and ■ stops, and if a
take isn't ready to save yet, the line at the top says what's missing —
a tune needs sixteen notes and a full last bar of four — and *keep tapping*
in the bottom-right corner picks it up where you left off), or import a
MIDI or MusicXML file — and every one of them is held to the same engraving
rules as the built-in songbook, so nothing a child reads is ever wrong.
The *Your songs* shelf holds eight tunes. To make room, open the
songbook and tap the small **×** beside one of your own tunes: the row
asks *let “…” go?* — tap **yes** at its right-hand end to let it go, or
anywhere else on the row (or just close the book) to keep it. Book One
and Book Two pages have no ×.

**Practice a tune by reading it:** pin a song in the songbook, then open
*Practise this tune ♪* — it sits right under *Wander the songbook* at the
top of the first page (while you're wandering, the same door reads *Make a
song ♪* and sits at the end of the book). The ladder now carries that tune — a gold dot sits on the
line or space of its next note. Tap there and the note is written in,
left to right like sheet music, and the dot moves on to the next spot; a
wrong note just sounds, nothing is lost. When a line fills, a fresh line
starts. At the end a soft chime plays and the dot goes back to the first
note on a clean line. (Choose *Wander the songbook* for plain
free play; pressing ● to record hides the dot until you stop.)

**Play it by heart:** while practising, tap *play by heart* in the
bottom-right corner. The dot goes away and the tune is yours to find; the
notes you get right are still written in. If three taps in a row miss,
the dot comes back quietly for the next few notes, then steps away again.
Tap *show the dot* to have it back for good.

**Book Two tunes are practised in their key:** pin one (say *Yankee
Doodle*, in G) and the ladder is tuned to it while you practise — every F
line plays F♯, and the letter that pops up says so ("F♯"). In *Amazing
Grace* (E♭) the B, E and A rungs play flat. The tune's key signature is
written at the left end of the staff while you practise (one ♯ on the F
line for G), so you can see *why* the F line plays F♯ — the same marks
the road's staff and any printed music use. Recording a take always uses
the plain notes, so the signature goes away while you record.

Play it live: https://at3gk.github.io/WanderingBardGame/

See [DESIGN.md](./DESIGN.md) for the concept and the pedagogy, and
[PLAYTEST.md](./PLAYTEST.md) if you have a child and five minutes — the one
question this project cannot answer about itself is whether the fading
happens at the right pace for a real five-year-old.

## Development

```bash
npm install
npm run dev      # local dev server with hot reload
npm test         # Vitest — all core game logic is headless-tested
npm run build    # type-check + production build (must stay green to deploy)
npm run preview  # serve the production build locally
```

Beyond the unit tests there is a headless harness in [`tools/`](./tools)
that drives a real browser against the production build to assert on
things unit tests cannot reach, and a visual-QA tool (`postcard.mjs`) that
poses the game and bakes screenshots for review. Run the automated checks
with `PLAYWRIGHT_PATH=... node tools/verify-all.mjs`; see
[`tools/README.md`](./tools/README.md) for setup.

## Stack

Three.js + TypeScript + Vite. No login, no build step beyond the above, no
paid services. Audio is procedural Web Audio, defined in
[`src/audio/manifest.ts`](./src/audio/manifest.ts).

## Deployment

Pushing to `main` runs tests and the build, then deploys to GitHub Pages.
A red build does not deploy — the last good version stays live. Day-to-day
development happens on short-lived `claude/*` branches (one per run) merged
to `main` via PR once CI is green.

After each merge, the [`tools/`](./tools) headless checks also run in CI
(`.github/workflows/headless-checks.yml`). This is informational only — it
doesn't gate the merge or the deploy — since it exercises a real browser
and heavier setup than the PR gate needs.

## Project docs

This game is developed autonomously per [CLAUDE.md](./CLAUDE.md):
- [DESIGN.md](./DESIGN.md) — vision, core mechanic, definition of done
- [ROADMAP.md](./ROADMAP.md) — task-by-task build plan
- [STATE.md](./STATE.md) — current status (start at "At a glance"), the
  run-by-run log, and what is blocked on a human
- [PLAYTEST.md](./PLAYTEST.md) — questions only a person can answer
- [tools/README.md](./tools/README.md) — the headless checks, what each one
  proved, and the wrong version of each that had to be fixed first
