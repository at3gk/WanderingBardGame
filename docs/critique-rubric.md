# The blind-panel critique rubric

The exact rubric text the six-lens blind panels run on, committed so that
wave-over-wave means stay comparable. It has been lost and reconstructed
TWICE (before wave 10 and before wave 13 — both times because the text
lived only in a session's workflow script), and each loss reset the
cross-wave baseline: STATE.md's wave entries carry "rubric reconstructed,
treat the mean as weak evidence" caveats at both breaks. Waves 13 and 14
ran on THIS text verbatim; future waves must copy it from here, changing
only the frame/reference file paths.

## Protocol

- Six independent judges (opus), one lens each, run blind — they are not
  told what changed since the last wave.
- References first: re-download per session (never commit them — not
  CC0). 7 A Short Hike press frames (ashorthike.com/images/screenN.png)
  and 5 Spiritfarer STEAM GAMEPLAY screenshots (Steam appdetails API,
  appid 972660 — the press site only has key art).
- Frames: the full postcard sheet from `tools/postcard.mjs`, shot the
  same day as any wave being compared against (the road is daily).
  Record the dayKey.
- Structured output per judge: per-frame score + note, top 3-5
  cross-frame fault families with pixel evidence, keeps.

## The judge prompt (per lens)

> You are one judge on a six-lens blind art critique panel for a cozy
> browser game. Your lens: {LENS}
>
> PROTOCOL (follow exactly):
> 1. First Read these 12 REFERENCE frames (A Short Hike press shots,
>    Spiritfarer gameplay) to calibrate what "reference-grade cozy"
>    looks like: {REF PATHS}
> 2. Then Read all 13 GAME frames, in order: {FRAME PATHS}
> 3. Score every game frame 0-10 against the anchor question: "Would
>    this frame ship beside A Short Hike without apology?" A 10 ships
>    proudly; a 5 ships with visible apology; a 2 does not ship. DO NOT
>    grade on a curve, do not reward effort, judge only what is in the
>    pixels through your lens.
> 4. Name your top 3-5 cross-frame FAULT FAMILIES with the frames they
>    appear in and concrete pixel evidence (what, where). Name what
>    should be KEPT (what already ships proudly).
>
> Judge only your lens. Be specific and unsparing; vague praise is
> useless. Frames 08/09/13 are phone viewports, 10 is tablet — judge
> them at their own size. Return via StructuredOutput.

## The six lenses (verbatim)

1. **colour** — "COLOUR: hue relationships, temperature story,
   saturation structure, whether colour carries the frame at its hour.
   Is the palette one deliberate statement or an accident of systems?"
2. **value** — "VALUE: the value ladder, dark anchors, legibility of the
   picture in greyscale terms, whether light explains the scene. Does
   the frame have a designed range of lights and darks?"
3. **silhouette** — "SILHOUETTE: shape design and edges. Do objects read
   by outline alone; are there unattributable soft masses, mushy or
   noisy shapes, clone-stamped repeats?"
4. **composition** — "COMPOSITION: framing, eye path, anchors, use of
   edges and corners, foreground/midground/background structure, dead
   zones."
5. **emotion** — "EMOTION: warmth, charm, story. Does the frame make you
   feel the coziness it intends; do characters read as people; is there
   a moment worth caring about?"
6. **mobile** — "MOBILE READABILITY: judge every frame as if on a phone
   in a bright room. Text legibility, tap affordances, HUD chrome, crops
   and collisions, whether the small-screen frames (08/09/13) hold up as
   playable surfaces at their own size."

## Score ledger (same-rubric runs only comparable within a block)

| Wave | Mean | Rubric block | Notes |
| ---- | ---- | ------------ | ----- |
| 13   | 4.38 | this text    | first wave on the 13-frame sheet |
| 14   | 4.33 | this text    | flat; land key registered locally (03 colour 3.4 → 4.8) |
| 15   | 4.40 | this text    | flat; accidental same-wave re-run measured judge noise at ±0.3-0.6 per lens — wave deltas under ~0.3 are noise |
| 16   | 4.45 | this text    | flat overall; colour became the TOP lens (5.46) — road/golden/flower fixes registered by name; dominant fault narrowed to the hours the key schedule leaves uncovered (01 dawn trough, 12/13 dusk) |

Earlier waves (5-12) ran on two prior, now-lost rubric texts; their means
live in STATE.md's HANDOFF entries with their own caveats.
