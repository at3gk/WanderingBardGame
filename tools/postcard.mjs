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
  // 265, not 340. The road's stops for the pinned day sit at 138, 206, 340,
  // 419 … and the walk is auto-forward, so a shot posed at a stop spends its
  // settle time arriving at it: a frame asked for as 'walking' came back
  // busking, with the stave in it, and read as a rendering fault. It was
  // not one — a player standing at 340 really is busking. The shot was
  // simply asking for something the road does not do there.
  { name: '02-morning-open', s: 265, day: 0.42, phase: 'walking', viewport: [1600, 900] },
  { name: '03-noon-forest', s: 620, day: 0.55, phase: 'walking', viewport: [1600, 900] },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista', viewport: [1600, 900] },
  { name: '05-golden-busk', s: 940, day: 0.82, phase: 'busking', viewport: [1600, 900] },
  { name: '06-dusk-encounter', s: 1120, day: 0.88, phase: 'encounter', viewport: [1600, 900] },
  // `s` here is a placeholder, overwritten below at runtime with the road's
  // true last stop before the shot loop runs — see the comment above that
  // override. Never rely on the literal value in this entry.
  { name: '07-night-campfire', s: 1400, day: 0.95, phase: 'resting', viewport: [1600, 900] },
  { name: '08-phone-portrait', s: 420, day: 0.5, phase: 'walking', viewport: [390, 844] },
  { name: '09-phone-landscape', s: 900, day: 0.82, phase: 'busking', viewport: [844, 390] },
  { name: '10-tablet', s: 700, day: 0.7, phase: 'walking', viewport: [1024, 768] },
  /*
   * 11-13 (run 94): three poses the critique never saw. Three panel waves
   * running called the sheet "one camera repeated as if it were ten
   * compositions" — which was partly the HARNESS's own fault: eight of ten
   * shots were the walking follow-cam on the same three daylight hours.
   * These add what the game actually has and the sheet never showed: a
   * second landscape composition in the morning, and the walk under a dusk
   * sky on both desktop and phone (no walking shot existed past day 0.7).
   *
   * A walking pose's `day` must AGREE with its `s`: the journey model
   * derives the hour from distance walked, so a posed mismatch is walked
   * back within the settle (measured — a night pose at s 300 shot as
   * morning). That also means the moonlit walk-on leg cannot be posed by
   * this tool at all (it is a separate leg state, not an hour); if it is
   * ever to face a judge it needs its own pose plumbing first.
   *
   * 01-10 are PINNED for cross-wave frame comparability: never renumber,
   * retime, or reframe them; add, don't touch. The one exception is 07's
   * `s`, which is deliberately NOT pinned to a literal number (see the
   * override below the SHOTS array) — its *intent* (resting, day 0.95, at
   * the camp) is what's pinned, and holding the number instead of the
   * intent is exactly the bug run 139/140 found: `RoadStage.makeCamp`
   * always places the fire at the road's real last stop, which moves every
   * UTC day, so a fixed `s` drifts out of step with where the camp actually
   * sits and can pose a frame with no ground cover streamed in at all.
   */
  { name: '11-morning-vista', s: 500, day: 0.35, phase: 'vista', viewport: [1600, 900] },
  { name: '12-dusk-walk', s: 1300, day: 0.92, phase: 'walking', viewport: [1600, 900] },
  { name: '13-dusk-walk-phone', s: 1250, day: 0.91, phase: 'walking', viewport: [390, 844] },
];

/**
 * Device pixel ratio for the shots.
 *
 * One, not two, and that is a change forced by the world getting heavier.
 * This box renders in software: doubling the ratio quadruples the pixels,
 * and once the world reached a few hundred thousand triangles a 3200x1800
 * frame stopped finishing inside Playwright's screenshot deadline — every
 * shot, every time. One agent hit it and quietly worked around it with a
 * private shooter, which meant the next one hit it too.
 *
 * Set BARD_DSF=2 on a machine with a GPU; the shots are crisper and the
 * cost is nothing there. A critic judging composition, value and silhouette
 * does not need the extra pixels, which is why the default gives them up
 * rather than the deadline.
 */
const DSF = Number(process.env.BARD_DSF ?? 1);

const browser = await launch();
const problems = [];
const written = [];

// '07-night-campfire' is posed at phase: 'resting', but `RoadStage.makeCamp`
// ignores whatever `s` a resting pose is given and always builds the camp at
// `road.stops[stops.length - 1]` — the road's true last stop, which moves
// every UTC day since the road is seeded from the day. A stale, hardcoded
// `s` therefore drifts out of step with where the camp actually sits: the
// camera poses at the old `s` while `WorldStreamer`'s grass/fern LOD window
// follows it too, so once the two diverge enough the frame can show a camp
// with no ground cover streamed in at all (ground-cover-probe.mjs, run 139
// — see its own header for the full account). Queried here, once, before the
// shot loop, so every 07 shot this run poses at the road's real camp.
const restingShot = SHOTS.find((shot) => shot.phase === 'resting');
if (restingShot) {
  const stopsPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await stopsPage.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  await stopsPage
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
    .catch(() => {});
  const lastStopS = await stopsPage.evaluate(() => {
    const stops = window.bard?.stage?.road?.stops;
    return stops && stops.length ? stops[stops.length - 1].s : null;
  });
  await stopsPage.close();
  if (lastStopS !== null) {
    restingShot.s = lastStopS;
  } else {
    problems.push(
      `${restingShot.name}: could not query the road's last stop — s left at its stale placeholder value`,
    );
  }
}

for (const shot of SHOTS) {
  if (only && !shot.name.includes(only)) continue;
  const [width, height] = shot.viewport;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: DSF });
  page.on('pageerror', (e) => problems.push(`${shot.name}: pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`${shot.name}: console: ${m.text()}`);
    if (/THREE.WebGLProgram|shader error|not compile/i.test(m.text())) {
      problems.push(`${shot.name}: shader: ${m.text()}`);
    }
  });

  // Navigation gets a long budget for the same reason the handle wait does:
  // a cold SwiftShader start compiles every shader on the main thread and
  // Playwright's 30 s default fires during it, throwing out of the loop
  // rather than reporting a problem for the shot.
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });

  // Wait for the debug handle rather than a fixed timeout: a fixed sleep is
  // either too short on a cold SwiftShader start (blank frame, false
  // "regression") or wastefully long on every other run.
  const ready = await page
    // Sixty seconds, not twenty. Under SwiftShader — no GPU, a software
    // vertex pipeline, and a world that is currently a few hundred thousand
    // triangles with per-vertex wind noise on most of them — first paint has
    // been measured at twelve seconds at pixel ratio 1 and twenty-one at
    // ratio 2. A twenty-second budget turned that into "the game never
    // booted", which is indistinguishable from a real break and cost a round
    // of chasing one. This is the harness being slow, not the game: the same
    // build boots promptly on hardware with a GPU.
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
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
  // Generous, for the same reason as the navigation budget: a software
  // rasteriser takes seconds per frame and the default 30 s fires mid-shot.
  await page.screenshot({ path, timeout: 120000 });
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
    // Full pipeline (task 168's finishing/LUT composite), not a bare
    // renderer.render() — see tools/README.md's discrepancy note.
    app.renderFrame(stage.scene, stage.camera);
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

  // Is the page's own animation loop actually running?
  //
  // The pixel check above renders explicitly before reading back, which
  // proves the *scene* can draw and says nothing about whether the page is
  // drawing it. Those come apart in practice: while agents are editing, the
  // dev server fires an HMR reload every few seconds and a shot taken inside
  // one is pure background colour — yet the explicit render succeeds and the
  // tool reported "10 postcards, no problems" over a set of blank images.
  //
  // three's own frame counter settles the question. If it has not advanced
  // across a gap, whatever the screenshot caught is not a frame of the game.
  const alive = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const renderer = window.bard?.app?.renderer;
        if (!renderer) return resolve({ ok: false, reason: 'no renderer' });
        const before = renderer.info.render.frame;
        setTimeout(() => {
          const after = renderer.info.render.frame;
          resolve({ ok: after > before, before, after });
        }, 350);
      }),
  );
  if (!alive.ok) {
    problems.push(
      `${shot.name}: the render loop is not advancing (${alive.reason ?? `frame stuck at ${alive.after}`})` +
        ' — the shot is not a live frame',
    );
  }

  // Is the canvas the size of the viewport?
  //
  // Checked on every shot because getting this wrong does not look like a
  // bug — it looks like a composition problem. The canvas once laid out at
  // its drawing-buffer size, so at deviceScaleFactor 2 it was twice the
  // viewport in each axis and every screenshot here was the top-left
  // quarter of the real frame, upscaled. It reads as "the horizon is too
  // low and the character is missing", and a round of art direction was
  // spent on those symptoms before anyone measured the element.
  const fit = await page.evaluate(() => {
    const host = document.getElementById('game');
    const canvas = host?.querySelector('canvas');
    if (!host || !canvas) return null;
    return {
      hostW: host.clientWidth,
      hostH: host.clientHeight,
      canvasW: canvas.clientWidth,
      canvasH: canvas.clientHeight,
    };
  });
  if (fit && (Math.abs(fit.canvasW - fit.hostW) > 2 || Math.abs(fit.canvasH - fit.hostH) > 2)) {
    problems.push(
      `${shot.name}: canvas ${fit.canvasW}x${fit.canvasH} does not fit host ` +
        `${fit.hostW}x${fit.hostH} — the frame is being cropped`,
    );
  }

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
