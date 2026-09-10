// far-band-objects — task 189 piece 5: does hiding one object category
// collapse the far band's hue spread?
//
// Piece 3 ruled out landKeyAmount as the cause of the far/near hueSpread gap
// on enacting-hour poses (forcing it to 0 made the gap WORSE, not better).
// Piece 4 ruled out camera mood too (the gap's sign follows the pose, not
// the mood forced onto it) and left one untried lead from piece 3's own
// list: "object mix at the far row band — a specific landmark or biome
// feature sitting in that band on some poses and not others". This is that
// piece, built the same way piece 3 tested the land key: not by inferring a
// cause from a screenshot, but by toggling `.visible` on one whole object
// category at a time (same session, same page, same pose) and re-measuring
// fog-hue-band.mjs's own far-band hueSpread — an ablation, not a guess.
//
// Three categories, drawn from the object-name families WorldStreamer.ts
// actually writes (scatter-probe.mjs's SCATTER_RE for the first one):
//   scatter    — grass/fern/flower/reed/bankreed/bankgrass/shrub/log/rock/
//                roadgrass/roadstone/puddle: the ordinary ground cover.
//   trees      — every `tree-<kind>-<index>` mesh (wayside sentinels and
//                ordinary forest fill alike).
//   landmarks  — `landmark-<kind>` and the `stop-*` meshes (camp dressing).
// Terrain itself is not a category here — hiding the ground mesh would
// leave nothing to sample at all, so it stays visible throughout and is
// the implicit "what's left" baseline every other ablation is measured
// against.
//
// If hiding a category collapses the far-band hueSpread (and the far/near
// gap) toward zero on the poses that show it, that category is carrying
// the effect. If nothing moves it much, the wall lives in terrain/fog
// itself — landKey and mood already ruled out, the shader terms
// (FOG_CHROMA/FOG_HUE_LEAD, the ridge/dome values task 166 piece 3 tuned)
// would be the remaining place to look, not another object toggle.
//
// Instrument, not a gate — always exits 0.
import { BASE_URL, launch } from './browser.mjs';

// Same five poses fog-hue-band.mjs uses (piece 2's set, natural mood only —
// the mood confound piece 4 found is already answered there, no need to
// re-litigate it here). Kept in the same order/names so a reader can line
// this file's output up against fog-hue-band.mjs's own.
const POSES = [
  { name: '02-morning', s: 265, day: 0.42, phase: 'walking' },
  { name: '03-noon', s: 620, day: 0.55, phase: 'walking' },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista' },
  { name: '11-morning-vista', s: 500, day: 0.35, phase: 'vista' },
  { name: '10-tablet-afternoon', s: 700, day: 0.7, phase: 'walking' },
];

const VIEWPORT = { width: 1600, height: 900 };
const BANDS = 3; // near / mid / far — matches fog-hue-band.mjs

// Piece 3/4's rise/fall split, restated here rather than re-derived: these
// are the poses whose far-near gap RISES above near (the fault this whole
// task chases) versus the two that stay flat/negative (zero-pull controls).
// Used only to label the summary table, not to change what gets measured.
const RISEN = new Set(['02-morning', '03-noon', '10-tablet-afternoon']);

const CATEGORIES = {
  scatter: /^(roadgrass|roadstone|puddle|grass|fern|flower|reed|bankreed|bankgrass|shrub|log|rock)-\d+$/,
  trees: /^tree-/,
  landmarks: /^(landmark-|stop-)/,
};

/**
 * Runs in the page. Self-contained per page.evaluate's own rule (see
 * land-histogram.mjs / fog-hue-band.mjs) — no reference to anything outside
 * this function, including CATEGORIES above; the pattern is passed in as a
 * string and rebuilt as a RegExp inside.
 */
function measureFarBandWithHidden({ bandCount, hidePattern }) {
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

  // The category ablation: hide every object whose name matches, remember
  // what it was so it can be restored exactly (a chunk not yet streamed in
  // has none of these, so an empty match list is fine).
  const hideRe = hidePattern ? new RegExp(hidePattern) : null;
  const hidden = [];
  if (hideRe) {
    stage.scene.traverse((obj) => {
      if (hideRe.test(obj.name) && obj.visible) {
        hidden.push({ obj, wasVisible: obj.visible });
        obj.visible = false;
      }
    });
  }

  const priorClear = { hex: 0x000000 };
  app.renderer.getClearColor({
    copy(realColor) {
      priorClear.hex = realColor.getHex();
      return this;
    },
  });
  const priorAlpha = app.renderer.getClearAlpha();
  app.renderer.setClearColor(0xff00ff, 1);

  // Calibrated live, not hardcoded — see fog-hue-band.mjs's own note (the
  // same finishing-pass grade bug land-histogram.mjs carried since task 168).
  const gl = app.renderer.getContext();
  const sceneWasVisible = stage.scene.visible;
  stage.scene.visible = false;
  app.renderFrame(stage.scene, stage.camera);
  const calib = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, calib);
  stage.scene.visible = sceneWasVisible;
  const sentinelR = calib[0];
  const sentinelG = calib[1];
  const sentinelB = calib[2];

  const TOLERANCE = 24;
  const isSentinel = (r, g, b) =>
    Math.abs(r - sentinelR) <= TOLERANCE &&
    Math.abs(g - sentinelG) <= TOLERANCE &&
    Math.abs(b - sentinelB) <= TOLERANCE;

  try {
    app.renderFrame(stage.scene, stage.camera);
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

    // GL readPixels convention: row 0 is the BOTTOM of the screen (near
    // ground); the last row is the TOP (sky/horizon/far land).
    let minRow = h;
    let maxRow = -1;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col += 3) {
        const i = (row * w + col) * 4;
        if (!isSentinel(px[i], px[i + 1], px[i + 2])) {
          if (row < minRow) minRow = row;
          if (row > maxRow) maxRow = row;
        }
      }
    }
    if (maxRow < minRow) return { error: 'no land pixels found in this pose' };

    const extent = Math.max(1, maxRow - minRow);
    const bandStats = Array.from({ length: bandCount }, () => ({
      sinSum: 0,
      cosSum: 0,
      satSum: 0,
      satRaw: 0,
      count: 0,
    }));

    const step = 2;
    for (let row = minRow; row <= maxRow; row++) {
      const t = (row - minRow) / extent;
      const band = Math.min(bandCount - 1, Math.floor(t * bandCount));
      const bs = bandStats[band];
      for (let col = 0; col < w; col += step) {
        const i = (row * w + col) * 4;
        const r8 = px[i];
        const g8 = px[i + 1];
        const b8 = px[i + 2];
        if (isSentinel(r8, g8, b8)) continue;
        const r = r8 / 255;
        const g = g8 / 255;
        const b = b8 / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        const sat = max === 0 ? 0 : chroma / max;
        bs.count++;
        bs.satRaw += sat;
        if (chroma > 0.01) {
          let hue;
          if (max === r) hue = ((g - b) / chroma + 6) % 6;
          else if (max === g) hue = (b - r) / chroma + 2;
          else hue = (r - g) / chroma + 4;
          const radians = (hue / 6) * Math.PI * 2;
          const weight = sat * max;
          bs.sinSum += Math.sin(radians) * weight;
          bs.cosSum += Math.cos(radians) * weight;
          bs.satSum += weight;
        }
      }
    }

    const bands = bandStats.map((bs, idx) => {
      const resultant = bs.satSum === 0 ? 1 : Math.hypot(bs.sinSum, bs.cosSum) / bs.satSum;
      const hueSpread = Math.round((1 - resultant) * 1000) / 1000;
      let hueDeg = null;
      if (bs.satSum > 0) {
        const angle = Math.atan2(bs.sinSum, bs.cosSum);
        hueDeg = Math.round(((angle / (Math.PI * 2)) * 360 + 360) % 360);
      }
      const meanSat = bs.count === 0 ? null : Math.round((bs.satRaw / bs.count) * 1000) / 1000;
      return {
        band: idx === 0 ? 'near' : idx === bandCount - 1 ? 'far' : `mid${idx}`,
        hueSpread,
        hueDeg,
        meanSat,
        pixels: bs.count,
      };
    });

    return { bands, hiddenCount: hidden.length };
  } finally {
    app.renderer.setClearColor(priorClear.hex, priorAlpha);
    for (let i = 0; i < sky.length; i++) sky[i].visible = skyWasVisible[i];
    for (const h of hidden) h.obj.visible = h.wasVisible;
    app.renderFrame(stage.scene, stage.camera);
  }
}

const only = process.argv[2] ?? null;
const browser = await launch();
const problems = [];
const rows = [];

for (const pose of POSES) {
  if (only && !pose.name.includes(only)) continue;
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
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
  await page.waitForTimeout(1800);

  const conditions = { natural: null, ...CATEGORIES };
  const results = {};
  let bad = false;
  for (const [label, re] of Object.entries(conditions)) {
    const result = await page.evaluate(measureFarBandWithHidden, {
      bandCount: BANDS,
      hidePattern: re ? re.source : null,
    });
    if (result.error) {
      problems.push(`${pose.name} (${label}): ${result.error}`);
      bad = true;
      break;
    }
    results[label] = result;
  }
  await page.close();
  if (bad) continue;

  rows.push({ name: pose.name, results });
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const gap = (bands) => {
  const near = bands[0];
  const far = bands[bands.length - 1];
  return Math.round((far.hueSpread - near.hueSpread) * 1000) / 1000;
};
const far = (bands) => bands[bands.length - 1];

for (const r of rows) {
  console.log(`\n${r.name}  (${RISEN.has(r.name) ? 'RISEN' : 'flat'})`);
  console.log(
    `  ${pad('condition', 12)}${pad('far.hueSpread', 15)}${pad('far.hueDeg', 11)}${pad('far.meanSat', 11)}${pad(
      'far/near gap',
      13,
    )}hidden`,
  );
  const naturalGap = gap(r.results.natural.bands);
  for (const [label, result] of Object.entries(r.results)) {
    const f = far(result.bands);
    const g = gap(result.bands);
    console.log(
      `  ${pad(label, 12)}${pad(f.hueSpread, 15)}${pad(f.hueDeg === null ? '-' : f.hueDeg, 11)}${pad(
        f.meanSat === null ? '-' : f.meanSat,
        11,
      )}${pad(g, 13)}${result.hiddenCount}`,
    );
  }
  console.log(
    `  gap change from natural (${naturalGap}): ` +
      Object.entries(r.results)
        .filter(([label]) => label !== 'natural')
        .map(([label, result]) => {
          const g = gap(result.bands);
          const pct = naturalGap !== 0 ? Math.round((1 - g / naturalGap) * 100) : '-';
          return `${label} ${pct}%`;
        })
        .join(', '),
  );
}

if (problems.length) {
  console.log(`\nproblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
}
