/**
 * Where the lane, the bard and the road sit vertically.
 *
 * This exists because the road ran off the bottom of the screen in
 * landscape. The lane was `height / 2` and the ground was a flat 178px
 * below it, which is a fixed offset hung off a proportional anchor — the
 * same shape of bug as the free-play staff overflowing, and it fails the
 * same way. On a 568x320 phone in landscape the ground landed at y=338 on
 * a 320px screen: **12 of the road's 60px were visible and the bard was
 * cut off at the shins.**
 *
 * Portrait was fine, which is why it went unseen. The numbers:
 *
 *     320x568   road 432-492   below road 76px
 *     390x664   road 480-540   below road 124px
 *     664x390   road 343-403   13px off the bottom
 *     568x320   road 308-368   48px off the bottom, 12px of road left
 *
 * The rule now works from both edges. Tall screens are untouched — the
 * clamp only engages where the old layout physically did not fit — so this
 * changes nothing about how the game looks on the phones it already
 * suited.
 */

/**
 * The lane sits this far above the bard's feet when there is room. Keeping
 * the old constant exactly means every viewport that already fitted is
 * pixel-identical after this change.
 */
export const IDEAL_LANE_TO_GROUND = 178;

/** Road band height; the bard's feet are at its vertical centre. */
export const ROAD_HEIGHT = 60;

/** Kept below the road so the world doesn't look sheared off. */
export const BOTTOM_MARGIN = 6;

/**
 * How far the notation reaches above the lane: the songbook spans staff
 * steps 0..12, step 12 sits 54px up, and its head and ledger line take
 * another 8. Below the lane is the mirror image, which is what the ideal
 * gap above is really protecting.
 */
export const NOTATION_ABOVE_LANE = 62;

/** Lowest thing the songbook writes — middle C's head, plus its ledger. */
export const NOTATION_BELOW_LANE = 62;

/** Bottom of the song title, from core/hud. */
export const TOP_CHROME_BOTTOM = 86;

/** Gap between the title and the highest note. */
export const TOP_CLEARANCE = 8;

/** The lane can never rise past this, or notes collide with the chrome. */
export const MIN_LANE_Y = TOP_CHROME_BOTTOM + TOP_CLEARANCE + NOTATION_ABOVE_LANE;

export interface WorldLayout {
  laneY: number;
  groundY: number;
  roadTop: number;
  roadBottom: number;
  /**
   * True when the screen was too short to give the bard his full clearance
   * below the notation. On a 568x320 landscape phone the bard's hat ends up
   * overlapping the very lowest notes by ~30px.
   *
   * That is the deliberate trade. The priority order when space runs out is:
   * the notation must clear the chrome (reading is the game), then the bard
   * and road must stay on screen (being sheared in half looks broken), and
   * the bard's clearance below the staff gives way last. The overlap is
   * cosmetic — notes draw over the bard, bright cream on a dark hat, so
   * nothing becomes harder to read.
   */
  cramped: boolean;
}

export function worldLayout(viewportH: number): WorldLayout {
  const centreLane = viewportH / 2;
  const lowestGround = viewportH - ROAD_HEIGHT / 2 - BOTTOM_MARGIN;

  // Anchor on the ground first: the road running off screen is the failure
  // that actually looks broken.
  const groundY = Math.min(centreLane + IDEAL_LANE_TO_GROUND, lowestGround);

  // Then take the lane as low as it can go without pushing the notation
  // into the chrome — never below centre, so tall screens don't move.
  // MIN_LANE_Y is the outer floor rather than an inner one: on a screen too
  // short for anything to fit, keeping notes clear of the chrome is the
  // priority that survives, per the order documented on `cramped`.
  const laneY = Math.max(MIN_LANE_Y, Math.min(centreLane, groundY - IDEAL_LANE_TO_GROUND));

  return {
    laneY,
    groundY,
    roadTop: groundY - ROAD_HEIGHT / 2,
    roadBottom: groundY + ROAD_HEIGHT / 2,
    cramped: groundY - laneY < NOTATION_BELOW_LANE + BARD_HEIGHT,
  };
}

/** Measured from the bard container's own bounds: 98px, feet at the origin. */
export const BARD_HEIGHT = 98;
