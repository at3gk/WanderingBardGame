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
 * has been got wrong most often here.
 *
 * The sky is the light source, and in a landscape it is also the lightest
 * thing in the frame. Everything on the ground is lit *by* it and so has to
 * sit below it — not by a hair, by a stop or better, or the picture has no
 * order from front to back for the eye to follow. Measured off the frames,
 * the village ground used to sit at 0.39 relative luminance with a sunlit
 * rise reaching 0.67, against a sky of 0.62: the field was as bright as the
 * air above it, and the four plain daylight frames came out with a total
 * value range of about 1.3:1 from near grass to far ridge.
 *
 * So the ground families here are deliberately darker than a green "looks
 * like" on a swatch. Sunlit grass photographs at around a fifth to a quarter
 * of white, not two fifths, and reading these numbers next to each other on
 * a screen will always make them look too dark — they are albedos, and the
 * sun and sky multiply them back up. What matters is the ratios: within a
 * biome the canopy sits at roughly half the grass, the road a little under
 * it.
 *
 * --- and where that argument stopped being true, measured ---------------
 *
 * The paragraph above used to end "and nothing on the ground comes within a
 * stop of the sky." That clause is struck, and the `*Dry` tones below are
 * lifted, because a land-masked histogram finally showed what obeying it
 * costs. With the sky dome hidden and the clear colour set to a sentinel —
 * so "land" is every pixel of real geometry and nothing else — the shipped
 * frames measured, in linear luminance:
 *
 *   02-morning   land p90 0.211 (L127)   sky p50 0.582 (L201)
 *                mid band (15-60 m) p99 0.303 (L149)
 *   noon         mid band p99 0.380 (L166)
 *
 * The only land in the game above L170 was HAZE: on the morning frame the
 * only band that reached it was the ground past sixty metres, 2 per cent of
 * the land, and it got there by being mixed most of the way to the fog
 * colour. So the frame really did read as sky plus one mass, and the one-stop
 * rule is why: it is a rule about the ALBEDO written as though it were a rule
 * about the rendered value, and the two are not the same claim.
 *
 * The physics the old clause got backwards. A sky is bright because it is a
 * large dim emitter; the SUN is a small ferocious one, and a diffuse surface
 * in direct sun is lit by both. Sunlit grass at a 0.22 albedo sits at roughly
 * 0.22 x 100000 lux / pi ~ 7000 cd/m^2, against a clear blue sky away from
 * the sun at around 5000. A sunlit field is *not* a stop below the sky it
 * stands under — it is level with it or a little above, and the reason a
 * photograph of one still reads as ordered front to back is that the SHADOWS
 * are three stops down, not that the lit ground is one stop down.
 *
 * So the rule that replaces it is about spread rather than about ceiling:
 * the ground's *dark* end stays where it is, and its *pale* end is allowed
 * up to within half a stop of the sky. That is the only version of the rule
 * that can produce the light-sky / mid-land / dark-accent structure the art
 * direction is aiming at, because a band of land that never crosses L128
 * cannot be the middle of anything.
 *
 * What actually moved, and what deliberately did not. Only `grassDry` — the
 * bleached, worn, sun-baked end of each family — is lifted, by about a sixth
 * in each channel at held hue. `grass`, `grassVariant`, `grassShade`, the
 * canopies and the roads are all untouched, so the frame's dark end and its
 * median are where they were and the value RANGE widens rather than sliding.
 * The lifted tone is still an honest albedo: dry blond grass, straw and baked
 * earth measure 0.35-0.50 reflectance, and these land at about 0.52 relative
 * luminance, at the top of that range rather than past it. Anything that
 * needed to go higher would have to become chalk or dust and say so.
 *
 * Two dials in `painterly.ts` had to move with these or the lift would have
 * been invisible: the ground's pale drift only reached 62 per cent of the way
 * to `grassDry`, and its ramp did not top out until 2.6 standard deviations
 * of a noise field that has about 0.125 — that is, almost never. See the
 * ground-drift note there.
 */
export const BIOME_PALETTES: Record<string, BiomePalette> = {
  // Open, cultivated, gentle. The lightest and most golden of the three —
  // this is where the road feels most walked-on, and the wide sightlines
  // are what make the first stretch of a day feel like setting out. Almost
  // all broadleaf, hardly any undergrowth, and more flowers than anywhere
  // else, so the ground reads as pasture rather than as wilderness.
  village: {
    id: 'village',
    // The whole ground family taken down by three tenths, from 0x9ab157 /
    // 0xd2ce84 / 0xe3d69c and a road of 0xa88a63. Village is the biome in all
    // four of the plain daylight frames and it was the brightest of the
    // three: the dry tone alone measured 0.67, which made a sunlit rise in
    // the middle distance the lightest thing in the picture, brighter than
    // any part of the sky above it. The grass now sits at 0.27 and the pale
    // ends at 0.35 and 0.38, which leaves a stop and a half of daylight
    // between the field and the air.
    grass: 0x839749,
    grassVariant: 0xa5a367,
    grassShade: 0x566c34,
    // Up from 0xb1a779, at held hue. This is the tone a sunlit crest, a worn
    // path across a field and a bleached patch of pasture reach, and it is
    // the one that has to carry the light third of the picture. See the
    // struck one-stop clause above for the measurement that moved it.
    grassDry: 0xcdc28c,
    // Kept a little under the grass rather than over it. The claim on this
    // colour is not that it is the right colour for dust but that it holds a
    // value break against every ground tone in its own biome, in both
    // directions: a road lighter than the field reads as a river of milk and
    // one the same value as the field is not a road at all.
    road: 0x836b4b,
    roadShoulder: 0x797350,
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
    grass: 0x40643d,
    grassVariant: 0x607a44,
    grassShade: 0x243f30,
    // Lifted with village's, at the same ratio and held hue. Forest keeps the
    // smallest absolute lift of the three because it starts darkest and its
    // canopy is what the light has to get past.
    grassDry: 0x919457,
    road: 0x6a5945,
    roadShoulder: 0x505e3b,
    rock: 0x8b9490,
    trunk: 0x655344,
    // Same correction as village, at forest's own scale: 0x4c7f47 measured
    // 0.17 against a grass of 0.12.
    canopy: 0x244831,
    canopyVariant: 0x335930,
    accent: 0xc4763a,
    accentAlt: 0xd9b06a,
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
    grass: 0x678c6d,
    grassVariant: 0x889b74,
    grassShade: 0x3d6358,
    // Lifted with village's, at the same ratio and held hue.
    grassDry: 0xbabe9b,
    // Same problem as village, milder: 0xa89a80 against a `grassDry` of
    // 0xccd2ac was not enough of a break to survive fog at thirty metres.
    road: 0x736553,
    roadShoulder: 0x626e5b,
    rock: 0xa2a8ae,
    trunk: 0x746459,
    // Darkened twice: from 0x6c9a76 / 0x9ac093 because the willows were the
    // palest foliage in the game and put the brightest object in a wide frame
    // out on the horizon, and again from 0x568170 / 0x7aa87f for the reason
    // given under village — the variant still measured above the grass. A
    // riverside canopy should be cool and slightly sombre anyway; it is the
    // biome whose whole character is that its accent is cooler than its
    // greens.
    canopy: 0x3a594d,
    canopyVariant: 0x517154,
    accent: 0x5fa6c8,
    accentAlt: 0xe4e8d2,
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
      reed: 0.9,
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
