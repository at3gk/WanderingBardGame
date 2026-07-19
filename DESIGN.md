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

## Tone

Cozy, unhurried, warm. Soft pixel-art silhouettes, a muted pastel palette
that shifts with time-of-day-per-biome, chiptune/procedural instrumentation
that sounds intentional even when generated. No fail states, no punishing
feedback (no harsh buzzers or red flashes) — a missed beat just lets a note
drop out of the tune, which is disappointing in a "the song lost its
harmony" way, not a "you lost" way. The game should feel like it wants you
to relax, not perform.

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
