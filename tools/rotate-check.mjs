// Playwright is deliberately not a project dependency (CLAUDE.md: the game
// itself stays dependency-free), so it lives wherever it was installed. Set
// PLAYWRIGHT_PATH to that install and these scripts run *in place*, straight
// out of the repo, instead of having to be copied next to it.
//
// That copy step is not just friction: this session twice ran a stale copy
// of a script and once had a crashed run "prove" that nothing had changed.
// Running the file you actually edited removes the whole class of mistake.
const pwPath = process.env.PLAYWRIGHT_PATH
  ? (/\.[cm]?js$/.test(process.env.PLAYWRIGHT_PATH)
      ? process.env.PLAYWRIGHT_PATH
      : `${process.env.PLAYWRIGHT_PATH.replace(/\/$/, '')}/index.js`)
  : 'playwright';
// playwright's entry is CommonJS, so a dynamic import may deliver the
// module under `default` rather than as named exports.
const pw = await import(pwPath);
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`could not load playwright's chromium from ${pwPath}`);

/**
 * Rotating a phone re-runs Phaser's create(). STATE.md already flags that
 * path as dangerous — the scaffold had to be hoisted to module scope so a
 * resize wouldn't wipe a child's progress. This checks what *else* survives
 * a rotation: progress, audio, the walk, and the marker list.
 */
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

async function play(seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    const waitMs = await page.evaluate(() => {
      const s = window.game.scene.scenes[0];
      const now = s.time.now - s.startTimeMs;
      const next = s.markers.find((m) => m.resolved === null && m.beat.hitTimeMs > now - 40);
      return next ? next.beat.hitTimeMs - now : 50;
    });
    if (waitMs > 400) { await page.waitForTimeout(400); continue; }
    if (waitMs > 2) await page.waitForTimeout(waitMs);
    // Tap a point that is inside the viewport in *both* orientations.
    // Clicking a fixed (200, 520) was the second harness bug found here: in
    // landscape the viewport is only 390px tall, so every tap landed outside
    // the page and the meter crashed to zero — which again looked like the
    // rotation breaking the game.
    const vp = page.viewportSize();
    await page.mouse.click(Math.round(vp.width / 2), Math.round(vp.height * 0.6));
  }
}

const snap = () => page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return {
    coins: Math.floor(s.coins),
    steps: Math.floor(s.distancePx / 64),
    meter: Math.round(s.meter),
    markers: s.markers.length,
    audioStarted: s.audioEngine.isStarted,
    textures: Object.keys(s.textures.list).length,
    w: s.scale.width, h: s.scale.height,
  };
});

await play(35);
const before = await snap();
const scaffoldBefore = await page.evaluate(() => localStorage.getItem('wb.learn.v1'));

// Rotate to landscape, then back to portrait.
// Keep playing straight through the rotation. Pausing here was the first
// version's mistake: 1.2s of not tapping produces perfectly genuine misses,
// which then read as "rotation cost the child progress". It does not — the
// scaffold numbers were measuring the harness, not the game.
await page.setViewportSize({ width: 664, height: 390 });
await play(12);
const landscape = await snap();
await page.setViewportSize({ width: 390, height: 664 });
await play(12);
const after = await snap();
const scaffoldAfter = await page.evaluate(() => localStorage.getItem('wb.learn.v1'));
const scaffoldBeforeP = JSON.parse(scaffoldBefore ?? '{"p":{}}').p ?? {};
const scaffoldAfterP = JSON.parse(scaffoldAfter ?? '{"p":{}}').p ?? {};

console.log('before rotation :', JSON.stringify(before));
console.log('in landscape    :', JSON.stringify(landscape));
console.log('after rotating back:', JSON.stringify(after));
console.log('scaffold before :', scaffoldBefore);
console.log('scaffold after  :', scaffoldAfter);

const fail = [];
if (errors.length) fail.push('page errors: ' + errors.join(' | '));
if (landscape.w !== 664) fail.push(`scene did not resize to landscape (w=${landscape.w})`);
if (after.w !== 390) fail.push(`scene did not resize back to portrait (w=${after.w})`);
if (landscape.coins < before.coins) fail.push(`coins went backwards on rotation: ${before.coins} -> ${landscape.coins}`);
// Rotating must not cost a child learning progress. Played continuously
// across the rotation, no position may end weaker than it started.
const weaker = Object.entries(scaffoldAfterP).filter(([k, v]) => (scaffoldBeforeP[k]?.[0] ?? 0) > v[0]);
if (weaker.length) fail.push(`rotation cost strength at ${weaker.map(([k, v]) => `step ${k}: ${scaffoldBeforeP[k][0]}->${v[0]}`).join(', ')}`);
if (after.steps < before.steps) fail.push(`walk distance reset on rotation: ${before.steps} -> ${after.steps}`);
if (!after.audioStarted) fail.push('audio engine stopped after rotation');
if (!scaffoldAfter) fail.push('learning progress was wiped by rotation');
if (after.textures > before.textures + 12) fail.push(`texture count grew ${before.textures} -> ${after.textures} across two rotations (leak)`);
if (after.markers === 0) fail.push('no notes in flight after rotating back');

console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: rotation preserves progress, audio and the walk');
await browser.close();
process.exit(fail.length ? 1 : 0);
