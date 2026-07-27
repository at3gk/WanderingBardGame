/**
 * Where the heads-up chrome sits.
 *
 * This exists because the three top-left buttons and the song meter were
 * laid out by two different rules that had never been asked to agree. The
 * buttons counted pixels from the left edge; the meter took 60% of the
 * width and centred itself. On a wide screen those two rules happen not to
 * collide, so landscape looked fine — but on a 390px phone the meter track
 * started at x=78 and the songbook button sat at 68–90, so the meter was
 * drawn straight over the top of it. Both new buttons were invisible on
 * exactly the devices the game is built for, and the landscape screen was
 * the only place you could see them.
 *
 * The fix is one rule for the whole bar: buttons and coins share the top
 * row, and the meter gets a row of its own underneath. The sky above the
 * staff is empty on every viewport, so the second row costs nothing that
 * was being used, and the meter stops being squeezed into whatever space
 * the buttons left over.
 */

/**
 * WCAG 2.5.5 and Apple's HIG both put the comfortable minimum at 44px.
 * It doubles as the button *pitch*: spacing the icons by exactly one
 * target is what stops two neighbouring zones overlapping, which they
 * did — the songbook and lute zones shared 9px, and a tap in that strip
 * went to whichever happened to be later in the display list.
 */
export const HUD_TOUCH_TARGET = 44;

/** Side margin for the whole bar, matching the existing chrome inset. */
export const HUD_MARGIN_X = 24;

/**
 * Nominal glyph radius. The buttons are drawn at 10-11px radius, so putting
 * the first *centre* one radius in from the margin lines its glyph's left
 * edge up with the distance readout and the meter track. The touch zone is
 * free to overhang further toward the screen edge — an edge-adjacent zone
 * makes the corner button easier to hit, not harder.
 */
export const HUD_ICON_RADIUS = 10;

/** Centre of the button row, and of the coin readout beside it. */
export const HUD_ICON_ROW_Y = 24;

/** Centre of the meter row. One touch target below the buttons. */
export const HUD_METER_ROW_Y = 54;

/** Baseline of the song title, clear of the meter. */
export const HUD_TITLE_Y = 78;

export const HUD_METER_HEIGHT = 14;

/**
 * Full-bleed on a phone, but capped so the meter doesn't become a runway
 * across a wide landscape screen — past a certain length a fill bar stops
 * reading as a quantity and starts reading as a horizon line.
 */
export const HUD_METER_MAX_WIDTH = 420;

export interface HudLayout {
  /** X centre of each button, left to right, in the order given. */
  iconXs: number[];
  /** Right edge of the last button's touch zone. */
  iconRowRight: number;
  iconY: number;
  meterY: number;
  meterCenterX: number;
  meterWidth: number;
  meterLeft: number;
  meterRight: number;
  titleY: number;
}

/**
 * @param viewportW  Scene width in pixels.
 * @param iconCount  How many buttons sit at the left of the top row.
 */
export function hudLayout(viewportW: number, iconCount: number): HudLayout {
  const iconXs: number[] = [];
  for (let i = 0; i < iconCount; i++) {
    // Pitch is exactly one touch target, which is what keeps neighbouring
    // zones from overlapping however many buttons the bar grows.
    iconXs.push(HUD_MARGIN_X + HUD_ICON_RADIUS + HUD_TOUCH_TARGET * i);
  }
  const iconRowRight = iconCount > 0
    ? iconXs[iconCount - 1] + HUD_TOUCH_TARGET / 2
    : HUD_MARGIN_X;

  const meterWidth = Math.min(HUD_METER_MAX_WIDTH, Math.max(0, viewportW - HUD_MARGIN_X * 2));
  const meterCenterX = viewportW / 2;

  return {
    iconXs,
    iconRowRight,
    iconY: HUD_ICON_ROW_Y,
    meterY: HUD_METER_ROW_Y,
    meterCenterX,
    meterWidth,
    meterLeft: meterCenterX - meterWidth / 2,
    meterRight: meterCenterX + meterWidth / 2,
    titleY: HUD_TITLE_Y,
  };
}
