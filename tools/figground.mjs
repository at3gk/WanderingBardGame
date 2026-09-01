// figure/ground measurement — exact silhouette by render-diff.
import { BASE_URL, launch } from './browser.mjs';

const SHOTS = [
  { name: '01-dawn-road', s: 60, day: 0.24, phase: 'walking', viewport: [1600, 900] },
  { name: '02-morning-open', s: 265, day: 0.42, phase: 'walking', viewport: [1600, 900] },
  { name: '03-noon-forest', s: 620, day: 0.55, phase: 'walking', viewport: [1600, 900] },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista', viewport: [1600, 900] },
  { name: '06-dusk-encounter', s: 1120, day: 0.88, phase: 'encounter', viewport: [1600, 900] },
  { name: '08-phone-portrait', s: 420, day: 0.5, phase: 'walking', viewport: [390, 844] },
  { name: '10-tablet', s: 700, day: 0.7, phase: 'walking', viewport: [1024, 768] },
];
const only = process.argv[2] ?? null;

const browser = await launch();
const rows = [];
for (const shot of SHOTS) {
  if (only && !shot.name.includes(only)) continue;
  const [width, height] = shot.viewport;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.BARD_DSF ?? 1) });
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  const ok = await page.waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!ok) { rows.push({ name: shot.name, err: 'no handle' }); await page.close(); continue; }
  await page.evaluate((s) => window.bard.pose({ s: s.s, dayFraction: s.day, phase: s.phase }), shot);
  await page.waitForTimeout(1800);

  const out = await page.evaluate(() => {
    const app = window.bard.app, stage = window.bard.stage;
    const gl = app.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const grab = () => {
      // Full pipeline (task 168's finishing/LUT composite), not a bare
      // renderer.render() — see tools/README.md's discrepancy note.
      app.renderFrame(stage.scene, stage.camera);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const A = grab();
    const g = stage.bard.group;
    const was = g.visible;
    g.visible = false;
    const B = grab();
    g.visible = was;

    const srgb = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const Lstar = (r, gg, b) => {
      const Y = 0.2126 * srgb(r) + 0.7152 * srgb(gg) + 0.0722 * srgb(b);
      return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
    };
    const LA = new Float32Array(w * h), LB = new Float32Array(w * h);
    const mask = new Uint8Array(w * h);
    let minX = w, maxX = -1, minY = h, maxY = -1, n = 0;
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      LA[i] = Lstar(A[p], A[p + 1], A[p + 2]);
      LB[i] = Lstar(B[p], B[p + 1], B[p + 2]);
      const d = Math.abs(A[p] - B[p]) + Math.abs(A[p + 1] - B[p + 1]) + Math.abs(A[p + 2] - B[p + 2]);
      if (d > 12) {
        mask[i] = 1; n++;
        const x = i % w, y = (i / w) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (n < 40) return { err: 'silhouette too small', n };
    // GL rows are bottom-up. Use percentile bounds so a few stray diff pixels
    // (a note particle, a shimmer) cannot stretch the body box.
    const rowCount = new Int32Array(h);
    for (let i = 0; i < w * h; i++) if (mask[i]) rowCount[(i / w) | 0]++;
    let cum = 0; let p02 = minY, p98 = maxY;
    for (let y = 0; y < h; y++) { cum += rowCount[y]; if (cum >= n * 0.02) { p02 = y; break; } }
    cum = 0;
    for (let y = 0; y < h; y++) { cum += rowCount[y]; if (cum >= n * 0.98) { p98 = y; break; } }
    minY = p02; maxY = p98;
    const bh = maxY - minY + 1;
    const bands = {
      full: [minY, maxY],
      lower: [minY, minY + Math.round(bh * 0.40)],   // knees-down
      upper: [minY + Math.round(bh * 0.55), maxY],
    };
    const RING = Math.max(6, Math.round(bh * 0.22)); // surround radius in px

    const measure = ([y0, y1]) => {
      let fs = 0, fn = 0, bs = 0, bn = 0, behS = 0, behN = 0;
      const fig = [], sur = [];
      for (let y = y0; y <= y1; y++) {
        for (let x = Math.max(0, minX - RING); x <= Math.min(w - 1, maxX + RING); x++) {
          const i = y * w + x;
          if (mask[i]) { fs += LA[i]; fn++; fig.push(LA[i]); behS += LB[i]; behN++; }
        }
      }
      // surround: within RING px of a mask pixel (in this band) but not masked
      for (let y = y0; y <= y1; y++) {
        for (let x = Math.max(0, minX - RING); x <= Math.min(w - 1, maxX + RING); x++) {
          const i = y * w + x;
          if (mask[i]) continue;
          let near = false;
          for (let dy = -RING; dy <= RING && !near; dy += 2) {
            const yy = y + dy; if (yy < y0 || yy > y1) continue;
            for (let dx = -RING; dx <= RING; dx += 2) {
              const xx = x + dx; if (xx < 0 || xx >= w) continue;
              if (mask[yy * w + xx]) { near = true; break; }
            }
          }
          if (near) { bs += LB[i]; bn++; sur.push(LB[i]); }
        }
      }
      const med = (a) => { if (!a.length) return 0; a.sort((p, q) => p - q); return a[a.length >> 1]; };
      const r2 = (v) => Math.round(v * 10) / 10;
      return {
        figL: r2(fs / Math.max(1, fn)), figMed: r2(med(fig)), figN: fn,
        surL: r2(bs / Math.max(1, bn)), surMed: r2(med(sur)), surN: bn,
        behindL: r2(behS / Math.max(1, behN)),         // what the road behind the figure reads as
        dL: r2(Math.abs(fs / Math.max(1, fn) - bs / Math.max(1, bn))),
        dLmed: r2(Math.abs(med(fig) - med(sur))),
      };
    };
    const res = {};
    for (const k of Object.keys(bands)) res[k] = measure(bands[k]);
    res.bbox = { minX, maxX, minY, maxY, w, h, px: n };
    return res;
  });
  rows.push({ name: shot.name, ...out });
  await page.close();
}
await browser.close();
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.FG_OUT ?? 'fg.json', JSON.stringify(rows, null, 1));
const pad = (v, n) => String(v).padStart(n);
console.log('shot            | lowerFig lowerSur lowerdL | behind(lo) | fullFig fullSur fulldL | upperdL');
for (const r of rows) {
  if (r.err) { console.log(r.name + ' ERR ' + r.err); continue; }
  console.log(
    r.name.padEnd(16) + '|' + pad(r.lower.figL, 9) + pad(r.lower.surL, 9) + pad(r.lower.dL, 8) +
    ' |' + pad(r.lower.behindL, 11) + ' |' + pad(r.full.figL, 8) + pad(r.full.surL, 8) + pad(r.full.dL, 7) +
    ' |' + pad(r.upper.dL, 8));
}
