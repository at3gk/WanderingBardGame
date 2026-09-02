// fog-hue-band — does the far band of a daylight frame converge on ONE hue?
//
// Wave 19's colour lens named a fault family independent of (and surviving)
// the FOG_CHROMA/FOG_HUE_LEAD fix painterly.ts already carries for item 10:
// "distance fade resolves to a single hue-free wall" across 10 of 13 frames
// (STATE.md's run-131 handoff, ROADMAP/STATE's repeated "hue-free distance
// wall" pointer since). That fix targeted the far band losing SATURATION
// entirely (S0.12 measured, ACES eating half of what the palette gave it);
// it does not by itself say whether the far band's SURVIVING colour still
// varies hue-to-hue or has collapsed onto one shared hue — which is a
// different failure with the same symptom word ("grey"/"wall"), and exactly
// what a whole-frame stat (frame-quality's hueSpread, land-histogram's
// value-only bands) cannot separate from "the far band is just cyan sky
// bleed" or "the near band is also fairly flat, nothing's wrong at distance
// specifically".
//
// The check, in the spirit of task 149's decisive variance-decomposition:
// mask the sky (land-histogram's magenta trick), split the remaining LAND
// pixels into near/far row bands by their position within the land pixels'
// own vertical extent (not the whole viewport — the horizon line sits
// wherever the camera's pitch puts it, and what matters is the far END of
// the land that's actually on screen), and compute frame-quality's own
// saturation*value-weighted circular hueSpread formula separately per band.
// A converged far band reads as: hueSpread crashes toward 0 AND the mean hue
// swings toward the fog colour's own hue. Both must hold — a low hueSpread
// with a hue nowhere near the fog's is a different, uninteresting fault (a
// genuinely monochrome BIOME, say), not this one.
//
// Instrument, not a gate — always exits 0.
import { BASE_URL, launch } from './browser.mjs';

// Piece 2 (run 143): the first reading (piece 1) drew its "milkier, less
// confident distance" verdict from exactly two enacting-hour samples —
// 02-morning (partial land-key pull) and 03-noon (full pull) — against one
// carrying-hour control. That's a pattern claim resting on two points. The
// three added below are existing, already-vetted postcard.mjs poses chosen
// to separate "does milkiness track the land-key pull amount" from "did we
// just get two odd samples": 11-morning-vista sits BELOW landKey.ts's
// LAND_KEY_RISE_START (sunHeight ~0.267 vs the 0.3 floor — zero pull, like
// the golden control, but a different biome/vista than 02) and 10-tablet
// sits in the afternoon's partial-pull band (sunHeight ~0.333) — a sun
// height nothing here has tested, past noon rather than approaching it.
// landKeyAmount (below) reports the actual pull each pose gets so the
// table itself carries the classification instead of relying on this
// comment to stay in sync with landKey.ts's constants.
const POSES = [
  { name: '02-morning', s: 265, day: 0.42, phase: 'walking' },
  { name: '03-noon', s: 620, day: 0.55, phase: 'walking' },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista' },
  { name: '11-morning-vista', s: 500, day: 0.35, phase: 'vista' },
  { name: '10-tablet-afternoon', s: 700, day: 0.7, phase: 'walking' },
];

const VIEWPORT = { width: 1600, height: 900 };
const BANDS = 3; // near / mid / far, by position within the land pixels' own row extent

// Piece 3 (run 144): does the far/near hueSpread gap piece 2 tied to
// landKeyAmount actually come FROM the land key? `measureFogHueBands`
// takes an optional `forcedLandKeyAmount` — an in-page override of
// `app.globals.uLandKeyAmount.value` for this one render, restored
// afterward — no shader edit, since the uniform is already the shared
// object every material binds to (see `painterly.ts`'s `bindGlobals`).
// Forcing it to 0 on a pose that naturally pulls answers "does the gap
// collapse with the key off" directly, rather than only correlating.
const FORCE_ZERO_POSES = ['02-morning', '03-noon', '10-tablet-afternoon'];

/**
 * Runs in the page. Self-contained per page.evaluate's own rule (see
 * land-histogram.mjs) — no reference to anything outside this function.
 */
function measureFogHueBands({ bandCount, forcedLandKeyAmount = null }) {
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

  const priorClear = { hex: 0x000000 };
  app.renderer.getClearColor({
    copy(realColor) {
      priorClear.hex = realColor.getHex();
      return this;
    },
  });
  const priorAlpha = app.renderer.getClearAlpha();
  app.renderer.setClearColor(0xff00ff, 1);

  // Calibrated, not assumed — see land-histogram.mjs's own note (same bug,
  // found while building this tool): the finishing pass's ACES tonemap + LUT
  // grade (task 168) moves pure magenta to roughly (253,40,240), not
  // (255,0,255), so the sentinel must be measured through the same pipeline
  // rather than hardcoded.
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

  // Applied only to the LAND render below — the calibration render above
  // hides the whole scene, so the key can't have touched it either way.
  const landKeyUniform = app.globals.uLandKeyAmount;
  const priorLandKeyAmount = landKeyUniform.value;
  const overriding = forcedLandKeyAmount !== null;
  if (overriding) landKeyUniform.value = forcedLandKeyAmount;

  try {
    app.renderFrame(stage.scene, stage.camera);
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

    // GL readPixels convention: row 0 of the buffer is the BOTTOM of the
    // screen (near ground); the last row is the TOP (sky/horizon/far land).
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

    const step = 2; // every other column; the buffer is large and this is stable
    for (let row = minRow; row <= maxRow; row++) {
      // 0 at the bottom (near), 1 at the top (far) — matches the GL row
      // convention above, so "far" really does mean "far".
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

    // The fog's own hue, for comparison — the mix painterly.ts's fragment
    // shader actually uses at the far clip (vWorldPosition.y low → mostly
    // uFogColor; see fogTint in painterly.ts).
    const fogColor = app.globals.uFogColor.value;
    const fr = fogColor.r;
    const fg = fogColor.g;
    const fb = fogColor.b;
    const fmax = Math.max(fr, fg, fb);
    const fmin = Math.min(fr, fg, fb);
    const fchroma = fmax - fmin;
    let fogHueDeg = null;
    if (fchroma > 0.001) {
      let fhue;
      if (fmax === fr) fhue = ((fg - fb) / fchroma + 6) % 6;
      else if (fmax === fg) fhue = (fb - fr) / fchroma + 2;
      else fhue = (fr - fg) / fchroma + 4;
      fogHueDeg = Math.round(((fhue / 6) * 360 + 360) % 360);
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

    // landKey.ts's own formula, duplicated rather than imported — this
    // function ships as source text into the page (see the file-level
    // note above), so it cannot reference the module. Kept in lockstep by
    // the constants comment below; if landKey.ts's numbers move, this
    // classification goes stale silently, same caveat as every other
    // hardcoded-elsewhere value in this file.
    const sunHeight = app.globals.uSunDirection.value.y;
    const RISE_START = 0.3; // LAND_KEY_RISE_START
    const RISE_END = 0.55; // LAND_KEY_RISE_END
    const KEY_MAX = 0.35; // LAND_KEY_MAX
    const rt = Math.min(1, Math.max(0, (sunHeight - RISE_START) / (RISE_END - RISE_START)));
    const landKeyAmount = Math.round(KEY_MAX * rt * rt * (3 - 2 * rt) * 1000) / 1000;

    return {
      bands,
      fogHueDeg,
      landRowExtent: extent,
      minRow,
      maxRow,
      bufferHeight: h,
      sunHeight: Math.round(sunHeight * 1000) / 1000,
      landKeyAmount,
      appliedLandKeyAmount: overriding ? forcedLandKeyAmount : landKeyUniform.value,
    };
  } finally {
    if (overriding) landKeyUniform.value = priorLandKeyAmount;
    app.renderer.setClearColor(priorClear.hex, priorAlpha);
    for (let i = 0; i < sky.length; i++) sky[i].visible = skyWasVisible[i];
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

  const result = await page.evaluate(measureFogHueBands, { bandCount: BANDS });

  if (result.error) {
    problems.push(`${pose.name}: ${result.error}`);
    await page.close();
    continue;
  }

  let forcedZero = null;
  if (FORCE_ZERO_POSES.includes(pose.name)) {
    forcedZero = await page.evaluate(measureFogHueBands, { bandCount: BANDS, forcedLandKeyAmount: 0 });
    if (forcedZero.error) {
      problems.push(`${pose.name} (forced landKeyAmount=0): ${forcedZero.error}`);
      forcedZero = null;
    }
  }

  await page.close();
  rows.push({ name: pose.name, ...result, forcedZero });
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const printBands = (bands) => {
  console.log(`  ${pad('band', 8)}${pad('hueSpread', 11)}${pad('hueDeg', 9)}${pad('meanSat', 9)}pixels`);
  for (const b of bands) {
    console.log(
      `  ${pad(b.band, 8)}${pad(b.hueSpread, 11)}${pad(b.hueDeg === null ? '-' : b.hueDeg, 9)}${pad(
        b.meanSat === null ? '-' : b.meanSat,
        9,
      )}${b.pixels}`,
    );
  }
};
const gap = (bands) => {
  const near = bands[0];
  const far = bands[bands.length - 1];
  return Math.round((far.hueSpread - near.hueSpread) * 1000) / 1000;
};

for (const r of rows) {
  console.log(
    `\n${r.name}  (fog hue ${r.fogHueDeg}°, land rows ${r.landRowExtent}px, ` +
      `sunHeight ${r.sunHeight}, landKeyAmount ${r.landKeyAmount})`,
  );
  printBands(r.bands);
  console.log(`  far-near hueSpread gap: ${gap(r.bands)}`);

  if (r.forcedZero) {
    console.log(`  -- forced landKeyAmount=0 (natural was ${r.landKeyAmount}) --`);
    printBands(r.forcedZero.bands);
    const forcedGap = gap(r.forcedZero.bands);
    const naturalGap = gap(r.bands);
    console.log(`  far-near hueSpread gap: ${forcedGap}`);
    console.log(
      `  gap with key on vs off: ${naturalGap} -> ${forcedGap} ` +
        `(${naturalGap !== 0 ? Math.round((1 - forcedGap / naturalGap) * 100) : '-'}% change)`,
    );
  }
}
if (problems.length) {
  console.log(`\nproblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
}

process.exit(0);
