// frame-quality — measure the things an art critique keeps saying in words.
//
// A critique of this game's frames has, across several rounds, returned the
// same three complaints: the daylight frames are *flat* (no value structure
// to compose with), they are *monochrome* (one hue at one saturation), and
// too much of the frame is one *uninterrupted area* of nothing — bare road
// on a phone, empty sky on a desktop. Those are all real, and all three were
// recorded as adjectives, which means nobody could tell whether the next
// round had improved them or not.
//
// This turns each into a number, sampled from the real renderer at a fixed
// set of poses. It is deliberately NOT a pass/fail gate on art taste — the
// thresholds are floors set well under what the game currently measures, so
// the check catches a *regression* (someone flattens the palette, someone
// lets one flat area eat the frame) and stays out of the way of ordinary
// tuning. `postcard.mjs` remains the tool for judging whether a frame is
// good; this one exists so "better than last round" has an answer that is
// not a matter of opinion.
//
// Three metrics, per posed frame:
//
// - **valueStops** — log2 of the ratio between the 90th and 10th percentile
//   of *linear* luminance. This is the frame's usable value range in
//   photographic stops. A frame under about one stop has nothing to compose
//   with and reads as a single grey mass when you squint, which is exactly
//   what "flat" means. (STATE.md already used this measure once, informally,
//   and reported 0.67 stops for a frame it was unhappy with.)
// - **hueSpread** — saturation-weighted circular spread of hue, 0..1. Near
//   zero means every pixel carrying any colour carries the *same* colour,
//   which is what "monochrome" means. Weighting by saturation matters: an
//   unsaturated pixel has a hue but no opinion about it, and letting grey
//   pixels vote turns the metric into noise.
//
//   **This one is not "higher is better", and the first run of this check
//   proved it.** A global floor of 0.04 failed exactly two frames — golden
//   hour (0.029) and the golden-hour busk (0.031) — which are the two frames
//   every critique of this game has named as the *best* in the set. A low sun
//   washing an entire landscape in one warm hue is not a monochrome fault, it
//   is what golden hour *is*. So the floor lives per-pose, and only the plain
//   daylight frames carry one: those are the hours with no colour event of
//   their own, where one hue across the whole frame really is a flat picture.
//
//   A known limit, stated rather than papered over: this is a whole-frame
//   measure, so a blue sky over a green field over a brown road scores as
//   varied even when the *land* — which is most of what the player looks at —
//   is one hue. Noon measures 0.28 here while still reading green-on-green
//   underfoot. Use it to catch a palette collapsing, not as evidence that a
//   frame's colour is working.
// - **modalShare** — the largest fraction of the frame sitting inside one
//   coarse colour bucket. High means one big uninterrupted area. This is the
//   "the bare road is the largest single thing in the frame on a phone"
//   complaint, as a fraction.
//
// Poses are held with `phase: 'vista'` for the same reason `shader-check`
// does it: `dayFraction` is derived from `s` and is recomputed whenever the
// bard advances, so a posed time of day only survives if the walk is stopped
// first. See the long note in shader-check.mjs.
import { BASE_URL, launch } from './browser.mjs';

const only = process.argv[2] ?? null;

/**
 * The frames worth measuring.
 *
 * Deliberately weighted toward the *plain daylight* poses. Golden hour and
 * night pass any tonal test easily — a low sun and a single fire both hand
 * you a value structure for free — and it is the flat middle of the day, plus
 * the two phone aspect ratios, where every previous critique found its
 * problems.
 */
// `minHue` is set only where a single hue across the whole frame would be a
// fault. Golden hour, night and the golden-hour busk are deliberately
// hue-unified and carry no floor — see the note on hueSpread above.
const POSES = [
  { name: 'morning', s: 265, day: 0.42, viewport: [1600, 900], minHue: 0.1 },
  { name: 'noon', s: 620, day: 0.55, viewport: [1600, 900], minHue: 0.15 },
  { name: 'golden', s: 900, day: 0.8, viewport: [1600, 900] },
  { name: 'night', s: 1400, day: 0.95, viewport: [1600, 900] },
  { name: 'phone-portrait', s: 420, day: 0.5, viewport: [390, 844], minHue: 0.1 },
  { name: 'phone-landscape', s: 900, day: 0.82, viewport: [844, 390] },
];

/**
 * Floors, not targets.
 *
 * Set from what the game measures today, with real headroom underneath, so
 * this check reports a regression rather than litigating taste. Raise them
 * deliberately when a round genuinely improves a frame and you want to keep
 * the gain.
 */
// Every pose currently measures between 3.3 and 6.8 stops, so 2.5 is a real
// regression gate with room to spare rather than a number art tuning will
// trip over.
const FLOORS = {
  valueStops: 2.5,
};
/** A ceiling rather than a floor: one bucket must not own the frame. */
const MODAL_SHARE_CEILING = 0.5;

const browser = await launch();
const problems = [];
const rows = [];

/** Runs in the page: render, read the framebuffer back, reduce to three numbers. */
function analyse() {
  const handle = window.bard;
  const app = handle?.app;
  const stage = handle?.stage;
  if (!app || !stage) return { error: 'no window.bard.app/stage' };

  // Same discipline as shader-check: render and read in ONE task. The
  // renderer runs preserveDrawingBuffer:false, so a frame that has been
  // presented is gone and a later read returns black.
  app.renderer.render(stage.scene, stage.camera);
  const gl = app.renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const lums = [];
  // 4096 colour buckets (16 levels per channel). Coarse on purpose: the
  // question is "is this one big flat area", and at 256 levels a gentle
  // gradient across a bare road splits into hundreds of buckets and hides.
  const buckets = new Map();
  let sinSum = 0;
  let cosSum = 0;
  let satSum = 0;
  let counted = 0;

  // Stride the buffer; the statistics are stable from a fraction of it.
  const step = 4 * 7;
  for (let i = 0; i < px.length; i += step) {
    const r = px[i] / 255;
    const g = px[i + 1] / 255;
    const b = px[i + 2] / 255;

    lums.push(0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b));

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const sat = max === 0 ? 0 : chroma / max;
    if (chroma > 0.01) {
      let hue;
      if (max === r) hue = ((g - b) / chroma + 6) % 6;
      else if (max === g) hue = (b - r) / chroma + 2;
      else hue = (r - g) / chroma + 4;
      const radians = (hue / 6) * Math.PI * 2;
      // Weighted by saturation AND value: a dark pixel's hue is mostly
      // quantisation noise and should not get a full vote either.
      const weight = sat * max;
      sinSum += Math.sin(radians) * weight;
      cosSum += Math.cos(radians) * weight;
      satSum += weight;
    }

    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    counted++;
  }

  lums.sort((a, b) => a - b);
  const at = (q) => lums[Math.min(lums.length - 1, Math.max(0, Math.floor(lums.length * q)))];
  const p10 = at(0.1);
  const p90 = at(0.9);
  // A floor under p10 so a frame with crushed blacks reports a large but
  // finite range instead of Infinity.
  const valueStops = Math.log2(Math.max(p90, 1e-6) / Math.max(p10, 1e-4));

  // Circular spread: 1 - R, where R is the resultant length of the
  // saturation-weighted hue vectors. 0 = every coloured pixel agrees on the
  // hue, 1 = hues cancel out completely.
  const resultant = satSum === 0 ? 1 : Math.hypot(sinSum, cosSum) / satSum;
  const hueSpread = 1 - resultant;

  let modal = 0;
  for (const count of buckets.values()) modal = Math.max(modal, count);

  return {
    valueStops: Math.round(valueStops * 100) / 100,
    hueSpread: Math.round(hueSpread * 1000) / 1000,
    modalShare: Math.round((modal / counted) * 1000) / 1000,
    p10: Math.round(p10 * 10000) / 10000,
    p90: Math.round(p90 * 10000) / 10000,
  };
}

for (const pose of POSES) {
  if (only && pose.name !== only) continue;
  const page = await browser.newPage({
    viewport: { width: pose.viewport[0], height: pose.viewport[1] },
  });
  page.on('pageerror', (e) => problems.push(`${pose.name}: pageerror: ${e.message}`));
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const posed = await page.evaluate(
    ({ s, day }) => {
      const handle = window.bard;
      if (typeof handle?.pose !== 'function') return 'window.bard.pose is not a function';
      // 'vista' freezes the walk so the posed dayFraction is not immediately
      // overwritten by the value the road position implies.
      handle.pose({ s, dayFraction: day, phase: 'vista' });
      return null;
    },
    { s: pose.s, day: pose.day },
  );
  if (posed) {
    problems.push(`${pose.name}: ${posed}`);
    await page.close();
    continue;
  }
  await page.waitForTimeout(900);

  const stats = await page.evaluate(analyse);
  await page.close();

  if (stats.error) {
    problems.push(`${pose.name}: ${stats.error}`);
    continue;
  }
  rows.push({ name: pose.name, ...stats });

  if (stats.valueStops < FLOORS.valueStops) {
    problems.push(
      `${pose.name}: flat — ${stats.valueStops} stops of value range (floor ${FLOORS.valueStops})`,
    );
  }
  if (pose.minHue !== undefined && stats.hueSpread < pose.minHue) {
    problems.push(
      `${pose.name}: monochrome — hue spread ${stats.hueSpread} (floor ${pose.minHue})`,
    );
  }
  if (stats.modalShare > MODAL_SHARE_CEILING) {
    problems.push(
      `${pose.name}: one colour bucket owns ${Math.round(stats.modalShare * 100)}% of the frame ` +
        `(ceiling ${Math.round(MODAL_SHARE_CEILING * 100)}%)`,
    );
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad('pose', 17)}${pad('stops', 8)}${pad('hueSpread', 11)}${pad('modalShare', 12)}${pad('p10', 9)}p90`,
);
for (const r of rows) {
  console.log(
    `${pad(r.name, 17)}${pad(r.valueStops, 8)}${pad(r.hueSpread, 11)}${pad(r.modalShare, 12)}${pad(r.p10, 9)}${r.p90}`,
  );
}

console.log(problems.length ? `FAIL (${problems.length}):\n  ${problems.join('\n  ')}` : 'PASS');
await browser.close();
process.exit(problems.length ? 1 : 0);
