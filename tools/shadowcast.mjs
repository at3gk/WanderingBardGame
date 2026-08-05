// shadowcast — identify who casts the "phantom shadows" and measure what
// they look like (ROADMAP task 183).
//
// Three wave-7 lenses independently named long dark streaks crossing road
// and grass "with no visible caster" (frames 01/03/09), reading them as
// render banding. Suspicion-list discipline says the symptom is true and
// the attribution is not: they are almost certainly real shadow-map casts
// from offscreen trees. This tool answers three questions with numbers
// before anyone touches a lever:
//
//   1. WHO casts each streak — by freezing the frame (app.stop()), then
//      re-rendering with the sun's shadows off entirely, and again with
//      each caster family (trees / shrubs / logs / rocks / the bard /
//      everything else) individually silenced, and diffing pixels. A
//      pixel that lightens only when the trees stop casting belongs to a
//      tree.
//   2. WHAT the shadow looks like — value drop, saturation in shadow vs
//      lit (the colour lens claims shadows should "carry hue, cooler and
//      still saturated, not grey" — wave 4 already proved CAST_SHADOW_HUE
//      chroma-gains at noon once, so measure before believing), and hue
//      shift, all computed on exactly the pixels the sun-off diff owns.
//   3. HOW SOFT it is — the share of shadowed pixels sitting in the
//      penumbra band (25-75% of the local full depth). A hard-edged cast
//      is bimodal (almost everything at full depth); references like A
//      Short Hike read soft because a wide penumbra carries the edge.
//
// Every capture is an explicit render of the same frozen state, so the
// diffs contain rendering changes only — no wind, no particles, no camera
// settle.
import { BASE_URL, launch } from './browser.mjs';

const SHOTS = [
  { name: '01-dawn-road', s: 60, day: 0.24, phase: 'walking', viewport: [1600, 900] },
  { name: '03-noon-forest', s: 620, day: 0.55, phase: 'walking', viewport: [1600, 900] },
  { name: '09-phone-landscape', s: 900, day: 0.82, phase: 'busking', viewport: [844, 390] },
];

const outDir = process.argv[2] ?? null;

async function measureShot(page) {
  return page.evaluate(async () => {
    const app = window.bard?.app;
    const stage = window.bard?.stage;
    if (!app || !stage) return { error: 'no handle' };

    // Freeze the world: every capture below re-renders this exact state.
    app.stop();

    const renderer = app.renderer;
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    const capture = () => {
      renderer.render(stage.scene, stage.camera);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };

    // The caster families. Everything in the scene with castShadow=true is
    // assigned to exactly one bucket, so silencing the buckets one at a
    // time partitions the sun-off mask.
    const buckets = new Map(); // name -> meshes
    const bucketOf = (obj) => {
      if (obj.isLight) return null; // a light's castShadow is not a caster family
      const n = obj.name || '';
      if (/^tree-/.test(n)) return 'trees';
      if (/^shrub-/.test(n)) return 'shrubs';
      if (/^log-/.test(n)) return 'logs';
      if (/^rock-/.test(n)) return 'rocks';
      // Walk up: anything under the bard's rig, else the nearest named
      // ancestor so a dressing's anonymous child meshes report as their
      // dressing rather than as "Mesh".
      let p = obj;
      while (p) {
        if (p.name === 'bard') return 'bard';
        p = p.parent;
      }
      p = obj;
      while (p && !p.name) p = p.parent;
      return `other(${p?.name ?? obj.type})`;
    };
    stage.scene.traverse((o) => {
      if (o.castShadow === true && bucketOf(o)) {
        const b = bucketOf(o);
        if (!buckets.has(b)) buckets.set(b, []);
        buckets.get(b).push(o);
      }
    });

    const sun = app.sun;
    if (!sun || !sun.castShadow) return { error: 'no shadow-casting sun (quality tier?)' };

    const base = capture();
    sun.castShadow = false;
    const noShadow = capture();
    sun.castShadow = true;

    // The mask of all cast-shadow pixels: where turning the sun's shadows
    // off lightened the frame. Threshold clears ACES/sRGB rounding noise.
    const luma = (px, i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const THRESH = 8;
    const maskIdx = [];
    for (let i = 0; i < base.length; i += 4) {
      if (luma(noShadow, i) - luma(base, i) > THRESH) maskIdx.push(i);
    }

    // Photometrics on the mask: the same pixel shadowed (base) vs lit
    // (noShadow), in HSV.
    const hsv = (px, i) => {
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      let hDeg = 0;
      if (d > 0) {
        if (max === r) hDeg = 60 * (((g - b) / d) % 6);
        else if (max === g) hDeg = 60 * ((b - r) / d + 2);
        else hDeg = 60 * ((r - g) / d + 4);
        if (hDeg < 0) hDeg += 360;
      }
      return { h: hDeg, s: max === 0 ? 0 : d / max, v: max };
    };
    let sShadow = 0, sLit = 0, vShadow = 0, vLit = 0, hShadow = 0, hLit = 0;
    let penumbra = 0, deep = 0;
    const depths = [];
    for (const i of maskIdx) {
      const a = hsv(base, i), b = hsv(noShadow, i);
      sShadow += a.s; sLit += b.s; vShadow += a.v; vLit += b.v; hShadow += a.h; hLit += b.h;
      depths.push(b.v - a.v);
    }
    const p95 = depths.slice().sort((x, y) => x - y)[Math.floor(depths.length * 0.95)] || 1;
    for (const d of depths) {
      const t = d / p95;
      if (t >= 0.25 && t <= 0.75) penumbra++;
      else if (t > 0.75) deep++;
    }
    const n = maskIdx.length || 1;

    // Ownership: silence one family, re-render, count mask pixels that
    // lightened. (Restore before the next family.)
    const owners = {};
    for (const [name, meshes] of buckets) {
      for (const m of meshes) m.castShadow = false;
      const alt = capture();
      for (const m of meshes) m.castShadow = true;
      let owned = 0;
      let ySum = 0;
      for (const i of maskIdx) {
        if (luma(alt, i) - luma(base, i) > THRESH) {
          owned++;
          ySum += h - Math.floor(i / 4 / w); // gl reads bottom-up
        }
      }
      if (owned > 0) {
        owners[name] = {
          pixels: owned,
          shareOfShadowPx: Math.round((owned / n) * 1000) / 10,
          meanScreenYShare: Math.round((ySum / owned / h) * 100) / 100,
        };
      }
    }

    // Leave the frame in the sun-off state for an optional screenshot; the
    // caller restores by re-posing or just closing the page.
    const result = {
      frame: { w, h },
      casterFamilies: [...buckets.keys()].map((k) => `${k}(${buckets.get(k).length})`),
      shadowPixels: maskIdx.length,
      shadowShareOfFrame: Math.round((maskIdx.length / (base.length / 4)) * 1000) / 10,
      owners,
      photometrics: {
        vLit: Math.round((vLit / n) * 100) / 100,
        vShadow: Math.round((vShadow / n) * 100) / 100,
        valueDrop: Math.round(((vLit - vShadow) / n) * 100) / 100,
        sLit: Math.round((sLit / n) * 100) / 100,
        sShadow: Math.round((sShadow / n) * 100) / 100,
        hLitDeg: Math.round(hLit / n),
        hShadowDeg: Math.round(hShadow / n),
      },
      softness: {
        penumbraShare: Math.round((penumbra / n) * 100) / 100,
        deepShare: Math.round((deep / n) * 100) / 100,
      },
    };
    return result;
  });
}

const browser = await launch();
for (const shot of SHOTS) {
  const [width, height] = shot.viewport;
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  const ready = await page
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    console.log(`${shot.name}: game never booted`);
    await page.close();
    continue;
  }
  await page.evaluate(
    ({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }),
    shot,
  );
  await page.waitForTimeout(1800);
  const r = await measureShot(page);
  console.log(`\n=== ${shot.name} ===`);
  console.log(JSON.stringify(r, null, 2));
  if (outDir && !r.error) {
    // The page is frozen post-measurement; shoot base for the record.
    await page.screenshot({ path: `${outDir}/${shot.name}-frozen.png`, timeout: 120000 });
  }
  await page.close();
}
await browser.close();
