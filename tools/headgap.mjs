// headgap — measure the note heads' real on-screen gaps (ROADMAP task 184).
//
// Wave 7 named "fused brown blobs" where notes sit close in musical time, on
// five frames, while frames with wide musical spacing were called excellent.
// This is the third appearance of the twice-refuted "noteheads ignore pitch"
// family, so before anything is fixed the claim gets a number: for a set of
// viewports, run the live walking tune, and at several sampled moments
// project every travelling glyph through the live camera, measure each
// neighbouring pair's centre distance in pixels against the pair's summed
// head radii, and report the worst overlap seen.
//
// The measurement reads the same instanced attribute buffers the GPU draws
// (aPos/aScale) rather than re-deriving positions from theory — the point is
// to measure what the judges saw, not what the layout maths promises. A
// pair counts as overlapping only when both glyphs are meaningfully lit
// (alpha above 0.25): a dissolved gone-by note under a fresh one is not a
// blob anyone can see.
import { BASE_URL, launch } from './browser.mjs';

const VIEWPORTS = [
  { name: '1600x900 (desktop)', width: 1600, height: 900 },
  { name: '390x844 (phone portrait)', width: 390, height: 844 },
  { name: '844x390 (phone landscape)', width: 844, height: 390 },
  { name: '1024x768 (tablet)', width: 1024, height: 768 },
];
/** Moments to sample after the tune starts, ms apart, so several bars pass. */
const SAMPLES = 6;
const SAMPLE_GAP_MS = 2500;

function measure() {
  const stage = window.bard?.stage;
  const app = window.bard?.app;
  if (!stage || !app) return { error: 'no stage' };
  const notes = stage.notes;
  const cam = stage.camera;
  const pos = notes.aPos.array;
  const scale = notes.aScale.array;
  const alpha = notes.aAlpha.array;
  const w = app.renderer.domElement.clientWidth;
  const h = app.renderer.domElement.clientHeight;

  // Head half-width in world metres for instance i: the glyph quad is
  // uSize world units tall per unit scale; the head occupies HEAD_RX of a
  // 128 px cell. Read uSize from the live material so the number is the
  // drawn one, not a restatement.
  const uSize = notes.glyphMaterial.uniforms.uSize.value;
  const HEAD_RX_FRAC = 28 / 128; // HEAD_RX in SongNotes; the cell is 128 px.

  const glyphs = [];
  const count = Math.min(scale.length, alpha.length);
  for (let i = 0; i < count; i++) {
    if (alpha[i] < 0.25 || scale[i] <= 0) continue;
    glyphs.push({ world: { x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] }, scale: scale[i] });
  }
  // three.js Vector3 via the scene's own classes: borrow from the camera.
  const V3 = cam.position.constructor;
  const out = [];
  for (const g of glyphs) {
    const p = new V3(g.world.x, g.world.y, g.world.z).project(cam);
    if (p.z > 1) continue;
    const sx = (p.x * 0.5 + 0.5) * w;
    const sy = (-p.y * 0.5 + 0.5) * h;
    // Pixel radius: project a second point one head-half-width to the
    // camera's right of the centre.
    const right = new V3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    const halfWorld = uSize * HEAD_RX_FRAC * g.scale;
    const q = new V3(g.world.x, g.world.y, g.world.z)
      .addScaledVector(right, halfWorld)
      .project(cam);
    const qx = (q.x * 0.5 + 0.5) * w;
    const qy = (-q.y * 0.5 + 0.5) * h;
    out.push({ x: sx, y: sy, r: Math.hypot(qx - sx, qy - sy) });
  }

  out.sort((a, b) => a.x - b.x);
  let worst = null;
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i];
    const b = out[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const need = a.r + b.r;
    const ratio = need > 0 ? d / need : Infinity;
    if (!worst || ratio < worst.ratio) {
      worst = { ratio: Math.round(ratio * 100) / 100, gapPx: Math.round(d), needPx: Math.round(need), rA: Math.round(a.r), rB: Math.round(b.r) };
    }
  }
  return { glyphs: out.length, worst };
}

const browser = await launch();
console.log('viewport                 sample  glyphs  worstGap/need  ratio   (ratio<1 = OVERLAP)');
const summary = [];
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(2000);
  let vpWorst = null;
  for (let s = 0; s < SAMPLES; s++) {
    const r = await page.evaluate(measure);
    if (r?.worst) {
      console.log(
        `${vp.name.padEnd(24)} ${String(s).padEnd(7)} ${String(r.glyphs).padEnd(7)} ${String(r.worst.gapPx + '/' + r.worst.needPx).padEnd(14)} ${r.worst.ratio}`,
      );
      if (!vpWorst || r.worst.ratio < vpWorst.ratio) vpWorst = r.worst;
    }
    await page.waitForTimeout(SAMPLE_GAP_MS);
  }
  summary.push({ viewport: vp.name, worst: vpWorst });
  await page.close();
}
console.log('\nSummary (worst pair seen per viewport):');
for (const s of summary) {
  console.log(`  ${s.viewport.padEnd(26)} ratio ${s.worst?.ratio ?? 'n/a'} ${s.worst && s.worst.ratio < 1 ? '<-- OVERLAP' : ''}`);
}
await browser.close();
