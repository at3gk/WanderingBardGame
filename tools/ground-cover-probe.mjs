// ground-cover-probe — does the meadow's grass/fern actually show streaky
// colour, or was that read off a tree edge and a firefly again?
//
// STATE.md's run-138 handoff refuted the first candidate cause for task
// 149's last open sliver ("07's black night spikes"): a grass-blade vertex-
// colour gradient. The two "spikes" it actually caught with a scan line
// turned out to be a conifer tree and a campfire ember particle — not
// ground cover at all — and the tool that caught them (`land-histogram.mjs`'s
// `app.renderer.render()` + `gl.readPixels` method) turned out to also be
// reading a PRE-FINISHING buffer, skipping task 168's LUT/composite pass.
// The real, still-open question — a faint wavy/streaky texture across the
// dark meadow, visible by eye in `07-night-campfire` crops — was never
// reduced to a number, because a blind scan line has no way to tell ground
// cover from anything else it happens to cross. This is the instrument run
// 138 sized to answer it properly: sample the RENDERED COLOUR of every
// actual grass/fern instance (nothing else — no roadgrass, flower, reed,
// shrub, log, rock; those are scatter too but a different vocabulary
// question), not just its visibility.
//
// Method, deliberately built on the two patterns that already exist rather
// than a third new one:
//   - instance projection: exactly `scatter-probe.mjs`'s approach — walk
//     every InstancedMesh whose name matches the kind, read its per-instance
//     world matrix, project through the live camera, keep what lands inside
//     the frustum on screen.
//   - pixel sampling: exactly `land-histogram.mjs`/`frame-quality.mjs`'s
//     approach — render explicitly, `gl.readPixels` the framebuffer in the
//     same task, and average a small patch around the projected pixel (a
//     grass card can be only a few pixels wide at range, so a lone sample
//     risks landing in a rendered-but-off-model AA fringe).
//
// The one thing done differently from every existing pixel tool in this
// directory: the render call is `app.renderFrame(scene, camera)` — which is
// `App.ts`'s own `this.finishing.render(this.renderer, scene, camera)` —
// not a bare `app.renderer.render()`. That is the exact discrepancy run 138
// found and flagged as a follow-up rather than fixing in the older tools;
// this new tool does not repeat it.
//
// A known limitation, stated rather than hidden: this samples the pixel at
// an instance's PROJECTED position, not a depth-verified one, so an instance
// occluded by something nearer (a tree trunk, another clump) can contribute
// a sample that is not really its own surface colour. No occlusion check is
// implemented — `scatter-probe.mjs` doesn't do one either, and at the
// population sizes here (tens to low hundreds of instances) an occasional
// occluded sample is noise the robust statistics below (median, IQR) are
// built to absorb, not a source of a systematic streak.
//
// Not a pass/fail check — an instrument, like `scatter-probe.mjs` and
// `staging-probe.mjs`. Always exits 0. Not wired into `verify-all.mjs`.
import { BASE_URL, launch } from './browser.mjs';

// The pose in question, pinned in postcard.mjs — never renumber or retime.
// 03-noon-forest rides along as a same-tool daylight baseline: not because
// night and noon SHOULD measure the same (a single fire against full dark is
// a wildly different lighting problem than open daylight), but because it
// answers "does this tool's own methodology report an ordinary, un-alarming
// per-instance CV for ground cover when nobody has ever complained about
// that frame" — the sanity check a lone night number can't give itself.
//
// A THIRD pose is pushed onto this array at runtime, once the browser is up:
// '07-night-campfire, s corrected to the road's real last stop'. This run found that postcard.mjs's
// pinned `s: 1400` for the resting pose does not match where `makeCamp()`
// actually builds the camp — `RoadStage.makeCamp` places the fire at
// `this.road.stops[stops.length - 1]`, ignoring whatever `s` a pose call set,
// while `WorldStreamer`'s grass/fern LOD window (~90 m) follows `journey.s`
// itself. In real play the two never diverge — `arriveAt()` only fires
// `setPhase('resting')` once `journey.s` is already within `ARRIVE_RADIUS`
// (4 m) of the stop — but a *posed* `s: 1400` frame is not real play: on the
// day this was measured the last stop sat at `s: 1790`, 390 m past the
// camera's actual grass/fern LOD window. The corrected pose queries
// `road.stops` at runtime and reposes at the true last stop's `s`, which is
// what a resting frame looks like when journey.s and the camp actually agree
// — see the printed comparison for what each pose measures.
const POSES = [
  { name: '07-night-campfire (pinned s:1400)', s: 1400, day: 0.95, phase: 'resting' },
  { name: '03-noon-forest (pinned, baseline)', s: 620, day: 0.55, phase: 'walking' },
];

// Ground cover farther than this from the camera is past any plausible
// firelight falloff at a single campfire's scale and is what the original
// complaint means by "the dark meadow" — as opposed to the lit clearing
// right around the fire, where real, large brightness swings are expected
// and not a fault. Chosen generously (most campfire light-pool falloffs in
// this game's own painterly work are described in metres-to-tens-of-metres,
// see `finishing.ts`/campfire scene comments); the actual near/far split in
// the printed output lets a reader judge whether it drew the line somewhere
// sensible for the pose that was actually shot.
const DARK_MEADOW_MIN_DIST = 20;

// Screen-space columns for the banding check: does an instance's lateral
// position in frame (not just its own random per-instance colour) predict
// its luma? A real streak running across the meadow would show up here as
// a large between-column share of the total variance; ordinary per-instance
// noise (the ~0.3 stop of colorOf() randomness `WorldStreamer.ts` already
// bakes into every clump) would not.
const BANDING_COLUMNS = 8;

const VIEWPORT = { width: 1600, height: 900 };

function measure() {
  // Matches `${kind}-${chunkIndex}` for grass and fern only — task 149's
  // "ground cover" vocabulary, not the wider ordinary-scatter set
  // `scatter-probe.mjs` covers (roadgrass/roadstone/puddle/flower/reed/
  // bankreed/bankgrass/shrub/log/rock all excluded on purpose).
  const GROUND_COVER_RE = /^(grass|fern)-\d+$/;

  const handle = window.bard;
  const app = handle?.app;
  const stage = handle?.stage;
  if (!app || !stage) return { error: 'no window.bard.app/stage' };
  const camera = stage.camera;
  const scene = stage.scene;
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);

  const V3 = Object.getPrototypeOf(camera.position).constructor;
  const M4 = Object.getPrototypeOf(camera.projectionMatrix).constructor;
  const scratchMatrix = new M4();

  const project = (v) => {
    v.project(camera);
    return { sx: (v.x + 1) / 2, sy: (1 - v.y) / 2, depth: v.z };
  };

  const items = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !GROUND_COVER_RE.test(o.name)) return;
    const kind = o.name.replace(/-\d+$/, '');
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, scratchMatrix);
      scratchMatrix.premultiply(o.matrixWorld);
      const world = new V3().setFromMatrixPosition(scratchMatrix);
      const dist = camera.position.distanceTo(world);
      const p = project(world.clone());
      const visible =
        p.depth >= -1 && p.depth <= 1 && p.sx >= 0 && p.sx <= 1 && p.sy >= 0 && p.sy <= 1;
      if (!visible) continue;
      items.push({ kind, sx: p.sx, sy: p.sy, dist, world: { x: world.x, y: world.y, z: world.z } });
    }
  });

  // The full pipeline, not a bare renderer.render() — see the file header.
  app.renderFrame(scene, camera);
  const gl = app.renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  // readPixels is bottom-up; `sy` above is top-down (screen convention,
  // matching scatter-probe.mjs/staging-probe.mjs). A 3x3 average around the
  // projected pixel, clamped to the buffer.
  const sampleAt = (sx, sy) => {
    const cx = Math.round(sx * (w - 1));
    const cy = Math.round((1 - sy) * (h - 1));
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const idx = (yy * w + xx) * 4;
        r += px[idx];
        g += px[idx + 1];
        b += px[idx + 2];
        n++;
      }
    }
    return { r: r / n, g: g / n, b: b / n };
  };

  for (const it of items) {
    const c = sampleAt(it.sx, it.sy);
    it.r = c.r;
    it.g = c.g;
    it.b = c.b;
    // sRGB (display-referred) luma, matching land-histogram.mjs's own
    // convention — read straight off the composited pixel, not linearised.
    it.luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }

  return { total: items.length, items, viewport: { w, h } };
}

function stats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const at = (q) => sorted[Math.min(n - 1, Math.max(0, Math.floor(n * q)))];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  return {
    n,
    mean,
    stdev,
    cv: mean > 0 ? stdev / mean : null,
    median: at(0.5),
    p10: at(0.1),
    p90: at(0.9),
    iqr: at(0.75) - at(0.25),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Eta-squared-style variance decomposition: split `items` into `columns`
 * equal-width buckets of `keyFn` (0..1), and report what share of the total
 * luma variance sits BETWEEN bucket means versus within them. A real spatial
 * streak (some region of the frame consistently brighter/darker than
 * another) inflates the between share; ordinary per-instance randomness with
 * no spatial structure leaves nearly all the variance within buckets.
 */
function bandingShare(items, keyFn, columns) {
  const buckets = Array.from({ length: columns }, () => []);
  for (const it of items) {
    const k = Math.min(columns - 1, Math.max(0, Math.floor(keyFn(it) * columns)));
    buckets[k].push(it.luma);
  }
  const populated = buckets.filter((b) => b.length > 0);
  const all = items.map((it) => it.luma);
  const grandMean = all.reduce((a, b) => a + b, 0) / all.length;
  const totalSS = all.reduce((a, b) => a + (b - grandMean) ** 2, 0);
  let betweenSS = 0;
  for (const b of populated) {
    const m = b.reduce((a, x) => a + x, 0) / b.length;
    betweenSS += b.length * (m - grandMean) ** 2;
  }
  return {
    columnsPopulated: populated.length,
    columnMeans: buckets.map((b) => (b.length ? Math.round((b.reduce((a, x) => a + x, 0) / b.length) * 10) / 10 : null)),
    columnCounts: buckets.map((b) => b.length),
    betweenShare: totalSS > 0 ? betweenSS / totalSS : null,
  };
}

const fmt = (x, d = 1) => (x === null || x === undefined ? '—' : x.toFixed(d));

/**
 * Opens its own fresh page, poses it, and settles. A resting pose calls
 * `makeCamp()` (clearings, a lit campfire, `strikeCamp` only unwinding it on
 * a LATER phase change within the same page) and a first attempt at this
 * tool ran every pose through one shared, long-lived page the way
 * `scatter-probe.mjs` does — which works there because every one of its
 * poses shares the same `vista` phase. Sequencing a resting pose before a
 * walking one in a single page measured ZERO grass/fern for the walking
 * pose too, byte-for-byte reproducible, even though an isolated page posed
 * at the exact same `s`/`day`/`phase` measures thousands — leftover camp
 * state (or the stream window's own settle) bleeding into the next pose.
 * A fresh page per pose costs a few seconds and removes the whole question.
 */
async function posedMeasurement(browser, pose) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`pageerror (${pose.name}): ${e.message}`));
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  const ready = await page
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    await page.close();
    return { error: 'window.bard.pose never appeared — cannot pose the game' };
  }
  await page.evaluate(
    ({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }),
    pose,
  );
  await page.waitForTimeout(1800);
  const result = await page.evaluate(measure);
  await page.close();
  return result;
}

const browser = await launch();

// The road's actual last stop — where `RoadStage.makeCamp` really places the
// fire, regardless of what `s` a resting pose asks for. See the POSES
// comment above. Queried at runtime because the road (and therefore this
// value) changes every UTC day. Its own short-lived page, for the same
// isolation reason `posedMeasurement` uses one per pose.
const stopsPage = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
await stopsPage.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
await stopsPage
  .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
  .catch(() => {});
const lastStopS = await stopsPage.evaluate(() => {
  const stops = window.bard.stage.road.stops;
  return stops.length ? stops[stops.length - 1].s : null;
});
await stopsPage.close();
if (lastStopS !== null) {
  POSES.push({
    name: `07-night-campfire (s corrected to road's last stop, s:${Math.round(lastStopS)})`,
    s: lastStopS,
    day: 0.95,
    phase: 'resting',
  });
} else {
  console.log("(road has no stops today — cannot build the s-corrected resting pose)");
}

for (const pose of POSES) {
  const result = await posedMeasurement(browser, pose);
  if (result.error) {
    console.log(`${pose.name}: ${result.error}`);
    continue;
  }

  const items = result.items;
  console.log(`\n=== ${pose.name} — ${items.length} grass/fern instances on screen (${result.viewport.w}x${result.viewport.h}) ===`);

  const byKind = {};
  for (const it of items) byKind[it.kind] = (byKind[it.kind] ?? 0) + 1;
  console.log(`  by kind: ${Object.entries(byKind).map(([k, n]) => `${k}:${n}`).join(' ')}`);

  const allLuma = items.map((it) => it.luma);
  const s = stats(allLuma);
  if (!s) {
    console.log('  no on-screen grass/fern instances at this pose — nothing to measure');
    continue;
  }
  console.log(
    `  ALL:         n=${s.n} mean=${fmt(s.mean)} stdev=${fmt(s.stdev)} CV=${fmt(s.cv, 3)} median=${fmt(s.median)} p10=${fmt(s.p10)} p90=${fmt(s.p90)} min=${fmt(s.min)} max=${fmt(s.max)}`,
  );

  const dists = items.map((it) => it.dist);
  const dSorted = [...dists].sort((a, b) => a - b);
  console.log(
    `  distance to camera: min=${fmt(dSorted[0])} median=${fmt(dSorted[Math.floor(dSorted.length / 2)])} max=${fmt(dSorted[dSorted.length - 1])}`,
  );

  const meadow = items.filter((it) => it.dist >= DARK_MEADOW_MIN_DIST);
  const near = items.filter((it) => it.dist < DARK_MEADOW_MIN_DIST);
  const sMeadow = stats(meadow.map((it) => it.luma));
  const sNear = stats(near.map((it) => it.luma));
  console.log(
    `  NEAR (<${DARK_MEADOW_MIN_DIST}m, firelit):  n=${sNear?.n ?? 0}` +
      (sNear ? ` mean=${fmt(sNear.mean)} stdev=${fmt(sNear.stdev)} CV=${fmt(sNear.cv, 3)}` : ''),
  );
  console.log(
    `  DARK MEADOW (>=${DARK_MEADOW_MIN_DIST}m): n=${sMeadow?.n ?? 0}` +
      (sMeadow
        ? ` mean=${fmt(sMeadow.mean)} stdev=${fmt(sMeadow.stdev)} CV=${fmt(sMeadow.cv, 3)} median=${fmt(sMeadow.median)} p10=${fmt(sMeadow.p10)} p90=${fmt(sMeadow.p90)} min=${fmt(sMeadow.min)} max=${fmt(sMeadow.max)}`
        : ' (nothing this far out at this pose)'),
  );

  if (sMeadow && meadow.length >= BANDING_COLUMNS * 2) {
    const banding = bandingShare(meadow, (it) => it.sx, BANDING_COLUMNS);
    console.log(
      `  DARK MEADOW banding across ${BANDING_COLUMNS} screen-width columns (n populated: ${banding.columnsPopulated}/${BANDING_COLUMNS}):`,
    );
    console.log(`    column mean luma:  [${banding.columnMeans.map((m) => (m === null ? '·' : m)).join(', ')}]`);
    console.log(`    column counts:     [${banding.columnCounts.join(', ')}]`);
    console.log(
      `    between-column share of total luma variance: ${fmt(banding.betweenShare, 3)}` +
        ` (screen-x position "explains" ${fmt((banding.betweenShare ?? 0) * 100, 1)}% of the dark-meadow luma spread)`,
    );

    // A "wavy" band across a landscape more often runs WITH distance (a fog
    // layer, a LOD chunk boundary, terrain vertex-colour banding) than
    // laterally, so the same decomposition is worth taking against depth
    // too — normalised into the meadow subset's own min..max distance range
    // rather than screen-y, since screen-y conflates depth with camera pitch.
    const dMin = Math.min(...meadow.map((it) => it.dist));
    const dMax = Math.max(...meadow.map((it) => it.dist));
    const dRange = dMax - dMin || 1;
    const depthBanding = bandingShare(meadow, (it) => (it.dist - dMin) / dRange, BANDING_COLUMNS);
    console.log(
      `  DARK MEADOW banding across ${BANDING_COLUMNS} depth bands (${fmt(dMin)}m..${fmt(dMax)}m, n populated: ${depthBanding.columnsPopulated}/${BANDING_COLUMNS}):`,
    );
    console.log(`    band mean luma:    [${depthBanding.columnMeans.map((m) => (m === null ? '·' : m)).join(', ')}]`);
    console.log(`    band counts:       [${depthBanding.columnCounts.join(', ')}]`);
    console.log(
      `    between-band share of total luma variance: ${fmt(depthBanding.betweenShare, 3)}` +
        ` (distance from camera "explains" ${fmt((depthBanding.betweenShare ?? 0) * 100, 1)}% of the dark-meadow luma spread)`,
    );
  } else {
    console.log(`  DARK MEADOW banding: too few instances (need >= ${BANDING_COLUMNS * 2}) for a column breakdown`);
  }
}

await browser.close();

// Instrument, not a gate — always exits 0.
process.exit(0);
