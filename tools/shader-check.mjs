// shader-check — boot the render foundation in a real browser and fail on
// any shader that does not compile or any frame that does not draw.
//
// This is the one class of bug unit tests structurally cannot catch: a
// GLSL typo type-checks perfectly and only shows up as a black screen. It
// used to be found by a human looking at the game; now it is found here,
// in about four seconds, before anything is pushed.
//
// It also renders the smoke stage at four times of day and reports the
// average pixel colour of each, which is a cheap, objective check that the
// time-of-day palette is actually moving the world's light and not just
// the sky dome.
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
    app.renderer.render(stage.scene, stage.camera);
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

const results = [];
for (const [label, t] of [
  ['dawn', 0.28],
  ['day', 0.55],
  ['golden', 0.82],
  ['night', 0.02],
]) {
  await page.evaluate((time) => {
    const handle = window.bard;
    if (handle?.stage?.setTimeOfDay) handle.stage.setTimeOfDay(time);
  }, t);
  await page.waitForTimeout(500);
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
