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
 * What a small child actually does: mash.
 *
 * Every other harness plays *correctly* — on the beat, one tap per note.
 * That is the least likely thing a five-year-old will do. This taps as fast
 * as the browser will deliver events for a minute and checks that nothing
 * comes apart: no page errors, no unbounded oscillator or marker growth, a
 * meter that still behaves, and a learning model that has not been poisoned
 * by taps that landed nowhere near a note.
 */
const SECONDS = Number(process.argv[2] ?? 60);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.addInitScript(() => {
  window.__oscCount = 0;
  const oc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { window.__oscCount++; return oc.call(this); };
});

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  window.__enc = { hit: 0, miss: 0 };
  const orig = s.recordEncounter.bind(s);
  s.recordEncounter = (step, outcome, walking) => { window.__enc[outcome]++; return orig(step, outcome, walking); };
});

let taps = 0;
const deadline = Date.now() + SECONDS * 1000;
while (Date.now() < deadline) {
  // No waiting at all — as fast as CDP will deliver.
  await page.mouse.click(195, 400);
  taps++;
}

const out = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return {
    meter: Math.round(s.meter), coins: Math.floor(s.coins), markers: s.markers.length,
    textures: Object.keys(s.textures.list).length, osc: window.__oscCount,
    enc: window.__enc, fps: Math.round(window.game.loop.actualFps),
    saved: localStorage.getItem('wb.learn.v1'),
  };
});

console.log(`mashed ${taps} times in ${SECONDS}s (${(taps / SECONDS).toFixed(1)}/sec)`);
console.log('after mashing:', JSON.stringify({ ...out, saved: undefined }));
console.log('saved record :', out.saved);

const fail = [];
if (errors.length) fail.push('page errors: ' + errors.join(' | '));
if (out.markers > 120) fail.push(`marker list grew to ${out.markers}`);
if (out.textures > 160) fail.push(`texture count reached ${out.textures}`);
// A pluck per tap is fine; a pluck per tap TIMES something is not.
if (out.osc > taps * 6 + 3000) fail.push(`${out.osc} oscillators for ${taps} taps — scheduling is amplifying`);
if (out.fps < 8) fail.push(`fps collapsed to ${out.fps} under mashing`);
// The model must not be fed by taps that hit nothing.
if (out.enc.hit > taps) fail.push(`${out.enc.hit} hits recorded from ${taps} taps`);
if (out.saved) {
  const p = JSON.parse(out.saved).p ?? {};
  for (const [step, v] of Object.entries(p)) {
    if (!v.every((n) => Number.isFinite(n))) fail.push(`step ${step} saved a non-finite value: ${JSON.stringify(v)}`);
    if (v[0] < 0 || v[2] < 0 || v[2] > 4) fail.push(`step ${step} out of range after mashing: ${JSON.stringify(v)}`);
  }
}
console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: mashing does not break anything');
await browser.close();
process.exit(fail.length ? 1 : 0);
