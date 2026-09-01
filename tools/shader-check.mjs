// shader-check — boot the render foundation in a real browser and fail on
// any shader that does not compile or any frame that does not draw.
//
// This is the one class of bug unit tests structurally cannot catch: a
// GLSL typo type-checks perfectly and only shows up as a black screen. It
// used to be found by a human looking at the game; now it is found here,
// in about four seconds, before anything is pushed.
//
// It also renders the game at four times of day and reports the average
// pixel colour of each, which is a cheap, objective check that the
// time-of-day palette is actually moving the world's light and not just
// the sky dome.
//
// **The clock is driven through `pose({dayFraction})`, and that matters.**
// This check spent its whole life reporting "time-of-day is inert:
// luminance range 3" — a number STATE.md recorded as a real rendering
// defect and queued as a thing to go and fix. It was not one. The clock was
// driven through `stage.setTimeOfDay(t)`, guarded by
// `if (handle?.stage?.setTimeOfDay)`. `window.bard.stage` is a `RoadStage`,
// which has no such method — only `SmokeStage` ever did — so the guard was
// false every time, the time never moved, and the four "samples" were four
// photographs of the same frame. Four identical frames have a luminance
// range of ~0, so the check failed, and it failed in the exact shape of the
// bug it was written to find. The postcards showed dawn, noon and golden
// hour looking obviously different the whole time.
//
// Two lessons, both already in tools/README.md and both worth restating
// where the mistake actually was: a failing check is a claim about the
// check first, and an optional-chained guard around the one call a check
// exists to make will turn "the hook is gone" into "the game is broken".
// Hence `poseAt` below throws instead of shrugging.
import { BASE_URL, launch } from './browser.mjs';

const base = BASE_URL;
const outPrefix = process.argv[2] ?? 'shader-check';

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error') problems.push(`console: ${text}`);
  // three reports shader compile failures as warnings, not errors.
  if (/THREE.WebGLProgram|shader error|GL_INVALID|not compile/i.test(text)) {
    problems.push(`shader: ${text}`);
  }
});

await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const context = await page.evaluate(() => {
  const canvas = document.querySelector('#game canvas');
  if (!canvas) return { ok: false, reason: 'no canvas' };
  return { ok: true, width: canvas.width, height: canvas.height };
});
if (!context.ok) problems.push(`canvas: ${context.reason}`);

// Average colour + variance of the rendered frame.
//
// Read back with gl.readPixels *inside the same JS task as an explicit
// render*, not by drawing the canvas into a 2D context afterwards. The
// renderer runs with preserveDrawingBuffer:false, so once a frame has been
// presented the drawing buffer is gone and a later drawImage() copies
// black — which is exactly the false failure this check reported the first
// time it was written.
async function sample(label) {
  const shot = await page.screenshot({ path: `${outPrefix}-${label}.png` });
  const stats = await page.evaluate(() => {
    const handle = window.bard;
    const app = handle?.app;
    const stage = handle?.stage;
    if (!app || !stage) return null;
    // Full pipeline (task 168's finishing/LUT composite), not a bare
    // renderer.render() — see tools/README.md's discrepancy note.
    app.renderFrame(stage.scene, stage.camera);
    const gl = app.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let r = 0;
    let g = 0;
    let b = 0;
    let sum = 0;
    let sumSq = 0;
    // Stride the buffer: at 2x DPR this is several million pixels and the
    // statistics are identical from a sixteenth of them.
    const stride = 4 * 4;
    let n = 0;
    for (let i = 0; i < px.length; i += stride) {
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
    const mean = sum / n;
    return {
      r: Math.round(r / n),
      g: Math.round(g / n),
      b: Math.round(b / n),
      stdDev: Math.round(Math.sqrt(Math.max(0, sumSq / n - mean * mean)) * 10) / 10,
    };
  });
  return { label, bytes: shot.length, ...(stats ?? {}) };
}

/**
 * Move the world's clock, and fail the run if the hook to do so is missing.
 *
 * No optional chaining, no shrug: if `pose` stops existing or throws, the
 * samples that follow are meaningless and the check must say *that* rather
 * than quietly measure four copies of one frame.
 *
 * **`phase: 'vista'` is load-bearing, not a framing preference.** The
 * journey's `dayFraction` is *derived from `s`* (`core/journey.ts` — the day
 * advances with distance walked, never with wall time) and is recomputed on
 * every advance. Pose a time of day while the bard is `walking` and the
 * derived value overwrites it inside about a second, which is less than the
 * settle this check needs before it reads pixels: asking for midnight at
 * s=620 got back the midday that s=620 actually implies. `'vista'` sets
 * `walking = false`, so `s` holds, nothing recomputes, and the posed time
 * survives the settle. Same place, four times of day — one variable moving,
 * which is the only way the resulting number means anything.
 */
async function poseAt(time) {
  const outcome = await page.evaluate((dayFraction) => {
    const handle = window.bard;
    if (typeof handle?.pose !== 'function') {
      return `window.bard.pose is not a function (got ${typeof handle?.pose})`;
    }
    handle.pose({ s: 620, dayFraction, phase: 'vista' });
    return null;
  }, time);
  if (outcome) throw new Error(`cannot drive the clock: ${outcome}`);
}

const results = [];
for (const [label, t] of [
  ['dawn', 0.28],
  ['day', 0.55],
  ['golden', 0.82],
  ['night', 0.02],
]) {
  await poseAt(t);
  // The sky and the lighting uniforms cross-fade, so a frame read
  // immediately after a pose catches the palette mid-move.
  await page.waitForTimeout(900);
  results.push(await sample(label));
}

for (const r of results) {
  if (r.r === undefined) {
    problems.push(`${r.label}: could not read pixels`);
    continue;
  }
  if (r.r === 0 && r.g === 0 && r.b === 0) problems.push(`${r.label}: frame is black`);
  // A frame with essentially no tonal variation is a flat clear colour —
  // i.e. the world drew nothing.
  if (r.stdDev < 4) problems.push(`${r.label}: frame is flat (stdDev ${r.stdDev}) — nothing drew`);
}

// The palette must actually move. Compare the brightest and darkest of the
// four samples; if the day looks the same at midnight as at noon, the
// time-of-day coupling is broken even though every shader compiled.
const lums = results.filter((r) => r.r !== undefined).map((r) => (r.r + r.g + r.b) / 3);
if (lums.length === 4 && Math.max(...lums) - Math.min(...lums) < 12) {
  problems.push(`time-of-day is inert: luminance range ${Math.round(Math.max(...lums) - Math.min(...lums))}`);
}

console.log('samples:', JSON.stringify(results));
console.log(problems.length ? `FAIL (${problems.length}):\n  ${problems.join('\n  ')}` : 'PASS');

await browser.close();
process.exit(problems.length ? 1 : 0);
