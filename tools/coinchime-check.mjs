// Playwright is deliberately not a project dependency (CLAUDE.md: the game
// itself stays dependency-free), so it lives wherever it was installed. Set
// PLAYWRIGHT_PATH to that install and these scripts run *in place*, straight
// out of the repo, instead of having to be copied next to it.
const pwPath = process.env.PLAYWRIGHT_PATH
  ? (/\.[cm]?js$/.test(process.env.PLAYWRIGHT_PATH)
      ? process.env.PLAYWRIGHT_PATH
      : `${process.env.PLAYWRIGHT_PATH.replace(/\/$/, '')}/index.js`)
  : 'playwright';
const pw = await import(pwPath);
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`could not load playwright's chromium from ${pwPath}`);

/**
 * The idea backlog asked for the coin chime to be "prototyped behind a
 * screenshot/listen check before committing" — headless can't listen, but it
 * can hook every oscillator the AudioEngine creates the same way
 * nofail-check and autoplay already do, and check that the chime's very
 * distinctive voice (a fixed sine two octaves above the root, never a pitch
 * drawn from the song being played) actually sounds once real coin accrual
 * crosses 25.
 *
 * Plays close to perfectly for 15s — enough for the meter to fill and,
 * at COIN_RATE_PER_SEC=5 and a full meter, comfortably cross 25 coins —
 * and asserts the chime fired near a real milestone, not on every note.
 */
const ROOT_HZ = 261.63; // core/notation.ts / audio/manifest.ts — middle C
const CHIME_HZ = ROOT_HZ * Math.pow(2, 24 / 12); // two octaves up

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.addInitScript(() => {
  window.__notes = [];
  const origCreate = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    const osc = origCreate.call(this);
    const origStart = osc.start.bind(osc);
    osc.start = (when) => {
      window.__notes.push({ hz: osc.frequency.value, type: osc.type, when });
      return origStart(when);
    };
    return osc;
  };
});

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const SECONDS = 15;
const deadline = Date.now() + SECONDS * 1000;
const coinsAtChime = [];

while (Date.now() < deadline) {
  const waitMs = await page.evaluate(() => {
    const scene = window.game.scene.scenes[0];
    const now = scene.time.now - scene.startTimeMs;
    const next = scene.markers.find((m) => m.resolved === null && m.beat.hitTimeMs > now - 40);
    return next ? next.beat.hitTimeMs - now : 50;
  });
  if (waitMs > 400) {
    await page.waitForTimeout(400);
    continue;
  }
  if (waitMs > 2) await page.waitForTimeout(waitMs);
  await page.mouse.click(600, 520);
}

const result = await page.evaluate(() => ({
  coins: window.game.scene.scenes[0].coins,
}));

const isChime = (n) => n.type === 'sine' && Math.abs(n.hz - CHIME_HZ) < 0.5;
const chimes = (await page.evaluate(() => window.__notes)).filter(isChime);

await browser.close();

console.log(`coins at end: ${result.coins.toFixed(1)}`);
console.log(`chime oscillators heard: ${chimes.length} (expected ${Math.floor(result.coins / 25)})`);
console.log(`page/console errors: ${errors.length}`);

let ok = true;
if (errors.length > 0) {
  ok = false;
  console.error('FAIL: page/console errors:', errors);
}
if (result.coins < 25) {
  ok = false;
  console.error(`FAIL: only accrued ${result.coins.toFixed(1)} coins — not enough runway to prove a milestone fired at all`);
}
const expected = Math.floor(result.coins / 25);
if (chimes.length !== expected) {
  ok = false;
  console.error(`FAIL: expected ${expected} chime(s) for ${result.coins.toFixed(1)} coins, heard ${chimes.length}`);
}

console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
