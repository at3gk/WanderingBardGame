/**
 * What each biome looks like in three dimensions.
 *
 * The 2D game's biome palettes (src/core/biome.ts) are dark-dusk colours
 * chosen so that cream notation would read on top of them. They are still
 * correct for what they do and they are not touched here — but they are
 * unusable as *world* colours in a game that now has a sun in it, so the
 * 3D world keeps its own palette keyed by the same biome ids.
 *
 * The palettes are built around one idea: each biome is a **narrow hue
 * family with one dissenting accent**. Village is a spread of warm yellow-
 * greens with a terracotta dissenter; forest is deep blue-greens with one
 * warm bracken; riverside is cool grey-greens with one bright water blue. A
 * biome that uses six unrelated hues reads as a texture pack. A biome that
 * uses one reads as flat. One dissenter is the whole trick.
 *
 * The second idea is that the three biomes have to be different *places*,
 * not the same place in three tints. So they disagree about more than hue:
 * village is open and sparse and full of flowers, forest is closed and
 * three times as dense and has fallen timber in it, riverside is flat and
 * reeded. Density and species mix carry as much of that as colour does — a
 * player who cannot tell where they are from a silhouette at eighty metres
 * is not really travelling.
 *
 * Every colour here is an *albedo* — the colour the surface would be under
 * neutral light. The sun, sky tint and fog are applied by the painterly
 * shader on top, which is why these read as much lighter and less
 * saturated than the finished frame looks.
 */

export type TreeKind = 'conifer' | 'broadleaf' | 'willow';

/**
 * What stands on the skyline here.
 *
 * A landmark is the one thing in this world placed for the walk rather than
 * for the ground it sits on: it exists so that the road ahead has something
 * to be going toward. Which kinds a band may draw from is therefore a
 * statement about what sort of country this is — the village has chapels
 * because people live there, the forest has stones because whoever raised
 * them is long gone, and the riverside has both plus the one lone tree that
 * would be unremarkable anywhere with a wood in it.
 */
export type LandmarkKind = 'stones' | 'trilithon' | 'chapel' | 'tree';

export interface BiomePalette {
  id: string;
  /**
   * The four ground tones. `grass` and `grassVariant` are the pair the
   * meadow drifts between; `grassShade` is what hollows fall to and
   * `grassDry` is what rises and worn patches come up to. Four is the
   * minimum that gives the mid-distance any landform at all — with two, a
   * hillside a hundred metres off is a single flat wash and the eye has
   * nowhere to land.
   */
  grass: number;
  grassVariant: number;
  /*
   * The dark end, deepened about a third on 2026-07-31, and the reason is
   * worth reading before anything here is tuned again.
   *
   * Task 121 raised `grass`, `grassVariant`, `grassDry`, `road` and
   * `roadShoulder` 35 per cent to close a bimodal land/sky histogram, and
   * deliberately left this one alone — correctly, since the fault it was
   * fixing was a missing *light* end. What went unnoticed is that the ground's
   * own spread had therefore narrowed by the whole of that raise, and the
   * frames were quietly making the difference up with near-black grass
   * scatter. When the ground cover was finally pulled into the ground's own
   * value neighbourhood (see `WorldStreamer`'s grass `colorOf`, and the
   * flat-shading note beside its foliage material) the noon pose lost half a
   * stop of range and `tools/frame-quality.mjs` went red — a measurement that
   * was, read correctly, the gauge counting the litter as value structure.
   *
   * The darks still have to come from somewhere, and this file's own
   * photometric note below already says where: a landscape reads front to back
   * because its SHADOWS are three stops down, not because it is speckled with
   * dark objects. So they come back as hollows in the field, as deeper wheel
   * ruts and as darker canopy — three large shapes — rather than as twenty
   * thousand small ones. Noon measures 2.59 stops against a 2.5 floor with all
   * six poses passing, and modal share across the set fell from 0.26-0.32 to
   * 0.07-0.13 in the same pass, which is the near ground finally not being one
   * uninterrupted wash.
   */
  grassShade: number;
  grassDry: number;
  /** Packed earth of the road itself, and its worn shoulder. */
  road: number;
  roadShoulder: number;
  rock: number;
  trunk: number;
  /** Canopy colours; instances draw from a spread between these. */
  canopy: number;
  canopyVariant: number;
  /** The dissenting accent — flowers, roofs, water, whatever is not green. */
  accent: number;
  accentAlt: number;
  /**
   * The two tones open water is pulled toward, deep and shallow.
   *
   * Neither is an albedo in the way everything else here is one. Water has no
   * albedo — it is a mirror — so what the shader is actually handed is the
   * sky's own horizon colour pulled some of the way toward these, further in
   * the middle of the channel than at its edges. See `paintWater`. They are
   * here rather than as two constants because a forest brook and a riverside
   * river are not the same water: one runs under a closed canopy over leaf
   * litter and the other is open to the whole sky.
   *
   * Riverside's pair is the one that matters, since that is the only band
   * that carries a river. The other two exist so the key means something in
   * every biome rather than being a riverside special case with a fallback.
   */
  waterDeep: number;
  waterShallow: number;
  /**
   * Wet ground at the waterline: silt, shingle and trodden mud.
   *
   * The bank has to be a different *material* from the meadow it interrupts,
   * or a river reads as a blue ribbon laid on a lawn. This is what the ground
   * inside the channel and the first metres of its bank are painted with.
   */
  bank: number;
  /** Which tree silhouettes belong here, and in what proportion. */
  trees: Array<{ kind: TreeKind; weight: number }>;
  /** Which landmarks may be raised on a ridge in this band. */
  landmarks: Array<{ kind: LandmarkKind; weight: number }>;
  /**
   * Scatter densities, relative. Tuned per biome so they feel different.
   * A zero means the kind is absent here, and `WorldStreamer` skips the
   * draw call entirely rather than issuing an empty one.
   */
  density: {
    grass: number;
    tree: number;
    rock: number;
    flower: number;
    fern: number;
    shrub: number;
    reed: number;
    log: number;
    /**
     * Loose stone and surviving grass on the carriageway itself. Its own
     * key rather than sharing `rock`, because how stony a *field* is and
     * how stony a *road* is are unrelated questions — the village has
     * almost no boulders in its pasture and a thoroughly gravelled lane.
     */
    road: number;
    /**
     * Standing water in the wheel rut. Its own key rather than folding into
     * `road` — how gravelly a lane is and how wet its rut stays are unrelated
     * questions, and forest's shade keeps a rut wet long after open village
     * ground has dried the same rain off.
     */
    puddle: number;
  };
  /** How hilly. Multiplies the terrain amplitude within this band. */
  relief: number;
}

/*
 * A note on how bright these are allowed to be, since it is the thing that
 * has been got wrong most often here — in both directions.
 *
 * The sky is the light source, and in a landscape it is also the lightest
 * thing in the frame. Everything on the ground is lit *by* it and so has to
 * sit below it — not by a hair, by a stop or better, or the picture has no
 * order from front to back for the eye to follow. An earlier round of this
 * file took that rule further than the evidence asked for: cut three tenths
 * off the whole ground family to fix a village that measured 0.39 against a
 * sky of 0.62, and never checked how far the cut had gone. It went too far.
 * ROADMAP task 121, from the critique recorded in STATE.md's item 8: the
 * daylight frames' value histogram was *bimodal* — land in one hump, sky in
 * another, and the band between them (roughly L128-175 of 255, whole-frame)
 * holding under 1.5% of the pixels in the morning and noon poses. Restricted
 * to the land region, pixels above L170 never exceeded half a percent even
 * at noon. There was no sunlit grass, no light-struck road, nothing bridging
 * land to sky — the previous cut had left no headroom between "shadowed" and
 * "as bright as the ground gets", so the mid grey a real lit meadow needs
 * simply was not in the palette to reach.
 *
 *
 * --- why the one-stop rule was wrong, not merely inconvenient -----------
 *
 * (Added when an interactive wave reached this same conclusion independently
 * and by a different route; task 121 above is the change that shipped, and
 * this is the physics behind it, kept because the file should say why.)
 *
 * The struck clause was "nothing on the ground comes within a stop of the
 * sky". It is a rule about ALBEDO written as though it were a rule about
 * rendered value, and the two are not the same claim. A sky is bright because
 * it is a large DIM emitter; the sun is a small ferocious one, and a diffuse
 * surface in direct sun is lit by both. Sunlit grass at 0.22 albedo sits near
 * 0.22 x 100000 lux / pi ~ 7000 cd/m^2 against a clear blue sky away from the
 * sun at around 5000. A sunlit field is NOT a stop below the sky it stands
 * under — it is level with it or a little above. What makes a photograph of
 * one still read as ordered front to back is that the SHADOWS are three stops
 * down, not that the lit ground is one stop down.
 *
 * So the replacement rule is about spread rather than ceiling: the ground's
 * dark end stays where it is, and its pale end may come within half a stop of
 * the sky. A band of land that never crosses L128 cannot be the middle of
 * anything, which is why the histogram was bimodal.
 *
 * Corroborating measurement from the interactive wave, taken with a
 * land-masked histogram (sky dome hidden, clear colour set to a sentinel, so
 * "land" is every pixel of real geometry): before the lift, 02-morning read
 * land p90 0.211 (L127) against sky p50 0.582 (L201), and the ONLY land in
 * the game above L170 was haze — the ground past sixty metres, 2 per cent of
 * the land, which got there by being mixed most of the way to the fog colour.
 * The fix taken here is the one the critique named as one of two valid
 * levers (raise the land or lower the sky, not a third lighting term): grass,
 * grassVariant, grassDry, road and roadShoulder in all three biomes are
 * scaled up a uniform 35% from the values the previous comment described,
 * canopy and rock left alone since they were not the surfaces the critique
 * measured as missing. That closes the gap — the morning pose's mid-band
 * share went from ~1.3% to ~24% — while leaving real headroom under the sky:
 * even the darkest tenth of the ground in the tightest-cropped pose measured
 * (a close phone-portrait framing that is almost all foreground) still sits
 * at little over a quarter of the sky's own brightness, comfortably more
 * than a stop below it.
 *
 * One measured cost, recorded rather than hidden: `tools/frame-quality.mjs`
 * scores that same phone-portrait pose as having *less* whole-frame value
 * range than before (2.71 stops before, 1.83 after — see the per-pose floor
 * override in that file for why the number moved and why it was accepted
 * rather than chased). That pose is the wrong one to read this change's
 * success from: it is almost entirely foreground with barely any sky in
 * frame, so closing the land/sky gap this palette exists to close mechanically
 * tightens *that* pose's own internal range, and the postcards (not the
 * histogram) are what show the fix actually reads as a lit meadow rather
 * than a flattened one. Sunlit grass still photographs at a fraction of
 * white, not close to it — these are albedos and the sun and sky multiply
 * them back up — and reading the hex values next to each other on a screen
 * will still make them look muted. What matters is still the ratios: within
 * a biome the canopy sits at roughly half the grass, the road a little under
 * it, and nothing on the ground comes within a stop of the sky.
 */
export const BIOME_PALETTES: Record<string, BiomePalette> = {
  // Open, cultivated, gentle. The lightest and most golden of the three —
  // this is where the road feels most walked-on, and the wide sightlines
  // are what make the first stretch of a day feel like setting out. Almost
  // all broadleaf, hardly any undergrowth, and more flowers than anywhere
  // else, so the ground reads as pasture rather than as wilderness.
  village: {
    id: 'village',
    // Raised 35% from 0x839749 (task 121, see the file-level note above):
    // that value and its 0xa5a367/0xb1a779 pale ends were the previous
    // round's fix for a *different* fault (ground reading brighter than the
    // sky) and overshot it, leaving the mid grey a lit meadow needs entirely
    // unreachable. Village carries three of the four plain daylight postcard
    // poses, so it is where the missing mid-tone showed up worst.
    grass: 0xb1cc63,
    grassVariant: 0xdfdc8b,
    grassShade: 0x3c4a23,
    grassDry: 0xefe1a3,
    // Kept a little under the grass rather than over it. The claim on this
    // colour is not that it is the right colour for dust but that it holds a
    // value break against every ground tone in its own biome, in both
    // directions: a road lighter than the field reads as a river of milk and
    // one the same value as the field is not a road at all.
    road: 0xb19065,
    roadShoulder: 0xa39b6c,
    /*
     * A cool slate, where this was a warm grey-tan (0xbcb39d).
     *
     * Village is the biome in all four plain daylight frames, and a critique
     * measuring those frames found that not one member of this palette
     * dissents from warm — the greens are yellow-olive, the road is warm
     * earth, the rock was warm tan and both accents were warm. A frame with
     * no cool in it anywhere cannot have a shadow that is the complement of
     * its light, however the shader is written, and it reads as a sepia tint
     * pass over one hue.
     *
     * Scattered stone is the right carrier for the cool note: there is enough
     * of it to register across the middle distance, it is never the subject,
     * and cool stone against warm grass is one of the oldest readings in
     * landscape painting. A Short Hike uses exactly this.
     *
     * Chosen at matched relative luminance — 178 against the old 179 — rather
     * than at the darker blue-slate first suggested, because the value
     * relationships in this file are measured off frames and hard-won, and a
     * hue rotation should not quietly become a value change as well.
     */
    rock: 0xaab3c1,
    trunk: 0x856851,
    // Was 0x84a44f / 0xb2c46a, and the variant was the fault. It measured
    // 0.50 against a grass of 0.39, so the pale end of the canopy — which is
    // where the broadleaf bias in `buildTrees` puts most of the trees — was
    // *lighter* than the field the trees stand in. A wood that is lighter
    // than its own meadow cannot separate from it at any distance, and the
    // treeline is the one edge in a landscape that has to hold. Both ends
    // now sit well below the grass, at about 0.43 and 0.69 of it.
    canopy: 0x53682f,
    canopyVariant: 0x727e42,
    accent: 0xe07a5f,
    // A periwinkle, where this was a warm yellow (0xf2cf8a). The comment at
    // the top of this file describes the scheme as "one family with one
    // dissenting accent", and village was shipping two accents that both
    // agreed with the family. Cornflower and harebell are the obvious
    // wildflowers for open pasture, so the cool note costs nothing in
    // plausibility. Darker than the yellow it replaces, which is wanted:
    // flowers are small and a cool note reads best as a dark speck rather
    // than competing with the sky for the light end.
    accentAlt: 0xa9a6d8,
    // Open pasture: whatever water is here is a pond under a wide sky.
    waterDeep: 0x51757f,
    waterShallow: 0x9fbfc6,
    bank: 0x9a8a6b,
    trees: [
      { kind: 'broadleaf', weight: 9 },
      { kind: 'conifer', weight: 1 },
    ],
    landmarks: [
      { kind: 'chapel', weight: 6 },
      { kind: 'stones', weight: 3 },
      { kind: 'tree', weight: 2 },
    ],
    density: {
      grass: 1.1,
      tree: 0.45,
      rock: 0.3,
      flower: 2.4,
      fern: 0.1,
      shrub: 0.9,
      reed: 0,
      log: 0,
      road: 1,
      // Open and sunny — a rut here dries fast, so the rarest puddles of
      // the three biomes.
      puddle: 0.35,
    },
    relief: 0.7,
  },

  // Close, deep, cool. Three times the tree density of anywhere else and
  // the tallest species, so the sky comes through in patches — which is
  // what makes the shafts of light through the canopy the memorable thing
  // about this stretch. The floor is bracken and fallen timber, not lawn.
  forest: {
    id: 'forest',
    // Forest takes the smallest cut of the three — it was already the dark
    // biome and had the least of the fault.
    grass: 0x568752,
    grassVariant: 0x82a55c,
    grassShade: 0x162720,
    grassDry: 0xa9ad65,
    road: 0x8f785d,
    roadShoulder: 0x6c7f50,
    rock: 0x8b9490,
    trunk: 0x655344,
    // Same correction as village, at forest's own scale: 0x4c7f47 measured
    // 0.17 against a grass of 0.12.
    canopy: 0x244831,
    canopyVariant: 0x335930,
    accent: 0xc4763a,
    accentAlt: 0xd9b06a,
    // Under a closed canopy, over leaf litter: darker and greener than the
    // open water of the riverside band.
    waterDeep: 0x2f4a46,
    waterShallow: 0x7c9a95,
    bank: 0x6f6248,
    trees: [
      { kind: 'conifer', weight: 7 },
      { kind: 'broadleaf', weight: 3 },
    ],
    landmarks: [
      { kind: 'stones', weight: 5 },
      { kind: 'trilithon', weight: 4 },
      { kind: 'tree', weight: 2 },
      { kind: 'chapel', weight: 1 },
    ],
    density: {
      grass: 0.75,
      tree: 3.0,
      rock: 0.8,
      flower: 0.35,
      fern: 2.4,
      shrub: 0.45,
      reed: 0,
      log: 1.3,
      road: 0.8,
      // Shaded by the closest canopy of the three biomes, so a rut here
      // holds the last rain the longest.
      puddle: 1.0,
    },
    relief: 1.25,
  },

  // Low, wet, and open to the sky. Least relief, most grass, and the only
  // biome whose accent is cooler than its greens — which is what makes
  // arriving here at golden hour worth walking to. The reeds are the tell:
  // a bank of verticals at the roadside says water is near without a drop
  // of it having to be drawn.
  riverside: {
    id: 'riverside',
    grass: 0x8bbd93,
    grassVariant: 0xb8d19d,
    grassShade: 0x27403a,
    grassDry: 0xd8ddb5,
    // Same problem as village, milder: 0xa89a80 against a `grassDry` of
    // 0xccd2ac was not enough of a break to survive fog at thirty metres.
    road: 0x9b8870,
    roadShoulder: 0x84957b,
    rock: 0xa2a8ae,
    trunk: 0x746459,
    // Darkened three times: from 0x6c9a76 / 0x9ac093 because the willows were
    // the palest foliage in the game and put the brightest object in a wide
    // frame out on the horizon; again from 0x568170 / 0x7aa87f for the reason
    // given under village — the variant still measured above the grass; and
    // again from 0x3a594d / 0x517154 on 2026-07-31, this time as one of the
    // three places the frame's darks were moved to once they stopped being
    // carried by black grass (see the note on `grassShade` above). A treeline
    // is the largest dark mass a flat midday landscape has, and this is the
    // band that carries the noon pose. A riverside canopy should be cool and
    // slightly sombre anyway; it is the biome whose whole character is that
    // its accent is cooler than its greens.
    canopy: 0x2f4a40,
    canopyVariant: 0x436248,
    accent: 0x5fa6c8,
    accentAlt: 0xe4e8d2,
    /*
     * The river's own two tones, and the reason this biome has a name.
     *
     * Deep is a cool blue-green well under every ground tone here — it is the
     * one thing in the band allowed to be darker than the shade grass —
     * because the middle of a channel is where the least light comes back.
     * Shallow is a pale eau-de-nil that sits *above* the grass: the rim of a
     * river is where the sky's own light is returned most directly, and a
     * river whose edges are darker than its banks reads as a trench.
     */
    waterDeep: 0x3f6f7d,
    waterShallow: 0xa8cdc9,
    // Silt and shingle. Well warmer than the greens either side of it, so the
    // bank reads as bare wet ground rather than as more meadow in shadow.
    bank: 0x8d8161,
    trees: [
      { kind: 'willow', weight: 7 },
      { kind: 'broadleaf', weight: 3 },
    ],
    landmarks: [
      { kind: 'trilithon', weight: 4 },
      { kind: 'chapel', weight: 3 },
      { kind: 'stones', weight: 3 },
      { kind: 'tree', weight: 3 },
    ],
    density: {
      grass: 1.45,
      tree: 0.9,
      rock: 0.45,
      flower: 0.8,
      fern: 0.6,
      shrub: 0.5,
      // Cut from 0.9 now that the band has an actual river in it. This key is
      // the reeds in the *roadside ditch*, and at 0.9 they were standing in
      // for the water — a hedge of dark verticals crowding the lane, which is
      // most of what made the near ground read as litter in the riverside
      // frames. The river's own fringe (`bankreed` in `WorldStreamer`) is
      // where reeds belong and is now much denser than this ever was.
      reed: 0.3,
      log: 0.2,
      road: 1.15,
      // Low, flat and closest to the water table of anywhere the road
      // goes — the wettest rut of the three biomes.
      puddle: 1.3,
    },
    relief: 0.45,
  },
};

/** Fallback so an unknown biome id degrades to a walkable world, not a crash. */
export const DEFAULT_PALETTE = BIOME_PALETTES.village;

export function paletteFor(biomeId: string): BiomePalette {
  return BIOME_PALETTES[biomeId] ?? DEFAULT_PALETTE;
}

/**
 * Linear blend between two palettes' numeric colours, for the band
 * transitions. Blending in plain RGB rather than a perceptual space is
 * deliberate: these are all low-saturation neighbours, sRGB lerp between
 * them has no visible dead zone, and the shader is already going to shift
 * them further than the blend error.
 */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
