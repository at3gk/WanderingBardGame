/**
 * Sky dome and the time-of-day palette that drives the whole world's light.
 *
 * The sky is not decoration here — it is the light source. Every painterly
 * surface reads `uSkyColor`, `uHorizonColor`, `uSunColor` and `uFogColor`,
 * so setting the time of day is one call into `applyTimeOfDay` and the
 * grass, the bard's cloak and the fog all move together. Getting that
 * coupling right is most of why dusk on this road feels like dusk rather
 * than like someone turned a brightness slider down.
 *
 * The dome itself is a single inverted sphere with a vertical gradient, a
 * soft sun bloom, a band of horizon warmth, drifting cloud, two bands of
 * distant land, and — after dark — stars that fade in by altitude. No
 * cubemap, no HDR load: the whole sky is a few hundred bytes of shader and
 * it can be any colour we want at any moment, which a baked cubemap cannot.
 *
 * The land on the dome is the odd one in that list and worth naming here.
 * The world only streams out to a hundred and sixty-five metres, so without
 * it every daylight frame ended in a straight seam between a green band and
 * a blue one — two values front to back, where a frame that reads has four.
 * Drawing the distance here rather than building it means it is at infinity
 * for free: it holds still as the bard walks and turns with the camera,
 * which is exactly what a range on the skyline does.
 */

import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type IUniform,
} from 'three';
import type { PainterlyGlobals } from './painterly';
// The one number the shader and the profile generator must agree on. Imported
// rather than written twice: a silent mismatch here would read as a skyline
// that is *nearly* tomorrow's road, which is the worst possible failure for a
// band whose entire justification is that it is honest.
import { SKYLINE_SAMPLES } from '../core/skyline';

/** One keyframe of the day. `t` is 0..1 across a full cycle from midnight. */
export interface SkyKey {
  t: number;
  name: string;
  zenith: number;
  horizon: number;
  sun: number;
  /** Warm bounce coming back up off the ground into shadowed faces. */
  bounce: number;
  fog: number;
  /** Sun elevation in radians. Negative is below the horizon. */
  elevation: number;
  /** Sun azimuth in radians, measured around +Y from +Z. */
  azimuth: number;
  /** Overall light multiplier. */
  exposure: number;
  /** 0 = no stars, 1 = full night sky. */
  starness: number;
  /**
   * Roughly what fraction of the visible sky band carries cloud.
   *
   * This is a key rather than a constant because the cloud sharpening used
   * to be fixed, and fixed sharpening tuned to look right at golden hour
   * left morning and noon with one faint smear and nothing else — the two
   * frames that most need something in the upper half. Weather is part of
   * the palette, so it belongs next to the colours that move with it.
   */
  cloudiness: number;
}

/**
 * The day, in eight keys.
 *
 * These are hand-picked rather than derived from a physical sky model,
 * because a physical model gives you a correct blue-grey dawn and what a
 * storybook wants is a *lilac* one. The through-line: shadows are always
 * the complement of the sun (warm sun, cool shadow; cool sun, warm
 * shadow), which is the single rule that makes painted light read as
 * painted light.
 */
export const SKY_KEYS: SkyKey[] = [
  {
    t: 0.0,
    name: 'deep night',
    zenith: 0x121a33,
    horizon: 0x2a2a48,
    sun: 0x8f9ed6,
    bounce: 0x1c2138,
    fog: 0x232a44,
    elevation: -0.5,
    azimuth: 1.2,
    // Lifted from 0.62 alongside the drop in AMBIENT_STRENGTH. The night
    // keys are lit by the sky and by one fire, so a cut to the ambient term
    // comes off them undiluted where the daylight keys barely feel it; this
    // hands that back at the only three hours that needed it.
    exposure: 0.73,
    starness: 1,
    cloudiness: 0.30,
  },
  {
    t: 0.2,
    name: 'first light',
    zenith: 0x3f5580,
    horizon: 0xc9a0a8,
    sun: 0xe9b0a4,
    bounce: 0x4a4460,
    fog: 0x8e93ae,
    elevation: -0.04,
    azimuth: 1.05,
    exposure: 0.90,
    starness: 0.35,
    cloudiness: 0.40,
  },
  {
    t: 0.28,
    name: 'dawn',
    zenith: 0x7ba3cf,
    horizon: 0xffc9a0,
    sun: 0xffc07a,
    bounce: 0x8a6f56,
    fog: 0xd9b7a4,
    elevation: 0.16,
    azimuth: 0.95,
    exposure: 1.02,
    starness: 0,
    cloudiness: 0.46,
  },
  {
    t: 0.42,
    name: 'morning',
    /*
     * The three daylight keys — this one, high day and afternoon — are all
     * about a stop and a half brighter than the land they light, and this is
     * the round that takes the difference out of the sky rather than out of
     * the ground.
     *
     * Measured on the ten postcards: 02-morning's land sits at 46/78/118 for
     * its fifth, fiftieth and ninety-fifth percentile against a sky of 204,
     * and 0.89 per cent of it reaches above L170. Worked through the shader
     * by hand, it cannot: the palest ground tone in the village palette is
     * grassDry, the drift only mixes 62 per cent of the way to it, and a
     * fully sunlit fragment of the result lands at about L160 after ACES and
     * the sRGB encode. So "the land never reaches the light third" is not a
     * tuning failure that a ground albedo would fix — it is arithmetic, and
     * palette.ts's argument for those albedos is sound and is left standing.
     *
     * What is wrong is the gap, and the round before this one tried to close
     * it by taking the zenith down 27 levels from 0x8dc0e8. Roughly half of
     * that is now back, and the paragraph that justified the whole drop is
     * struck, because its central claim is measurably the wrong way round.
     *
     * It claimed a change here "moves the sky's own value nearly one for one
     * while costing the lit ground only the slice of it that arrives as
     * ambient — roughly a twentieth". Shot three ways at one matched horizon
     * — exposure lifted alone, exposure plus half the zenith, exposure plus
     * all of it — the zenith is mostly GROUND light, not sky light:
     *
     *   08-phone-portrait  sky band  199 → 199 → 201 → 204
     *                      land >L128  11.8 → 18.7 → 27.3 → 33.0 per cent
     *   10-tablet          sky band  209 → 209 → 210 → 212
     *                      land >L128   2.7 →  3.5 →  3.8 →  4.2 per cent
     *
     * So thirteen levels of zenith bought eight and a half points of land in
     * the light-mid tier for two levels of sky. The reason is geometry the
     * old paragraph did not account for: these cameras look along the road,
     * so the sky actually in frame is nearly all horizon and fog and holds
     * almost no zenith at all, while a patch of ground has its normal
     * pointing straight up and therefore takes the zenith at very nearly full
     * weight through the ambient mix in painterly.ts. The zenith is the half
     * of the sky the frame does not show and the ground does.
     *
     * Half rather than all of it, and the ladder above is why the next round
     * has a real lever rather than a guess: a full restore measures better
     * again on both frames and was shot, not assumed. It is left on the table
     * because it would revert the previous round wholesale on two frames'
     * evidence, and because the sky band is beginning to move under it.
     *
     * Held at exactly the same saturation as both endpoints (0.392 old,
     * 0.394 dropped, 0.391 here), so this is a value change and nothing else;
     * the hue rotation on the horizon below is the separate argument and is
     * untouched — it is what earned the saturation and none of it is given
     * back here.
     */
    zenith: 0x83b2d7,
    // Was 0xdceaf2, which is within a few per cent of white. A near-white
    // horizon key does two bad things at once: it leaves the lower sky with
    // no colour to differ from the cloud in it, and — because this same
    // value is the world's sideways ambient — it lifts every vertical
    // surface in the frame until there is no dark left to compose with.
    /*
     * Rotated from 0xbfd4e6 and NOT darkened, and the second half of that is
     * a measured result rather than caution.
     *
     * The rotation first: S0.170 to S0.259 at held luminance (208.8 to
     * 208.9). Measured per depth band, the two widest high-sun frames wash to
     * neutral where the rest of the set does not — 08-phone-portrait reads
     * skyline S0.091 and treeline S0.123, 10-tablet skyline S0.081, against
     * 01-dawn's skyline S0.223 and 04-golden's S0.302, which are fine. The
     * skyline band is mostly *sky*, so this key and not only the fog had to
     * move: at S0.17 there was no hue in the lower sky for the far land to be
     * hazed toward, and the haze then mixed a warm olive with a near-neutral
     * grey and arrived at grey.
     *
     * The value was taken down 27 levels alongside the zenith for one round
     * and put back, because this key is not only sky. `fogTint` in
     * painterly.ts is `mix(uFogColor, uHorizonColor, ...)` running up to 0.6
     * at ground level, so this is also what the far land tends toward — and
     * the fog is applied *after* uExposure, so unlike everything else the
     * exposure lift below cannot pay the far land back. Shot with it dark:
     * 10-tablet's treeline fell from L130 to L106 and its skyline from L170
     * to L141 while the near ground rose, which took the frame's front-to-
     * back range from 2.79 stops to 1.95 and left a *wider* empty gap between
     * the land and the sky than it started with. The zenith is the half of
     * the sky that is only sky, and it is where the whole drop belongs.
     */
    horizon: 0xb4d6f3,
    sun: 0xfff0d0,
    // Darkened from 0x7d8a5c. This value is the light coming back UP off the
    // ground into every downward-facing surface, so a bright one lifts the
    // shadow side of every tuft, every canopy underside and every rut back
    // to roughly the tone of the lit side — which is most of why the noon
    // and morning frames had no value range to compose with.
    bounce: 0x5d6a44,
    /*
     * Down from 0xcfe0ec, which was brighter than the sky it stands in
     * front of.
     *
     * The fog colour is the value distance tends toward, so it decides where
     * the far ground sits in the frame's order. At 0.72 against a horizon of
     * 0.64 the answer was: above it. The hazed band at a hundred and fifty
     * metres came out as the brightest thing in the picture — brighter than
     * the sky, brighter than the ridge behind it — and a landscape whose
     * middle distance out-glows its own sky reads as a bank of fog rolling
     * in rather than as depth. Distance is *paler and lower in contrast*
     * than what is in front of it and *darker* than the air behind it, and
     * there is only one band of values that puts it there. This one lands
     * the fully hazed distance at about nine tenths of the sky it meets:
     * below it, and clearly above the treeline standing in front of it.
     *
     * Rotated from 0xb2c1cc, and only rotated: L190.6 to L190.7, S0.127 to
     * S0.278. Everything the paragraph above says about where the value has
     * to sit still holds and is untouched, which is the whole reason this was
     * done as a hue change rather than by reaching for the value again. The
     * three daylight fogs were the three flattest hues in the file and they
     * are the three that have to carry aerial perspective; a grey haze
     * subtracts saturation from the distance instead of replacing it with
     * the colour of air.
     */
    fog: 0xa4c3e3,
    /*
     * Down from 0.62 rad and round from 0.6, and this is the change that
     * gives the morning frame a landscape instead of a lawn.
     *
     * At thirty-five degrees with the sun a little behind the shoulder,
     * every cast shadow in the world falls away from the camera and hides
     * behind the thing that cast it, and the ground — which is near enough
     * flat over the whole of the middle distance — takes the same `ndl`
     * everywhere. The field therefore had no modelling of any kind: no
     * shadows across it, no difference between a rise and a hollow, one
     * value from the bard's boots to the treeline. Twenty-two degrees and
     * more to the side puts the shadows across the road where they can be
     * seen, and gives a slope tilted toward or away from the sun something
     * to differ by.
     *
     * Twenty-two degrees is still plainly morning. The alternative on offer
     * was to keep the sun where it was and fake the modelling with a
     * gradient, which is a second lighting model wearing the first's
     * clothes.
     *
     * Twenty-two degrees, and a later round tried to go lower and put it
     * back. The argument for lower was that the modelling a low sun buys
     * goes as the derivative of the sine, so it keeps paying as the sun
     * drops. It does — on a slope. The near ground of these frames is flat
     * for the first ten metres, which is nearly half the picture, and
     * measured against the same ten postcards the drop to 0.31 moved every
     * one of them down or nowhere and darkened the lot. What the near
     * ground is missing is a caster standing in it, not a lower sun, and
     * that turned out to be a harder problem than an angle.
     */
    elevation: 0.38,
    azimuth: 0.92,
    /*
     * Up from 1.02, and this is the other half of the sky coming down.
     *
     * uExposure multiplies the painterly shader's colour and the sky dome has
     * no such uniform, so this is the one dial in the file that moves the
     * land without moving the air. It is not a new term: the note under deep
     * night already uses it as a per-hour compensation for a change made to
     * the shared lighting model.
     *
     * It is needed because darkening the sky costs the land the slice of its
     * light that arrives as ambient. Measured on 02-morning across the sky
     * change: the land's median fell from L78 to L74 and its share above
     * L170 from 0.89 to 0.09 per cent, so the gap the change was meant to
     * close was being closed partly by pulling the land down with the sky.
     *
     * Eighteen per cent, and it was cut to eight for one round on the
     * argument that a large lift would compress the top of the land's range
     * through the ACES curve. Measured, it does the opposite: at 1.18 the
     * morning land reads 45/81/125 for its fifth, fiftieth and ninety-fifth
     * percentile against 46/78/118 before any of this, so the top of the
     * range expanded by seven levels; at 1.10 it reads 44/78/120 and the
     * frame's share of the L128-175 tier the land is supposed to be
     * occupying falls from 2.43 back to 1.37 per cent. The argument was
     * plausible and wrong, and the frames settled it.
     *
     * Thirty per cent now, and this is where the separation the zenith
     * restore gives back is taken instead. Same reasoning one step further:
     * this is the only dial that moves the land and leaves the air alone, so
     * it is the right place to spend, and there is no ACES shoulder anywhere
     * near the land — the morning band sits at a linear 0.07, a long way
     * below where the curve starts to compress. Measured at a matched
     * horizon, base to shipped, on the two frames item 8 names:
     *
     *   08-phone-portrait  land 42/104/155 → 47/114/162, >L170 0.69 → 2.18,
     *                      >L128 11.8 → 32.0 per cent, frame HOLE 9.1 → 20.9
     *   10-tablet          land 45/80/112 → 51/89/122, >L128 2.7 → 3.9,
     *                      frame HOLE 4.9 → 5.8
     *
     * The front-to-back range falls as this rises (08 1.47 → 1.28 stops, 10
     * 1.65 → 1.46) and that is the trade being made deliberately, not a
     * regression: item 8 is a claim about the land never occupying the light
     * third, and the only way to fill the L128-175 tier from below is to
     * bring the land up toward the sky. The band ORDER is intact on every
     * frame, which is the property worth guarding.
     */
    exposure: 1.30,
    starness: 0,
        /*
     * Up from the mid-thirties and forties. The three daylight keys are the
     * three whose upper half a critic kept describing as a band of frame
     * doing no work, and they were the three with the least cloud in them —
     * a sky asked for a third covered, over a noise field that spends most
     * of its range in the middle, gives a couple of smears near the
     * horizon and clean paper above. Cloudiness is a quantile here, so
     * these numbers are honest fractions of the visible band: rather over
     * half, which is a fair English morning and gives the top of the frame
     * something with an underside in it.
     */
    cloudiness: 0.56,
  },
  {
    t: 0.55,
    name: 'high day',
    // Down 14 levels at held saturation (0.417 old, 0.415 dropped, 0.418
    // here), half of the 28 the previous round took. See the long note on
    // morning's zenith: the gap is closed from the LAND's end by uExposure,
    // because a zenith at these camera pitches is mostly ground ambient and
    // barely appears in the frame's own sky.
    zenith: 0x7cafd5,
    // See the note on morning. Noon is the frame with the least colour in it
    // and the most to lose from a white horizon. Rotated from S0.123 to
    // S0.259 at held luminance (213.5 to 213.3) and deliberately not
    // darkened: this key is most of what the skyline band of a wide high-sun
    // frame is made of, and it is also what the far land is hazed toward, so
    // taking its value down takes the whole distance with it.
    horizon: 0xb7dbf7,
    sun: 0xfff6e2,
    // See the note on morning; noon has the least colour to lose and the
    // most flattening to undo.
    bounce: 0x66703f,
    // Same correction as morning; noon had the brightest fog of the day and
    // the palest sky to lose it against. Then rotated, L195.6 to L195.7 and
    // S0.107 to S0.272 — the flattest hue in the file, on the frame with the
    // longest sightlines and so the most aerial perspective to carry.
    fog: 0xa9c8e8,
    /*
     * Sixty degrees was the worst case of the problem described under
     * morning: at that height a flat field and a hillside differ by almost
     * nothing and a shadow is a puddle under its own caster. Forty was
     * better and still not enough — measured, the noon frame's foreground
     * carried half the cross-frame variation of the golden one.
     *
     * Twenty-nine degrees, and the azimuth stays where it is. The azimuth
     * is the lever one would rather pull, because a sun off to the side
     * throws its shadows across the road instead of hiding them behind
     * their own casters — but this key is the top of the day, the sun
     * crosses the meridian here, and the arc runs 0.95 at dawn through this
     * to -1.05 at golden hour. Swinging it back east at noon to buy a
     * better frame would have the sun reverse direction in the middle of
     * the afternoon, which is a thing a player watching a full day cycle
     * would see. So the height carries it alone.
     *
     * Held at forty degrees. Twenty-nine was tried, alone and alongside a
     * meadow that casts its own shadows, and measured worse both times for
     * the reason set out under morning.
     */
    elevation: 0.70,
    azimuth: 0.34,
    // Up from 1.05, then to 1.33. See the note under morning: this is the one
    // dial that moves the land without moving the air, so it is where the
    // separation is taken rather than out of the sky. Noon moves least of the
    // four measured frames — its land is 41/87/106 against 48/95/116 — which
    // is the arithmetic under morning's first paragraph showing through: this
    // hour's ground is already near the palest tone the palette can reach.
    exposure: 1.33,
    starness: 0,
        // See the note under morning.
    cloudiness: 0.52,
  },
  {
    t: 0.7,
    name: 'afternoon',
    // The third daylight key, and the one 10-tablet is posed exactly on. Down
    // 10 levels rather than the 20 the previous round took, keeping the same
    // proportion as the other two: afternoon's zenith was already the lowest
    // of the three relative to its own horizon, and this key has to stay
    // warmer and softer than noon or the afternoon stops being an afternoon.
    // Saturation held (0.363 old, 0.362 dropped, 0.360 here).
    zenith: 0x87b8d3,
    // Was 0xf3dcbc at L222.6, the brightest key in the file. Rotated warm
    // from S0.226 to S0.300 at held luminance and left at that value: this is
    // the key 10-tablet is posed under, and it was the frame that proved
    // darkening a horizon darkens the whole distance with it. See morning.
    horizon: 0xf8dcad,
    sun: 0xffe2ac,
    bounce: 0x8b8452,
    // Rotated warm, L194.2 to L194.4 and S0.105 to S0.271. Afternoon's fog
    // was as neutral as noon's while sitting under a warm horizon, so the
    // haze was pulling the distance toward grey and the horizon toward cream
    // at the same time, which is two atmospheres.
    fog: 0xd2c299,
    // Same correction, mirrored: the afternoon sun has crossed over, so it
    // goes further round rather than back. Tried at 0.27 and put back; see
    // the note under morning.
    elevation: 0.34,
    azimuth: -0.92,
    // Up from 1.0, then to 1.27. See the note under morning; 10-tablet is
    // posed on this key and is one of the two frames the change is measured
    // on.
    exposure: 1.27,
    starness: 0,
        // See the note under morning.
    cloudiness: 0.54,
  },
  {
    t: 0.82,
    name: 'golden hour',
    zenith: 0x6f96c4,
    horizon: 0xffa869,
    sun: 0xff9d5c,
    bounce: 0x8a5f42,
    fog: 0xe8b391,
    elevation: 0.12,
    azimuth: -1.05,
    exposure: 0.98,
    starness: 0,
    cloudiness: 0.50,
  },
  {
    t: 0.9,
    name: 'dusk',
    zenith: 0x3c4a7a,
    horizon: 0xc2718a,
    sun: 0xd98a86,
    bounce: 0x4c4258,
    fog: 0x8a7c96,
    elevation: -0.1,
    azimuth: -1.2,
    exposure: 0.94,
    starness: 0.45,
    cloudiness: 0.44,
  },
];

const scratchA = new Color();
const scratchB = new Color();

/** Interpolated sky state at a point in the day. */
export interface SkyState {
  zenith: Color;
  horizon: Color;
  sun: Color;
  bounce: Color;
  fog: Color;
  sunDirection: Vector3;
  exposure: number;
  starness: number;
  cloudiness: number;
  /** Blend label, for debug overlays and the journal. */
  label: string;
}

/**
 * Sample the palette. `t` wraps, so 1.05 and 0.05 are the same moment —
 * the day loop never has to clamp at its own seam.
 */
export function skyStateAt(t: number): SkyState {
  const time = ((t % 1) + 1) % 1;
  const keys = SKY_KEYS;

  let i = 0;
  for (let k = 0; k < keys.length; k++) {
    if (keys[k].t <= time) i = k;
  }
  const a = keys[i];
  const b = keys[(i + 1) % keys.length];
  let span = b.t - a.t;
  if (span <= 0) span += 1;
  let local = (time - a.t) / span;
  if (local < 0) local += 1 / span;
  local = Math.min(1, Math.max(0, local));
  // Ease the blend so the sky lingers in each named mood and moves quickly
  // between them, rather than spending the whole day in between two.
  const e = local * local * (3 - 2 * local);

  const elevation = a.elevation + (b.elevation - a.elevation) * e;
  const azimuth = a.azimuth + (b.azimuth - a.azimuth) * e;

  return {
    zenith: mixHex(a.zenith, b.zenith, e).clone(),
    horizon: mixHex(a.horizon, b.horizon, e).clone(),
    sun: mixHex(a.sun, b.sun, e).clone(),
    bounce: mixHex(a.bounce, b.bounce, e).clone(),
    fog: mixHex(a.fog, b.fog, e).clone(),
    sunDirection: new Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation),
    ).normalize(),
    exposure: a.exposure + (b.exposure - a.exposure) * e,
    starness: a.starness + (b.starness - a.starness) * e,
    cloudiness: a.cloudiness + (b.cloudiness - a.cloudiness) * e,
    label: e < 0.5 ? a.name : b.name,
  };
}

function mixHex(a: number, b: number, t: number): Color {
  scratchA.setHex(a);
  scratchB.setHex(b);
  return scratchA.lerp(scratchB, t);
}

/**
 * Push a sky state into the shared painterly uniforms and the sun light.
 * This is the one function that couples "what time is it" to "what does
 * everything look like".
 */
export function applyTimeOfDay(
  globals: PainterlyGlobals,
  state: SkyState,
  sunLight?: { color: Color; intensity: number },
): void {
  globals.uSkyColor.value.copy(state.zenith);
  globals.uHorizonColor.value.copy(state.horizon);
  globals.uSunColor.value.copy(state.sun);
  globals.uGroundBounce.value.copy(state.bounce);
  globals.uFogColor.value.copy(state.fog);
  globals.uSunDirection.value.copy(state.sunDirection);
  globals.uExposure.value = state.exposure;

  if (sunLight) {
    sunLight.color.copy(state.sun);
    // Below the horizon the sun stops throwing shadows entirely rather than
    // inverting them, and moonlight takes over as a dim cool key.
    const above = Math.max(0, state.sunDirection.y);
    sunLight.intensity = 0.15 + above * 1.15;
  }
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  // Strip translation so the dome is always centred on the camera, and
  // force w = z so it renders at the far plane without a huge radius.
  vec4 clip = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

const SKY_FRAGMENT = /* glsl */ `
/** See the note at the point of use: how far the dome is pushed off its own
 *  grey axis to pay back what ACES takes off the brightest area in the frame. */
#define SKY_CHROMA 2.30
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform vec3 uFogColor;
uniform vec3 uGroundBounce;
uniform float uStarness;
uniform float uCloudiness;
uniform float uTime;

/* Tomorrow's road on the skyline; see the block in main() and core/skyline.ts.
 * The sample count is injected from SKYLINE_SAMPLES so the two cannot drift.
 * The arc is a little over a third of a turn wide: narrow enough that a signed
 * angle taken with atan() can never meet its own seam, wide enough that the
 * whole of tomorrow's road fits in the direction the bard is facing. */
#define TOMORROW_SAMPLES ${SKYLINE_SAMPLES}
#define TOMORROW_ARC 0.6
uniform float uTomorrow;
uniform float uTomorrowHeights[TOMORROW_SAMPLES];
uniform vec2 uTomorrowDir;

varying vec3 vDirection;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/** Value noise on the dome's own coordinates. Two octaves is enough for cloud. */
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.3 + 7.1) * 0.3 + vnoise(p * 4.7 + 19.3) * 0.15;
}

/**
 * Coverage of one band of distant land: 1 below its crest, 0 above.
 *
 * The heading arrives as a point on the unit circle rather than as an
 * angle, and that is what keeps the noise seamless. Sampling by atan2 puts
 * a discontinuity due south, and the range tears itself in half every time
 * the camera swings past it.
 *
 * The three scales are written out rather than left to fbm because fbm's
 * octaves fall away too fast at this amplitude — the second and third were
 * worth well under a degree each and the crest came out as one long smooth
 * arc, which reads as a bank of cloud rather than as land. The middle term
 * is the one that does the work: ten-degree humps big enough to be summits.
 */
float ridgeMask(vec2 ring, float height, float base, float amp, float seed) {
  float crest = base
    + vnoise(ring * 1.9 + seed) * amp
    + vnoise(ring * 5.5 + seed * 1.7) * amp * 0.40
    + vnoise(ring * 13.0 + seed * 2.9) * amp * 0.16;
  return smoothstep(crest, crest - 0.004, height);
}

/**
 * The fog colour as it has to be written in order to arrive as air.
 *
 * The dome runs through the same ACES pass the world does, and the haze is
 * the brightest large area in a daylight frame, so it lands on the tone
 * mapper's shoulder where ACES desaturates by design. painterly.ts's
 * FOG_CHROMA note has the measurement: the morning frame's fully-hazed
 * distance goes in at S0.274 and comes out at S0.122. The terrain's haze and
 * this ridge are supposed to arrive at the same colour from opposite
 * directions — that is the argument in the note on ridgeTint below — so they
 * have to be corrected by the same amount, and this constant is deliberately
 * the same number as FOG_CHROMA rather than a second one tuned by eye.
 *
 * Luminance-preserving by construction (a mix toward the colour's own luma
 * moves chroma and leaves dot(c, luma) exactly where it was), because the
 * value of this band is load-bearing and separately argued for below: it is
 * darker than the air it meets by construction, and a saturation pass must
 * not quietly become a value change.
 */
vec3 chroma(vec3 c, float k) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(vec3(0.0), mix(vec3(luma), c, k));
}

/**
 * Kept as the identity, and kept as a named call rather than deleted.
 *
 * This was a 1.35 chroma push applied to the ridge bands alone, and the long
 * note below the cloud block records what measuring it found: the correction
 * was right and was reaching a tenth of the surface it was written about,
 * while the bands it did reach still came back three and a half times flatter
 * than the hazed terrain they are supposed to meet. The whole dome now takes
 * one correction at one strength, after the bands are drawn, so a second push
 * here would land on them twice.
 */
vec3 air(vec3 c) {
  return c;
}

/**
 * Aerial perspective for a band of distant land, in the sky's own colours
 * rather than a grey wash. base is the sky's value in this direction, so
 * the band is darker than the air it meets by construction at every hour,
 * instead of by a set of constants tuned against one of them. haze pulls
 * it toward the colour of distance, away from the band it stands in; land
 * is the trace of the ground's own colour that keeps a forested skyline
 * blue-green and not blue.
 *
 * haze used to pull toward uZenith, and that is the term that made the
 * tablet frame's skyline grey. Measured, its skyline band came back at
 * saturation 0.081 while the near ground read 0.417, and it did not move
 * when the afternoon horizon and fog keys were both committed to a
 * saturated hue — because at an hour whose horizon is warm cream and whose
 * zenith is cool blue, a third of the way from one to the other is the grey
 * axis. Mixing two near-complements and expecting a colour is the same
 * mistake the haze over the terrain was making.
 *
 * uFogColor is the right target and not merely a less bad one: it is the
 * value and hue this file already declares distance tends toward, the
 * terrain's own haze uses it, and it is now committed at every hour to a
 * hue rather than to a grey. So the ridge and the hazed land in front of it
 * arrive at the same colour from opposite directions, which is what makes
 * them read as one atmosphere.
 */
vec3 ridgeTint(vec3 base, vec2 ring, float haze, float value, float land) {
  vec3 tinted = mix(mix(base, uFogColor, haze) * value, uGroundBounce, land);
  // The flank turned toward the sun keeps a little of the sun's colour,
  // which is what stops the band being a flat cut-out.
  vec2 sunRing = normalize(uSunDirection.xz + vec2(1e-5));
  float facing = max(dot(ring, sunRing), 0.0);
  // air() last, on the finished band rather than on uFogColor alone: the
  // band is mostly base — the sky's own colour in this direction — and it
  // is the BAND that measured grey, so correcting one of its three
  // ingredients corrects a third of the problem. Measured on the morning
  // frame, boosting only the fog input moved the skyline band from S0.114 to
  // S0.134; the band itself is what the critique is looking at.
  return air(mix(tinted, mix(tinted, uSunColor, 0.22), facing * facing));
}

void main() {
  vec3 dir = normalize(vDirection);
  float height = dir.y;

  // Gradient.
  //
  // The edges here are the whole reason the sky used to be blank paper. The
  // ramp ran smoothstep(0.44, 0.92, t), and t is 0.5 at the horizon: it did
  // not reach the halfway point of that ramp until about seventeen degrees
  // of elevation, which is above the top of a forty-two-degree frame pitched
  // slightly down. The camera therefore never saw the zenith colour at all,
  // and every daylight frame had a third to a half of its area filled with
  // undifferentiated horizon wash. Bringing the ramp into 0.50..0.66 puts
  // the blue where the camera is actually looking. The pow() is kept: it is
  // what stops the warm horizon band washing halfway up the sky.
  float t = pow(clamp(height * 0.5 + 0.5, 0.0, 1.0), 0.9);
  vec3 color = mix(uHorizon, uZenith, smoothstep(0.50, 0.66, t));

  // A tighter band of extra horizon warmth just above the skyline.
  float band = exp(-abs(height) * 7.0);
  color = mix(color, uHorizon, band * 0.55);

  // Kept aside before anything is drawn into the sky, because the ridge
  // below is built from the sky's own value in its own direction. A far
  // landform tends toward the radiance of the air in front of it, so
  // deriving it from this rather than from a hand-mixed constant is both
  // the physical answer and the one that cannot go wrong at some key
  // nobody checked: it is darker than the sky it meets by construction, at
  // every hour, instead of by a set of numbers tuned against noon.
  vec3 skyBase = color;

  // --- cloud -------------------------------------------------------------
  // Two drifting sheets of fbm, masked to the band of sky the camera can see
  // and faded out at both ends of it. Sheets rather than a single layer
  // because one layer of noise reads as marble; two at different scales and
  // speeds read as weather. They are tinted between the horizon colour and
  // white, so they take the time of day for free — pink at dusk, near-white
  // at noon — which is the same trick the whole world's lighting uses and
  // costs nothing beyond the uniforms already here.
  //
  // Drawn on the dome rather than as geometry: no mesh, no texture, no
  // bundle. The projection divides the direction by its own height, so a
  // sheet flattens toward the horizon the way a real one does.
  // The lower edge runs below the skyline rather than starting a few
  // degrees above it. Cloud that stops short of the horizon leaves a clean
  // strip of empty gradient exactly where the treeline meets the sky, and
  // that strip is what made the treeline read as a sticker: it had nothing
  // to sit against.
  float cloudBand = smoothstep(-0.03, 0.05, height) * smoothstep(1.05, 0.30, height);
  if (cloudBand > 0.001) {
    vec2 plane = dir.xz / max(height + 0.16, 0.05);
    float drift = uTime * 0.004;
    float low = fbm(plane * 0.85 + vec2(drift, drift * 0.3));
    float high = fbm(plane * 2.1 + vec2(-drift * 1.7, drift * 0.9) + 31.0);

    // Where the sharpening sits decides how much sky is covered, and it
    // used to be a constant tuned against golden hour: smoothstep(0.52,
    // 0.78, ...) on a field whose standard deviation is about 0.14 leaves
    // roughly a tenth of the band with any cloud in it and almost none of
    // it opaque. Morning and noon came out as one smear on empty paper.
    // Centring the ramp on a per-key quantile instead lets the palette ask
    // for a coverage and get it. The 0.73 and 0.43 are the noise field's
    // own numbers, not taste: 0.73 is roughly its 1.3-sigma point and the
    // slope carries the centre down to the median by full cloudiness.
    float mid = 0.73 - 0.43 * uCloudiness;
    float cover = smoothstep(mid - 0.085, mid + 0.085, low * 0.72 + high * 0.28);
    // Squared off once more. A single smoothstep spends most of its output
    // in the middle of the range, and a cloud that is forty per cent opaque
    // everywhere is haze: it lowers the contrast of the whole upper frame
    // without ever becoming a shape. Pushing the midtones toward the ends
    // gives the same coverage as edges and gaps instead.
    cover = cover * cover * (3.0 - 2.0 * cover);

    // A cloud needs an underside or it is a sheet of paper laid on the sky.
    // The low-frequency term stands in for "how far up the mass this pixel
    // is": where it is small we are looking at the shaded belly, which in
    // life is lit by whatever the ground is throwing back — so it takes
    // uGroundBounce, the same warm return every shadowed surface in the
    // world uses. Where it is large we are on the crown and it goes toward
    // white. That gives the cloud a value range of its own instead of one
    // flat tint, which is the difference between weather and wallpaper.
    float lit = smoothstep(0.38, 0.84, low);
    vec3 belly = mix(uHorizon, uGroundBounce, 0.50) * 0.95;
    // The crown is the sun's colour on the horizon's, not white. It was
    // white — ninety per cent of the way to it — and that is fine at noon
    // and absurd at midnight, where it put brilliant white cumulus over a
    // sleeping camp lit by one fire. A cloud is only ever as bright as the
    // light falling on it, and at night that light is the moon, which this
    // palette already carries as the sun colour of the night keys.
    vec3 crown = mix(uHorizon * 1.15, uSunColor, 0.45);
    vec3 cloudColor = mix(belly, crown, lit);
    color = mix(color, cloudColor, cover * cloudBand);
  }

  /*
   * --- the sky's own hue, put back after the tone mapper takes it ---------
   *
   * The one correction in this file that was written down, argued for, and
   * then applied to a tenth of the frame it was about. air() above carries
   * the whole case: the dome runs the same ACES pass the world does, ACES
   * desaturates its shoulder by design, and the sky is the brightest large
   * area in a daylight frame. That case is about the SKY, and until now the
   * correction was reaching only the two ridge bands drawn on it.
   *
   * Measured on the shipped wave-3 build, in the frame a blind panel called
   * a milk-grey upper half: the morning sky's own band came back at
   * saturation 0.062 immediately above the skyline and 0.096 at the top of
   * the frame, against a horizon key committed at S0.259 and a zenith at
   * S0.391. Nearly two thirds of the hue this file's keys declare was being
   * taken off between the uniform and the pixel, which is why every round
   * spent re-picking those hexes measured no better: the keys were never the
   * thing that was wrong.
   *
   * The cloud is the worse half of it and is corrected here rather than at
   * the crown, deliberately. A cloud crown at mix(uHorizon * 1.15, uSunColor,
   * 0.45) goes into the tone mapper at a linear 0.74/0.82/0.85 and comes out
   * within a few levels of white, and the daylight keys ask for rather over
   * half the visible band to be covered — so half the upper frame was paper.
   * Dimming the crown would fix the saturation by taking the sky's VALUE
   * down, and every note in this file about the horizon key says what that
   * costs: this is the band the far land is hazed toward and the value order
   * front to back is the property worth guarding. A chroma push holds
   * dot(c, luma) exactly, so the sky keeps its place in that order to the
   * level and only its colour moves.
   *
   * Above air()'s own 1.35 because it is correcting a larger loss: air() was
   * fitted to the ridge bands, which sit at 0.64 and 0.79 of the sky's value
   * and are only part-way up the shoulder, and it left them at a measured
   * S0.064 against the hazed terrain standing in front of them at S0.211 —
   * the two things this file's ridgeTint note says must arrive at the same
   * colour from opposite directions, three and a half times apart. So the
   * bands take this correction too and air() steps out of their way; see the
   * call site below the ridges.
   */

  // --- distance ----------------------------------------------------------
  // The world streams out to a hundred and sixty-five metres and then
  // simply stops, so every daylight frame had a hard straight seam where a
  // green band met a blue one and nothing in between. Two values, front to
  // back, when the frames that read well have four.
  //
  // This is the missing distance: bands of land drawn on the dome rather
  // than built. Geometry was the obvious answer and is the wrong one — a
  // ring of hills far enough away to look far has to be enormous, has to
  // stream, and would need its own fog treatment to stop reading as a
  // wall. On the dome it is at infinity by construction, which is also
  // exactly right: it holds still as the bard walks and swings with the
  // camera's heading, the way a real range on the skyline does.
  //
  // Each band fills everything *below* its crest and the terrain draws
  // over it, so neither needs to know where the ground actually ends. They
  // simply back whatever stands in front of them.
  //
  // Two bands rather than one. One was enough to break the green-meets-blue
  // seam and not enough to make the distance feel deep: it arrived as a
  // single flat value and the eye read it as a smear of haze. A second,
  // nearer, lower and darker band is what turns it into a recession — the
  // near range reads as land because the far one behind it is paler, and
  // the far one reads as far because there is something in front of it.
  // The far crest sits about five degrees up and the near one about two.
  // Lower than that and the terrain hides them in every frame where the
  // road runs uphill, which is most of them; much higher and they stop
  // being distance and become a wall around the meadow.
  vec2 ring = normalize(dir.xz + vec2(1e-5));

  /*
   * --- tomorrow's road ---------------------------------------------------
   *
   * The campfire bookend. At rest, the skyline down the road is the shape of
   * the road that will actually be walked tomorrow: uTomorrowHeights is the
   * centreline of tomorrow's real generated road, off tomorrow's real seed
   * (core/skyline.ts), normalized to a profile. That derivation is the whole
   * point. A hand-painted range would have been three lines shorter and would
   * have been a lie, and the one thing this game is not allowed to sell the
   * player at the end of a day is a promise it has not already kept.
   *
   * Drawn FIRST of the three bands so today's two ridges paint straight over
   * it. It is the farthest thing on the dome — a day further off than the far
   * ridge — and it has to lose to everything standing in front of it. Where
   * it wins, it wins on its own height, which is why the amplitude below is
   * set against the far ridge's arithmetic rather than by eye: base 0.048
   * plus up to 0.055 against a far crest that averages 0.085, so the upper
   * half of the profile clears the skyline and the lower half sinks into it.
   *
   * Everything here is multiplied by uTomorrow, and the whole block is
   * skipped when it is zero: the effect ablates on one uniform, and the fade
   * is phase-driven rather than clock-driven because it is the FIRE that
   * makes the horizon worth looking at. On the road, the bard is walking
   * today's road and tomorrow is none of their business.
   */
  if (uTomorrow > 0.001) {
    vec2 tdir = normalize(uTomorrowDir + vec2(1e-5, 0.0));
    float along = dot(ring, tdir);
    float across = ring.x * tdir.y - ring.y * tdir.x;
    float angle = atan(across, along);
    float u = angle / TOMORROW_ARC;
    if (abs(u) < 1.0) {
      // The outer sixth of the wedge at each end takes the crest down to
      // nothing — not the coverage, which would leave a see-through band of
      // haze, but the height itself, so the range sinks under today's ridges
      // and dissolves into the existing skyline instead of ending in a cliff.
      float amt = uTomorrow * smoothstep(1.0, 0.85, abs(u));

      // Position along the profile: west end of tomorrow's road first, the
      // order core/skyline.ts hands them over in.
      float fi = (u * 0.5 + 0.5) * float(TOMORROW_SAMPLES - 1);
      // Read as a hat-weighted sum rather than by index pair. This material
      // compiles as GLSL ES 1.00 — gl_FragColor and varying, not GLSL3 — and
      // there a uniform array may only be indexed by a constant-index
      // expression, which a constant-bound loop counter is and a computed
      // index is not. Only the two neighbours of fi carry any weight, so
      // the result is exactly the linear interpolation between them.
      float profile = 0.0;
      for (int i = 0; i < TOMORROW_SAMPLES; i++) {
        profile += uTomorrowHeights[i] * max(0.0, 1.0 - abs(fi - float(i)));
      }
      // ridgeMask's third octave at the same relative weight (0.16 of the
      // amplitude). Sixteen samples across seventy degrees is one summit every
      // four and a half, and the straight line between two of them reads as a
      // roof rather than as land; this is the smallest amount of noise that
      // stops the silhouette being polygonal without editing its shape.
      float crest = amt * (0.048 + profile * 0.055 + vnoise(ring * 13.0 + 71.0) * 0.0088);
      float band = smoothstep(crest, crest - 0.004, height);

      // Hazier and higher in value than the far ridge (0.32 / 0.79), because
      // it is further away: land almost entirely dissolved in air. Through
      // ridgeTint like the others, so it is built from the sky's own colour
      // in its own direction and stays darker than the air it meets at every
      // hour by construction, and so the one chroma correction below picks it
      // up with the rest of the dome rather than treating it as a special case.
      if (band > 0.001) {
        color = mix(color, ridgeTint(skyBase, ring, 0.45, 0.86, 0.05), band);
      }

      /*
       * The glow: first light behind a range the bard has not reached yet.
       *
       * Mixed toward the colour distance already tends toward, carried a
       * little way to the hour's own warm end — never a picked cream and
       * never white. A constant would be a UI chip pasted on a midnight sky;
       * deriving it from uFogColor and uSunColor means it is dawn-coloured at
       * dusk and moon-coloured at deep night, which is what a real light over
       * a real horizon does, and it costs no uniform this file did not have.
       *
       * Value-modest on purpose: at 0.18 it is a lift of a few levels, well
       * inside what the note above calls value-modest, and it must not push
       * the sky off its place in the front-to-back order.
       */
      vec3 dawn = mix(uFogColor, mix(uHorizon, uSunColor, 0.60), 0.50);
      float halo = smoothstep(crest + 0.045, crest, height) * (1.0 - band);
      color = mix(color, dawn, halo * 0.18 * amt);
      // A touch of the same light caught on the crest itself, so the range is
      // lit from behind rather than being a silhouette with a lamp above it.
      float rim = smoothstep(crest - 0.014, crest, height) * band;
      color = mix(color, dawn, rim * 0.10 * amt);
    }
  }

  float farRidge = ridgeMask(ring, height, 0.026, 0.075, 11.0);
  float nearRidge = ridgeMask(ring, height, 0.004, 0.040, 47.0);
  /*
   * Ridge values 0.79/0.64 → 0.62/0.48 (task 166 noon piece, run 85).
   * Three panel waves running read the day frames' distance as "bleached
   * to sky value so the horizon dissolves", and the run-85 ablations
   * pinned the fault HERE and nowhere else: tree-haze fogScale 0.85
   * moved the far band 0.3 luminance levels, the day fog keys' value
   * −5% moved it 1, and this pair moved the painted range 6 per step of
   * ~0.09 — the milky band IS the dome's own ranges, not the fogged
   * world. The horizon and fog keys stay untouched (darkening those
   * darkens the whole distance — measured, see the morning key). The
   * bands stay lighter than any real geometry in front of them and
   * darker than the air above by construction (value multiplies the
   * sky's own base), so the file's band-order argument survives; what
   * changes is that the range now holds a legible value step against
   * the wash instead of dissolving into it.
   */
  if (farRidge > 0.001) {
    color = mix(color, ridgeTint(skyBase, ring, 0.32, 0.62, 0.10), farRidge);
  }
  if (nearRidge > 0.001) {
    color = mix(color, ridgeTint(skyBase, ring, 0.36, 0.48, 0.20), nearRidge);
  }
  float ridge = max(farRidge, nearRidge);

  /*
   * See the long note in the cloud block above. One chroma correction for
   * everything drawn ON the dome — gradient, cloud and the two bands of
   * distant land — applied once, here, where they are all present and none of
   * them has been corrected separately. Before the sun and the stars, which
   * are added at the colour they are meant to be and must not be pushed off
   * it. Luminance-preserving, so the value order this file spends most of its
   * length arguing for is untouched to the level.
   *
   * Ramped on the fragment's own value rather than applied flat, because the
   * loss it repays is. The renderer runs ACES at an exposure that multiplies
   * by 1.75 before the curve, and the curve's desaturating shoulder begins to
   * bite around half of its input and owns everything past about 1.2 — which
   * is a pre-tonemap luminance of roughly 0.20 to 0.60 here. A flat push
   * would hand the same correction to the parts of the sky that never reach
   * the shoulder and therefore never lost anything: measured across the day,
   * the three daylight keys' skies come back at S0.10-0.15 and golden hour's
   * at S0.29, and it is the first set that needs rescuing. This ramp gives
   * morning and noon effectively all of it, golden hour about half, and deep
   * night — whose sky is four per cent of full scale and nowhere near the
   * curve — none at all.
   */
  float shoulder = smoothstep(0.20, 0.60, dot(color, vec3(0.2126, 0.7152, 0.0722)));
  color = chroma(color, mix(1.0, SKY_CHROMA, shoulder));

  // Sun: a soft disc plus a wide bloom. No hard edge — a crisp disc reads
  // as a decal pasted on a painting. The disc goes behind the ridge and the
  // bloom does not: light spills over a skyline, a sun does not.
  float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
  float disc = smoothstep(0.995, 0.9995, sunDot) * (1.0 - ridge);
  float bloom = pow(sunDot, 42.0) * 0.55 + pow(sunDot, 6.0) * 0.16;
  color += uSunColor * (disc * 0.9 + bloom);

  // Stars, faded in by night and by altitude so they don't sit in the fog.
  if (uStarness > 0.001 && ridge < 0.999) {
    vec2 grid = dir.xz / max(abs(dir.y) + 0.22, 0.06) * 34.0;
    vec2 cell = floor(grid);
    float star = hash21(cell);
    float bright = smoothstep(0.982, 1.0, star);
    if (bright > 0.0) {
      vec2 local = fract(grid) - 0.5 - (vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.6;
      float dist = length(local);
      float twinkle = 0.65 + 0.35 * sin(uTime * 1.7 + star * 40.0);
      float point = smoothstep(0.16, 0.0, dist) * bright * twinkle;
      color += vec3(0.85, 0.88, 1.0) * point * uStarness * smoothstep(0.02, 0.35, height) * (1.0 - ridge);
    }
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Sky {
  readonly mesh: Mesh;
  private readonly uniforms: {
    uZenith: IUniform<Color>;
    uHorizon: IUniform<Color>;
    uSunColor: IUniform<Color>;
    uSunDirection: IUniform<Vector3>;
    uFogColor: IUniform<Color>;
    uGroundBounce: IUniform<Color>;
    uStarness: IUniform<number>;
    uCloudiness: IUniform<number>;
    uTime: IUniform<number>;
    uTomorrow: IUniform<number>;
    uTomorrowHeights: IUniform<number[]>;
    uTomorrowDir: IUniform<Vector2>;
  };

  constructor() {
    this.uniforms = {
      uZenith: { value: new Color(0x86bde6) },
      uHorizon: { value: new Color(0xe4eef4) },
      uSunColor: { value: new Color(0xfff6e2) },
      uSunDirection: { value: new Vector3(0, 1, 0) },
      uFogColor: { value: new Color(0xd6e6f0) },
      uGroundBounce: { value: new Color(0x87945f) },
      uStarness: { value: 0 },
      uCloudiness: { value: 0.4 },
      uTime: { value: 0 },
      // Absent until a stage hands over a road and lights a fire. A flat 0.5
      // profile is the same neutral `tomorrowSkyline` returns for a road with
      // no relief, so a sky with no stage behind it is still well-formed.
      uTomorrow: { value: 0 },
      uTomorrowHeights: { value: new Array<number>(SKYLINE_SAMPLES).fill(0.5) },
      uTomorrowDir: { value: new Vector2(0, 1) },
    };

    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      // Rendered first with depth test off; everything else draws over it.
      depthTest: false,
      fog: false,
    });

    this.mesh = new Mesh(new SphereGeometry(1, 32, 16), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
  }

  apply(state: SkyState, timeSeconds: number): void {
    this.uniforms.uZenith.value.copy(state.zenith);
    this.uniforms.uHorizon.value.copy(state.horizon);
    this.uniforms.uSunColor.value.copy(state.sun);
    this.uniforms.uSunDirection.value.copy(state.sunDirection);
    this.uniforms.uFogColor.value.copy(state.fog);
    this.uniforms.uGroundBounce.value.copy(state.bounce);
    this.uniforms.uStarness.value = state.starness;
    this.uniforms.uCloudiness.value = state.cloudiness;
    this.uniforms.uTime.value = timeSeconds;
  }

  /**
   * Hand the dome tomorrow's road. Once per stage, not once per frame: the
   * profile is a property of the day, and `core/skyline.ts` derives it from
   * tomorrow's real seed, which is the whole reason the horizon is allowed to
   * make a promise about it. `dirX`/`dirZ` are the unit ring direction of
   * "down the road" — the band appears in a wedge around that and nowhere
   * else, because that is the only direction tomorrow is actually in.
   */
  setTomorrowRoad(heights: readonly number[], dirX: number, dirZ: number): void {
    const target = this.uniforms.uTomorrowHeights.value;
    for (let i = 0; i < target.length; i++) {
      target[i] = heights[Math.min(i, heights.length - 1)] ?? 0.5;
    }
    this.uniforms.uTomorrowDir.value.set(dirX, dirZ);
  }

  /** 0 = the horizon is today's. 1 = tomorrow's road is fully raised on it. */
  setTomorrow(amount: number): void {
    this.uniforms.uTomorrow.value = Math.min(1, Math.max(0, amount));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
  }
}
