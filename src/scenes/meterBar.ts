import Phaser from 'phaser';

/**
 * The song meter: five faint staff lines over a gold fill, so the bar
 * reads as sheet music filling with light rather than a plain progress
 * bar (ROADMAP idea backlog, "meter as staff"). Split out of RoadScene
 * (1838 lines — ROADMAP task 111) as the "just the meter bar" first cut
 * task 110 flagged once task 108 had already ruled out `setWalkChromeVisible`
 * as a whole: it touches nine unrelated fields with no shared sub-grouping,
 * but the three meter parts inside it are their own clean unit.
 *
 * Shaped like `./picker` and `./freePlayOverlay` rather than a `render/*`
 * texture baker: the three GameObjects persist across frames and are
 * resized in place every frame, not rebuilt from pure inputs. Unlike
 * those two modules, the meter owns no mode of its own — no toggle, no
 * tap handling, nothing to tear down — so it needed only three functions:
 * build once, lay out every frame, show or hide with the rest of the walk
 * chrome.
 *
 * The three fields stay plain (non-private) fields on RoadScene rather
 * than being wrapped in a returned handle, the same call `PickerHost` and
 * `FreePlayOverlayHost` made and for an added reason here:
 * `tools/hud-check.mjs` already reaches `scene.meterTrack` directly to
 * check the chrome doesn't overlap itself, so hiding it behind a handle
 * would mean touching a passing check for no behavioural gain.
 * `MeterBarHost` is the minimal slice of RoadScene these functions read
 * and write. Everything else `setWalkChromeVisible` toggles — the staff
 * lines, the clef, the hit line, the coin/distance readouts — stays on
 * RoadScene; this extraction is scoped to the meter alone.
 */
export interface MeterBarHost {
  add: Phaser.GameObjects.GameObjectFactory;
  meterTrack: Phaser.GameObjects.Rectangle;
  meterFill: Phaser.GameObjects.Rectangle;
  meterStaffLines: Phaser.GameObjects.Rectangle[];
}

/**
 * 18 rather than 14 so the five staff lines inside the meter are actually
 * five lines. At 14 they sat 2.33px apart, which is under the width the
 * renderer needs to keep 1px strokes separate — they antialiased into each
 * other and the "sheet music filling with light" idea read as a smear of
 * texture. At 18 the spacing is 3px and they resolve.
 */
const METER_HEIGHT = 18;
/**
 * Gold, not cream.
 *
 * Cream (0xe8d9c0) is the notation's colour — note heads, letters, staff
 * lines, the clef. The meter used to borrow it, which was survivable while
 * the bar was 234px wide and squeezed between the buttons. Once it got a
 * row of its own and ran 342px on a phone, a full meter became the largest
 * and brightest thing on the screen, in exactly the colour the child is
 * supposed to be reading. The teaching surface has to win that contest.
 *
 * Gold is already this world's second voice — the coin beside it, the lit
 * windows in the village, the bard's buckle — so the meter joins something
 * rather than introducing a colour.
 */
const METER_FILL_COLOR = 0xc79a3c;
const METER_FILL_COLOR_STOPPED = 0x6b5f74;
// Meter as staff (ROADMAP idea backlog): the song meter joins the notation
// language established in task 32 — five faint staff lines across the bar,
// same cream tone as the beat glyphs, sitting on top of the existing
// track/fill so the meter reads as sheet music filling with light rather
// than a plain progress bar.
const METER_STAFF_LINE_COUNT = 5;
// A mid-tone (not the fill's own cream) so the lines stay visible whether
// they sit on the dark track or the bright fill — sheet-music lines read
// the same whether the page under them is blank or inked.
const METER_STAFF_LINE_COLOR = 0x6b4f18;
// Raised with the height: the lines sit on gold rather than cream, and at
// 0.55 they were a 1.25:1 contrast against their own fill — present in a
// pixel sample, invisible to a person.
const METER_STAFF_LINE_ALPHA = 0.75;
const METER_STAFF_LINE_THICKNESS = 1;

/** Builds the meter's three parts. Called once, from RoadScene.create(). */
export function createMeterBar(host: MeterBarHost): void {
  host.meterTrack = host.add.rectangle(0, 0, 0, METER_HEIGHT, 0x2c2536, 0.9);
  host.meterFill = host.add.rectangle(0, 0, 0, METER_HEIGHT - 4, 0xe8d9c0, 1);
  host.meterStaffLines = Array.from({ length: METER_STAFF_LINE_COUNT }, () =>
    host.add.rectangle(0, 0, 0, METER_STAFF_LINE_THICKNESS, METER_STAFF_LINE_COLOR, METER_STAFF_LINE_ALPHA)
  );
}

/**
 * Resizes and repositions the meter every frame, driven by the HUD's own
 * layout (`core/hud.ts`) and the live meter state — `centerX`/`meterY`/
 * `trackWidth` come from `hudLayout`, `fillRatio` and `walking` from the
 * song meter itself.
 */
export function layoutMeterBar(
  host: MeterBarHost,
  centerX: number,
  meterY: number,
  trackWidth: number,
  fillRatio: number,
  walking: boolean
): void {
  host.meterTrack.setPosition(centerX, meterY);
  host.meterTrack.setSize(trackWidth, METER_HEIGHT);

  host.meterFill.setSize(Math.max(0, trackWidth * fillRatio), METER_HEIGHT - 4);
  host.meterFill.setFillStyle(walking ? METER_FILL_COLOR : METER_FILL_COLOR_STOPPED, 1);
  host.meterFill.setPosition(centerX - trackWidth / 2 + host.meterFill.width / 2, meterY);

  const lineCount = host.meterStaffLines.length;
  for (let i = 0; i < lineCount; i++) {
    // Half-pixel offset so a 1px line covers exactly one row of pixels.
    // Centred on a whole number it straddles two, and antialiasing paints
    // both at half strength — five 2px smudges instead of five lines,
    // which is what made this read as corduroy rather than ruled paper.
    const y = Math.round(meterY - METER_HEIGHT / 2 + ((i + 1) * METER_HEIGHT) / (lineCount + 1)) + 0.5;
    host.meterStaffLines[i].setPosition(centerX, y);
    host.meterStaffLines[i].setSize(trackWidth, METER_STAFF_LINE_THICKNESS);
  }
}

/** Shows or hides the meter — called from RoadScene.setWalkChromeVisible alongside the rest of the walk-only chrome. */
export function setMeterBarVisible(host: MeterBarHost, visible: boolean): void {
  host.meterTrack.setVisible(visible);
  host.meterFill.setVisible(visible);
  for (const line of host.meterStaffLines) line.setVisible(visible);
}
