# Wandering Bard

A cozy, no-fail rhythm game: tap the beat to keep a wandering bard's song
alive as they walk an endless road through drifting scenery. See
[DESIGN.md](./DESIGN.md) for the concept and [ROADMAP.md](./ROADMAP.md) for
build status.

Play it live: https://at3gk.github.io/WanderingBardGame/

## Development

```bash
npm install
npm run dev      # local dev server with hot reload
npm test         # Vitest — all core game logic is headless-tested
npm run build    # type-check + production build (must stay green to deploy)
npm run preview  # serve the production build locally
```

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
- [STATE.md](./STATE.md) — run-by-run log, current status, playtest notes
