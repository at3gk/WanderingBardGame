// land-histogram — a value histogram of LAND pixels only, sky excluded.
//
// Built for ROADMAP task 122. Every existing pixel-stats tool
// (frame-quality.mjs, shader-check.mjs) measures the WHOLE frame, and on
// every pose here the sky is 40-90% of it. When someone asks "did the
// ground actually get lighter", a whole-frame p90 answers a different
// question — it moves when the sky moves and says nothing about the land
// underfoot. Task 121 lifted ground albedo and reported a MID-BAND SHARE
// number for that reason; task 122 asks for a land-masked p90 to check the
// same claim with the statistic that actually means "the land is lighter".
//
// The trick: hide the sky dome (named 'sky' in scene.traverse — see
// src/three/sky.ts, `this.mesh.name = 'sky'`) and set the renderer's clear
// colour to a sentinel that nothing painted by the game would ever produce
// — pure magenta. Whatever pixel comes back magenta is empty background;
// everything else is real geometry the renderer actually drew: land, the
// bard, trees, whatever's in frame. That set of "everything else" is what
// this tool calls LAND, without needing to know anything about the scene's
// contents beyond "the sky dome is the thing named 'sky'".
//
// This is an instrument, not a gate — it always exits 0. The gate change
// (task 125) is a separate decision once the numbers below are trustworthy.
import { BASE_URL, launch } from './browser.mjs';

const POSES = [
  { name: '02-morning', s: 265, day: 0.42, phase: 'walking' },
  { name: '03-noon', s: 620, day: 0.55, phase: 'walking' },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista' },
];

const VIEWPORT = { width: 1600, height: 900 };
const DSF = 1;

/**
 * Runs in the page. Hides the sky dome, paints the clear colour magenta,
 * renders once explicitly, reads the framebuffer back, then restores both —
 * this tool must not leave the game looking broken for whatever runs next
 * in the same page (postcard.mjs, another pose).
 *
 * Written as one self-contained function on purpose: `page.evaluate` ships
 * only the function's own source text into the page, not the module scope
 * around it, so any constant it needs (the sentinel colour, the tolerance)
 * has to live inside it rather than as a file-level const.
 */
function measureLandHistogram() {
  const handle = window.bard;
  const app = handle?.app;
  const stage = handle?.stage;
  if (!app || !stage) return { error: 'no window.bard.app/stage' };

  const sky = [];
  stage.scene.traverse((obj) => {
    if (obj.name === 'sky') sky.push(obj);
  });
  if (sky.length === 0) return { error: "no object named 'sky' in the scene — mask target not found" };
  const skyWasVisible = sky.map((obj) => obj.visible);
  for (const obj of sky) obj.visible = false;

  // getClearColor(target) needs a target with a .copy(realColor) method —
  // it does not hand back a plain hex. There is no `THREE` global in this
  // page to build a real Color from, so borrow the real Color the call
  // hands to .copy() just long enough to read its hex out of it.
  const priorClear = { hex: 0x000000 };
  app.renderer.getClearColor({
    copy(realColor) {
      priorClear.hex = realColor.getHex();
      return this;
    },
  });
  const priorAlpha = app.renderer.getClearAlpha();
  app.renderer.setClearColor(0xff00ff, 1);

  // How close to pure magenta a pixel has to be to count as sentinel
  // background rather than land. Not zero: the renderer antialiases
  // geometry edges against the clear colour, so a silhouette's rim blends a
  // few levels of land colour into magenta for a pixel or two. A wide
  // tolerance would eat land pixels near every edge; a narrow one still
  // classifies those AA fringe pixels as land, which is correct — they
  // carry real edge colour, not background.
  const TOLERANCE = 24;
  const isSentinel = (r, g, b) =>
    Math.abs(r - 255) <= TOLERANCE && Math.abs(g - 0) <= TOLERANCE && Math.abs(b - 255) <= TOLERANCE;

  try {
    // Same discipline as every other pixel-reading tool in this directory:
    // render and read in ONE task. preserveDrawingBuffer is false, so a
    // presented frame is gone and a later read returns black.
    app.renderer.render(stage.scene, stage.camera);
    const gl = app.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

    const landLums = [];
    let landCount = 0;
    let totalCount = 0;

    for (let i = 0; i < px.length; i += 4) {
      totalCount++;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      if (isSentinel(r, g, b)) continue;
      landCount++;
      // sRGB (display-referred) luminance, deliberately NOT linearised —
      // this matches the "L170", "L130" style values the ROADMAP and
      // sky.ts comments already use, which are read straight off rendered
      // pixels, not converted through a gamma curve first.
      landLums.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }

    landLums.sort((a, b2) => a - b2);
    const at = (q) =>
      landLums.length === 0
        ? null
        : landLums[Math.min(landLums.length - 1, Math.max(0, Math.floor(landLums.length * q)))];

    const above170 =
      landLums.length === 0 ? null : landLums.filter((l) => l > 170).length / landLums.length;

    return {
      p10: at(0.1),
      p50: at(0.5),
      p90: at(0.9),
      shareAbove170: above170 === null ? null : Math.round(above170 * 1000) / 1000,
      landShare: Math.round((landCount / totalCount) * 1000) / 1000,
      landPixels: landCount,
      totalPixels: totalCount,
    };
  } finally {
    // Runs whether the measurement above succeeded or threw — this tool
    // must not leave the game looking broken for whatever runs next in the
    // same page (postcard.mjs, another pose).
    app.renderer.setClearColor(priorClear.hex, priorAlpha);
    for (let i = 0; i < sky.length; i++) sky[i].visible = skyWasVisible[i];
    app.renderer.render(stage.scene, stage.camera);
  }
}

const only = process.argv[2] ?? null;
const browser = await launch();
const problems = [];
const rows = [];

for (const pose of POSES) {
  if (only && !pose.name.includes(only)) continue;
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DSF });
  page.on('pageerror', (e) => problems.push(`${pose.name}: pageerror: ${e.message}`));

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });

  const ready = await page
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    problems.push(`${pose.name}: window.bard.pose never appeared — cannot pose the game`);
    await page.close();
    continue;
  }

  await page.evaluate(
    ({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }),
    pose,
  );
  // Same settle as postcard.mjs: let the camera's damping and the wind/
  // particle systems reach a steady state before reading pixels.
  await page.waitForTimeout(1800);

  const stats = await page.evaluate(measureLandHistogram);
  await page.close();

  if (stats.error) {
    problems.push(`${pose.name}: ${stats.error}`);
    continue;
  }
  rows.push({ name: pose.name, ...stats });
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad('pose', 17)}${pad('p10', 8)}${pad('p50', 8)}${pad('p90', 8)}${pad('%>L170', 9)}${pad('landShare', 11)}pixels`,
);
for (const r of rows) {
  console.log(
    `${pad(r.name, 17)}${pad(Math.round(r.p10), 8)}${pad(Math.round(r.p50), 8)}${pad(Math.round(r.p90), 8)}` +
      `${pad(Math.round(r.shareAbove170 * 100) + '%', 9)}${pad(Math.round(r.landShare * 100) + '%', 11)}` +
      `${r.landPixels}/${r.totalPixels}`,
  );
}
if (problems.length) {
  console.log(`\nproblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
}

// Instrument, not a gate — task 125 is the separate decision to wire any of
// this into verify-all.mjs. Always exit 0 so this tool never blocks a run.
process.exit(0);
