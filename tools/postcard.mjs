// postcard — bake a sheet of framed moments from the live game.
//
// This is the harness the art-critique loop runs on. A critic agent cannot
// play the game, so the game has to be able to *pose* for it: drive to a
// known point on the road, set a known time of day, set a phase, settle,
// shoot. Every shot is deterministic (the road comes from a fixed seed and
// the clock is driven, not observed), so two runs of this tool differ only
// where the rendering actually changed — which is what makes "is this
// better than last round" a question with an answer.
//
// Shots are written as individual PNGs so a critic can open them at full
// size. A contact sheet is deliberately not produced: judging a painterly
// look from thumbnails is how you ship something that falls apart at 1x.
import { mkdirSync } from 'node:fs';
import { BASE_URL, launch } from './browser.mjs';

const outDir = process.argv[2] ?? 'postcards';
const only = process.argv[3] ?? null;
mkdirSync(outDir, { recursive: true });

// The moments worth looking at. Chosen to cover the things that are hard to
// get right rather than the things that are easy: raking light, silhouettes
// against a bright sky, a busy foreground, a night scene with a single warm
// source, and the two phone aspect ratios where a desktop framing breaks.
const SHOTS = [
  { name: '01-dawn-road', s: 60, day: 0.24, phase: 'walking', viewport: [1600, 900] },
  { name: '02-morning-open', s: 340, day: 0.42, phase: 'walking', viewport: [1600, 900] },
  { name: '03-noon-forest', s: 620, day: 0.55, phase: 'walking', viewport: [1600, 900] },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista', viewport: [1600, 900] },
  { name: '05-golden-busk', s: 940, day: 0.82, phase: 'busking', viewport: [1600, 900] },
  { name: '06-dusk-encounter', s: 1120, day: 0.88, phase: 'encounter', viewport: [1600, 900] },
  { name: '07-night-campfire', s: 1400, day: 0.95, phase: 'resting', viewport: [1600, 900] },
  { name: '08-phone-portrait', s: 420, day: 0.5, phase: 'walking', viewport: [390, 844] },
  { name: '09-phone-landscape', s: 900, day: 0.82, phase: 'busking', viewport: [844, 390] },
  { name: '10-tablet', s: 700, day: 0.7, phase: 'walking', viewport: [1024, 768] },
];

const browser = await launch();
const problems = [];
const written = [];

for (const shot of SHOTS) {
  if (only && !shot.name.includes(only)) continue;
  const [width, height] = shot.viewport;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => problems.push(`${shot.name}: pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`${shot.name}: console: ${m.text()}`);
    if (/THREE.WebGLProgram|shader error|not compile/i.test(m.text())) {
      problems.push(`${shot.name}: shader: ${m.text()}`);
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'load' });

  // Wait for the debug handle rather than a fixed timeout: a fixed sleep is
  // either too short on a cold SwiftShader start (blank frame, false
  // "regression") or wastefully long on every other run.
  const ready = await page
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    problems.push(`${shot.name}: window.bard.pose never appeared — cannot pose the game`);
    await page.close();
    continue;
  }

  await page.evaluate(
    ({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }),
    shot,
  );
  // Let the camera's damping settle into the new framing and the wind and
  // particle systems reach a steady state. Shooting immediately catches the
  // camera mid-transition, which reads as a composition failure that isn't.
  await page.waitForTimeout(1800);

  const path = `${outDir}/${shot.name}.png`;
  await page.screenshot({ path });
  written.push(path);

  // Did anything actually draw?
  //
  // This tool twice reported "10 postcards, no problems" for a completely
  // blank page. A frame can be empty with no console error and no page
  // error at all — a stage that throws inside its constructor, a camera
  // pointing at nothing, a render loop that never started. Screenshots are
  // written either way, so "the file exists" proves nothing and a caller
  // trusting the exit code is being actively misled.
  //
  // Read the pixels back with gl.readPixels in the same task as an explicit
  // render: the renderer runs with preserveDrawingBuffer:false, so drawing
  // the canvas into a 2D context after presentation copies black and would
  // report every healthy frame as broken.
  const drew = await page.evaluate(() => {
    const app = window.bard?.app;
    const stage = window.bard?.stage;
    if (!app || !stage) return { ok: false, reason: 'no handle' };
    app.renderer.render(stage.scene, stage.camera);
    const gl = app.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 16) {
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
    const mean = sum / n;
    const stdDev = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    return { ok: true, mean: Math.round(mean), stdDev: Math.round(stdDev * 10) / 10 };
  });

  if (!drew.ok) {
    problems.push(`${shot.name}: could not read the frame back (${drew.reason})`);
  } else if (drew.stdDev < 3) {
    // A frame with essentially no tonal variation is a flat fill — the page
    // background, a clear colour, or a world that drew nothing. A real
    // frame of this game, even a foggy dusk one, is well above this.
    problems.push(
      `${shot.name}: BLANK — mean ${drew.mean}, stdDev ${drew.stdDev}; nothing drew`,
    );
  }

  await page.close();
}

await browser.close();

console.log(`wrote ${written.length} postcards to ${outDir}/`);
for (const p of written) console.log(`  ${p}`);
if (problems.length) {
  console.log(`\nproblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
}
process.exit(problems.length ? 1 : 0);
