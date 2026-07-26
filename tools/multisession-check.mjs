import { chromium } from 'playwright';

// Does the model actually deliver its central promise — that a note reaches
// full fade only across SEVERAL sittings, never inside one? Unit tests
// assert it; this proves it in the real game, through real storage.
const PLAY = Number(process.argv[2] ?? 70);
const SESSIONS = Number(process.argv[3] ?? 3);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const play = async (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const w = await page.evaluate(() => {
      const s = window.game.scene.scenes[0];
      const n = s.time.now - s.startTimeMs;
      const m = s.markers.find((x) => x.resolved === null && x.beat.hitTimeMs > n - 40);
      return m ? m.beat.hitTimeMs - n : 50;
    });
    if (w > 2) await page.waitForTimeout(Math.min(w, 400));
    await page.mouse.click(600, 520);
  }
};

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });

const perSession = [];
for (let i = 0; i < SESSIONS; i++) {
  await play(PLAY * 1000);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('wb.learn.v1') ?? '{"p":{}}'));
  // band 0 = fully faded (letter arrives only 350ms before the tap)
  const bands = Object.fromEntries(Object.entries(rec.p).map(([k, v]) => [k, v[2]]));
  perSession.push({ session: i + 1, bands });
  console.log(`after sitting ${i + 1}:`, JSON.stringify(bands));
  if (i < SESSIONS - 1) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
  }
}

const finalBands = Object.values(perSession[perSession.length - 1].bands);
const firstBands = Object.values(perSession[0].bands);
const fail = [];
if (Math.min(...firstBands) === 0) fail.push('a position reached FULL fade inside a single sitting — the session cap is not holding');
if (Math.min(...finalBands) >= Math.min(...firstBands)) fail.push('no further fading happened across sittings — persistence or the cap reset is broken');
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

console.log(fail.length ? `FAIL:\n - ${fail.join('\n - ')}` : 'PASS: fading is gradual within a sitting and continues across sittings');
await browser.close();
process.exit(fail.length ? 1 : 0);
