/**
 * The low-sun value floor — the 144/169 family's lever, three sites deep.
 *
 * The painterly fragment already owns a "sky floor": an additive,
 * hue-carrying term gated hard on how dark a fragment is, sized from the
 * ambient so that night keeps its darks ("the floor comes down with the
 * sky"). That proportionality is correct at night and is exactly the fault
 * at the horizon hours: at dusk and golden the ambient is dim, so the floor
 * shrinks precisely when the ACES + finishing transform is crushing the
 * V ~0.2 band's chroma to grey. Three independent measurements landed on
 * this one mechanism:
 *
 * - runs 105-107: the 12/13 dusk midground's "cold slate" band is LIT
 *   ground at V ~0.21, S 0.13 — chroma-dead through the display transform,
 *   with the cast shadows proven innocent and three hue-side levers
 *   refuted (byte-identical twice, anti-family once);
 * - wave 16's value lens, blind: "bimodal frame — bright sky band, dark
 *   ground band, midtones scooped out";
 * - run 115: the travellers' "unlit navy voids" at golden refuted as an
 *   albedo problem — their bodies sit at the bard's own value with warm
 *   hues, and a 1.7x albedo chroma scale moved 0.63% of frame pixels,
 *   because V ~0.21 is the same crush regime.
 *
 * So the floor gains an HOUR GATE rather than a twin: at the horizon band
 * the existing term is scaled up, putting hue-carrying light exactly into
 * the fragments the darkness gate already selects. Night is outside the
 * band by construction (the night gauge's 6.4 stops are load-bearing), and
 * so is high day (noon's contrast is the designed hour's own business).
 */

/** Peak boost: the sky floor becomes (1 + this) times its size in-band. */
export const LOW_SUN_FLOOR_MAX = 1.6;

/** Fully in across the horizon hours: golden ~0.12, dawn ~0.06, dusk ~-0.14. */
export const FLOOR_BAND_FULL_LO = -0.16;
export const FLOOR_BAND_FULL_HI = 0.15;
/** Zero by deep night (night pose sunH -0.296) and by morning (0.371). */
export const FLOOR_BAND_OUT_LO = -0.26;
export const FLOOR_BAND_OUT_HI = 0.3;

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** The boost factor for the painterly sky floor at a sun height. */
export function lowSunFloorAmount(sunHeight: number): number {
  const rise = smooth01(
    (sunHeight - FLOOR_BAND_OUT_LO) / (FLOOR_BAND_FULL_LO - FLOOR_BAND_OUT_LO),
  );
  const fall = smooth01(
    (FLOOR_BAND_OUT_HI - sunHeight) / (FLOOR_BAND_OUT_HI - FLOOR_BAND_FULL_HI),
  );
  return LOW_SUN_FLOOR_MAX * Math.min(rise, fall);
}
