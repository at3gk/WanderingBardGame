/**
 * The one HUD number that survived the 2D-era dashboard layout.
 *
 * This file used to lay out a whole top-of-canvas bar (buttons, a song
 * meter, a title row) for the 2D game. `ui/hudLayout.ts` replaced all of
 * that after the v0.6 Three.js rewrite, for a screen shaped like a walk
 * rather than a dashboard — see that file's header for why the two
 * problems are different shapes. Everything from the old bar layout was
 * deleted here once it had zero production callers left (run 217); this
 * constant is the one piece `ui/hudLayout.ts` still imports.
 *
 * WCAG 2.5.5 and Apple's HIG both put the comfortable minimum at 44px.
 */
export const HUD_TOUCH_TARGET = 44;
