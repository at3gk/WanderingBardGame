/**
 * The skylight-ambient-saturation gate (ROADMAP task 194 piece 3).
 *
 * Piece 1 (`tools/skylight-sat.mjs`) measured that `skyLight`'s ambient term
 * in `painterly.ts` reads less saturated on a non-cast shaded face than on a
 * sun-facing one, at every hour tried — the lever `docs/color-script.md`'s
 * noon section names. Piece 2 tried the obvious fix, a luma-preserving
 * chroma boost gated by `sunAmount` (and then `sunAmount * sunHeight`), and
 * measured a real leak into the CARRYING hours (task 166's governance:
 * dawn/golden/dusk/night get no ground/sky spend) with both gates — because
 * neither `sunAmount` nor in-shader `sunHeight` ranks the hours the way the
 * colour script needs. `CAST_SHADOW_HUE`'s own comment records dawn's
 * `sunHeight` as 0.59, HIGHER than golden's 0.44, so a term keyed on either
 * cannot tell a CARRYING hour from an ENACTING one by construction.
 *
 * `docs/color-script.md`'s own hour list is keyed on `dayFraction` instead,
 * and dayFraction ranks the hours correctly by definition — it's the axis
 * the palette itself is authored against (`sky.ts`'s `SKY_KEYS`). This gate
 * reads that value directly rather than anything derived from sun geometry:
 *
 *   night 0.0 -- first light 0.2 -- dawn 0.28 -- morning 0.42 -- noon 0.55
 *   -- afternoon 0.7 -- golden 0.82 -- dusk 0.9
 *
 * The shape is a plateau, not a single hump: zero up to dawn's own value,
 * ramping to full exactly by morning's, held full across noon (the
 * "designed hour" the boost exists for) and afternoon, ramping back to zero
 * exactly by golden's value. Both zero edges land ON a named CARRYING hour
 * (dawn, golden) rather than approaching it asymptotically, so there is no
 * hour where this reads as "a little" — task 166's rule is no spend, not
 * reduced spend, at those hours.
 */

/** Zero at and below dawn's own dayFraction. */
export const GATE_RISE_START = 0.28;
/** Full by morning's own dayFraction. */
export const GATE_RISE_END = 0.42;
/** Still full at afternoon's own dayFraction. */
export const GATE_FALL_START = 0.7;
/** Zero at and above golden's own dayFraction. */
export const GATE_FALL_END = 0.82;

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * The gate for a point in the day, 0..1. `dayFraction` wraps the same way
 * `sky.ts`'s `skyStateAt` does, so a value like 1.05 reads as 0.05.
 */
export function skylightSatGate(dayFraction: number): number {
  const t = ((dayFraction % 1) + 1) % 1;
  const rise = smooth01((t - GATE_RISE_START) / (GATE_RISE_END - GATE_RISE_START));
  const fall = 1 - smooth01((t - GATE_FALL_START) / (GATE_FALL_END - GATE_FALL_START));
  return Math.min(rise, fall);
}
