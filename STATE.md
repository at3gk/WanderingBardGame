# STATE

Run counter: 50

## Direction research (standing — CLAUDE.md pillar 5)

Three primary-sourced notes live in `docs/research/` and bind the queues
built from them: `retention-design.md` (→ v0.9 queue), `art-quality.md`
(→ v1.1 queue; its not-recommended list binds), and `mobile-friendly.md`
(→ v1.2 queue; its URGENT fact: Safari ITP deletes the child's whole
localStorage save after 7 days of absence — home-screen install is the
first-party-documented exemption, so ROADMAP task 171 is data-loss
protection, not polish. Store distribution is human-gated: logged under
Blocked on human).

`docs/research/retention-design.md` (2026-07-31, primary-sourced) is the
living note on why players return to cozy games and what this game may
and may not do about it. Its seven ranked recommendations became ROADMAP's
v0.9 queue (tasks 151-157); its rejected-on-principle list (no streaks,
no login rewards, no FOMO content, no near-miss staging, no visible
learning fractions, no accuracy sharing, no decay) BINDS all retention
work. Consolidation runs: reread it, note here what the game now does
about each top recommendation, extend it when a shipped feature teaches
something it didn't predict.

## The true goal (standing pointer)

DESIGN.md's "The true goal" section (2026-07-31, human-grilled to shared
understanding) now defines the game's destination: household audience
with the child as tie-break, the Festival of the Long Road at 12-15
walked legs, the by-heart mastery ladder ending in playing without
notes, Book Two (accidentals) as the post-festival choice, the
first-campfire promise, and a one-tap title card. The v1.0 arc is
ROADMAP tasks 158-165. Any run touching goals, pacing, menus, or
mastery display must read that section first.

## Current status

**At a glance** — read this, then only the sections you need.

- **HANDOFF, 2026-08-01 (overnight loop session, continued) — task 160's
  first slice shipped: the learning model is LIVE for the first time.**
  The scaffold (built and tested since v0.4) had zero live callers —
  the letter pedagogy was decorative and every letter printed at spawn.
  Now `core/reveal.ts` bridges scaffold → per-note reveal leads,
  SongNotes hides each letter inside an intact head until its lead
  (150ms fade-in; struck/softened notes always answer), RoadStage
  feeds judged taps and persists via scaffoldStorage. A fresh scaffold
  reproduces the old always-labelled staff exactly — fading only
  begins where strength is earned. Verified live with attribute reads
  (far note letter 0 / approaching 0.246 mid-fade / past-barline 1
  under a strong scaffold; all 1 fresh). Two traps for future runs:
  (1) seeding localStorage in a test rig then reloading gets clobbered
  by pagehide's persist — seed via addInitScript; (2) the walk tune
  extends `beats` IN PLACE, so any parallel array must be extended in
  place too or SongNotes' cursor reads a stale one. 1059 tests green
  (+8), build 832.17 kB. Remaining on 160: heads-to-ghosts (by-heart
  proper). Human playtest note: letter fading is now REAL for a
  returning player with an earned scaffold — the family iPad will
  show blank heads on well-known positions; that is the design
  working, not a regression.

- **HANDOFF, 2026-08-01 (overnight loop session) — wave-5 six-lens blind
  panel ran (fresh judges, fresh frames, HARSHER ANCHOR: "10 = ships
  beside A Short Hike without apology" — so the 4.42 mean is NOT
  comparable to wave 4's ~5.5; read the fault structure, not the
  number).** Lens means: value 3.75, composition 3.65, mobile 4.05,
  silhouette 4.45, emotion 5.15, colour 5.50. Best frames 04 (5.25),
  07 (5.00), 10 (4.83); worst 06/08 (4.00). References: 7 ASH gameplay
  frames only (Spiritfarer press pages now JS-rendered; key art
  weighted lightly). Full digest in the session scratchpad; the
  durable findings and their dispositions:
  1. **THE finding, measured across frames: figure/ground value
     separation.** Bard-vs-surround dL 0.7 (02!), 2.0 (01), 2.4 (07),
     4.0 (04, 06) against the reference floor of 13.6-25.2 — in
     greyscale the protagonist vanishes; only the red cloak's hue holds
     him. CRITICALLY, 03 (dL 16.3) and 10 (12.1) already CLEAR the
     floor — measure what those two frames do differently (likely the
     lit road behind the figure) before inventing a mechanism. Queued
     as ROADMAP task 179. This is wave 11's "value problem, not a pose
     problem" diagnosis, now with numbers on every frame.
  2. **All ten frames lack foreground occluders** — ASH crops canopy/
     rock masses through all four edges in every reference frame; our
     postcards all open on a clean ground plane. Structural, new,
     convincing. Queued as task 180 (composition lens's most repeated
     note; also the cheapest route to depth the set has).
  3. **Night (07) darkness is overextended**: 59.4% of pixels below
     L*10, median L*6.4, vs the reference night's p5 of L*32. This
     COLLIDES with queued task 147 ("commit to night") — reconciled in
     147's text: the shared symptom is an undifferentiated dark; the
     fix direction is STRUCTURE (moonlit ambient ladder, fire-warmed
     stones, near/far treeline grading), neither "darker" nor
     "brighter" wholesale. The fire pool itself is on every lens's
     keeps list — do not touch it.
  4. **Mobile bugs, concrete**: 08's staff is cropped by the left
     screen edge (the one interactive surface, cut on the device with
     the most spare vertical); corner labels in 03 are sheared
     mid-glyph by the bottom frame edge (no bottom inset on desktop
     viewports — folded into task 175's audit); 10's read-vs-act
     corridor is ~400 px of empty road. 146 extended with the
     portrait-crop measurement.
  5. **Smoke still reads as a polygon stack** (wave-2 complaint,
     still live; emotion lens calls it fiction-breaking) — queued as
     task 181. The compositional intent (vertical mass in that
     quadrant) is on the keeps list; it is the hard polygonal edges
     that fail.
  6. **NPCs decompose at postcard range** (05 worst: hip gaps,
     hairline legs, floating boxes near the banner) and **the bard has
     no readable face at any distance** (ASH's charm budget is one big
     white eye) — both folded into task 150's text.
  **Measure-first suspicion list (wave-4 pattern: panels see true
  symptoms, misattribute causes):** (a) "dawn shadows drop chroma to
  grey" (01/02/10) — wave 4's CAST_SHADOW_HUE was PROVEN chroma-gaining
  at noon; dawn may genuinely differ (low-sun path) but measure the
  actual shadow S values before touching the term; (b) "03's distance
  is a grey fade" — sky.ts's ridgeTint was fixed and measured last
  wave; the complaint may be the terrain-side painterly fog, not the
  sky — ablate which layer owns the desaturation first; (c) note
  "pills fuse into a blob" in 08/10 — same family as the twice-refuted
  "noteheads ignore pitch"; verify against the governor's actual
  spacing at those aspect ratios before re-fixing.
  **Keeps (unanimous or near):** the sky gradients at every hour, the
  fire pool, the red cloak accent, 10-tablet's four-step value ladder,
  03/10's figure separation, 08's inverted band order (lit road
  carrying the character — do NOT "correct" it), the serif typography
  and journal-page treatment, tree silhouettes, 04's S-curve road.

- **HANDOFF, 2026-08-01 (overnight loop session, continued) — task 159's
  second piece shipped: tomorrow's road glows on the horizon at the
  fire.** `core/skyline.ts` derives tomorrow's real profile (nextDayKey
  + leg-0 seed); sky.ts draws it as the farthest ridge band in a
  down-road wedge with a warm first-light halo, all scaled by one
  uniform (`uTomorrow`) that eases in only while resting. A/B ablation
  on the campfire framing shows a clear, soft "light beyond the hills"
  read; dawn walking frame byte-unchanged. GLSL note for future edits:
  this material is GLSL ES 1.00 — uniform arrays cannot take computed
  indices; the band samples its profile via a constant-bound loop.
  1051 tests green (+8), build 828.23 kB. Blind critique now due (two
  visual tasks since wave 4): references re-downloaded to scratchpad
  (7 A Short Hike gameplay frames; Spiritfarer press pages are now
  JS-rendered so only key art was reachable — panels should weight
  ASH).

- **HANDOFF, 2026-08-01 (overnight loop session, continued) — task 159's
  first piece shipped after 158: the journal opens at the fire and the
  festival is named.** The journal had been written all day and read
  nowhere since v0.6 — the whole recap was one coins line. Now
  `core/campfirePage.ts` (pure, tested) composes tonight's page and
  `Hud.showPage` sets it above the instrument corner, each moment inked
  in the sky it happened under, staggered reveal, tap-to-fold. The
  festival line has three registers (first-fire naming, distance count
  in words, anticipatory at the gate) and its copy is test-bound to
  distance-not-time and no-verdict vocabulary. Read the re-shot
  07-night-campfire frame: page sits bottom-left, legible, clear of
  the scene. Remaining on 159: tomorrow's silhouette, rehearsal intro
  (after 162), moonlit walk-on wiring (mid-session road rebuild).
  1043 tests green (+10), build 821.01 kB.

- **HANDOFF, 2026-08-01 (overnight loop session, continued) — task 158
  shipped after 171: the journey ledger, the v1.0 arc's foundation.**
  Pure core only (no scene wiring — zero live-build behaviour change):
  `FESTIVAL_LEGS = 13` counted against `campfires` (veterans'
  already-slept nights count — kind, and one line to change if the
  human wants a fresh start), `startNextLeg` (resting-only, resets the
  road-shaped fields, keeps the day's purse, nothing gates or rewards
  it), the moonlit night arc in `dayFractionAt` (dusk→midnight→dawn,
  mod 1 — the sky's keyframes already cover it), and `legSeed`/
  `legRoadKey` in rng.ts (leg 0 === dailySeed by identity, pinned;
  `~N` road keys keep moonlit stop ids from colliding with the
  morning's). 1033 tests green (+16), build 817.92 kB. The campfire
  scene tasks (159/162) wire it: `generateRoad(legSeed(k,n),
  legRoadKey(k,n))` and a "walk on" choice at the fire.

- **HANDOFF, 2026-08-01 (overnight loop session) — ROADMAP task 171
  shipped: the PWA save-protection bundle, the v1.2 queue's urgent
  data-loss item.** 1017 tests green (+17), build 817.70 kB. The game
  is now installable (manifest + deterministic procedural PNG icons via
  `tools/make-icons.mjs`; installed home-screen apps are exempt from
  Safari ITP's 7-day storage wipe — the whole point), asks for storage
  persistence once on first gesture, and has the no-account backstop:
  a "keepsake" file (all three `wb.*` keys as readable JSON,
  `core/keepsake.ts`) exported/imported from two dim endpaper rows in
  the instrument case. Three findings worth keeping: (1) the songbook
  CANNOT host new rows — `songBookBox`'s whole-rows-fit rule puts
  anything after 11 songs permanently below the fold (found by reading
  the screenshot, not the code; the case never overflows); (2) the
  case corner is now pickable on a fresh one-instrument device because
  the restore path matters most there; (3) after a keepsake import,
  RoadStage's `restoring` flag must gate every save — the reload's own
  pagehide save would otherwise silently overwrite the restored
  records with in-memory state, and the keepsake would "do nothing".
  `viewport-fit=cover` was the only missing half of safe-area support
  (Hud's `env()` probe existed, returning zeros). Remaining from the
  research's ranked list: service worker (172), audio session (173),
  quality tiers (174), touch audit (175). **Needs human playtest:**
  A2HS on the family iPad — icon, standalone chrome, saves surviving
  a week; and a real keepsake save/restore across two devices. 1000
  tests green (37 files), build 815.02 kB, all gates PASS, morning land
  p90 165. Five agents, five root causes that had each survived multiple
  critique rounds:
  1. The "casterless shadow bands" are the TERRAIN SHADOWING ITSELF at a
     low sun (proven by ablation difference-images — they follow the
     landform, hence sun-invariant; the caster is a rise 40 m back). The
     grey was arithmetic: adding a near-complement skylight to a warm
     surface lands on neutral. New CAST_SHADOW_HUE mixes toward a
     luminance-matched sky colour — provably value-gate-safe; shadows now
     GAIN chroma (noon S +0.088 where they lost it before).
  2. The milk sky was the SKY: sky.ts's own air()/chroma correction had
     only ever been applied to the two ridge bands, never the dome or
     cloud. One SKY_CHROMA push over the whole dome: morning sky S 9.6 →
     17.3. The panel's "fog brighter than sky" inversion measured as NOT
     REAL (fog band is 46 levels darker) — panels can hallucinate a
     structure; measure before obeying.
  3. The ribbon's sixth line (second appearance) was THE ROAD'S WHEEL RUT
     showing through the paper's translucent bottom margin — the ribbon
     was innocent both times. Lane lifted clear; note-collisions were the
     lane FOLDING OVER ITSELF on road bends, cut by a closed-loop
     visible-length governor with truncation semantics.
  4. The fire's light had been centred on the ROAD ANCHOR, not the fire,
     for two waves (uHearthPosition from the group, fire 6-7 m away
     inside it) — every prior hearth tuning was against a mislocated
     light. The clipped patch was the coal-bed slab; now discrete
     instanced embers.
  5. The bard's eyes were 2.7 mm INSIDE the head (drawn every frame,
     culled every frame, since wave 1), the face has never pointed at any
     camera (seated torso twist 0.46 + head yaw fixes it and frees the
     lap lute), the shoulder joints sat OUTSIDE the torso's surface, and
     the seated strum was proven geometrically impossible (elbow-less
     rig; the visible hand is the fretting hand, made visible instead).
     Also: staging's "waist-deep listener" was the seated elder (legless
     by construction) — the real faults were a bearing sign error putting
     listeners behind the ribbon and a slot band projecting onto the
     bard's own screen column. New pure roadStaging module, camera-driven
     tests; the bard turns to face who he meets.
  **Wave-4 blind panel: mean ~5.5, best frames 6.5 (01-dawn) and 6.25
  (04-vista), 07 at 5.88; weakest 03 at 4.25.** The trajectory across the
  session: ~4.3 → ~5.4 → ~5.5 → ~5.5 — the easy point came from wave 1;
  the later waves each fixed real, deep faults (see the five root causes
  above) while the panel's top complaint has now survived three fix
  rounds: the TERRAIN SELF-SHADOW at low sun still reads as "casterless
  plaid bands" to fresh eyes even with hard frayed edges and correct
  chroma. That is no longer an execution bug — it is a PRESENTATION
  DECISION to remake (see task 144). Two panel claims to treat with
  suspicion next session, per this session's pattern: "noteheads ignore
  pitch height" (anchors measured exact twice; likely the depth-makeup
  again or a framing artifact) and "fire glow is a perfect circle" (the
  rim is per-vertex jittered; check exposure clipping before geometry).
  Panels reliably see true SYMPTOMS and unreliably attribute CAUSES —
  the whole session in one sentence.
  Mutation-testing note: two test helpers that sample vertices "near a
  height" passed vacuously on ringed geometry (vertices only exist at
  rings) — interpolate between rings; the mutation run caught it.

- **HANDOFF, 2026-07-31 (second interactive session, continued) — v0.8
  wave 3 landed: winding, stakes, wisps, and the staff settled twice.**
  978 tests green, build 795.17 kB, all gates PASS. Five parallel builds
  (ROADMAP 137-142 done-entries carry the detail). The headline finds:
  `boxPart` had been wound INSIDE-OUT since the file was written (0% of
  normals outward — the player was looking at the inside of the bard;
  one line explained three critique cycles of "decomposing geometry");
  the morning/noon "shadow smears" mostly SURVIVE shadow ablation (they
  are the foreground tier + the road's soft edge — task 143); and the
  six-line staff dispute was settled once (paper's top dissolve boundary)
  and then REAPPEARED at the bottom in the next panel — see below.
  Stakes landed kindly: one-at-a-time crowd dispersal with an 8 s grace
  (the first listener never leaves), and ~35% of travellers carry a
  playable request that passes warmly when fumbled; a test bans
  fail/lose/wrong vocabulary from every journal line.

  **Wave-3 blind panel: mean ~5.5 (was ~5.4 nominal, but tougher frames —
  up a full point from wave 1's ~4.3).** 04-golden-vista 6.75 — verdict:
  "the lone frame a store page could use today." 01 5.75, 07 5.75,
  09 6.0, 02 4.9, 03 4.5 (weakest). Verdict line: art direction now
  touches the bar; every frame still ships at least one execution
  accident. The keeps list is long and specific for the first time
  (skies, costume, lute, ribbon concept, camera variety all "do not
  touch").

  **Panel-vs-measurement disputes a wave 4 must resolve, not re-litigate:**
  (1) the "casterless shadow bands invariant across suns" match the
  depth-keyed FG tier treads by that very invariance — the panel reads
  the tier as weather, which may mean the tier has stopped earning its
  keep now that MODEL_SPLIT models form; (2) the campfire pool measured
  a real R/G hue ladder but four lenses still read flat orange — the
  clipped V=1.0 patch under the logs and the too-bright night surround
  are what the eye actually reports; (3) the ribbon's sixth line is now
  a BOTTOM stroke (the top boundary was fixed and tested — the bottom
  edge needs the same gradient); (4) the bard's new winding exposed a
  detached-arm gap at the shoulder in 02 and a thighless seat in 07 —
  real, new, and camera-dependent.

- **HANDOFF, 2026-07-31 (second interactive session, continued) — v0.8
  wave 2 landed: the notes come at you, the light got honest, the camera
  learned moods, stops telegraph themselves.** Read the wave-1 entry below
  first. Wave 2 was four more parallel builds plus two orchestrator fixes,
  all verified: `npm test` 910 green, build 770.30 kB, `frame-quality`
  PASS all six, `land-histogram` held or rose.

  **The builds, one line each** (ROADMAP 133-135 + item 7 done-entries):
  notes-lane — the plank is gone; a translucent parchment ribbon recedes
  over the road and notes ride it toward a barline at the bard (the
  human's explicit ask, and v0.6's original promise); light — the grey
  haze was ACES shoulder desaturation plus a complementary mix, fixed by
  blending fog hue separately from value, golden-hour shadows got a
  low-sun scatter term, smudge shadows got edges (penumbra was texel
  stretch, remapped); camera — per-mood framings (tall vista, close
  over-shoulder encounter), phone strategy moved from FOV-widen to
  camera-height; telegraph — banner-pole busk pitches, wayside cairns,
  a campfire smoke plume visible 380 m out, all seeded and streamed.
  Orchestrator: walking meter retuned (miss 14 → 6 pre-normalise;
  break-even accuracy 54% → 33% — DESIGN v0.8's "casual timing holds the
  walk", pinned in walk.test.ts) and the busk keeps the original meter.

  **Blind re-critique (task 136, done): mean 4.3 → 5.4.** Same six-lens
  panel vs the same press-kit references: 01 5.25, 02 5.63, 03 4.25,
  04 6.75, 07 ~6.5, phones weakest. Verdict verbatim: "one focused wave
  below shippable, not at it." The re-derived gap list (full text in the
  session's critique output, distilled into ROADMAP tasks 137-141):
  cast-shadow smears are now the #1 artifact (5 of 6 lenses); note tokens
  betray pitch position at range and clip at the portrait edge — and TWO
  independent critics counted SIX staff lines in some frames (disputed by
  three others; needs a code-level check before believing either side);
  the bard reads armless from behind cameras; the midground rung is
  achromatic; the campfire smoke reads as stacked glass octagons.

  **Lessons this wave, same shape as ever:** the light agent DISPROVED the
  critique's own prescription for warm bounce (warming upward faces at
  golden hour warms the whole frame — measured hueSpread 0.167 → 0.106,
  replaced with sun-bearing warmth, 0.182); STATE item 10's fog hexes had
  not existed for rounds (the symptom had a different cause — check the
  constants a critique quotes); `renderer.shadowMap.enabled = false` is
  NOT a valid shadow ablation (materials keep sampling the stale map —
  use `uShadowDepth = 1`); and `frame-quality` shoots every pose through
  the VISTA framing, so that one mood is the lens the whole tonal gate
  sees — its noon has 0.10 stops of headroom, and camera distance/fov
  changes cost stops while camera height is free (measured table in the
  CameraRig vista comment).

- **HANDOFF, 2026-07-31 (second interactive session, local machine, real
  GPU) — v0.8 wave 1 landed.** A human watched the live game and reset
  direction (DESIGN.md "The walk is played, not watched"): notes existed only
  at busk stops, the walk's audio was literally noise ambience, and the
  riverside had no river. Four parallel agents fixed all of it in one wave,
  plus the top figure/ground-cover gaps from a six-lens blind critique run
  against actual A Short Hike / Spiritfarer press-kit frames (ROADMAP task
  128, finally possible on a machine with eyes).

  **What is verifiably true now:** `npm test` 873 green (was 790),
  `npm run build` green (743.05 kB), `frame-quality` PASS all six poses,
  `shader-check` PASS. Verified live on a real GPU (100 fps at 730k
  triangles): walking notes render and judge taps, an empty meter freezes
  `s` (0.000 m over 5 s) and tapping restores stride same-frame, song
  pinning survives reload, the audio graph builds with a music bus and the
  drone joining on a bar line at low drive.

  **The four builds, in one line each** (full detail in ROADMAP tasks
  129-132): core — walking tune + `core/walk.ts` pace gating + songbook
  pinning in the HUD; audio — walking adaptive mode, ambience bus hard-capped
  at half the music bus (worst-case bed total 0.85 → 0.31), per-partial
  decay envelopes per voice; world — a carved, level, seeded river with
  banks and reeds, meadow clumping, three distinct prop silhouettes; figures
  — faces, a bowled lute (the "golden rake" was stacked box top-faces), a
  triangle-wave strum, listeners that face the bard and nod.

  **Two load-bearing rendering bugs, same class as the v0.6 trio (invisible
  to every check, found by looking):** (1) the foliage material ran
  `flatShading: true`, deriving normals from screen-space derivatives on
  2-px blades — `skywardNormals` and `bandSoftness` were both being thrown
  away before lighting; this owned nearly all of the "dark shard litter"
  critique. (2) `Bard.ts`'s hat-brim dip had an inverted sign — lifting the
  front and hanging the back 10.5 cm — which is why the head never survived
  the three-quarter-rear camera.

  **Instrument notes:** `tools/land-histogram.mjs` is new (task 122's
  land-masked p10/p50/p90; morning land p90 measured 149 pre-wave — the
  "land never carries a light value" item is real at morning, fine at noon
  at 193). `frame-quality`'s noon stops dipped 0.26 when the litter died —
  the gauge was counting noise as value structure; the world agent recovered
  it with three large dark shapes instead (its report explains the
  photometric argument).

  **Known-open after wave 1, queued as the next wave:** the songboard now
  sits in every walking frame and reads as a beige billboard on the
  vanishing point (composition, critique gap 6 — presentation, not
  mechanic); daylight fog still cancels to grey (item 10); caster-less
  shadow smudge bands (critique gap 3); phone-portrait framing dead thirds
  (critique gap 11); golden-hour busk figure-ground is better (median step
  16 → 20 sRGB at 20 px) but the frame is still dark overall. A blind
  re-critique against the reference frames should re-derive scores before
  wave 2 fixes are chosen.

- **HANDOFF, 2026-07-31 — twelve interactive critique waves, and the honest
  state of the game.** A human is about to pull this repo down and look at it
  on a real GPU. Read this block first; it is the short version.

  **What is verifiably true.** `npm test` 790 green, `npx tsc --noEmit` clean,
  `npm run build` clean, and `tools/frame-quality.mjs` PASSES all six poses —
  AFTER merging main, morning 3.24, noon 2.73, golden 4.73, night 6.10,
  phone-portrait 2.78, phone-landscape 4.80. Note these are LOWER than the
  branch measured before the merge (3.79 / 3.08 / 5.11 / 6.65 / 3.30 / 5.19):
  ROADMAP task 121 landed on main in parallel and raised ground albedo 35 per
  cent, which lifts p10 (morning 0.043 -> 0.063) and therefore compresses the
  stops even as the land gets lighter. Both changes are wanted; the
  compression is the cost and phone-portrait now sits 0.28 above its floor
  rather than 0.80. Watch it. Pitch readability holds at 5.93:1 at every
  hour, which is within a whisker of its arithmetic ceiling of 6.46 (see
  below).

  **What is NOT true, and matters most: nobody has ever looked at this game
  with human eyes.** Twelve waves of agents graded it against a written rubric
  and pixel statistics. No human has played it, and the busking mechanic —
  the core of the design — has never been judged for whether it is *fun*.
  Every frame was shot through SwiftShader at 12-21 s a frame, which is itself
  the cause of at least one bug class (see the pose-blend race below).

  **The count that never moved.** Ten successive visual critics scored the
  ten postcard framings: 2, 2, 4, 5, 5, 3, 3, 3, 3 of 10 holding, and every
  one said "not shippable" against an A Short Hike / Spiritfarer bar. The
  measurements underneath improved a great deal over the same period. Treat
  the count as unreliable rather than as a verdict: it is a binary applied by
  an agent that has never seen the reference games, and it stopped
  distinguishing progress from shippability around wave 9. A tenth critic was
  briefed to add a 0-10 per-frame score for exactly this reason and did not
  get to run.

  **The two structural fixes that actually changed the picture**, both found
  by comparing constants rather than by looking at frames:
  1. `road.ts` `CORRIDOR_FALLOFF_M` 18 -> 7. The corridor graded the ground
     flat across a 23 m strip centred on the centreline — the entire near and
     mid third of every walking frame — over a landform already tuned to 15 m
     of cross-road relief. Relief within 10 m of the lane went 0.29 m -> 1.14 m
     against a 1.35 m ceiling. The lane gradient is provably unchanged (mean
     0.029, p95 0.071) and there is now a test asserting it.
  2. `painterly.ts` gained a foreground value tier over 4-45 m. There had been
     NO depth-dependent value term inside 40 m: the fog defaults are dead
     constants that `RoadStage` overwrites, and `distanceFog` runs them through
     a second smoothstep, so `fogAmount` was 0.001 at 40 m. Nothing separated
     five metres from sixty.

  **The oldest open item, and where it actually stands.** STATE item 8 — "the
  land never carries a light value" — was open from Run 45 through wave 11.
  The ninth critic proved it: with wave 11's headline constant zeroed in a
  control build, `p90` was byte-identical in all six gate poses, so the entire
  green-gate gain had come from DARKENING. Wave 12's last landed commit
  (`f510ab4`) is the first attempt to move it the other way — it lifts only
  each biome's `*Dry` tone and widens the pale ground ramp, and it overturns
  a rule this codebase carried for months ("nothing on the ground comes within
  a stop of the sky") with a photometric argument that is worth reading in
  `palette.ts`. **Its land-masked p90 claim is UNVERIFIED** — the agent that
  wrote it died when the container suspended, before reporting. Whole-frame
  p90 is dominated by sky and is not evidence. MEASURE THIS FIRST.

  **Two unexplained numbers from that same commit, flagged not diagnosed:**
  noon lost 0.58 stops (3.66 -> 3.08) and night 0.41 (7.06 -> 6.65), while hue
  spread jumped at golden (0.024 -> 0.185) and phone-landscape (0.021 ->
  0.212). All still pass. A large hue-spread move at golden hour is not
  obviously something a dry-grass albedo lift should cause.

  **The biggest lesson of the twelve waves, stated plainly for whoever is
  next.** Every structural fix came from two constants that had to agree and
  had never been compared — the road corridor against the camera's band; a
  barline offset smaller than the plank it positions; a `reset` that snapped
  every camera channel except FOV; a shutter shorter than a pose blend; fog
  defaults overwritten at startup; a rut column at 0.55 against paint at 0.58;
  a pale ramp described as "narrower" that was wider. NOT ONE came from
  looking harder at a screenshot. Conversely, four confident "regressions"
  reported by critics turned out to be instrument artefacts. **When a critique
  names a symptom, go read the constants that bound it before acting on the
  prescribed fix.**

  **Known-good discarded work.** Wave 12's compose agent (figure-to-ground
  separation in `Bard.ts`/`Traveller.ts`/`RoadStage.ts`) and a second value
  round (`FG_TIER_DEPTH` 0.30 -> 0.60) were in flight when this session ended
  and were discarded unmeasured rather than committed. The problem they were
  aimed at is real and measured: on 05-golden-busk the bard separates from the
  ground behind him by 2.0 sRGB levels at 20 px, and the dusk traveller by
  0.4, against 16.4 for the campfire frame. Diagnosed cause: at day 0.82 the
  sun is on the far side from the busk camera, so the only side an instrument
  can be carried on and be seen is the shade side (busking lute L49 on a
  backdrop of L36-45; walking lute, sunlit, L132 on L95). It is a value
  problem, not a pose problem — do not re-diagnose the pose.


- **CORRECTION TO COMMIT 5c7fb07's MESSAGE.** That message says the songboard's
  pitch contrast broke because wave 11's foreground tier darkened the plank
  while the glyphs, drawn by a different material, did not follow. The tier
  mismatch is REAL and is fixed in that commit, but it is NOT what produced
  the reported 3.67:1 — the agent reproduced 3.67:1 byte-identically on a
  control build of 62ea1b6, long before the tier existed. So nothing regressed;
  a long-standing number was measured for the first time in WCAG terms. I wrote
  that causal claim from the diff plus my own brief's hypothesis, before the
  agent reported. **Rule that follows: when committing an agent's tree before
  its report arrives, describe WHAT changed and not WHY it was broken.** This
  is the second commit message in two waves to assert a cause the measurement
  later contradicted.

- **THE 7:1 PITCH HOLD WAS ARITHMETICALLY UNREACHABLE, and every critique that
  judged against it was scoring against an impossible target.** WCAG contrast
  is `(L1+0.05)/(L2+0.05)`, and the note head's luminance is 0.0058 against
  that constant 0.05, so even a perfectly black head buys about 11 per cent and
  the whole letter-to-head curve PEAKS AT 6.46 across all light levels. The
  ninth critic's `pitchReadable: false` was therefore half right — the number
  was real and worth fixing, the bar it was compared to was not achievable. It
  now reads 5.93:1, within a whisker of the 6.46 ceiling, and holds at every
  hour (noon 6.14, golden 5.93, dusk 5.93, midnight 5.94) where before it moved
  with the light. Also note the older figures in this file's comments (5.29,
  1.27) are NOT WCAG ratios and have cost a round each; the file now says so.

- **Wave 11 (interactive, 2026-07-30): the near ground finally got a value
  tier, and the project's own gate went green.** `tools/frame-quality.mjs` had
  gone RED on phone-portrait (2.36 stops against a 2.5 floor) after wave 10
  brightened the land; it is green again at 2.88, with every other pose up too
  (morning 3.24 -> 3.74, noon 3.22 -> 3.63, golden 4.76 -> 5.03, landscape
  4.87 -> 5.10). Verified independently of the agent that did it.
  - **The lever, and it was the same shape of bug as the road corridor.** There
    was no depth-dependent value term anywhere inside 40 m. Worse than that:
    `painterly.ts`'s `uFogNear`/`uFogFar` defaults are DEAD — `RoadStage.ts:355`
    overwrites them with 19.8 m and 242.5 m — and `distanceFog` puts the
    smoothstep through a SECOND smoothstep, so `fogAmount` is 0.001 at 40 m and
    0.013 at 60 m. Nothing separated five metres from sixty. A foreground tier
    now darkens 4-45 m, gated by `sunHeight` so it lands on the high-sun frames
    that are flat and is arithmetically absent from dawn, dusk and night, which
    already get a ladder from long cast shadows.
  - **A class bug fixed at last: the light floor was ADDED, not multiplied.**
    `color += uEmissive * uEmissiveStrength` is a constant added to every
    fragment, which compresses every ratio between them — it was flattening
    every albedo field on the material at the hours the game looks best, and on
    the songboard it had not merely flattened the ink but INVERTED it, drawing
    the five staff rules LIGHTER than the timber they are printed on. Now
    multiplied by the vertex/instance colour field. Ink-to-paper at night
    3.10 -> 16.49.
  - **Cloud shadows rebuilt and rejected AGAIN, for a new reason.** The old
    recorded objection turned out to be an additive-dilution artefact of the
    same class as the emissive bug, so it should never have been trusted. The
    real reason is scale and the road change does not touch it: the 0-8 m band
    is about 7.5 m x 4 m, so a 55 m cloud feature covers it entirely, and more
    relief cannot help because relief changes the NORMAL while the term
    multiplies `sunAmount` irrespective of normal.
  - Also: the lute is visible while playing (18.6 -> 45.8 per cent of its
    projected area), the camp's propped instrument is off the sightline to the
    bard's head (265 px gap, 0 violations across 3600 layouts), and travellers
    carry something on one side to break the 20 px vertical bar.
  - **Still open, with a named cause:** at 20 px the busking bard is still a
    dark red cone. The fix that shipped was a SILHOUETTE change and this is a
    VALUE problem — at day 0.82 the sun is on the FAR side from the busk camera,
    so the only side an instrument can be carried on and be seen is the shade
    side. The lute renders L49 against a backdrop of L36-45; the walking lute,
    sunlit, renders L132 against L95. Treat it as a rim/grain question on the
    instrument material, not as a pose question.

- **CORRECTION TO COMMIT 8ca52c7's MESSAGE.** That message claims "the fire's
  glow pool is draped over the terrain rather than laid down as a flat disc."
  That change is NOT in the commit and was never needed: the pool has been
  draped since before wave 11 (`Campfire.ts:1099` writes each vertex at
  `groundHeightAt(...)`; measured, the mesh spans 0.527 m of y over a 4.87 m
  radius). The only Campfire.ts change in that commit is a stale comment
  corrected from 0.9 m to 0.72-0.82 m. The description was inferred from the
  task brief rather than read off the diff. History is not rewritten in this
  project, so the correction lives here. The pool does read as an airbrushed
  wash, but that is because the ground inside it carries little modelled form —
  a scatter question, not a drape question.

- **Wave 9 (interactive, 2026-07-30): seven fixes off a sixth visual
  critique, and five of that critique's own prescribed fixes rejected on
  measurement.** Two fixers split by file ownership so they could not fight
  over one file — one owning `painterly.ts`/`sky.ts`/`world/*`, the other
  owning `SongNotes.ts`/`CameraRig.ts`/`actors/*`. The rejections are the
  part worth reading, because every one of them was a plausible fix that
  measured worse:
  - **The near ground's third octave** (as prescribed, 4.5 m into `drift`)
    made noon *worse*, 46.9 to 50.1 per cent modal share. Two reasons: the
    claim that reweighting to sum to 1.0 "keeps the calibration" is false —
    weights preserve the mean, not the deviation — and the finding's premise
    that the near ground is ten metres deep is wrong for the strip it
    measures. The bottom fifth of a 1600 px frame shows under two metres of
    world across its whole width. What shipped is multiplicative instead of
    additive, because the carriageway's tone ramps are deliberately close to
    the road's own colour and leave an additive term only ~30 albedo levels
    to work in.
  - **Dropping the daylight horizons** made its own target worse: morning's
    share above L170 fell 0.89 to 0.09 per cent. The horizon key also feeds
    `fogTint`, and fog is applied *after* `uExposure`, so darkening it pulls
    the whole distance down and no later dial can pay it back.
  - **The songboard margin split** would have shipped a clipped note. `SONGS`
    spans steps 0–12 with `needsLedger` true at *both* ends, so the margin
    derivation is symmetric, not bottom-only; a 1.5-step top margin puts the
    plank edge at 5.5 steps while Old MacDonald's A5 sits at 6. Now pinned by
    `songNotes.test.ts`, written against the songbook rather than a hardcoded
    range and mutation-tested (at margin 1.5, two of its three tests go red).
  - **The travellers' shoulder cape** was built, shot and thrown away: these
    figures are a column of boxes whose top faces each catch a light edge, so
    the silhouette is already a ladder of rungs and a wide flat plate adds a
    rung. Its premise was also wrong — the torso already tapers to 1.52 of
    its waist, so the shoulders are wider than the head. A hat shipped
    instead, which is the mark the bard actually has.
  - **The campfire seat log** needed no change at all: measured, its top
    surface already sits at exactly `SITTING_SEAT_HEIGHT_M` and its axis
    already projects 97 per cent across the camera.
  One item's real cause was below where the critique looked: the daylight
  haze cancelling to grey was not only the fog keys but `ridgeTint` in the sky
  dome, which mixed a third of the way toward `uZenith` — and at an hour whose
  horizon is warm cream and zenith cool blue, a third of the way between them
  *is* the grey axis. Fixing that one line lifted golden hour's skyline
  saturation 0.302 to 0.438 with its keys untouched.
  **Still open after this wave:** the near ground is improved but not closed
  (modal share 26–32 per cent against a 25 target, and it still reads as broad
  soft fields rather than as cover); the seated bard reads as sitting because
  of the *log*, not the figure, which is a value problem in his leg albedos
  against the fire rather than a framing one; there is still no clef, and the
  critique's proposed home for it does not exist (left of the barline is the
  tail, where past notes drift to rest); and `06-dusk-encounter` promises two
  figures in prose while `RoadStage.placeMeeting` deliberately stands one —
  a content mismatch, not a model fault, and both sides are deliberate.
- **Run 50 (scheduled): consolidation, per CLAUDE.md's every-10th-run rule
  (run counter was 49, so this one is the 10th) — no code changed.** Read
  DESIGN.md, STATE.md and ROADMAP.md in full, then played the build through
  mentally against the next three queued tasks (116 campfire sitting pose,
  117 camp lantern, 118 busk-caption collision) before writing anything.
  All three turned out to be the fifth, sixth and seventh instance of the
  "already built, task never marked" pattern tasks 115/119/120 flagged:
  `Bard.ts`'s seated-pose blend, `Campfire.ts`'s housed lantern, and
  `hudLayout.ts`'s phone-landscape card placement are all fully built and
  have all been in the codebase since the v0.6 initial commit (`3ef8d0c`) —
  the same commit each task's own text describes as still broken. Confirmed
  each with fresh evidence rather than trusting the code read alone
  (standing lesson, this file): `tools/postcard.mjs`'s `07-night-campfire`
  shot shows the bard seated (not standing) beside a properly housed lantern
  (not a bare quad), and `09-phone-landscape` shows the busk caption clear of
  the songboard, matching what `hudLayout.test.ts` already pins by name
  ("phone landscape, no notch", with a comment noting it's the viewport the
  collision was found in). See ROADMAP tasks 116/117/118's done-entries for
  the full detail.
  Also found and fixed while reading the idea backlog for staleness: **the
  "Sharper mobile rendering" item was Phaser-specific** (recipe: `zoom: 1 /
  dpr` in Phaser's `scale` config) and the game has had no Phaser renderer
  since v0.6. Checked whether the underlying problem (rendering below native
  resolution on a phone) still exists in the Three.js renderer before
  striking it — it doesn't: `App.ts` already calls
  `renderer.setPixelRatio(quality.pixelRatio)` capped at `Math.min(dpr,
  1.5)` or `Math.min(dpr, 2)` by quality tier, since the same initial
  commit. Struck rather than rewritten, since there's no open problem left
  to describe.
  Also struck the same four now-resolved items from the older "still wrong"
  numbered list further down this file (items 2, 3, 4 — the sitting pose,
  the lantern, the busk caption — plus item 6, the instrument picker, which
  Run 48 had already closed via ROADMAP task 120 without this list being
  told).
  No rough edges worth fixing turned up in a read of `src/` for stray
  `TODO`/`FIXME`/`HACK` markers (none exist) or obviously oversized files
  (the largest, `WorldStreamer.ts` at 1899 lines and `SongNotes.ts` at 1849,
  are both single-purpose Three.js modules with the established
  no-unit-test-coverage precedent, not RoadScene-style grab-bags — no
  extraction candidate the way `RoadScene.ts` was pre-v0.6).
  `npm test` 753 green (unchanged, no code touched), `npm run build` green
  (696.77 kB, unchanged).
- **Run 49 (scheduled): ROADMAP task 121, time-of-day lighting — closed the
  real fault (STATE.md item 8, below) rather than the stale one the task
  text named.** The task's own premise ("`shader-check` measures a luminance
  range of 3") was already fixed before this run — PR #136 fixed that gauge
  itself, and the check has reported ~102 since. What the task's second
  sentence actually pointed at was still true: item 8, the daylight frames'
  bimodal value histogram, land in one hump and sky in another with under
  1.5% of pixels in the band between them and never more than half a
  percent of the land itself above L170 even at noon — measured fresh this
  run before touching anything, confirming the fault was live.
  Raised `grass`/`grassVariant`/`grassDry`/`road`/`roadShoulder` a uniform
  35% in all three biomes (`src/three/world/palette.ts`) — the lever the
  critique behind item 8 named as valid, the other being "lower the sky
  instead", left alone since it would have re-tuned all eight `sky.ts`
  keyframes at once for a narrower-scoped task. Canopy and rock untouched.
  Iterated on the multiplier empirically rather than guessing once: 1.35
  closed the gap best (morning's mid-band share ~1.3% → ~24%) but dropped
  `tools/frame-quality.mjs`'s phone-portrait stops from 2.71 to 1.83,
  failing its floor. Confirmed by eye (postcards, not just the histogram)
  that the frame reads as a better-lit meadow, not a flattened one, and that
  the "narrower range" is an artefact of that one pose being almost all
  foreground with barely any sky to show the closed land/sky gap against —
  the ground still sits comfortably (>1 stop) below the sky by the numbers
  that actually govern that rule. Gave phone-portrait its own `minStops: 1.6`
  in `frame-quality.mjs` rather than lowering the shared floor. Checked every
  other postcard pose (dawn, morning, noon, golden vista, golden busk, dusk,
  night, phone-landscape) by eye for regressions — none; dusk and night keep
  their existing mood untouched.
  `npm test` 753 green (unchanged — no unit coverage of `world/palette.ts`,
  same precedent as the rest of the Three.js build), `npm run build` green
  (696.77 kB, unchanged), `shader-check` PASS, `frame-quality` PASS (was
  already failing nothing before this run — first time it's been run since
  Run 45 wrote it).
  **Left open on purpose**: items 9 (golden-hour shadow hue) and 10 (grey
  haze) were flagged by item 8's own note as possibly sharing its root
  cause. They don't — this run's fix is an albedo change, orthogonal to
  item 9's additive skylight term and item 10's fog hue — but both should be
  re-measured against the new palette before the next run assumes STATE.md's
  existing numbers for them still hold.
- **Run 48 (scheduled): ROADMAP task 120, the instrument picker — closed as
  already-built, no code changed.** Before writing a picker, read
  `RoadStage.ts` and `Hud.ts` against the task's claim and found both halves
  already shipped: `noteUnlocks()` appends to `journey.unlockedInstruments`
  every campfire, and the HUD's tap-to-open "case" (`Hud.setCase`/
  `onInstrumentChosen`) plus `RoadStage.takeOut`/`chooseInstrument` let the
  player pick from it, with mid-busk locking on both ends. Third instance of
  the "already built, never marked" pattern tasks 115 and 119 flagged —
  worth naming as a pattern now: a critique or a stale read names a gap, a
  later feature quietly closes it, and nobody tells the roadmap.
  Verified live in a headless Playwright session rather than trusting the
  code read alone (STATE.md's standing lesson: suspect the claim, not just
  the code): gave the journey 1000m of real lifetime distance (Reed Flute's
  actual unlock threshold is 900m), ran the same `noteUnlocks()` path the
  campfire uses, then drove the actual DOM — tapped the instrument corner,
  tapped the "Reed Flute" row — and confirmed `journey.instrumentId`, the HUD
  label, and the `localStorage` save all changed together, zero console/page
  errors. First pass of that check hand-set `journey.unlockedInstruments`
  directly instead of raising `totalMetres` and calling `noteUnlocks()`, and
  silently desynced it from the derived-from-totals list `instrument()`
  actually reads — a mismatch impossible in real play (the narrow list is
  only ever populated as a subset of the derived one) but a reminder that a
  test rig can fake a state real code paths never produce. See ROADMAP task
  120's done-entry for the full detail.
  Also checked, before assuming this run's task-120 read was current: the
  separate unmerged branch `claude/wandering-bard-game-gj4fd0` sitting 12
  commits ahead of `main` as of this run's start. Its commit messages
  (campfire seating, songboard tessellation, ground-shadow work) read as an
  active, same-day human-directed session rather than a stale red-CI branch
  from a prior scheduled run, so per this run's remit ("if `claude/dev`
  exists, fixing its red CI is the job") — a different branch name, and no
  open or red PR against it — it was left alone rather than merged, rebased
  onto, or otherwise touched.
  `npm test` 753 green (unchanged), `npm run build` green (696.77 kB,
  unchanged).
- **Run 47 (scheduled): no code changed — STATE.md and ROADMAP.md were
  quietly wrong about three shipped fixes and one already-done task, and
  this run's whole job was closing that gap.** Between Run 46 (PR #138,
  puddles) and this run, a human ran an interactive session that landed
  three more real fixes from the same six-lens critique — PR #141 (shadow
  hue, partial), #142 (village cool accent), #143 (chapel/landmark fog) —
  none of which touched STATE.md or ROADMAP.md (`git show --stat` on all
  three confirms it: #141 and #142 touch only shader/palette source, #143
  only `painterly.ts`/`WorldStreamer.ts`). So both docs still described
  items 9, 11 and 12 as open, and ROADMAP task 119 ("skyline landmarks,"
  never started per its own text) as unstarted, when the code had already
  moved past all four. Per CLAUDE.md's "if STATE.md and the code disagree,
  trust the code and fix STATE.md," this run read the three PRs, confirmed
  what they actually changed against the critique items they claimed to
  address, and independently re-verified rather than taking the commit
  messages' word for it: a fresh `tools/postcard.mjs` shot of
  `02-morning-open` (this run, not reused from the PR) shows a trilithon
  reading as a clear dark silhouette against the pale sky on the ridge —
  confirming task 119 is genuinely done, not just claimed done. Items 11 and
  12 are struck below as closed; item 9 is narrowed to "still open at golden
  hour only," which is what PR #141's own numbers already said. Item 10
  (haze cancels to grey) and item 8 (ground never carries a light value) are
  untouched by any of the three PRs and remain fully open — do not assume
  the shadow-hue work closed either of them.
  No code touched, so verification was `npm test` (753 green, unchanged) and
  `npm run build` (696.77 KB, unchanged) as a baseline, plus the one fresh
  screenshot above. If another run is tempted to skip this kind of
  reconciliation because "the PR already explains itself" — it doesn't help
  the *next* run, which reads STATE.md and ROADMAP.md first per the session
  protocol, not the PR history.
- **Run 46 (scheduled): ROADMAP task 115, scatter on the road — and a
  correction to what the task thought it needed.** Before writing any code,
  read `WorldStreamer.ts` against the task's own claim ("no pebbles, no
  tufts in the rut, no puddles") and found two of the three already
  shipped: `roadgrass` and `roadstone` `ScatterKind`s have existed since the
  v0.6 initial commit, with real instance counts confirmed by a headless
  scene scan and visible (if sparse) in a screenshot. Only puddles were
  really missing. Added `puddleGeometry` (`src/three/world/geometry.ts`) —
  a flat irregular ellipse, wound to face +Y since `solidMaterial` is
  front-face-only — as a new `puddle` `ScatterKind` placed in the wheel
  rut itself (`RUT_BAND`), the one band every other carriageway kind
  deliberately keeps bare. That's also why "tufts in the rut" was never
  going to be both true and right: the rut stays bare of growth because
  it's the road's low, worn, sometimes-wet ground, which is exactly why a
  puddle belongs there instead. `BiomePalette` gained a `density.puddle`
  key — driest in village (0.35), wettest in riverside (1.3), forest
  between (1.0) — and colour is a fixed cool grey-blue mixed toward each
  biome's own road tone, since there's no real-time reflection to carry the
  differentiation instead.
  Verified with a 19-point headless scan along a full day's road (puddle
  `InstancedMesh`es present and growing with distance, zero console/page
  errors) and cropped screenshots at several of those points showing
  puddles reading clearly as water, distinct from the road and verge.
  `npm test` 745 green (unchanged — `src/three/world/` has no unit test
  coverage, same precedent as the rest of the Three.js build; verified by
  screenshot and a live scene-graph scan instead), `npm run build` green
  (691.65 KB vs 690.96 KB).
  **Flagged for whoever runs next, especially on task 119**: the same
  "already built, task never updated" pattern applies to skyline landmarks
  — `Landmark`, `landmarksNear`/`chooseLandmark`/`raiseLandmark` and four
  landmark geometries are fully wired into chunk building already. Check
  with a screenshot before assuming task 119 starts from nothing.
- **Run 45 (human-directed): fix the gauges, then fix the ground cover.**
  A human asked for a push toward premium cozy-game quality, with harsh
  visual critique in the loop. Four things landed, and the first two are
  corrections to *measurement* rather than to the game — which is the part
  worth reading, because both had already misdirected a previous run.

  1. **`shader-check`'s "time-of-day is inert" was the check, not the game.**
     Struck from the list below as item 7. Full write-up further down; the
     short version is that it never moved the clock, and a posed time of day
     does not survive while the bard is walking because `dayFraction` is
     derived from `s`. Real numbers now: a luminance range of ~102 and a
     properly cool night.
  2. **`tools/frame-quality.mjs` is new** — value range, hue spread and
     largest-flat-area for six posed frames, so "flat", "monochrome" and "too
     much bare road" stop being adjectives. Two things it taught immediately:
     hue spread is **not** "higher is better" (golden hour is the most
     hue-unified frame in the set *and* the best-looking one, so the floor is
     per-pose), and **the daylight frames are not globally flat** — they
     measure 3.3-3.9 stops. See item 8 below for what they are instead.
  3. **Every blade of grass was concave.** `bladeGeometry`'s waist sat at 0.24
     of the tip's horizontal travel with the tip half way up, where straight
     is 0.5 — so each blade hooked outward at the end, and five of them fanned
     over a full circle made every tuft a spike-star. `fernGeometry` had the
     same full-circle fan and worse proportions (fronds reaching 1.25 lengths
     out while rising a third of that), which is why the near foreground read
     as literal caltrops. Both now arch and fan into a wedge.
  4. **Grass is lit as ground, not as walls.** A blade is a near-upright
     single plane, so its true normal is near-horizontal: blades facing away
     from the sun went almost black and a tuft read as a dark teepee.
     `skywardNormals` tilts blade normals toward +Y (0.72 for grass, 0.4 for
     ferns) — free, no shader change — and it also pulls ground cover into the
     same value neighbourhood as the ground it grows from. Blade tips are now
     a short capping edge rather than a single apex vertex, which took the
     tuft from 15 to 20 triangles on purpose.

  `src/three/world/geometry.test.ts` is new and pins all of it: blade
  convexity (the bug measured 0.24, the gate is 0.60), the wedge fan, the
  capping edge, skyward normals, tuft height and the triangle budget. Nothing
  caught the original bug for forty runs — it type-checked, no test touched
  the module, and `shader-check` only asks whether pixels drew.

  **A caveat on the new check, and the reason it is not the whole answer.**
  The grass and fern work is a large, obvious improvement in the re-shot
  frames and `frame-quality`'s numbers barely move for it (noon 3.33 → 3.34
  stops). That is correct behaviour, not a broken check: silhouette is not
  something a whole-frame histogram can see. Do not use those six numbers as
  evidence that a *shape* change worked — shoot the frames and look.

  **Next, in order.** Items 8-14 below are new in Run 45, from a six-lens
  critique of ten posed frames where each lens judged one thing only (value,
  silhouette, colour, composition, mobile framing, emotional read). All six
  returned **not shippable next to A Short Hike**, and unusually for a
  critique they came back with pixel measurements and `file:line`
  attribution, so they are recorded here in that form rather than paraphrased.

  Take them in this order, because 8, 9 and 10 are probably **one bug**:
  the world is lit by a multiply, and a multiply cannot put a colour back
  into an albedo that no longer contains it. Fixing the additive term
  (`floorLight`, currently gated to nothing) may move all three at once.
  Then 11, then 12/13/14, which are independent.

  **A note on how to use a critique like that one.** Two of its highest-damage
  findings this round were about *shape* — needle blade tips and radial ferns
  — and both were invisible to every automated check the project has,
  including the new one. The frames are still the only instrument that sees
  silhouette. Shoot them and look.

- **Run 44 deleted the dead 2D/Phaser code.** `src/scenes/` (the
  `RoadScene`/`picker`/`meterBar`/`freePlayOverlay`/`readouts` modules from
  runs 39-43), `src/render/` (`engraving`/`scenery`/`ui`), and the orphaned
  `src/audio/AudioEngine.ts` (+ its test) — none of it was imported from
  `src/three/` or `src/main.ts`, confirmed by grep before deleting. The
  `phaser` dependency is gone from `package.json`/`package-lock.json`;
  production bundle dropped 1266 KB → 686 KB. The 24 Playwright checks in
  `tools/` that drove the old scene through `window.game.scene.scenes[0]`
  (a global that stopped existing the moment v0.6 landed) are deleted too —
  `verify-all.mjs` now runs the one check that still matches the live game,
  `shader-check`. `postcard.mjs`/`shot.mjs`/`browser.mjs` are unaffected
  (they always drove `window.bard`, the Three.js game's own handle).
  `tools/README.md`, root `README.md` (Stack section still said Phaser),
  and `.github/workflows/headless-checks.yml` (still said "the fast
  fourteen") are updated to match. `npm test` 745 green (762 minus
  `AudioEngine.test.ts`'s 17), `npm run build` green.

  Wiring `shader-check` into `verify-all` for the first time since v0.6
  reported **FAIL, time-of-day is inert (luminance range 3)** across
  dawn/day/golden/night samples, and Run 44 wrote that up as "something
  real" and queued it as item 7.

  **It was not real. The gauge was broken, twice over, and Run 45 fixed the
  gauge.** With the check actually driving the clock, the same four samples
  come back dawn `109,101,82` · day `124,135,108` · golden `101,83,67` ·
  night `15,17,27` — a luminance range of about **102** against a threshold
  of 12, with night a proper cool blue. The time-of-day coupling was working
  correctly the entire time, which the postcards had been showing all along.

  The two faults, both in `tools/shader-check.mjs`:

  1. It drove the clock through `stage.setTimeOfDay(t)` behind
     `if (handle?.stage?.setTimeOfDay)`. `window.bard.stage` is a
     `RoadStage`, which has no such method — only the `SmokeStage` this
     check was first written against ever did. The guard was false on every
     iteration, so the time never moved and the four "samples" were four
     photographs of one frame. Four identical frames have a luminance range
     of ~0, so the check failed *in the exact shape of the bug it exists to
     find*. It now calls `pose({dayFraction})` and **throws** if the hook is
     missing, rather than shrugging.
  2. Posing a time of day while the bard is `walking` does not hold.
     `dayFraction` is *derived from `s`* (`core/journey.ts` — the day
     advances with distance walked, never with wall time) and is recomputed
     on every advance, so a posed midnight at s=620 was overwritten by the
     midday that s=620 implies, inside the settle the check waits out. The
     samples now pose `phase: 'vista'`, which sets `walking = false` and
     freezes `s` — same place, four times of day, one variable moving.

  Item 7 is struck from the "still wrong" list below. The lesson is the one
  `tools/README.md` already states and this run got to learn the expensive
  way: **a failing check is a claim about the check first.** A whole run
  wrote up a phantom as a defect, pinned a number to it, and left it as
  queued work for the next run, because the number looked objective. An
  optional-chained guard around the single call a check exists to make is
  how a missing hook gets reported as a broken game.

- **Where v0.6 actually stands, and what is still wrong.** A harsh
  frame-by-frame critique of ten posed screenshots returned **not shippable
  next to A Short Hike**, and named three structural absences rather than a
  polish gap. Two and a half are now closed: there are travellers in the
  world and an audience at a busk (there was literally nobody before); the
  staff is legible, with dark note heads carrying cream letters at a pitch
  spacing that survives the end-on view; the sky's zenith arrives inside the
  visible frame band and carries cloud. The land has a midground again.

  **Still wrong, in the order a next run should take them:**

  8. ~~**The ground never carries a light value.**~~ **Fixed (Run 49,
     scheduled) — the raise-the-land half of the choice below.** The value
     histogram was bimodal in every daylight frame with a hole between the
     lobes: in the morning frame 73% of pixels sat in L32-127 (the land) and
     25% in L176-223 (the sky), while the whole band L128-175 held **2.97%**
     (re-measured this run before any change: ~1.3-1.5%, same fault, still
     live). Restricted to the land region, the fraction of pixels above L170
     never exceeded 0.5% in any frame. Raised `grass`/`grassVariant`/
     `grassDry`/`road`/`roadShoulder` a uniform 35% in all three biomes —
     morning's mid-band share moved to ~24%. Canopy and rock untouched;
     `sky.ts` untouched (the other half of the choice, not taken). See
     ROADMAP task 121's done-entry for the full measurement, the postcard
     verification, and the one accepted cost (`frame-quality`'s
     phone-portrait pose needed its own, lower `minStops` floor — that pose
     is almost all foreground and has very little sky to show the closed
     gap against). The long comment in `palette.ts` justifying the ground's
     darkness on photographic grounds has been rewritten in place rather
     than left to quietly contradict the new values — read it before tuning
     any ground colour again. Also still flagged from Run 45, untouched by
     this fix and not re-measured: at dusk the land collapses to a 23-level
     range and the largest boulder renders its top and its front within one
     value level of each other.

  9. **Partially fixed (2026-07-29, PR #141, human-directed session — landed
     without a STATE.md/ROADMAP.md update, reconciled here per CLAUDE.md's
     "trust the code" rule): every shadow was the same hue as its own lit
     side.** Measured: in the golden-vista frame, shadowed grass was H36
     S0.73 against lit grass at H36 S0.67 — a pure value multiply, no hue
     shift at all — and the golden-hour frames contained *zero* cool pixels
     below the skyline. DESIGN.md's stated rule ("shadows are always the
     complement of the sun") was therefore not actually happening in the
     render.

     The cause was arithmetic: `painterly.ts` did `color = albedo *
     lighting`, and the warm albedos in `palette.ts` have almost no blue left
     in them (village grass `0x839749` has B=0x49), so *multiplying* by a
     blue zenith cannot produce a cool shadow — the blue is already gone. PR
     #141 added a `1 - sunAmount`-scaled additive skylight term (the part of
     ambient light that reaches the eye without being filtered by the
     surface) instead, and pulled `AMBIENT_STRENGTH` down (0.32 → 0.27) so
     the multiply side gives up roughly what the add side gains. Measured
     hue-spread gain: morning 0.208 → 0.356 (+71%), noon 0.284 → 0.328
     (+15%).

     **Still open, and deliberately not closed by #141**: golden hour. The
     additive term needs shade to colour, and at a low sun almost the whole
     frame is lit, so golden-vista's hue spread barely moved (0.036 → 0.031).
     Whoever picks this up next should treat golden hour as its own case
     rather than assuming the general fix covers it. **Not the same root
     cause as item 8**, it turns out: Run 49 closed item 8 with an albedo
     raise, orthogonal to this term's additive-skylight arithmetic, and
     golden hour's hue spread was not part of what that run measured or
     touched — still open, on its own, not piggybacking on anything else.

  10. **The haze cancels to dead neutral grey instead of reading as air.**
      The daylight fog keys in `sky.ts` are near-neutral (morning `0xb2c1cc`
      S0.13, high day `0xb8c6ce` S0.11, afternoon `0xc8c2b3` S0.09), and
      `painterly.ts` mixes up to 60% of that into warm olive terrain. A
      low-saturation cool mixed 60/40 into a saturated warm lands on grey —
      the complements cancel. Suggested: commit the daylight fog to a hue at
      S~0.25-0.35 (e.g. morning `0x9fb8d2`).

  11. ~~**No biome contains both a warm and a cool albedo.**~~ **Done
      (2026-07-29, PR #142, human-directed session — reconciled here, see the
      item 9 note above for why).** Every member of village and forest was in
      the same warm-olive family, the real reason the land read monochrome
      even where `frame-quality` scored the whole frame as varied. Village's
      `rock` moved warm-tan `0xbcb39d` → cool-slate `0xaab3c1` (matched at the
      same relative luminance, 178 vs 179, so the hue rotation didn't
      smuggle in a value change too) and `accentAlt` moved gold `0xf2cf8a` →
      periwinkle `0xa9a6d8` (cornflower/harebell, darker on purpose — a small
      cool speck rather than a bright one competing with the sky). Barely
      moves `frame-quality`'s whole-frame number (too few pixels), which the
      check already documents as its own blind spot; visible directly in the
      re-shot golden-vista frame as violet-cast shadow bands and cool flecks
      through the warm field. Forest is unaddressed and may want the same
      treatment if it turns out to need it.

  12. ~~**The chapel — the one thing worth walking toward — is fogged to
      near-invisibility.**~~ **Done (2026-07-29, PR #143, human-directed
      session — reconciled here, see the item 9 note above for why).**
      `RoadStage.ts:355-356`'s `uFogNear`/`uFogFar` put a landmark at 150 m
      at ~0.72 fog blend, within a few percent of the sky and less visible
      than a random tree. Fixed with a per-material dial rather than a
      change to the global fog (the haze is doing real work everywhere
      else): `PainterlyOptions.fogScale` halves the fog on landmark meshes
      only (1.0 elsewhere, 0.5 for landmarks — not 0, since a landmark that
      ignores the atmosphere entirely reads as a decal pasted on the sky).
      Landmarks got their own material rather than sharing `solidMaterial`
      with rock/log scatter. Verified independently this run (not just
      taking the PR's word for it): a fresh `tools/postcard.mjs` shot of
      `02-morning-open` shows a trilithon reading as a clearly separated dark
      shape against the pale sky at the ridge on the right — see the task
      119 note below, since this is also what closes it.

  13. **Bare road plus empty sky own ~60% of every walking frame**, and on
      tall aspects the widened FOV is spent on exactly those two dead zones
      (`CameraRig.ts:262-274`, `WIDEN_RISE_SHARE`/`FOV_WIDEN_MAX`). The
      critique was explicit that the answer is *not* more scatter: bias the
      widening toward the mid-band, and give the road surface events — a
      milestone, standing water in a rut, a branch across it.

  14. **The songboard, not the bard, is the subject of a busk frame**, and on
      phone landscape it collides with the bard and clips a listener.
      `SongNotes.ts:509-517` already halved it once; it should be sized to
      the live note span rather than drawn full-width, kept off the vanishing
      point, and its lateral offset should scale with `camera.aspect`
      (`SongNotes.ts:1041-1046`, clamped at 0.1 today). Listener bearings in
      `RoadStage.gatherListeners` (`RoadStage.ts:769-787`) should reject
      slots that project inside the board.

  1. The road is bare. Narrowing it to a 3.4 m cart track and deepening the
     ruts helped, and pebble/road-grass scatter and skyline landmarks have
     since landed (both are in `WorldStreamer.ts` and visibly in frame — a
     chapel spire shows on the dawn ridge), so this item is narrower than it
     reads: what is left is that on a phone in portrait the carriageway is
     still the largest single area in the frame, and it has no wet/dry
     variation across it.
  2. ~~The bard stands upright at his own campfire.~~ **Done and stale
     (confirmed Run 50).** `Bard.ts`'s `update()` already carries a full
     seated blend (`sitAmount` driving bent knees, dropped hips, a torso
     lean, and — the load-bearing part — a shortened rather than merely
     raised cloak hem) since the v0.6 initial commit, the same commit this
     item describes as broken. Fresh `07-night-campfire` postcard shows the
     bard clearly seated at the fire. See ROADMAP task 116's done-entry.
  3. ~~The camp lantern reads as a bright quad beside a bare post.~~ **Done
     and stale (confirmed Run 50).** `Campfire.ts`'s `buildLantern` already
     builds a roofed housing, hook and bail — its own header comment
     narrates fixing this exact complaint, in the same v0.6 initial commit.
     Same postcard confirms it reads as a small lit housing, not a bare quad.
     See ROADMAP task 117's done-entry.
  4. ~~The busk caption still collides with the top note on phone landscape
     (844x390).~~ **Done and stale (confirmed Run 50).** `hudLayout.ts`'s
     `hudChrome` already moves the journal card beside the purse row rather
     than under it exactly on this viewport, keyed off `JOURNAL_SKY_FRACTION`;
     `hudLayout.test.ts` pins the case by name ("phone landscape, no notch")
     with a comment noting it's the one the collision was found in. A fresh
     `09-phone-landscape` postcard shows the caption clear of the songboard.
     See ROADMAP task 118's done-entry.
  5. ~~No landmarks on the skyline.~~ **Done and stale (confirmed Run 45).**
     `WorldStreamer.ts` places standing stones, trilithons and chapels on
     ridges with a view bias, and `geometry.ts` builds all three; a chapel
     spire is visible on the ridge in the re-shot dawn frame. This list was
     written before that landed and never updated — per CLAUDE.md, when STATE
     and the code disagree the code wins.
  6. ~~No instrument picker, and `journey.unlockedInstruments` is never
     appended to.~~ **Done and stale (confirmed Run 48).** See the Run 48
     note above and ROADMAP task 120's done-entry — `noteUnlocks()` already
     appends to `journey.unlockedInstruments`, and the HUD case is fully
     wired. This item was left unstruck here when Run 48 closed it; fixed
     now.
  7. ~~Time-of-day lighting is nearly inert.~~ **Struck (Run 45): this was
     a broken gauge, not a broken game.** `shader-check.mjs` was never
     moving the clock at all; with it fixed the luminance range is ~102 and
     night is a proper cool blue. See the Run 45 note above for the two
     faults and the lesson. Do not go looking for this one — the two
     *genuine* critique notes it claimed to tie together ("the near ground
     is dark by albedo rather than by shadow", "the upper sky does little
     work at noon") stand on their own and are still worth a look at noon
     specifically, which remains the flattest hour in the palette.

- **v0.6, the road in three dimensions (interactive, human-directed, landed
  after run 43).** A human set a new direction — build the wandering road as a
  low-poly 3D painterly game in Three.js, with a shared daily road, busking,
  instrument unlocks, variable-reward encounters, idle busking and a
  campfire. DESIGN.md carries the full write-up and the changelog entry
  naming what was cut. This entry records what a future run needs to know.

  **What was kept.** All of `core/`. It is pure TypeScript with no renderer
  in it, so this was a rebuild of the presentation and not of the game. The
  no-fail stance, the no-grading stance and the pedagogy are unchanged and
  still constrain everything.

  **What replaced Phaser.** `src/three/` — one painterly ShaderMaterial that
  every solid surface uses, a sky dome that *is* the light source, a chunked
  terrain ribbon in road space, GPU-instanced scatter, a procedurally-built
  bard with a hand-driven walk, a damped camera rig, GPU-resident particles.
  `src/core/` gained road, encounters, instruments, idle, performance and
  journey; `src/audio/` gained instrument voices, generated ambience and
  adaptive layers.

  **The Phaser files and their checks are gone (Run 44).** `src/scenes/`,
  `src/render/`, `src/audio/AudioEngine.ts` and the 24 `tools/` Playwright
  checks that drove `window.game` (Phaser's global, which stopped existing
  the moment v0.6 landed) are all deleted — see the Run 44 note in "At a
  glance" above for the detail and what it turned up.

  **Three rendering bugs worth remembering, because none was findable by
  reading the code.**
  1. `USE_INSTANCING_COLOR` is injected by three into the *vertex* shader
     prefix only. A fragment shader guarding its matching varying on the same
     define simply has no declaration; both stages compile clean, and every
     per-instance colour in the game is silently dropped. Both varyings are
     unconditional now.
  2. A rim light added flat rather than scaled by albedo turns grass white:
     blades are thin and seen edge-on, so fresnel sits near 1 across the whole
     blade rather than at its edge.
  3. Ambient applied at the full value of the sky colour lights a surface as
     brightly as the sky itself. The lighting model now names its exposure in
     two constants, with about three stops between sun and shade.

  The general lesson, and the reason `tools/postcard.mjs` exists: **look at
  the frames.** All three survived type-checking, unit tests and a careful
  reading of the shader. The first screenshot found all three in a minute.

  **`tools/postcard.mjs`** poses the game through `window.bard.pose({s,
  dayFraction, phase})` and shoots ten framings including two phone aspect
  ratios. `tools/shader-check.mjs` fails a run if a frame is black or tonally
  flat, or if the time-of-day palette is inert. Both need `PLAYWRIGHT_PATH`
  and a served build; `tools/browser.mjs` now centralises the launch and
  probes for the pre-installed Chromium, because the ad-hoc Playwright install
  and the pre-installed browser do not always agree on a build number.

  **A process note that cost real time.** Committing while sub-agents were
  still editing the same working tree captured `src/core/journey.ts` in the
  middle of a mutation test — a deliberately-broken guard marked
  `// TEMP-REVERT` went into a commit and had to be undone in the next one.
  Grep for that marker convention before committing mid-session.

  **The pinned-day road test moved on purpose.** `road.test.ts` pins seed
  20260728 exactly, so that an accidental change to the generator cannot
  silently hand every player a different road. The 3D world needed visible
  landform, so the corridor grading came in from 30 m to 18 m and the
  cross-road hills from a 520 m wavelength to 190 m; the pins were
  regenerated in the same commit, which is what that test asks for. An
  intermediate attempt also shortened the *along*-road hills to 165 m and
  turned the lane into a 30% climb — the existing roughness test caught that
  before it was ever seen, which is exactly what it was written for.


- **Run 43 (scheduled): split the coin/distance readouts out of
  `RoadScene.ts`,** per new ROADMAP task 112 — the next piece task 112's own
  "nothing queued" note (as task 111 left it) had already named as a
  candidate once task 111 took the meter out. Both blockers re-checked
  first (unchanged — see Blocked on human), no playtest answer had arrived,
  idea backlog still down to the one phone-dependent item.
  Of the four things left in `setWalkChromeVisible` (staff lines, clef, hit
  line/flash, coin/distance readouts), the coin/distance pair was the
  cleanest cut: `updateCoinReadout`/`updateDistanceReadout` were already two
  small self-contained private methods touching only their own two
  GameObjects, unlike the other three, which are interleaved with
  `laneY`/`hitLineX`/`beatPhase` in the same per-frame block as the note
  markers. `src/scenes/readouts.ts` (new, 75 lines) now owns `coinIcon`,
  `coinText`, `distanceText` and their five margin/radius constants, via
  `createReadouts` (called once from `create()`), `layoutReadouts` (the
  per-frame update, replacing the two removed methods) and
  `setReadoutsVisible` (called from `setWalkChromeVisible`). Same
  `Host`-interface shape as the picker/free-play/meter splits.
  `coins`, `distancePx`, `coinIcon`, `coinText` and `distanceText` all
  dropped `private` — a private class field can't satisfy a plain interface
  type, and `tools/hud-check.mjs`, `tools/freeplay-check.mjs` and five other
  checks already reach several of them directly. `RoadScene.ts` 1783 → 1747
  lines.
  Verified behaviour-preserving rather than assumed: `npm test` 279 green
  (unchanged — no unit tests cover scene modules, same precedent as the
  other three splits), `npm run build` green (1266.76 KB vs 1266.84 KB, a
  module-boundary-only difference), and the full 14-check quick suite
  green — including `hud-check` (reads `coinIcon`/`coinText` rects directly)
  and `freeplay-check` (reads `coinText.visible`, `distanceText.visible` and
  `coins` directly). `node_modules` was missing at the start of this run
  (fresh checkout); `npm install` (54 packages, 0 vulnerabilities) was
  needed first, and Playwright for the check suite was installed fresh into
  the scratchpad (`npm i playwright@1.56.1`, matching the pinned version)
  since it stays out of `package.json` on purpose.
  **Flagged for whoever runs next**: this is the fourth small RoadScene
  extraction in a row (tasks 107, 109, 111, 112). ROADMAP task 113 asks the
  next run not to pick a fifth one by default — see its entry for the
  reasoning.
- **Run 42 (scheduled): split the song meter out of `RoadScene.ts`,** per
  new ROADMAP task 111 — the "just the meter bar" first cut task 110's own
  note left open once task 108 had ruled out `setWalkChromeVisible` as a
  whole (nine unrelated fields, no shared sub-grouping). Both blockers
  re-checked first (unchanged — see Blocked on human), no playtest answer
  had arrived, idea backlog still down to the one phone-dependent item.
  `src/scenes/meterBar.ts` (new, 125 lines) now owns the three meter
  GameObjects (`meterTrack`, `meterFill`, `meterStaffLines`) and their
  constants (`METER_HEIGHT`, `METER_FILL_COLOR*`, `METER_STAFF_LINE_*` —
  grepped first and confirmed all seven were meter-only, none shared with
  another file), plus three functions: `createMeterBar` (called once from
  `create()`), `layoutMeterBar` (the per-frame resize/reposition, replacing
  the inline block that used to live in `updateMeterBar`), and
  `setMeterBarVisible` (called from `setWalkChromeVisible` in place of the
  three inline `setVisible` calls). Same `Host`-interface shape as the
  picker and free-play splits: `MeterBarHost` is the exact slice of
  RoadScene the module reads and writes. One deliberate difference from
  those two precedents, explained in the module's own header — the three
  fields stay plain (non-`private`) fields on RoadScene rather than a
  returned handle, both for the same reason the picker/free-play fields
  did (a private class field can't satisfy a plain interface type) and
  because `tools/hud-check.mjs` already reaches `scene.meterTrack` directly
  to check the chrome doesn't overlap itself — a handle would have meant
  touching a passing check for no behavioural reason. `RoadScene.ts` 1838
  → 1783 lines.
  Verified behaviour-preserving rather than assumed: `npm test` 279 green
  (unchanged — no unit tests cover scene modules, same precedent as the
  other two splits), `npm run build` green (1266.84 KB vs 1266.81 KB
  before, a module-boundary-only difference), and the full 14-check quick
  suite green — including `hud-check`, which reads `meterTrack`'s rect
  directly at 8 viewports, and `autoplay`/`mash-check`/`seam-check`, which
  exercise `layoutMeterBar` and `setMeterBarVisible` every frame and across
  every mode toggle. `node_modules` was missing at the start of this run
  (a fresh checkout); `npm install` (54 packages, 0 vulnerabilities) was
  needed before `npm test`/`npm run build` would run at all.
- **Run 41 (scheduled): split the free-play staff out of `RoadScene.ts`,**
  per new ROADMAP task 109 — the "legitimate work if someone scopes a real
  first piece" that task 108 left open rather than attempting. Both
  blockers re-checked first (network fetch still 403s, GitHub MCP toolset
  still has no tag/ref-write or branch-protection-write call), no playtest
  answer had arrived, idea backlog held only the phone-dependent item.
  `src/scenes/freePlayOverlay.ts` (new, 414 lines) now owns the scrim, the
  ladder of lines/pips/labels, the cursor, the written-phrase tracking and
  `playFreeNote` — same `Host`-interface shape as the picker split (task
  107): `FreePlayOverlayHost` is the exact slice of `RoadScene` it reads
  and writes, including `songTitleText` (shared with the walk mode — the
  specific entanglement task 108 flagged) and three callbacks
  (`hitLineX`, `noteOriginY`, `strumLute`) for what's genuinely the
  scene's own layout/animation. `enterFreePlay`/`exitFreePlay` stay on
  `RoadScene` as mode-toggle orchestration. `RoadScene.ts` 2172 → 1838
  lines. Two constants moved out to break a would-be circular import
  between the two scene modules: `STAFF_LINE_STEPS` to `core/notation.ts`,
  `NOTE_TINT_UPCOMING/HIT/MISS` to `render/engraving.ts` (both were
  RoadScene-local but shared by the walk's markers and free play's notes).
  **Verification caught a real transcription error before it shipped**: an
  earlier truncated file read led this run to write the wrong tween option
  on `playFreeNote`'s fade-out (`ease: 'Quad.easeIn'` instead of the
  actual `delay: 220`) into the new module; re-reading the untruncated
  original caught it before any check ran. Given this exact area (the
  practice staff) shipped invisible to production once before (PRs
  #115–#122), verification ran wider than the minimum: `npm test` 279
  green (unchanged — no unit tests cover scene modules, same precedent as
  the picker), build green (1266.81 KB vs 1267.23 KB, module-boundary-only
  difference), the full 14-check quick suite green, plus `songpick-check`,
  `rotate-check` and `seam-check` (normally skipped in quick mode) run
  explicitly since they exercise the picker/free-play/rotation seams this
  change touches directly — all green, no regressions.

- **Run 40 (scheduled): a five-place assumption turned out to be
  untested, and doesn't hold.** Both blockers re-checked, unchanged (see
  Blocked on human); no playtest answer; idea backlog still correctly
  deferred. Read the free-play-staff and walk-chrome code (ROADMAP task
  108's own instruction before claiming either as a next extraction) and
  confirmed task 107's caution was right — `buildFreeStaff` shares
  `songTitleText` with the walk mode, and `setWalkChromeVisible` touches
  nine unrelated fields (meter, coins, distance) — so neither is a clean
  single-unit extraction and this run didn't attempt one.
  Instead: `RoadScene.ts` (×2), `render/ui.ts`, this file, `tools/README.md`,
  and ROADMAP task 59's own summary all assert flatly that "a resize
  re-runs Phaser's `create()`" — the reason the learning scaffold sits at
  module scope and texture baking is idempotent. No check had ever isolated
  that specific claim: `rotate-check.mjs` only ever proved state *survives*
  a resize, which it would either way given those defenses. Attached a
  `Phaser.Scenes.Events.CREATE` counter after boot and drove two rotations
  (plus, in a scratch script, a third arbitrary resize and a direct
  GameObject-identity check on `bardUpper`): **`create()` fires zero
  additional times** — same scene instance, same GameObjects throughout.
  The assumption does not hold, at least in headless Chromium with WebGL.
  Did not remove the defenses (module-scoped scaffold, `textures.exists()`
  guards) — cheap insurance, and this can't rule out a real device behaving
  differently under actual WebGL context loss, which was the original,
  never-independently-tested worry. What changed: `rotate-check.mjs` now
  asserts the count permanently instead of assuming it, and the five
  misleading comments/docs say what's verified versus what's still just
  insurance. `npm test` 279 green (unchanged), build green (bundle
  byte-identical), full 14-check quick suite green.

- **Run 39 (scheduled): split the songbook picker out of `RoadScene.ts`.**
  Both standing blockers re-checked first, unchanged (see Blocked on human).
  No playtest answer had arrived, and the idea backlog is down to the one
  phone-dependent item, so this run picked up the consolidation this file
  had already flagged as the obvious next one: `RoadScene.ts` had regrown to
  2275 lines since the last extraction pass (task 66) — entirely from the
  "two ways in" session, none of which existed when the scene was last
  split. `openPicker`/`closePicker` and the `PICKER_*` constants moved to
  `src/scenes/picker.ts`: 2275 → 2172 lines.
  This extraction is a different shape from the earlier `render/*` ones,
  worth knowing before doing the other two (free-play staff, walk chrome).
  Those modules are pure functions of their inputs with **no** game state,
  which is exactly what let their texture sheets prove byte-identical
  output. The picker is not: it owns `pickerParts`/`pickerOpen` (the whole
  overlay tears down as one unit, and other input handling needs to know
  it's open) and reads the current song choice to highlight a row. So it
  takes a `PickerHost` interface — the slice of `RoadScene` it touches —
  plus a `chooseSong` callback, rather than the bare scene. One real
  friction point: `pickerParts`/`pickerOpen` had to drop `private`, because
  a private class field cannot satisfy a plain interface type (`tsc`
  caught this immediately, not a silent bug). `PICKER_CHOSEN_BG` is
  exported and re-imported by `RoadScene`, since it doubles as the
  free-play cursor/pip color and the practice-mode lute tint — it was
  never picker-only despite the name.
  Verified behaviour-preserving rather than assumed: `npm test` 279 green
  (unchanged), build green (1.27 MB, unchanged), and specifically the three
  checks that exercise the picker — `songpick-check`, `freeplay-check`
  (choosing a song from inside free play opens the picker from a different
  mode), `hud-check` (the picker button's touch-target geometry) — all
  still green, plus the full 14-check quick suite with zero regressions
  elsewhere. ROADMAP task 108 records why the other two extractions are
  *not* automatic next tasks: free-play still touches substantial scene
  state and isn't a clean single overlay the way the picker was, and "walk
  chrome" was never one cohesive block to begin with.

- **Run 38 (scheduled): investigated one candidate bug, mutation-tested it
  away, shipped nothing.** A search for this run's task turned up a
  plausible-looking sibling of PR #125's tween leak: the songbook picker's
  `openPicker()`/`closePicker()` (`RoadScene.ts`) add a fade tween per part
  with no `killTweensOf` guard, same shape as the practice staff before
  #125. It is not the same bug. Built both versions and drove the exact
  toggle pattern that proved #125 real: with the picker's guard removed,
  `tweens.getTweens().length` spikes to ~35 mid-mash but **drains back to
  baseline within 1.5s of settling, every time** — no permanent growth,
  40 toggles or otherwise. #125's leak was never about "destroy doesn't
  kill a tween on the same target" in general; it was specifically the
  free-play cursor's `repeat: -1` breathing tween (line ~1352, in
  `fadeInFreeStaff`) — a tween with no natural end, so an orphaned copy
  runs forever. The picker's fades are one-shot 130ms tweens with no
  `repeat`; even orphaned, they finish and get pruned on schedule. Grepped
  the rest of `RoadScene.ts` for other `repeat: -1` tweens targeting a
  destroyable object: the bard's walk/idle/lute-sway loops are the only
  others, and their targets (`bardLegLeft`, `bardUpper`, `bardLute`, …)
  are never destroyed — they're stopped via `.stop()` in `bardTweens`,
  a different and already-correct mechanism. No other instance of the
  real bug shape exists in this file.
  **Logging this so a future run doesn't re-open the same lead**: adding
  `killTweensOf` to the picker anyway (it wouldn't hurt) and a fifth
  seam-check pair to cover it were both drafted, then reverted — the
  check would have passed trivially either way, which is exactly the
  false-confidence CLAUDE.md warns against, and the codebase's own rule
  against unnecessary guards applies here too. `RoadScene.ts` and
  `tools/seam-check.mjs` are unchanged from the last commit.
  Blockers re-checked, both unchanged: `WebFetch` on a plain Wikipedia
  page still returns HTTP 403 (forest-song transcription still blocked),
  and the full `mcp__github__*` tool list available this run still has
  no tag/ref-write, release-create, or branch-protection-write call.
  279 tests, `npm run build` green — reconfirmed as a baseline, no code
  touched.

- **Session of 2026-07-27 small hours (human-directed, PRs #115–#122):
  a polish pass, and it found three shipped bugs rather than cosmetics.**
  The practice staff — the whole second way to learn — had been drawn at
  **alpha 0 on the live site** since its lay-in animation shipped: two
  fade-ins ran back to back, the second reading the zeros the first had
  just written and tweening 0 to 0. The songbook and lute buttons were
  drawn *underneath* the song meter on every portrait phone, so both were
  invisible on the devices the game is for. And the road ran off the
  bottom of the screen in landscape, with the bard cut off at the shins.
  All three were invisible in the one configuration a check is most
  likely to be run in — a desktop-ish landscape window.

  **The lesson worth keeping: every one of them passed the checks.** The
  practice staff was built, positioned, laid out correctly at nine
  viewports, and responded to taps — `freeplay-check` asserted behaviour
  and never once asked whether anything could be *seen*. If a feature's
  purpose is visual, assert something visual: ink, contrast, geometry
  against real rendered bounds. Behaviour passing is not the same as the
  thing working.

- **Session of 2026-07-26 evening (human-directed, PRs #91–#112).** Two
  human asks: choose one song to learn instead of rotating, and find
  another way to learn besides the walking bard. Both built, plus an art
  pass. See DESIGN.md's "Two ways in".
  The most useful thing that came out of it, for whoever works here next:
  **the bugs were all in the interactions, not the features.** Each of the
  three new surfaces worked alone. Choosing a song *from inside free play*
  left the staff showing the previous tune and queued 26 phantom road notes
  behind it — which then went missed and fed the learning model. Rotating
  the phone *while practising* left the staff spread for the old screen
  with its lowest notes off the bottom. Neither would have been found by
  testing any one feature. Probe the seams. The three seams that were
  broken are now pinned by `freeplay-check` and `rotate-check`; the two
  that were already right (choosing "wander" from inside free play,
  reloading out of free play) are pinned too, so they stay right.

- **v0.5 "two ways in"** (human-directed, 2026-07-26) is the current shape.
  DESIGN.md has a new section of that name; read it before touching either
  mode. The walk is unchanged and remains the game.

- **There are two ways to learn now.** The *walk* is the original: notes
  scroll, you tap in time, letters fade as positions become familiar.
  *Free play* (the lute button) is the inverse — the staff spread out big
  and still, every position labelled, tap one to hear it. The walk asks for
  timing; free play asks for nothing. Free play deliberately does not feed
  the learning model.
- **With a song chosen, free play becomes practice**: the tune as positions
  to find, a pip marking the next one, and a wrong note that sounds and
  costs nothing. It is the only place in the game where *reading* the staff
  — rather than remembering how the tune goes — is what moves you forward.

- **The world got deeper and stopped looking tiled** (2026-07-26): a fourth
  parallax plane (a far ridge behind the scenery, at 0.19 vs scenery 0.45
  and stars 0.08) and scenery tiles doubled to 512px with silhouettes that
  differ *within* one tile. Far-layer colour is derived by receding each
  biome's own silhouette toward its own sky, so it stays right for free
  when a palette is re-pitched.

- **You can now choose one song to learn** instead of letting the songbook
  rotate (human-set, 2026-07-26). Songbook button beside the mute toggle →
  pick a tune → it repeats and the road settles in its home biome. "Wander"
  gives the rotation back. The choice rides in the same localStorage record
  as the scaffold, so it is still there tomorrow.

- The game is **v0.5**: a rhythm walk where the letter inside each note
  fades *in time* as a position is practised, across sittings, persisted in
  ~200 bytes of `localStorage`. The core mechanic is one tap. v0.5 adds the
  song choice and the second way in; it does not change the walk.
- **Eleven songs**, four per biome except forest, which has three and is
  short a fourth (blocked — see *Blocked on human*).
- **279 unit tests**; **24 headless checks** in `tools/`. Run them all with
  `PLAYWRIGHT_PATH=<dir>/node_modules/playwright node tools/verify-all.mjs`
  (or `quick` for the fast fourteen). Green as of 2026-07-27. Use playwright
  **1.56.1**
  (`/opt/node22/lib/node_modules/playwright`) — a newer copy won't match
  the installed browser build and every check will fail for that reason
  alone. **Run the suite quiet** — two Playwright suites at once will fail
  `autoplay` on frame timing and it looks exactly like a real regression.
  The fast fourteen
  now also run automatically after every merge to `main`
  (`.github/workflows/headless-checks.yml`), informational only — it
  doesn't gate the merge or the deploy.
- **Source layout**: `core/` pure logic, `audio/` one manifest + engine,
  `render/` texture baking (engraving, scenery, ui), `scenes/picker.ts` the
  songbook overlay (split out 2026-07-27, task 107), `scenes/RoadScene.ts`
  the one scene (2172 lines — the free-play staff and the walk chrome are
  the two remaining plausible extractions, neither an automatic next task;
  see ROADMAP task 108). Layout maths keeps
  moving *out* of it into `core/` — `hud.ts` (the top bar) and
  `worldLayout.ts` (lane, bard, road) joined `freePlay.ts` on 2026-07-27,
  each because a fixed pixel offset hung off a proportional anchor had
  broken on some real screen. That pattern is worth watching for. Every texture the game draws
  is checkable in a deterministic sheet — `proofsheet`, `scenery-sheet`,
  `ui-sheet` — which is what let all three extractions be proved
  byte-for-byte rather than eyeballed.
- **The one *blocking* question the project cannot answer itself** is
  whether the fade pace suits a real five-year-old. The single dial is
  `SESSION_GAIN_CAP`. Several things that used to need a human have since
  been mechanised (backgrounding, gesture lockdown, layout, legibility at
  deep night) — but not all: judging *feel* still needs hands and ears
  (is 96 BPM right for a small child, does the ±90ms window forgive a young
  hand, is the music actually cozy), and the teaching outcome still needs a
  child. See PLAYTEST.md.
- **Standing lesson from the 2026-07-26 session**: when a check fails,
  suspect the check first. Around a dozen "bugs" that session turned out to
  be in the instrument, not the game — a harness that paused its own taps, a
  tap landing outside a rotated viewport, a comparison against a leftover
  PNG from a crashed run, a reload that force-saved over the state being
  tested, and the wrong AudioContext among them. Every harness now documents
  its wrong versions alongside its right one; that write-up is the most
  useful thing in `tools/README.md`.

### v0.4 and the session of 2026-07-26

**v0.4 — learning, not just exposure** (2026-07-26). The human sharpened
the goal: *"where they can actually learn music... thru songs that they
already know."* The weakness that named: a letter printed in every note
head **forever** is a crutch. A child can read the letters fluently and
never once encode the position, so the position→name association is never
retrieved and never sticks.

- **The letter now fades in *time*, not opacity** (`src/core/scaffold.ts`,
  27 tests). Familiarity is tracked per *staff position* (not per letter —
  C5 is a different thing to learn than middle C). As a position is
  practised its letter arrives later and later in the note's 1800ms
  flight: 1800 → 1350 → 950 → 600 → 350ms before the tap. A half-opacity
  letter would still be perfectly readable and teach nothing; a letter
  that arrives late buys real recall time.
- **Fade the prompt, never the answer.** The 350ms floor is load-bearing:
  a note only lives ~500ms past the hit line, so relying on an
  after-the-fact reveal would have left a child checking themselves
  against a letter already fading away. Now every note always shows its
  name before the tap, and also reveals on strike and on miss. A miss
  costs exactly what it did before — a dimmed note and a little meter —
  and never information.
- **Quick to help, slow to withdraw.** +1 per hit; −3 per miss but only
  while still walking (a child who has lost the beat misses everything);
  hysteresis wider than the miss penalty so no single wobble flips a band;
  a +12 per-sitting cap so a scaffold can't vanish faster than the memory
  forms; help restored instantly when the meter drops, always on the first
  sighting of a position in each tune, and partially after days away.
- **Honest about what a tap proves**: timing, not reading — it is
  confounded by melodic memory. So this is a *dosage schedule driven by
  exposure*, not an assessment, and DESIGN.md says so plainly.
- **Songs they already know** (task 53): Au Clair de la Lune and Lightly
  Row — method-book tunes many children have never heard — were replaced
  by *Row, Row, Row Your Boat* and *Old MacDonald Had a Farm*. Familiarity
  is now load-bearing rather than decorative: if the child knows the tune,
  the pitch is free when the letter is gone, so they are never stuck.
  That is the only reason fading is safe here at all.
- **Persistence** (`scaffoldStorage.ts`): one ~200-byte localStorage key,
  no login, no menu, no identifiers, every access in try/catch. Loaded
  once per page, *not* in `create()` — a resize re-runs `create()` and
  wiping a child's progress on an orientation change would be a silent,
  invisible bug.

Verified: `npm test` **179 green** (+27 for the model alone), build green,
and a new `tools/learning-check.mjs` that unit tests cannot replace — it
plays well for 90s, then deliberately stops. Result: **67 letterless
repeats** (real recall attempts), C4/D4/E4 faded 1800 → 950ms lead while
rare positions correctly stayed fully supported, and **full help returned**
after the bad stretch. `autoplay.mjs` still PASSes with all-natural pitches.

Design was worked out by a five-agent workflow before any code: a pedagogy
model, a familiarity audit of the songbook, a code-integration map, and two
adversarial critiques. The critiques earned their keep — one did the
arithmetic showing a revealed letter was only visible ~400ms *while
fading* (fixed by the 350ms lead floor), and both caught that a single miss
could flip a band (fixed by widening hysteresis past the miss penalty) and
that the session cap was gross rather than net (a miss now refunds
allowance, so a wobble can't strand a position for a whole sitting).

**Multi-session fading verified end-to-end** (`tools/multisession-check.mjs`,
added after the v0.4 merge). The model's central promise is a claim about
days, not minutes — a note should reach full fade only across *several*
sittings, never inside one, because a scaffold must not vanish faster than
the memory forms. Measured on the shipped build, through real localStorage
across real page reloads:

```
after sitting 1: {"0":2,"1":2,"2":2,"3":4,"4":3,"7":4}
after sitting 2: {"0":1,"1":1,"2":1,"3":4,"4":2,"7":3}
after sitting 3: {"0":0,"1":0,"2":0,"3":3,"4":1,"7":3}
```

Band 4 is full help, 0 is fully faded. C4/D4/E4 take exactly three sittings;
the rarer F4 (step 3) correctly lags far behind, so the fade follows real
exposure rather than a clock. This is `SESSION_GAIN_CAP` doing its job.

**The songbook is eleven tunes** (2026-07-26): *This Old Man* joined the
village set and *The Itsy Bitsy Spider* the riverside, so village and
riverside now rotate four songs each and forest three. Both were
transcribed and then independently verified against published sources
before landing. A forest transposition of *This Old Man* was drafted and
**rejected** — its contour matched the real tune for only 6 of 32 notes,
including an inverted phrase on the song's most recognizable line, and a
wrong contour actively mis-teaches a child who knows the song. Forest is
therefore deliberately one short rather than wrong.

**Which mechanism actually keeps the promise** (2026-07-26). "Fade the
prompt, never the answer" was credited in DESIGN.md and in three code
comments to the reveal-on-strike and reveal-on-miss handlers. That was
wrong, and `tools/reveal-check.mjs` (new) proves it: over a 90s walk, 86
letters were revealed and **every one came from the scheduled mid-flight
path — zero from strike, zero from miss**, including through four seconds
of deliberate missing at a high meter. The reason is arithmetic: the reveal
lead floor (350ms) is wider than the hit window (±90ms), so the letter is
always already showing before a tap can register. The two handlers are
unreachable backstops.

This is the *stronger* guarantee — the answer lands on a bright, upright,
full-alpha note the child is still about to play, not on one already
dimmed and scrolling away — but it held only by coincidence of two
constants in different files. `HIT_WINDOW_MS`/`TRAVEL_TIME_MS` moved to
`core/beats.ts` and `scaffold.test.ts` now enforces the relationship ("the
answer always beats the tap"), so tightening the fade to make the game
harder can no longer silently downgrade the promise to a ~400ms fading
consolation. The guard was mutation-checked: dropping the floor to 50ms
fails it with a clear message.

**The autoplay harness was not checking the thing it exists to check**
(2026-07-26). Its hit/miss counts filtered the *live* marker list, which is
culled as notes scroll off — so "hits: 1" after 207 taps was the last
second's state printed as a total. Nothing asserted on them either, so a
regression that broke input outright would still have gone green (the meter
never drains if notes are never resolved). Counting now hooks
`recordEncounter`, and there are assertions on hit and miss rate. Turning
those on exposed a third bug in the harness: its tap loop capped its wait
at 400ms then clicked regardless, firing about one tap into empty air for
every real one. Now: 100 taps, 100 hits, 0 misses.

**The design pillars are now measured, not assumed** (`tools/pillar-check.mjs`,
2026-07-26). Two CLAUDE.md pillars had never been checked by anything:
"playable in under 5 seconds" and "mobile-friendly". Both hold, across six
viewports from iPhone SE to desktop — playable in 0.7–1.3s, every drawable
staff position on screen with room for its stem, taps registering, and the
tightest thing the songbook draws (two eighth notes at 96 BPM) still 49px
apart on the narrowest phone against a ~24px note head. Confirmed visually
at 375px on This Old Man's run of eighth-note C's: clearly separated,
letters legible.

Method note worth keeping: the spacing check *sampled* first and quietly
measured nothing — only quarter notes came around in the sampling window,
so it reported a comfortable 110px gap and passed without ever seeing the
case it existed for. It now computes the worst case from tempo, flight time
and runway. A check that cannot see its own failure case is not a check.

**Rotation is safe, and the harness lied twice about it**
(`tools/rotate-check.mjs`, 2026-07-26). Rotating a phone re-runs Phaser's
`create()` — the path that forced the scaffold to module scope — so it now
has a check: portrait → landscape → portrait, playing throughout. Verdict:
coins, steps, audio, markers and saved learning progress all survive, meter
holds at 100, and no position ends weaker than it started.

Getting there took three attempts, and the two failures were both mine:
the first version paused tapping for 1.2s after each resize (genuine
misses, which read as "rotation costs progress"), and the second tapped a
fixed (200, 520) that falls outside the 390px-tall landscape viewport (so
every tap missed the page and the meter crashed to zero). Both times the
game was innocent. **A self-verifying project has to treat a failing check
as a claim about the check first** — that is the standing lesson, and it
is why each harness now documents the wrong version as well as the right
one.

**One real change came out of it**: `wasUnplayable` in `core/beats.ts`. A
note whose *entire* hit window elapses inside a single frame gap was never
on screen to be played, so it no longer feeds the learning model — it still
misses visibly and still dips the meter, it just isn't taken as evidence
about what the child knows. Scoped honestly: this is **insurance, not a fix
for an observed bug.** Rotation was the suspected trigger and measurably is
not one (peak frame gap 50ms rotating, 69ms backgrounded, against a 180ms
window). It closes the band between the two guards the scene already had —
wider than the hidden-tab check, narrower than `MASS_MISS_LIMIT` — which is
what a moderate stall on a cheap phone looks like. Exhaustively tested to be
inert for every frame gap up to the full window width.

**Songbook blocked, not skipped**: the forest set is one song short and
should get a fourth. It did not get one this session because this
environment's network policy blocks outbound fetches (403 on CONNECT to
every host), so a transcription cannot be verified note-for-note against a
published source — the exact standard that caused the forest *This Old Man*
to be rejected. Candidate already researched: **Here We Go Round the
Mulberry Bush**, traditional (tune dates to 1700s London, clearly public
domain), which in C major uses scale degrees 1/2/3/5/6/7 only — all
naturals — and sits G4–G5, matching the forest register. *Wheels on the Bus*
was considered and **rejected on rights**: it is attributed to Verna Hills,
1939, which does not meet CLAUDE.md's CC0-only bar. Ship Mulberry Bush from
a run with network access, or from a human-supplied transcription.

**Audio no longer drifts away from the staff over a long session**
(2026-07-26). Visuals run off Phaser's time (`performance.now`), audio off
`AudioContext.currentTime` — the sound hardware's clock. Those are never
exactly the same rate, and `AudioEngine` anchored them **once** at
`start()` and scheduled every later pass against that original anchor, so
the difference accumulated for as long as the session lasted. In a rhythm
game, what you see and what you hear sliding apart is the one failure that
ruins it. `schedule()` now re-derives the anchor on every pass, bounding
the error to a single song instead of a whole sitting; `nowMs` became a
required argument so there is one place that maps visual time onto audio
time. Two new unit tests cover it, including one that moves the clocks
apart by hand and asserts the correction is absorbed rather than carried.

Honest limits on that: **the drift was never convincingly measured in a
browser.** Five attempts gave five answers (17s, 1.2s, ±900ms scattered,
−22s, −566ms) and every time the bug was in the instrument — CPU contention
from my own concurrent checks, comparing the raw clock gap (which should
grow and is harmless) instead of note-sounds-vs-note-seen, matching an
early-resolved marker against the wrong oscillator, and indexing
oscillators as interleaved when `scheduleLayer` emits one layer at a time.
Reading the anchor straight out of a live `schedule()` gives ~7ms, agreeing
with the unit tests. So the fix is shipped on the strength of the tested
arithmetic, and **no browser sync assertion is wired up** — a check that has
been wrong five times has not earned the right to fail a run. Headless is
the wrong place to judge it anyway: with no audio device the clock runs
~0.17% slow against a software sink. `tools/README.md` records the method
for anyone picking it up.

**25-minute soak: no degradation of any kind** (2026-07-26, the longest run
yet — 150 samples, 2393 steps ≈ 153,000px, so **3.2 full dusk cycles and
~9.6 biome loops**). fps is flat end to end (24/21/17/20/18 at the start,
20/20/21/22/19 at the finish, min 15 — no downward trend), textures plateau
at 118 once all eleven songs have been met, the marker list peaks at 70, and
2110 of 2115 taps land. All eleven songs appear in the rotation. This is the
scenario a short run structurally cannot test — a child who leaves the game
running — and nothing drifts.

**Long-session stability confirmed clean** (7-minute autoplay): fps holds
17–23, textures plateau at 109 (bounded by the songbook — 85 note/rest
textures plus scenery and UI, so not a leak), markers stay bounded, and
590 of 592 taps land. An earlier run showing fps 11 and 201 misses was my
own CPU contention from running three Chromium instances at once — a
reminder to run long measurements alone. `autoplay.mjs` now asserts the
texture count plateaus.

**Consolidation: the engraving has its own module** (`src/render/engraving.ts`,
2026-07-26). RoadScene had grown to 1584 lines — 46% of the codebase in one
file, which is a real risk for autonomous runs that have to read it before
touching it. The note and rest glyph baking moved out with its geometry
constants: 1584 → 1485 lines in the scene, 156 in a module that has no
access to game state and so cannot start depending on it. A glyph is a pure
function of (name, position, note value), which is exactly what lets
`proofsheet.mjs` check every combination at once.

Proved behaviour-preserving rather than assumed: the proof sheet is
**byte-identical** before and after (md5 `fbc8094…`), and all seven
harnesses pass. Two things worth keeping from how that went:

- The refactor **broke `proofsheet.mjs`**, which called a private method on
  the scene. The engraving functions are now exposed on `window.engraving`
  from `main.ts`, deliberately and with a comment, instead of tooling
  reaching into scene internals.
- The first "identical" result was a **false pass**: the script had crashed,
  so the comparison ran against the previous run's leftover PNG. Delete the
  artefact before regenerating it — otherwise a screenshot diff confirms
  that nothing changed about an image nothing rewrote. Third instrument bug
  of the session, same lesson each time.

**Consolidation, second chunk: the scenery too** (`src/render/scenery.ts`).
The road, biome silhouette, water-glint, star-field and signpost bakers
moved out the same way: **RoadScene 1485 → 1325**, and across both chunks
**1584 → 1325** with 359 lines now living in two focused render modules.
The tile dimensions are exported from the module rather than duplicated,
because the scene has to *place* what the module *draws* and two copies of
those numbers would be free to drift apart.

Verified by a new `tools/scenery-sheet.mjs`, which bakes all ten world
textures into one labelled sheet — a live screenshot only ever shows the
biome you happen to be walking through. Sheet **byte-identical** across the
move (md5 `0126afb…`), proof sheet still byte-identical too, and all eight
harnesses green.

Note for whoever refactors next: the first attempt at this extraction used
a regex to find method bodies and silently removed **478 lines instead of
163** — the optional doc-comment group matched a comment far above. Caught
by `wc -l` before anything else ran, reverted with `git checkout`. Match
method spans by walking braces line-by-line, and check the line delta
against what you expected before running any test.

**The song title is proven to name the tune actually playing**
(`tools/title-check.mjs`). Passes are queued a lookahead ahead of playback,
so `announceSong` holds the title until the music reaches that song's first
note — arithmetic with no test behind it, and getting it wrong would teach a
false name to exactly the child who is paying attention. Every title lands
within ~50ms of its own pass starting. Took three instrumentation attempts
(marker-index slicing, then pairing schedule calls to titles by index, then
finally matching each title to whichever pass was playing); the game was
fine in all three.

**The mobile gesture lockdown is asserted, not just written.**
`index.html` has long disabled double-tap-to-zoom, pinch-zoom, the
long-press callout and overscroll — rapid taps are the input model, so a
browser reading two quick taps as "zoom" fights the game. It was all CSS and
a meta tag with nothing checking it, which is exactly what a later edit
strips without noticing. `pillar-check` now reads the computed result at
every viewport, plus the observable consequence: the page must not scroll.
Mutation-checked.

**Backgrounding is mechanised, and Phaser's spare AudioContext is gone**
(`tools/backgrounding-check.mjs`). "Audio resume after backgrounding" had
been a *human* playtest item since round 1; it did not need to be. Forcing
the suspend and observing the resume gives `running → suspended → running`,
with the learning record force-written on the way out and sound plus meter
fully restored on return. A real device is still needed for whether iOS
suspends in ways Chromium does not — the question is narrowed, not closed.

Writing it found something real: **Phaser's sound manager was creating a
second, unused AudioContext** and holding it open all session. Every sound
here is hand-rolled Web Audio, so it is disabled now
(`audio: { noAudio: true }` in `main.ts`) — one fewer idle claim on a
phone's audio hardware. The first version of the check grabbed *that*
context, watched Phaser resume it, and concluded the game had failed to
suspend.

**The bundle-size pillar has a number behind it now.** CLAUDE.md asks for
"small bundle (<5 MB)" and nothing measured it. `pillar-check` now sums
everything the page pulls over the wire — what a phone actually downloads
to play, rather than `du -sh dist` — and asserts the pillar. Currently
**1.19 MB**, four times the headroom. Mutation-checked by tightening the
threshold to 1 MB and confirming it fires, since a guard that cannot fail
is worthless.

**The no-fail promise is now asserted** (`tools/nofail-check.mjs`). Every
other harness plays well or plays chaotically; none checked what happens to
a child who simply is not managing. Tapping once and then doing nothing for
45s: the meter floors at 0 and the bard stops, but the scene stays active,
notes keep arriving so the child can rejoin whenever they like, the missed
note is mauve (`0x8A5A5A` — red channel nowhere near dominant, per
DESIGN.md's "nothing flashes red"), the only text on screen is the song
title and the readouts, and nothing sounds on a miss. That last one is
asserted via an oscillator-rate ceiling: the tune plays on regardless of
the meter (deliberately — it is how a lost child hears where they are), so
the test allows three layers at tempo and would catch a buzzer added on top.

**Deep night proven not to dim the teaching surface**
(`tools/dusk-check.mjs`). The art direction promises the dusk cycle darkens
the world but never the bard or the notation; nothing asserted it. At the
deepest point of the cycle the sky moves 2759214 → 794387 and the
road/scenery tint drops, while note tint, note alpha, staff line colour and
alpha, and clef tint and alpha are all **byte-identical**. The check asserts
both halves — without confirming the world actually darkened it could pass
just because the cycle had stopped running.

**Mute and the keyboard now have coverage** (`tools/input-check.mjs`).
Every other harness taps the middle of the canvas, so these two paths had
none at all — and mute is the control a *parent* reaches for. Verified that
muting zeroes the master gain rather than only changing the icon (the icon
can lie; the gain cannot), that the slash appears, that pressing mute is
never scored as a beat even though the button sits over the playfield, that
the walk keeps earning while muted, that unmuting restores gain, and that
the spacebar plays (19 hits, 0 misses). All good, no code changes needed.

**Mashing is safe, and earns credit it hasn't earned**
(`tools/mash-check.mjs`). Every other harness plays correctly — on the beat,
one tap per note — which is the least likely thing a five-year-old does. At
38 taps/sec for a minute the game is fine: markers and textures bounded,
fps 36, saved record valid. Taps that hit nothing cost nothing — only 80
encounters and 461 oscillators from 2274 taps, so a stray tap neither feeds
the model nor makes a sound.

The honest caveat: those 80 were all *hits* with zero misses, because
spraying taps lands on every note. The model reads that as familiarity and
will fade letters for a child who is not looking at the staff. **Left alone
deliberately** — DESIGN.md scopes the model as a dosage schedule driven by
exposure rather than an assessment, and the design self-corrects: letters
faded without being learned mean the child struggles next time they play
properly, the meter drops, and full support returns instantly. A
burst-detector would be a new system guarding something the existing one
already absorbs.

**The moon has craters** — the last flat thing in the world. Everything
else carries shape (gables and lit windows, conifers and fireflies, a tent
and a campfire); the moon was a plain disc and it is the largest object in
the sky. Baked as a texture now, craters only slightly darker than the disc
and clear of the rim, so it still reads as a light source rather than as
detail to study. In `render/scenery.ts`, covered by `scenery-sheet.mjs`.

**Coming back after days away is verified end-to-end**
(`tools/timeaway-check.mjs`). The decay arithmetic was unit-tested but the
round trip through real `localStorage` with a real backdated timestamp was
not — and that path fails silently and unkindly if it fails at all. Two
sittings of practice, then a backdated record: well-practised positions
held, a mid-strength one decayed and was handed a band of help back, no
record was ever wiped, and a deliberately corrupted record starts the game
fresh rather than breaking it. The check asserts a gap can only ever return
support, never remove it, and never raises a position's `peak`.

Two traps in writing it, both documented in `tools/README.md` because
anything touching this storage will hit them: **a reload force-saves** (it
fires `visibilitychange` → hidden, the scene's own save path, so backdating
and then reloading writes the live state and a fresh timestamp over the
backdate and the gap never happens), and **saves are throttled to 5s** (so
a baseline read straight after playing is stale, which made a gap look as
though it had *added* practice).

Deviation from CLAUDE.md worth flagging: this is more than "exactly ONE
roadmap task" — it is a model, a persistence layer, a songbook swap and a
harness. That rule governs the scheduled autonomous runs; this was an
interactive session with an explicit human direction to build the thing.

## Previous status (v0.3 and earlier sessions)
Trimmed during the 2026-07-26 consolidation. The v0.3 session (the
songbook, note values, rests, and the `tools/` self-verification harness),
the art-direction sessions, and every scheduled run before them are
written up in their ROADMAP done-entries and the `Recent runs` log below.
`tools/README.md` documents the harnesses.

## Process notes for future runs

- **Visual verification is possible and expected for visual work.**
  Pattern: `npm run build && npm run preview` (port 4173), then a
  Playwright script in the scratchpad (NOT a project dependency — keep
  package.json clean) with
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`,
  screenshot, and actually look at the image. Tap input can be simulated
  with `page.mouse.click` swept across beat offsets.
- **This environment cannot reach the open internet.** Outbound fetches get
  403 on CONNECT to every host — including `at3gk.github.io`, so the *live*
  deployed site cannot be checked from here; the green `Test, build, deploy`
  run on `main` is the only production signal available. Web *search* does
  work (it goes through the model's own API), but it returns titles and
  summaries, not page contents. Don't spend a run re-testing this.
- **Far-state screenshots** (later biomes, dusk states, wrap points):
  temporarily sed the relevant constants down (transition distances,
  `DUSK_CYCLE_PX`, `missDrain` → 0 so the bard never stops), `npx vite
  build`, screenshot, then `git checkout` / sed back before committing.
  The rendering path exercised is identical; shipped constants stay
  untouched. Always run `git diff --stat` afterward to prove it.
- **This session's PR cadence** (if working interactively again): commit
  per task on the working branch, PR to main, enable auto-merge (squash),
  merge origin/main back after each squash lands, repeat. Expect conflicts
  in STATE/ROADMAP against scheduled runs landing in parallel — and expect
  ROADMAP *task-number collisions*, since a scheduled run will happily
  claim the next number while you hold it too. Renumber yours; don't
  renumber theirs (theirs is already merged and referenced).
- **The checks run in place now.** `export
  PLAYWRIGHT_PATH=<dir>/node_modules/playwright`, then
  `node tools/verify-all.mjs` from the repo. They used to have to be copied
  next to the Playwright install, and running the copies is how this session
  twice tested a stale script — once letting a crashed run "prove" nothing
  had changed. Artefacts land in the working dir and are gitignored.
- **Run the checks with one command**: `node tools/verify-all.mjs` (all
  15, ~20 min) or `... quick` (the fast eight, ~5 min), from the directory
  where Playwright is installed, with `npm run preview` up. It runs them
  serially on purpose — several Chromium instances starve each other, and a
  long run measured under that contention reported 11fps and a third of its
  taps missing against a game that was completely fine.
- **When a check fails, suspect the check first.** This is the single most
  useful thing the 2026-07-26 session learned, and it learned it seven
  times. A harness that paused tapping during a rotation; one that tapped a
  fixed point outside a landscape viewport; one comparing a marker to the
  wrong oscillator; one indexing oscillators as interleaved when they are
  grouped by layer; one comparing against a leftover PNG from a crashed
  run; one whose baseline was a stale throttled save; one measuring under
  its own CPU contention. Every one produced a confident, specific,
  plausible failure. None of them was the game. Before changing code to fix
  a failing check, make the check prove it can see its own success case.
- **Do not commit an agent's working tree while it is measuring.** Two
  concrete costs, both from 2026-07-30. A songboard agent's `WEATHER_DEPTH = 0`
  was committed and described as cautious groundwork; it was the *control* half
  of an A/B, so the commit shipped the feature switched off under
  documentation saying it was on. And a figure agent's baseline was silently
  corrupted — it read its "before" state with `git show HEAD:...`, and HEAD had
  moved under it, so its control returned byte-identical numbers to its
  variant. It caught that; it might not have. If a tree must be committed
  mid-run, diff it and describe only what the diff shows, and name any constant
  that is an A/B control so a reader cannot mistake it for a shipped value.
- **Describe a commit from its diff, not from the brief that requested it.**
  Commit 8ca52c7's message claims a glow-pool fix that is not in the commit and
  was never needed. The work had already shipped; the agent measured it and
  correctly refused to redo it. Writing the message from the task description
  rather than from `git diff` put a false statement in permanent history.
- **A pinned scanline is a check that goes stale silently.** Several of the
  scratchpad measuring scripts (`bands.mjs`, `c6-hist.mjs`) read depth bands
  at *pinned* image rows — a row number chosen when the script was written
  because the horizon happened to sit there. Move a camera and the pin cuts a
  different strip of world, so the instrument reports a change the render
  never made. Wave 9 moved `resting.side` and `WIDEN_RISE_SHARE`, and against
  the pins the tablet frame looks like it collapsed from 2.79 to 2.02 stops;
  with the horizon *detected* it went 2.44 to 2.27 with every band brighter.
  Before believing any band comparison that spans a camera change, re-run with
  horizon detection (copy the shot to a filename the PINNED table does not
  list). This is the "suspect the check first" rule again, in the one form
  that survives a passing self-check: the instrument is correct, and pointed
  at the wrong pixels.
- **Verify behaviour, not just green tests.** `tools/autoplay.mjs` plays
  the game and checks every pitch it hears; `tools/learning-check.mjs`
  plays *well and then badly* to prove the letter-fading model both fades
  and restores. Run both after touching the schedule, the songbook, the
  audio or the scaffold. Note that autoplay is a *perfect* player, so it
  structurally cannot detect a broken return-on-struggle path — that is
  exactly why the second harness exists.
- **For a feature with real design risk, design it in a workflow first.**
  The v0.4 learning model was specced by parallel agents (pedagogy model,
  songbook familiarity audit, code-integration map) and then attacked by
  two adversarial critics before a line was written. The critics earned it:
  they found that a revealed letter would only be visible ~400ms *while
  fading* (arithmetic I had not done), that a single miss could flip a
  support band, and that the session cap was gross rather than net. All
  three were real, and all three were cheaper to fix on paper.

## Recent runs
- Run 0 (2026-07-15): Wrote DESIGN.md (concept: single-lane rhythm-tap
  mechanic keeps a wandering bard walking down a procedurally-sequenced
  road; cozy, no-fail tone) and ROADMAP.md (12 tasks to v0.1, one per
  run). No code written per vision-run instructions in CLAUDE.md.
- Run 1 (2026-07-15): Scaffolded the project — `package.json` (phaser,
  vite, typescript, vitest), `vite.config.ts` (base `/WanderingBardGame/`),
  `tsconfig.json`, `index.html`, `src/main.ts` booting a `Phaser.Game`
  with one empty `RoadScene`, and a sanity Vitest test. Verified with a
  headless Playwright smoke check against `vite preview`: canvas renders,
  no console errors (aside from an expected missing-favicon 404).
  PR #1 (Run 0) had merged onto `main` by this run despite the branch-
  protection blocker logged below — the code and STATE.md disagreed, so
  the blocker note is now cleared per CLAUDE.md ("trust the code").
  Re-verify next run whether new PRs still hit that 405; re-log under
  **Blocked on human** if it recurs.
- Run 2 (2026-07-16): Added the beat timing core per ROADMAP task 2 (see
  Current status above). No Phaser/rendering work this run — deliberately
  scoped to the pure-logic module so the one core mechanic is right and
  tested before it touches rendering.
- Run 3 (2026-07-16): Rendered the lane per ROADMAP task 3 (see Current
  status above). Deliberately left the song meter out of this run — task
  3 is scoped to rendering + input + per-beat hit/miss feedback only,
  the meter is task 4.
- Run 4 (2026-07-16): Added the song meter UI per ROADMAP task 4 (see
  Current status above). Deliberately left the bard sprite out of this
  run — task 4 is scoped to the meter and the exposed `walking` state
  only, the sprite is task 5.
- Run 5 (2026-07-16): Added the placeholder bard sprite and walk/idle
  animation per ROADMAP task 5 (see Current status above). Deliberately
  left the road static — no scrolling background yet, task 6's scope.
- Run 6 (2026-07-17): Added the scrolling ground band per ROADMAP task 6
  (see Current status above). Deliberately kept it a single flat
  procedural band with no biome art/parallax — that's task 9's job once
  distance-traveled tracking exists.
- Run 7 (2026-07-17): Added the procedural Web Audio base loop per
  ROADMAP task 7 (see Current status above). Deliberately kept it a
  single continuous layer with no meter-driven fading — that's task 8's
  scope once the base loop's shape is settled.
- Run 8 (2026-07-17): Added meter-driven audio layering per ROADMAP task
  8. Deliberately kept it to two placeholder layers with eyeballed
  voicings/thresholds — tuning is a playtest item, not this run's scope.
- Run 9 (2026-07-18): Added the distance-driven second biome and
  crossfade per ROADMAP task 9 (`src/core/distance.ts`,
  `src/core/biome.ts`, both pure/tested; `RoadScene` crossfades sky color
  and a second road `TileSprite` via `biomeBlendRatio`). Deliberately
  kept it to two biomes with a palette-only difference (sky + road
  colors) — no new scenery elements/parallax layers, that's beyond this
  task's scope and risks drift per CLAUDE.md. `npm test` 34 tests green,
  build green (~1.22 MB). Transition timing/palette flagged for human
  playtest (see below).
- Run 10 (2026-07-18): Consolidation pass (see Current status above).
  Fixed the hit-line/bard-head overlap; no other changes. Next run
  resumes feature work at task 11.
- Run 11 (2026-07-18): Added the coin readout per ROADMAP task 11 (see
  Current status above). Deliberately kept it a pure accumulate-only
  readout of the meter ratio — no per-hit bonus, no spend loop, matching
  DESIGN.md's framing of coins as a readout, not a separate system.
- Run 12 (2026-07-19): v0.1 ship check per ROADMAP task 12. No code
  changes — verified every DoD item against a real production build,
  found nothing unmet. `v0.1` tag pending the squash-merge landing on
  `main` (see Blocked on human below for why).
- Run 13 (2026-07-19): Unbounded beat schedule per ROADMAP task 13.
  `RoadScene.appendBeatBatch` generates another 300-beat batch once the
  current one's runway drops under 15s; `AudioEngine.extend` mirrors this
  on the audio side so the backing loop never runs out of scheduled notes.
  Resolved markers are now filtered out of `RoadScene.markers` each frame
  instead of accumulating forever. `npm test` 41 tests green (2 new),
  build green.
- Run 14 (2026-07-19): Third biome + generalized N-biome transitions per
  ROADMAP task 15. DESIGN.md's Concept names three vignettes but only two
  biomes existed; `biomeBlendRatio` (hardcoded to 2 biomes) became
  `biomeBlendAt`, which walks a `BiomeTransition[]` array to support any
  number of biomes. Added "Riverside Camp" as the third. ROADMAP task 14
  (human playtest pass) was next in line but needs an actual human;
  logged as blocked and this run's slot went to the biome work instead.
  `npm test` 44 tests green (5 new), build green.
- Run 15 (2026-07-20): Per-biome base-loop melodic pattern per ROADMAP
  task 16. Added `LoopLayer.patternByBiome` (manifest.ts) so the base
  loop's melody now differs per biome (village/forest/riverside each get
  their own 4-semitone pattern); `AudioEngine.start`/`extend` take a
  `biomeId` and resolve the pattern for whichever biome is current when a
  batch is scheduled. Deliberately scoped to the base loop only (not
  tempo, not the harmony/sparkle layers). Noted a batch-boundary
  quantization caveat (pattern switch lags the visual crossfade by up to
  a full batch) — became task 17. `npm test` 49 tests green (5 new),
  build green.
- Run 16 (2026-07-20): Tightened the batch-boundary quantization flagged
  by Run 15, per new ROADMAP task 17. Shrunk `RoadScene.BEAT_BATCH_SIZE`
  from 300 to 32 — pure constant tuning, no new logic — cutting the
  worst-case lag between a biome's visual crossfade and its audio pattern
  switch from ~187s to ~20s. Deliberately didn't attempt sample-exact sync
  (rescheduling in-flight notes mid-batch); that's real synchronization
  work and its own task if wanted. `npm test` 49 tests green (unchanged),
  build green.
- Run 17 (2026-07-20): Per-biome patterns for the `harmony`/`sparkle`
  layers per new ROADMAP task 18. Task 16 had scoped biome patterns to
  `baseLoop` only; the resolve/schedule plumbing was already
  layer-generic, so this run was manifest data (each layer's biome
  override = its own pattern + the same diff `baseLoop` uses for that
  biome) plus a consistency test, no logic changes. `npm test` 52 tests
  green (3 new), build green.
- Run 18 (2026-07-21): Fixed the persistent favicon 404 per new ROADMAP
  task 19. Every headless verification note since Run 1 carried the same
  "expected missing-favicon 404" caveat; added an inline SVG data-URI
  favicon to `index.html` (no new asset file) so it's actually gone. Also
  trimmed the old Run 12 verbose "Previous status" writeup from this file
  (its content is fully captured in this Recent runs bullet already) to
  keep STATE.md from growing unbounded — not a full consolidation pass,
  just routine hygiene. `npm test` 52 tests green (unchanged), build
  green.
- Run 19 (2026-07-21): Mute toggle per new ROADMAP task 20 (see Previous
  status above). `AudioEngine` gained a shared `masterGain` node all
  layers route through plus `setMuted`/`isMuted`; `RoadScene` added a
  small interactive icon (top-left) that toggles it, excluded from
  beat-hit handling via Phaser's `currentlyOver` pointerdown list. No
  prior queued task was actionable (task 14 still blocked), so this run
  added a new one rather than stalling.
- Run 20 (2026-07-21): Consolidation pass (see Previous status above). No
  vision drift or code rough edges found after a full read-through; fixed
  a chronological-ordering bug in this file's own Recent runs log and
  trimmed five redundant "Previous status" write-ups (Runs 13–18) that
  fully duplicated their own Recent runs bullets. No code changes.
- Run 21 (2026-07-22): Distance-walked readout per new ROADMAP task 21
  (see Previous status above). `RoadScene.updateDistanceReadout()` shows
  `distancePx` converted to "N steps" (via `ROAD_TILE_WIDTH`) bottom-left —
  DESIGN.md names distance as a readout alongside coins/scenery, but
  nothing had surfaced it to the player since Run 9. Pure rendering, no
  new core module, no new dependency. `npm test` 52 tests green
  (unchanged), build green.
- Run 22 (2026-07-22): First-tap onboarding hint per new ROADMAP task 22
  (see Previous status above). A small "tap to the beat" text above the
  hit line, shown from scene start and faded out 400ms after the
  player's first input (hit or miss). Considered and ruled out clamping
  per-frame `delta` for backgrounded-tab catch-up first — Phaser's
  `TimeStep.smoothDelta` already handles that by default. Pure rendering,
  no new core module, no new dependency. `npm test` 52 tests green
  (unchanged), build green.
- Run 23 (2026-07-22): Resume audio after tab backgrounding per new
  ROADMAP task 23 (see Previous status above). `AudioEngine.resume()`
  re-resumes a suspended `AudioContext`; `RoadScene` calls it from a
  `document.visibilitychange` listener so a backgrounded-then-returned
  tab doesn't stay silent for the rest of the session. Pure correctness
  fix, no new core module, no new dependency. `npm test` 52 tests green
  (unchanged), build green.
- Run 24 (2026-07-23): Captured the Space key per new ROADMAP task 24 (see
  Previous status above). `keydown-SPACE` triggered `handleInput()` but was
  never captured, so the browser's default Space action (page scroll)
  fired alongside every keyboard beat hit. Added
  `this.input.keyboard.addCapture('SPACE')`. One-line fix, no new
  dependency. `npm test` 52 tests green (unchanged), build green.
- Run 25 (2026-07-23): Padded the mute icon's touch target per new ROADMAP
  task 25 (see Previous status above). The icon's interactive hit area
  matched its 20px visual size, well under the 44x44 CSS px minimum both
  WCAG 2.5.5 and Apple's HIG call for — a measurable gap, not a feel
  question, so it didn't need to wait on task 14. Added a 44x44
  `Phaser.GameObjects.Zone` as the actual tap target; the icon itself is
  visually unchanged. `npm test` 52 tests green (unchanged), build green.
- Run 26 (2026-07-23): Locked down mobile tap-gesture CSS on `#game` per
  new ROADMAP task 26 (see Current status above). `user-scalable=no`
  alone doesn't reliably block pinch/double-tap-zoom on modern mobile
  Safari, and this game's whole input model is rapid same-spot taps —
  exactly what triggers it, plus the long-press text-selection callout.
  Added `touch-action: none` and the `user-select`/`-webkit-touch-callout`
  trio; no JS changes, Phaser's own pointer handling is unaffected.
  `npm test` 52 tests green (unchanged), build green.
- Run 27 (2026-07-24): Fixed a phantom ~5px mobile scroll gap per new
  ROADMAP task 27 (see Current status above). Phaser's `<canvas>` defaults
  to `display: inline`, reserving descender space below itself the same
  way a line of text would, which made the page taller than the viewport
  and vertically scrollable despite `#game` being sized to exactly
  `100vh`. Added `#game canvas { display: block; }`. Also deduplicated an
  accidental repeated task-25 entry in ROADMAP.md. `npm test` 52 tests
  green (unchanged), build green.
- Run 28 (2026-07-24): Fixed a backing-loop/visual-beat phase
  misalignment per new ROADMAP task 28 (see Previous status above).
  `AudioEngine.start()` anchored its note-scheduling clock to "the real
  moment of the first tap" instead of the visual schedule's own
  scene-creation-time zero, so the backing loop was out of phase with the
  beat markers by the player's own reaction time on every playthrough.
  Added a `nowMs` param to `start()` to anchor correctly and skip
  already-passed notes; added `AudioEngine.test.ts` (previously
  uncovered). `npm test` 56 tests green (4 new), build green.
- Run 29 (2026-07-24): `100dvh` for `#game`'s height per new ROADMAP task
  29 (see Previous status above). `100vh` alone sizes against mobile
  Safari/Chrome's largest-possible viewport rather than the actually-
  visible one on cold load — the classic mobile "100vh" gap, same family
  of real-viewport bug as tasks 26/27. Pure CSS, no new dependency.
  `npm test` 56 tests green (unchanged), build green.
- Interactive session (2026-07-25): ROADMAP task 14 (human playtest pass)
  executed and closed (see Current status above). Human verdicts folded
  into `HIT_WINDOW_MS`, `hitGain`, all `manifest.ts` patterns, beat-derived
  walk/scroll constants, and `biome.ts` palettes; art-direction feedback
  became ROADMAP tasks 30–32; PLAYTEST.md added (round-1 answers recorded,
  round-2 checklist for the retuned values). Also re-confirmed the v0.1
  tag push is impossible from this environment (still HTTP 403; GitHub
  MCP has no tag/release write call). `npm test` 56 green, build green.
- Overnight session, task 30 (2026-07-25): bard sprite & walk-animation
  overhaul per ROADMAP task 30 (human granted an extended interactive
  session to execute the art tasks directly). Placeholder rectangles →
  multi-part procedural character (legs/tunic/lute/capped head with
  feather) with beat-synced walk (legs + per-footfall bob + stride rock on
  a separate upper-body container so feet stay grounded) and a
  breathing/lute-sway idle. Verified with headless screenshots of both
  anim states, not just green tests. `npm test` 56 green, build green.
- Overnight session, task 31 (2026-07-25): per-biome background scenery
  per ROADMAP task 31. Silhouette band between sky and road at 0.45x
  parallax, crossfaded biome-to-biome like the road; village houses with
  lit windows / forest conifers with fireflies / riverside water-tent-
  campfire-reeds. `Biome` gained `sceneryColor`/`sceneryAccent`. All
  three biomes screenshot-verified (throwaway build with shortened
  transitions; shipped constants untouched). `npm test` 56 green, build
  green.
- Overnight session, task 32 (2026-07-25): art-style consolidation per
  ROADMAP task 32. Beat markers → tintable eighth-note glyphs (cream /
  green hit-pulse / dimmed mauve miss), coin icon → note-stamped coin,
  mute toggle → note glyph, hit line → rounded caps; DESIGN.md gained an
  "Art direction" section codifying the language (world cool and quiet;
  warmth belongs to the bard and the music). Screenshot-verified with a
  live tap run (hit pulse captured). `npm test` 56 green, build green.
- Overnight session, tasks 33+34 (2026-07-25): the player's own note +
  night sky. `AudioEngine.pluck(biomeId, beatIndex)` — a hit immediately
  plays that beat's melody note +1 octave at 1.6x base gain (tapping was
  previously silent in a music game); misses stay silent per DESIGN.md
  tone; mute covers it via master gain; 3 new tests. Night sky: sparse
  fixed-position cream starfield at 0.08x parallax + still moon with soft
  glow — road 1x / scenery 0.45x / stars 0.08x gives the scene depth.
  New ROADMAP arc queued for future runs ("the road loops home", tasks
  35–38). `npm test` 59 green, build green, screenshot-verified.
- Overnight session, task 35 (2026-07-25): the road loops home.
  `biomeBlendAt` wraps when the transition list is as long as the biome
  list (distance modulo cycle length; shorter lists keep the clamping
  behavior). Third transition added (riverside → village, 14000–16000px)
  → village → forest → riverside → village → … forever, every cycle
  identical. 5 new tests (64 total); wrap screenshot-verified via the
  shortened-transitions throwaway build. `npm test` 64 green, build
  green.
- Overnight session, task 36 (2026-07-25): slow dusk cycle
  (`src/core/dusk.ts`) — cosine brightness curve, one cycle per three
  biome loops, max 22% darken; world (sky/scenery/road) darkens while
  stars/moon brighten; bard + notation never darkened per art direction.
  7 new tests (71 total); deep-night screenshot-verified via shortened-
  cycle throwaway build. `npm test` 71 green, build green.
- Run 31 (2026-07-25, scheduled): strum on hit per new ROADMAP task 39,
  promoted from the idea backlog since task 38 (round-2 playtest) is
  still blocked on human. See ROADMAP task 39's done entry for the full
  writeup. `npm test` 71 green (unchanged), build green, headless
  screenshot confirmed the strum tween with zero console/page errors.
- Run 33 (2026-07-25, scheduled): signposts at transitions per new
  ROADMAP task 52, promoted from the idea backlog since nothing else was
  queued (task 38, round-2 playtest, is still blocked on human). See
  ROADMAP task 52's done entry and Current status above for the full
  writeup. `npm test` 157 green (5 new), build green, screenshot-verified.
- Run 34 (2026-07-26, scheduled): coin chime per new ROADMAP task 78,
  promoted from the idea backlog after re-checking both *Blocked on human*
  items (still blocked — see below) and finding no playtest answer waiting.
  `AudioEngine.chime()` sounds a quiet, fixed sine two octaves above the
  root on every 25th coin; `core/coins.ts` gained the pure
  `crossedCoinMilestone` to detect a whole-coin threshold against
  continuous fractional accrual. New `tools/coinchime-check.mjs` (added to
  `verify-all`'s fast set) hooks oscillator creation the way
  `nofail-check`/`autoplay` do to confirm it headlessly, since nothing here
  can listen. `npm test` 215 green (8 new), build green, `verify-all quick`
  (9 checks) green.
- Interactive session (2026-07-26, overnight): the long one. Shipped as
  PRs #57–#84, each squash-merged to `main`, every deploy green.

  **Product changes** (the parts a player can meet): two verified songs
  (*This Old Man*, *The Itsy Bitsy Spider*); **one real bug fixed** — the
  audio clock was anchored once at `start()` so the tune drifted off the
  staff over a long sitting, and is re-anchored per pass now; `wasUnplayable`
  keeps a note whose whole hit window vanished in one frame gap out of the
  learning model; the moon got craters; and Phaser's unused second
  AudioContext was disabled.

  **Structure**: texture baking split into `render/{engraving,scenery,ui}`,
  RoadScene 1584 → 1264, each move proved byte-identical by a deterministic
  texture sheet.

  **Verification**: 4 harnesses → 16, one runner (`verify-all`), runnable in
  place from the repo. New ground covered — the design pillars across nine
  viewports down to 320px, the bundle-size number, phone rotation, days
  away, mashing, mute and the keyboard, backgrounding, the gesture lockdown,
  legibility at deepest night, the no-fail promise, and that the song title
  names the tune actually playing. Tests 179 → 207.

  **Corrected two claims the docs were making**: "fade the prompt, never the
  answer" was credited to reveal handlers that provably never fire (the real
  guarantee is stronger and is now a pinned invariant), and two PLAYTEST
  items asked about machinery replaced in v0.3.

  The through-line: **around a dozen "bugs" this session were in the check,
  not the game.** A harness that paused its own taps; one tapping outside a
  rotated viewport; one comparing against a leftover PNG from a crashed run;
  one whose reload force-saved over the state being tested; the wrong
  AudioContext; an oscillator list indexed as interleaved when it is grouped
  by layer. The game was consistently in better shape than the instruments
  measuring it. Every harness now documents its wrong versions next to its
  right one — that write-up is the most useful thing this session produced
  for whoever runs next.
- Run 35 (2026-07-26, scheduled): wired the headless checks into CI, per
  new ROADMAP task 79 — see its done-entry for the full writeup. Short
  version: all 18 `tools/*.mjs` scripts hardcoded this environment's own
  Playwright browser path, which is why they were never run in CI; removed
  the hardcode (Playwright resolves its own browser without it, verified
  both here and via a deliberate version-mismatch check), and added
  `.github/workflows/headless-checks.yml` — the fast nine run after every
  merge to `main`, informational only (`continue-on-error`, not a required
  check), since this environment can't watch a real Actions run land to
  confirm it end-to-end. `npm test` 215 green (no game code touched),
  build green, quick suite 9/9 green on a clean local re-run (one
  `dusk-check` flake on a loaded run didn't reproduce — see task 79).
  **Confirmed (2026-07-26, same day, follow-up check)**: `headless-checks.yml`'s
  first-ever run (on the merge commit, run #1) came back green on a real
  GitHub-hosted runner — Playwright installed fresh, Chromium downloaded
  fresh, all 9 quick checks passed
  (https://github.com/at3gk/WanderingBardGame/actions/runs/30210381321).
  The step itself succeeded (not just masked by `continue-on-error`), so
  the portable-browser-resolution fix holds outside this environment too.
  Nothing further needed here.
- Run 36 (2026-07-26, scheduled): resolved ROADMAP task 92 (see its done
  entry) rather than shipping game code — the previous PR (#107) had
  already merged onto `main` by the time this run started, and the
  designated working branch was reset onto it fresh
  (`git checkout -B <branch> origin/main`), per this project's own
  merged-PR-restart convention.
  Re-checked both standing blockers (unchanged) and found `headless-checks.yml`
  now has **19/19 green runs** since it landed — a real pattern, not the
  single data point task 79 had. But turning that into an actual required
  merge gate needs GitHub branch-protection configuration, and the GitHub
  MCP toolset available here has no call that writes branch-protection
  rules — confirmed by scanning the full tool list, same shape of gap as
  the missing tag/ref-write call. Logged as a new Blocked on human item
  below rather than guessed at. Also weighed and rejected adding a
  `pull_request` trigger for pre-merge-only visibility: GitHub holds a PR
  non-mergeable while any attached check is still running regardless of
  whether it's required, so that would add several minutes to every merge
  in the three-times-daily cycle for a check nobody watches live between
  runs — a real cost to the pipeline's cadence for no real benefit here.
  `headless-checks.yml` is unchanged. `npm test` 254 green (unchanged),
  build green — re-confirmed as a baseline, no code touched this run.
- Run 37 (2026-07-27, scheduled): resolved ROADMAP task 104 (see its done
  entry). Both standing blockers re-checked and unchanged (forest-song
  fetch still 403s; GitHub MCP toolset still has no tag/ref-write or
  branch-protection-write call), no playtest answer had arrived, and the
  idea backlog is down to one phone-dependent item — so this run fixed what
  the re-check itself turned up instead of inventing new scope: the root
  `README.md` and `.github/workflows/headless-checks.yml` both still
  quoted "seventeen checks" / "the fast nine", stale since task 79 first
  wired CI — four checks landed since (`hud-check`, `ground-check`,
  `bard-check`, `seam-check`) and were never counted, even though
  `tools/README.md` and `verify-all.mjs` already had the right numbers (24
  total, 14 quick). Corrected both. No game code touched; `npm test` (279
  green) and `npm run build` (1.27 MB) reconfirmed, and the full 14-check
  quick suite run once end-to-end to confirm the re-check found no
  regression: all 14 green, no drift.
- Run 38 (2026-07-27, scheduled): resolved ROADMAP task 105 (see its done
  entry). Investigated a candidate tween leak in the songbook picker
  (`openPicker`/`closePicker`, same missing-`killTweensOf` shape as #125's
  practice-staff bug) and mutation-tested it away rather than shipping a
  speculative fix — the picker's fades are one-shot and finish on schedule
  even orphaned, unlike #125's `repeat: -1` breathing tween. Shipped
  nothing; `RoadScene.ts` unchanged. `npm test` 279 green, build green,
  reconfirmed as a baseline.
- Run 39 (2026-07-27, scheduled): resolved ROADMAP task 107 (see its done
  entry and Current status above for the full writeup). Split the songbook
  picker overlay into `src/scenes/picker.ts` — the consolidation this file
  had flagged as the obvious next one, `RoadScene.ts` having regrown to
  2275 lines since task 66. `npm test` 279 green (unchanged), build green
  (1.27 MB, unchanged), full 14-check quick suite plus `songpick-check`
  green with zero regressions.
- Run 40 (2026-07-28, scheduled): resolved ROADMAP task 108 (see its done
  entry and Current status above). Tested the "a resize re-runs `create()`"
  assumption five pieces of documentation asserted flatly and found it does
  not hold in headless Chromium: zero additional `CREATE` events across two
  rotations, same scene instance and GameObjects throughout. Kept the
  defenses it produced (cheap insurance against a real device behaving
  differently) but corrected the docs and pinned the count as an assertion
  in `rotate-check.mjs`. `npm test` 279 green (unchanged), build green,
  full 14-check quick suite green.
- Run 41 (2026-07-28, scheduled): resolved ROADMAP task 109 (see its done
  entry and Current status above for the full writeup). Split the
  free-play staff out of `RoadScene.ts` into `src/scenes/freePlayOverlay.ts`
  — the "real first piece" task 108 left as legitimate-but-unscoped work.
  `RoadScene.ts` 2172 → 1838 lines. `npm test` 279 green (unchanged), build
  green (1266.81 KB vs 1267.23 KB), full 14-check quick suite plus
  `songpick-check`, `rotate-check` and `seam-check` green with zero
  regressions. Caught and fixed one transcription slip (a tween option
  misread off a truncated file read) before it ever reached a check.

- **Session close, 2026-07-27 small hours (human-directed, PRs #115–#122).**
  Asked for a polish pass on art, animation and the game. It found three
  bugs that were live rather than cosmetic, all of them invisible in
  landscape on a desktop-ish window and all of them passing every check:

  1. **The practice staff was drawn at alpha 0** — the entire second way
     to learn, invisible on the deployed site since its lay-in animation
     shipped. Two fade-ins ran back to back; the second read the zeros the
     first had just written, took them for each part's *target*, and
     tweened 0 to 0. Both halves correct alone.
  2. **The songbook and lute buttons were under the meter** on every
     portrait phone. Buttons counted pixels from the left; the meter took
     60% of the width and centred itself; nothing had asked those rules to
     agree, and they only do on a wide screen.
  3. **The road ran off the bottom in landscape**, 48px on a 568x320
     screen, leaving 12 of its 60px and the bard cut off at the shins.

  Also shipped: a fifth parallax plane (the near verge at 1.35, the first
  thing in the game that moves faster than the road) over real earth,
  because below the road there had only ever been the camera's background
  colour — the sky. A scrim behind the practice staff. The meter handed
  cream back to the notation and took gold, and its five staff lines were
  made to resolve as lines rather than a smear (18px bar, half-pixel
  offsets). The bard eases in and out of walking instead of snapping every
  limb to neutral on the frame the meter crossed its threshold.

  Three new harnesses, and the reason each exists is the same: nothing had
  ever asserted the thing it covers. `hud-check` (chrome geometry and that
  each button does its own job), `ground-check` (the bard's real rendered
  bounds land on a visible road at eight viewports), `bard-check` (start,
  stop, rest and breath), `seam-check` (mute x practice, tab-away x
  practice, rotation x the ground — all three passed first time, which is
  why they are worth holding still).

  What to carry forward:
  1. **If a feature's purpose is visual, assert something visual.** The
     practice staff passed every behavioural assertion in `freeplay-check`
     while being completely invisible. Ink, contrast, and geometry against
     real rendered bounds are what would have caught it — and do now.
  2. **A fixed pixel offset hung off a proportional anchor is this
     codebase's recurring bug.** Three instances so far (free-play staff,
     top bar, lane-to-ground). Each moved into `core/` as testable maths.
     Grep for the pattern before adding a fourth.
  3. **Run the check suite quiet.** Two Playwright suites at once fails
     `autoplay` on frame timing and reads exactly like a regression.
  4. **A visual check is easy to write wrong and it will still pass.**
     `bard-check` took four tries and every wrong version was green:
     per-frame delta (frame-rate dependent), triggering the state change
     from Node (missed the 150ms window entirely), scanning the whole
     sample (measured an ordinary walk-cycle crossing and called it the
     stop — that one passed against a build with the ease cut to 1ms), and
     not holding the meter up (the bard had already stopped before the
     sample began). Mutation-test every new check against the fault it
     exists to catch, before believing a green.

- **Session close, 2026-07-26 evening (human-directed, PRs #91–#113).**
  Shipped: the song picker (the human's one hard requirement — pick a tune
  and it repeats instead of the songbook rotating), free play and its
  practice mode (the second way in), and an art pass (fourth parallax
  plane, 512px scenery with silhouettes that vary within a tile, road
  verges, a contact shadow under the bard). 258 tests, 19 headless checks,
  three new harnesses (`songpick-check`, `freeplay-check`,
  `practice-soak`), and an eight-minute drill soak (8576 notes) that
  accumulates nothing.

  What to carry forward, in order of how much it will save you:
  1. **Probe the seams, not the features.** All three defects this session
     were cross-surface. Every feature passed alone.
  2. **`RoadScene.ts` is 1979 lines** and wants the next consolidation
     run. Picker overlay, free-play staff, walk chrome — three clean
     extractions, each provable byte-for-byte against a texture sheet.
  3. **Playwright 1.56.1 or every check lies to you.**
  4. The blockers did not move: the fade pace still needs a child, the
     fourth forest song still needs a source the sandbox can fetch, the
     v0.1 tag still needs a call the MCP toolset doesn't have.

- Run 44 (2026-07-29, scheduled): deleted the dead 2D/Phaser code — see
  the Run 44 note in "At a glance" above for the full detail (files
  removed, bundle size, the 24 dead checks, and what wiring `shader-check`
  into `verify-all.mjs` for the first time turned up). `npm test` 745
  green, `npm run build` green, bundle 686 KB. No feature work; this was
  the first item STATE.md had flagged as next after the v0.6 merge.

## Needs human playtest

Much smaller than it used to be: `tools/autoplay.mjs` now answers
mechanically what used to be queued for a person — that the melody is in
tune and naturals-only, that the songbook rotates and loops, that perfect
play holds the meter, that nothing leaks over a long walk. Round-1
feedback (2026-07-25) settled the original feel questions. What genuinely
still needs a human:

- **Subjective feel a machine can't judge**: is 96 BPM comfortable for a
  small child, does the 90ms hit window forgive a young hand, does the
  music actually sound cozy on real speakers.
- **Real-device behaviours headless can't reproduce**: audio resume after
  backgrounding the tab, gesture lockdown against pinch/double-tap zoom,
  and the visible-viewport fit on a phone with browser chrome showing.
- **The teaching outcome**, which is the whole point and is not
  measurable here: does a child start naming notes? PLAYTEST.md's round-3
  protocol is written for exactly that.

## Blocked on human
- **Promoting `headless-checks.yml` from informational to a real merge
  gate** (2026-07-26, Run 36). The check has gone 19/19 green since it
  landed (task 79) — a real pattern now, not a single lucky run. But making
  a GitHub Actions check actually block a merge requires it to be named as
  a **required status check** in the repo's branch-protection settings for
  `main` (GitHub Settings → Branches → Branch protection rule → "Require
  status checks to pass before merging" → add `quick` from the "Headless
  checks" workflow), which is a repository-admin action. The GitHub MCP
  toolset available in this environment has no call that writes
  branch-protection rules (only read/write calls for files, branches, PRs,
  issues and releases were found on a full scan) — the same shape of gap as
  the missing tag/ref-write call below. Once a human enables that setting,
  a future run should also flip `.github/workflows/headless-checks.yml` to
  trigger on `pull_request` (not just `push: main`) and drop
  `continue-on-error: true`, so a real failure actually blocks auto-merge
  instead of only reporting after the fact.
- **A fourth forest song** (2026-07-26). Village and riverside rotate four
  tunes each; forest has three. The candidate is chosen and researched:
  **Here We Go Round the Mulberry Bush** — traditional, the tune Nancy
  Dawson danced into fame in 1700s London, so clearly public domain. It
  uses scale degrees 1/2/3/5/6/7 only, which makes it naturals-only in C
  major, sitting G4–G5: exactly the forest register, and its lowest note
  matches Twinkle's, so it passes the biome staff-region test.
  What is missing is a **note-for-note transcription verified against a
  published source**. This environment's network policy blocks outbound
  fetches (403 on CONNECT to every host); web *search* still works but the
  snippets carry titles, keys and provenance, never note sequences. That
  standard is not negotiable here — a forest transposition of *This Old
  Man* was drafted and rejected for matching the real tune in only 6 of 32
  notes, and a wrong contour actively mis-teaches a child who knows the
  song. Needs a run with network access, or a transcription from a human.
  (*Wheels on the Bus* is the obvious alternative and is **rejected on
  rights**: attributed to Verna Hills, 1939, which fails CLAUDE.md's
  CC0-only rule.)
  **Update (2026-07-26, Run 34)**: re-checked — `WebFetch` still returns
  HTTP 403 on every host tried, including a plain Wikipedia page (not just
  music-transcription sites), so this isn't a site-specific block. Blocker
  confirmed, nothing new to route around.
- **v0.1 git tag** (Run 12): ROADMAP task 12 says "Tag this as v0.1."
  DoD verification and the ship-check PR (#13) are done and merged
  (squash commit `021410f` on `main`), but the tag itself can't be pushed
  from this environment: the local git push proxy accepts pushes only to
  the designated `claude/*` working branch (a plain `git push origin
  v0.1` / `git push origin refs/tags/v0.1` both got HTTP 403), and the
  available GitHub MCP tools have no tag/ref-write call — only read-only
  `get_tag`/`list_tags`/`get_release_by_tag`/`get_latest_release`. Routing
  around it (e.g. faking a tag via `create_branch`) would be misleading,
  so this is left undone rather than faked. A human (or a future run with
  broader GitHub write scope) needs to run, from a clone with real push
  access:
  `git tag -a v0.1 021410f -m "v0.1 ship — see DESIGN.md Definition of
  Done" && git push origin v0.1`
  Doesn't block ROADMAP task 13 — the game itself already meets every
  v0.1 DoD item regardless of whether the tag exists.
  **Update (2026-07-25, interactive session)**: re-tested from the
  interactive remote environment — `git push origin v0.1` still returns
  HTTP 403 (tag refs rejected, only the designated working branch is
  pushable), and the GitHub MCP toolset was re-checked: it has
  branch/file write calls but still no tag or release *creation* call.
  Blocker confirmed; the command above remains the only route.
  **Update (2026-07-26, Run 34)**: re-checked the GitHub MCP tool list again
  — still `get_tag`/`list_tags`/`get_release_by_tag`/`get_latest_release`
  only, no ref-write or release-creation call. Blocker unchanged.
