# The colour script

Authored 2026-08-05 (ROADMAP task 166, first piece). This is the
Firewatch-style script `docs/research/art-quality.md` recommends: the
day's hours, each with an *intended* mood and an *intended* value
structure, written down so that a critique wave tests frames against a
spec instead of a vibe, and so that tuning runs know which hours are
carrying and which are owed work. Firewatch's lesson, in Jane Ng's
terms: colour is structural — it drives the scene's beat, it is not
decoration. This game's hours were, until this document, whatever the
lighting math emitted; the annotations in `sky.ts` are a decade of
measured corrections but no *plan*. This is the plan.

What binds it:

- The research note's not-recommended list: no outline pass, no bloom
  chain, no shipped image LUT. Everything below is authorship inside
  the existing sky/palette/painterly machinery.
- The one painted-light rule `sky.ts` already states: **shadows are
  the complement of the sun** — warm sun, cool shadow; cool sun, warm
  shadow. Nothing below may break it.
- The notation is never dimmed and never tinted off-cream; the bard
  carries his own warmth through every hour (the art direction's
  oldest rule).

The script's one structural claim, hour by hour: **when the sun is
low, VALUE carries the frame; when the sun is high, COLOUR must carry
it.** Dawn and golden hour get long shadows and a raking ladder of
tone for free. Noon gets nothing for free — its classic answer
(Firewatch's, and every plein-air painter's) is that noon is the hour
of colour: saturated local hues, and shadows that are *hue events*
(cool, saturated, same family as what they fall on) rather than value
events. The measured state of this game's noon is the opposite —
see "High day" below — which is why the panels call it milky.

## How this is enforced

- `tools/frame-quality.mjs` — value stops / hue spread / modal share
  per posed frame, on the PINNED road (GAUGE_DAY 2026-07-30; the
  noon-village pose pins its own day). Its floors are this script's
  regression tests: morning ≥ 2.5 stops (measures 2.89), noon ≥ 2.5
  (3.44), noon-village ≥ 1.6 (the flattest honest family), golden
  ≥ 2.5 (3.94), night ≥ 2.5 (6.05), phone-landscape (3.94).
- `tools/shadowcast.mjs` (task 183) — cast-shadow ownership and
  photometrics (value drop, saturation kept, hue rotation). The noon
  colour targets below are stated in its units.
- `tools/land-histogram.mjs` — land-masked percentiles when a change
  claims to move the ground and not the sky.
- `tools/postcard.mjs` — the frames themselves. The gauges catch
  regressions; only frames judge intent.

## Reference numbers (measured 2026-08-05)

A Short Hike's shadowed ground versus its lit ground (press frame,
rect-measured): hue stays in family (H 44° → 75°, a +31° cool turn
inside green), saturation keeps 63% (S 0.73 → 0.46), value drops hard
(V 0.77 → 0.46). **Reference shadows are darker than ours and more
saturated than ours.** Ours today: hue flips family (H ≈ 39° → 222°),
saturation keeps 34–43% (S 0.46 → 0.20 dawn, 0.47 → 0.16 golden).
That grey-blue drain is the measured core of "milky".

## The hours

Each hour: intended mood → what carries the frame → the value
structure (darkest dark, lightest light, where the eye lands first)
→ measured state and the owed work, if any.

### Deep night (t 0.0)

- **Mood:** held breath; the world asleep, the fire the only argument.
- **Carries:** a single light event. The campfire owns warmth; the
  moon owns the rims.
- **Structure:** darkest dark is everything beyond the fire's reach;
  lightest light is the fire core, then the moon; the eye lands on
  the fire, then the lit faces around it.
- **Measured:** 6.05 stops — the strongest frame family; wave 7
  scored 07-campfire best of the set twice running ("reference-
  grade"). Task 147 (ring stones staying daylight-grey) is the one
  open item, owned by that task, not this script.
- **Verdict: carrying. Spend no runs here.**

### First light (t 0.2)

- **Mood:** lilac promise; the day not yet committed.
- **Carries:** value (a low gradient sky against a dark land mass),
  plus the last stars.
- **Structure:** darkest dark is the land silhouette entire; lightest
  light is the horizon band; the eye reads the skyline first — this
  is the hour the skyline exists for.
- **Measured:** not separately posed; rides between night's and
  dawn's gauges. No named faults in any wave.

### Dawn (t 0.28)

- **Mood:** the road calling; long light, long shadows, cool air over
  warm ground.
- **Carries:** value — the raking ladder. Tree shadows stripe the
  road (183 measured them: real casts, 96.5% trees, a third of the
  frame); that striping is the hour's *structure*, not a fault.
- **Structure:** darkest dark is the shadow stripes and the treeline;
  lightest light is the horizon/sun halo; the eye lands on the lit
  road between stripes, which points at the horizon.
- **Measured:** wave 7 named the streaks "phantom" here only because
  they desaturate — the owed work is shadow COLOUR (S kept ≥ ~0.5 of
  lit, hue within the warm family), which is the noon lever applied
  day-wide. The geometry is right.

### Morning (t 0.42)

- **Mood:** English morning, half-clouded, work begun; the most
  ordinary hour of the day and content to be so.
- **Carries:** value first (22° sun still models the land), colour
  second.
- **Structure:** darkest dark is the treeline and canopy undersides;
  lightest light is the cloud tops, then the dry rises of the field;
  eye lands on the bard against the lit road.
- **Measured:** 2.89 stops on the pinned road against a 2.5 floor;
  the sky.ts annotations record the whole zenith/exposure ladder that
  bought it. Wave 7 had no morning-specific fault beyond the shadow
  desaturation shared day-wide.

### High day / noon (t 0.55) — THE DESIGNED HOUR

- **Mood:** the world at full colour under a high sun — a picture-
  book field in summer, not a washed photograph. Noon is when a child
  is most likely to be handed the game; it must not be its worst hour.
- **Carries: COLOUR. This is the hour's whole design.** The sun at
  40° gives no raking ladder and never will (29° was measured worse
  twice — see sky.ts); the value floors only guard against collapse.
  What must do the carrying: (1) local hue variety in the land —
  the meadow's green family actually *spread*, the accents (flowers,
  terracotta, water) at full voice; (2) shadows as hue events —
  cool, still saturated, same family as their ground.
- **Structure:** darkest dark is canopy underside and the deepest
  shade patch, and it is *coloured* dark (deep green, never grey);
  lightest light is cloud and the dry crown of the road; the eye
  lands on the bard's warm red, which noon surrounds with its
  complement.
- **Measured today (the gap):** noon-forest 3.44 stops (healthy) but
  wave 7's worst frame at 4.58, "milky monochrome"; noon-village
  1.6-2.2 stops, the flattest honest family (bright walls, no dark
  anchor). Shadows keep ~35% saturation and flip to blue-grey
  (183). The big noon diagonals are NOT shadows — they are the baked
  terrain tone field (183's ablation), owned by tasks 144/169.
- **Targets for the enacting run** (stated in shadowcast's units):
  shadowed land at noon keeps **≥ 50% of lit saturation** (ASH: 63%)
  and rotates **≤ ~60° cool of the lit hue** (ASH: +31°) instead of
  flipping 180°. Value floors unchanged. Levers, in order of
  cheapness: the skylight ambient's saturation at high sun (the
  shade-filling light is currently near-achromatic by the time ACES
  is done with it), CAST_SHADOW_HUE's chroma, the bounce key. NOT
  levers: lightening shadows (reference shadows are darker than
  ours); darkening the sun angle (measured worse twice); any
  full-frame pass (banned).
- **Verdict: owed one enacting run (166 second piece), judged on
  re-shot 03/08/10 + the noon-village pose.**

### Afternoon (t 0.7)

- **Mood:** the warm shoulder of the day; the first hint the light
  will end.
- **Carries:** colour warming toward value as the sun drops (0.34
  elevation already models the land again).
- **Structure:** as noon, with the horizon warmth beginning to pull
  the eye west.
- **Measured:** 10-tablet poses here; its faults in wave 7 were the
  note-overlap family (184) and HUD plates (175), not the hour.
  Noon's shadow-colour fix inherits here automatically.

### Golden hour (t 0.82)

- **Mood:** the day's reward; one hue over everything and meant to be.
- **Carries:** light itself — the one hour a single hue is correct
  (the gauge deliberately drops its hue floor here).
- **Structure:** darkest dark is the long shadows and silhouetted
  casts; lightest light is the sun's halo and its glitter on water;
  the eye goes where the light points.
- **Measured:** 3.94 stops; every wave's favourite walking hour. The
  one recurring fault is the 145/179 maroon value-merge (cast and
  props melting together at 05/06) — owned by task 179's floor, not
  by re-colouring the hour.
- **Verdict: carrying. Spend no runs here.**

### Dusk (t 0.9)

- **Mood:** lamps soon; the world going violet, the warm things
  (bard, windows, fire) taking over the job of colour.
- **Carries:** the handoff from sun to sources. Value range comes
  from emitted light against a falling ambient.
- **Structure:** darkest dark is the land away from any source;
  lightest light is the sky's last band, then the lit windows; the
  eye lands on whatever is lit and warm.
- **Measured:** no gauge pose of its own; 06-dusk-encounter's wave-7
  notes were the maroon merge (179 family) and HUD (175). LIGHT_FLOOR
  in SongNotes guarantees the notation survives this hour; that
  contract predates the script and stands.

## Fog reach (task 193 audit, 2026-09-14)

`art-quality.md` recommendation 6 ("adopt the detail-density language")
asks for two things: a detail budget that favours the bard/instruments/
notation/stop-dressing over the world at a distance, and "fog tables
[that] get per-biome, per-hour authored values as part of the color
script rather than one global near/far." The first half already holds
structurally and needed no new work — see the changelog entry for the
survey. The second half does not: `uFogNear`/`uFogFar`
(`RoadStage.ts`, near `TERRAIN_REACH * 0.12`/`* 1.47`) are set **once**,
at scene construction, from `TERRAIN_REACH` alone. No hour, no biome,
no dusk-cycle brightness (`dusk.ts`, which already runs every frame)
ever touches them. The reach that "solves for" the treeline keeping
most of its tone and the ribbon's far edge dissolving to air (the long
comment at the `RoadStage.ts` call site) is a fact about geometry, not
about the hour — it is right for every hour at once only by accident.

What the script's own hour table above implies the fog SHOULD do, if it
carried authored intent instead of one constant:

- **Night** (already "carrying," per its own verdict) wants the
  shortest reach of the day — the fire is the one light event, and a
  fog edge that reaches too far dilutes the "everything beyond the
  fire's reach is the darkest dark" structure the hour is built on.
  Today's constant fog reach is the same 20m/240m used at noon, which
  is generous for a frame whose whole point is that little is lit.
- **Dawn/golden** (both "carrying," value-led hours) want a LONGER
  reach than noon: these are the hours the raking ladder and the long
  casts are supposed to recede gradually into light-filled air, not
  the coloured-shade hours where the treeline anchor needs to stay
  legible close in.
- **Noon/noon-village** (the one hour owed work, colour-led) wants the
  treeline anchor kept CLOSER and clearer — colour is the hour's whole
  carrying mechanism, and colour reads worst exactly where fog has
  already desaturated it, so noon can least afford of any hour to let
  fog eat into the near/mid ground the accent work (166's flower
  drifts, the village's painted doors) depends on being seen.
- **Per-biome**, riverside is the one place the reach itself might
  need to differ rather than just its tint: the water band IS the
  hour's carrying event (see "The biomes" below), and fog desaturating
  the mirror before it reaches the camera would compete with the one
  guaranteed saturated read riverside has.

None of this is wired in this piece — deliberately, matching 166 piece
1's own split. `uFogNear`/`uFogFar` are read once at construction, not
per frame, so making them authored-per-hour is a real engineering piece
(a per-frame update alongside `dusk.ts`'s brightness curve, most likely,
since that is the existing per-frame hook for "the world darkens
overnight") and per-biome needs care that a biome-blend transition
cannot pop the reach — both real work, not a config swap. This section
is the spec an enacting run should build against, the same role the
noon colour targets above played for 166's second piece. No runtime
values changed in this piece.

## The biomes under the script

The hours modulate three *places* (palette.ts's narrow-family rule —
one hue family, one dissenter each):

- **Village** — warm yellow-greens, terracotta dissenting. Its noon
  is the script's hardest case: bright walls over bright ground with
  no dark anchor in frame (p10 ~0.17 linear vs forest's ~0.06; the
  noon-village gauge pose exists exactly for this). The village's
  noon colour must come from its accents (roofs, flowers, painted
  doors) and from coloured shade — it has no treeline to lean on.
- **Forest** — deep blue-greens, warm bracken dissenting. The
  treeline hands every daylight frame its dark anchor; forest noon
  is where "milky" reads loudest *because* the promise is highest —
  deep coloured shade is this biome's birthright and it currently
  reads grey.
- **Riverside** — cool grey-greens, water dissenting. The water is a
  mirror, so riverside frames inherit the sky's hour directly; its
  noon carries the one guaranteed saturated event (the water band)
  and mostly needs the shared shadow-colour fix.

## Changelog

- 2026-08-05: written (166 piece 1). No runtime values changed in
  this piece; the noon targets above are the spec for piece 2.
- 2026-08-07: 166 noon-accent piece (run 112) — the flower clump
  became a drift (3 over 0.55 m → 7 over 0.8 m) and the scatter
  density rose 0.07 → 0.12/m², which through the village's own 2.4×
  multiplier lands mostly in the biome this section names as needing
  it. Instrument note: frame-quality's hueSpread cannot see this
  lever (flowers are too few pixels for a percentile spread) — the
  judge is the panel on re-shot noon-village/02/08.
- 2026-09-14: fog reach audit (193 piece 1, run 180) — see "Fog reach"
  above. No runtime values changed.
