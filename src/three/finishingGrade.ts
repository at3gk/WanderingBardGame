/**
 * The finishing grade — the last thing that touches a pixel.
 *
 * Everything in this game is lit by one painterly model, but a dozen
 * materials still resolve to a dozen slightly different palettes. A grade
 * is what pulls them into one picture: it is not a look on top of the art,
 * it is the thing that makes the art read as having been *made by one
 * hand*. A Short Hike (this repo's art reference) does exactly this — a
 * gentle unifier, not a filter. If a player can name the grade, it is too
 * strong.
 *
 * So the whole pass is three small moves, each with a named knob:
 *
 * - **A gentle S-curve** for a little contrast. Not a film curve — just
 *   enough to stop midtones going milky once fog and bloom have had their
 *   say.
 * - **Vibrance, not saturation.** Saturation clips the colours that were
 *   already vivid (sunset sky, lantern flame) and turns them into flat
 *   plates. Vibrance scales its own boost down as a colour gets more
 *   saturated, so it lifts the muted greens and stone that need it and
 *   leaves the loud things alone. Greys are untouched by construction.
 * - **Split-tone**: shadows drift violet-blue, highlights drift warm
 *   cream. This is the single cheapest trick for "illustration" over
 *   "render", and it is why dusk looks painted rather than dimmed.
 *
 * Two contracts this module is built around, because a 3D LUT is
 * unforgiving about both:
 *
 * 1. **Black stays black and white stays white.** The split-tone strength
 *    is windowed by `4L(1-L)`, which is exactly zero at both endpoints, so
 *    the LUT's black and white corners are identity. A grade that lifts
 *    black turns every night scene into grey haze, and one that tints white
 *    puts a cast on the UI.
 * 2. **Purity.** No three import here. This half is the maths, testable in
 *    a headless run; `finishing.ts` owns the Data3DTexture and the
 *    composite. That split is what lets the grade be pinned by tests
 *    instead of eyeballed in a screenshot.
 *
 * The grade runs in *display-referred* sRGB — after ACES tone mapping and
 * sRGB encoding, on values that are already what the monitor will show.
 * Grading in linear light would be more physical and would look wrong:
 * these curves are shaped for perceptual space.
 */

/**
 * Edge length of the 3D LUT. 33 is the industry-standard cube size: at
 * 16-bit-ish smoothness for gradients like a sky, while a 33³ RGBA table is
 * only 140 KB — small enough to build at boot and forget about on a phone.
 */
export const LUT_SIZE = 33;

/** Strength of the S-curve. Above ~0.2 the shadows start to crush. */
export const CONTRAST = 0.14;

/** Peak vibrance boost, applied only to fully desaturated colour. */
export const VIBRANCE = 0.18;

/** Peak split-tone displacement, at mid-grey. Deliberately tiny. */
export const SPLIT = 0.035;

/** Shadows lean violet-blue. */
export const SHADOW_DIR: readonly [number, number, number] = [-0.35, -0.1, 0.6];

/** Highlights lean warm cream. */
export const HIGHLIGHT_DIR: readonly [number, number, number] = [0.5, 0.25, -0.35];

/** Rec.709 luma weights; they sum to exactly 1, which endpoint exactness relies on. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** GLSL `mix`, written so that t=0 and t=1 are exact. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** GLSL `smoothstep`. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function luma(r: number, g: number, b: number): number {
  return LUMA_R * r + LUMA_G * g + LUMA_B * b;
}

/**
 * Grade one display-referred sRGB colour. In and out are 0..1 per channel.
 *
 * This is the reference implementation of the look; the shader never runs
 * it, it only samples the LUT this bakes into. Keep it branch-free and
 * closed-form so the LUT stays deterministic across machines.
 */
export function gradeColor(r: number, g: number, b: number): [number, number, number] {
  let cr = clamp01(r);
  let cg = clamp01(g);
  let cb = clamp01(b);

  // 1. Gentle S-curve. Per channel, so it nudges saturation up a hair too —
  //    which is the same thing film does and part of why it reads warm.
  cr = mix(cr, cr * cr * (3 - 2 * cr), CONTRAST);
  cg = mix(cg, cg * cg * (3 - 2 * cg), CONTRAST);
  cb = mix(cb, cb * cb * (3 - 2 * cb), CONTRAST);

  // 2. Vibrance. The boost fades to nothing as a colour approaches full
  //    saturation, so vivid things keep their shape. Pushing away from luma
  //    (rather than scaling channels) keeps brightness fixed, so this step
  //    cannot make a colour bloom or go muddy.
  const vibLuma = luma(cr, cg, cb);
  const sat = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);
  const boost = VIBRANCE * (1 - sat);
  cr = vibLuma + (cr - vibLuma) * (1 + boost);
  cg = vibLuma + (cg - vibLuma) * (1 + boost);
  cb = vibLuma + (cb - vibLuma) * (1 + boost);

  // 3. Split-tone. `4L(1-L)` is the window that pins the endpoints: it is 0
  //    at black and at white and 1 at mid-grey, so the tint lives entirely
  //    in the midtones where the eye reads mood.
  const toneLuma = luma(cr, cg, cb);
  const amount = SPLIT * 4 * toneLuma * (1 - toneLuma);
  const t = smoothstep(0.25, 0.75, toneLuma);
  cr += mix(SHADOW_DIR[0], HIGHLIGHT_DIR[0], t) * amount;
  cg += mix(SHADOW_DIR[1], HIGHLIGHT_DIR[1], t) * amount;
  cb += mix(SHADOW_DIR[2], HIGHLIGHT_DIR[2], t) * amount;

  return [clamp01(cr), clamp01(cg), clamp01(cb)];
}

/**
 * Bake the grade into RGBA bytes for a three.js `Data3DTexture`.
 *
 * Layout is the one three expects for a 3D texture: r fastest, then g, then
 * b, so entry `((b * size + g) * size + r) * 4` holds the grade of the input
 * `(r, g, b) / (size - 1)`. Alpha is a constant 255 because WebGL wants
 * RGBA, not because anything reads it.
 */
export function buildLutData(size = LUT_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * size * 4);
  const last = size - 1;
  let i = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const [gr, gg, gb] = gradeColor(r / last, g / last, b / last);
        data[i++] = Math.round(gr * 255);
        data[i++] = Math.round(gg * 255);
        data[i++] = Math.round(gb * 255);
        data[i++] = 255;
      }
    }
  }
  return data;
}
