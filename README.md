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

The songs are the reason that is safe: eleven tunes a child already knows
(*Twinkle*, *Mary Had a Little Lamb*, *This Old Man*, *Ode to Joy*, *The
Itsy Bitsy Spider*…). If you know how the tune goes, the pitch is free even
when the letter is gone, so you are never stuck.

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

Beyond the unit tests there is a headless harness in [`tools/`](./tools) —
eleven checks that drive a real browser against the production build and
assert on things unit tests cannot reach: that the melody is in tune and
naturals-only, that the letter-fading actually fades and recovers, that
progress survives a reload, a rotation and a month away, that the layout
holds from a 320px phone upward, and that mashing breaks nothing. Run them
all with `node tools/verify-all.mjs` (or `quick`); see
[`tools/README.md`](./tools/README.md).

## Stack

Phaser 3 + TypeScript + Vite. No login, no build step beyond the above, no
paid services. Audio is procedural Web Audio, defined in
[`src/audio/manifest.ts`](./src/audio/manifest.ts).

## Deployment

Pushing to `main` runs tests and the build, then deploys to GitHub Pages.
A red build does not deploy — the last good version stays live. Day-to-day
development happens on short-lived `claude/dev` branches merged to `main`
via PR once CI is green.

## Project docs

This game is developed autonomously per [CLAUDE.md](./CLAUDE.md):
- [DESIGN.md](./DESIGN.md) — vision, core mechanic, definition of done
- [ROADMAP.md](./ROADMAP.md) — task-by-task build plan
- [STATE.md](./STATE.md) — current status (start at "At a glance"), the
  run-by-run log, and what is blocked on a human
- [PLAYTEST.md](./PLAYTEST.md) — questions only a person can answer
- [tools/README.md](./tools/README.md) — the headless checks, what each one
  proved, and the wrong version of each that had to be fixed first
