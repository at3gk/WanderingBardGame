// Playwright is deliberately not a project dependency (CLAUDE.md: the game
// itself stays dependency-free), so it lives wherever it was installed. Set
// PLAYWRIGHT_PATH to that install and these scripts run *in place*.
const pwPath = process.env.PLAYWRIGHT_PATH
  ? (/\.[cm]?js$/.test(process.env.PLAYWRIGHT_PATH)
      ? process.env.PLAYWRIGHT_PATH
      : `${process.env.PLAYWRIGHT_PATH.replace(/\/$/, '')}/index.js`)
  : 'playwright';
const pw = await import(pwPath);
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`could not load playwright's chromium from ${pwPath}`);

/**
 * Drilling one tune, for minutes, the way a child learning a piece would.
 *
 * Practice is the one path in the game that *accumulates* on purpose: every
 * correct note appends to the written-out phrase, which is cleared a line
 * at a time and again when the tune comes round. "Cleared" is a promise
 * worth holding to over hundreds of passes rather than the six notes a
 * functional check plays.
 */
const MINUTES = Number(process.argv[2] ?? 4);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.mouse.click(195, 500);
await page.waitForTimeout(400);
await page.evaluate(() => window.game.scene.scenes[0].chooseSong('buns'));
await page.waitForTimeout(400);
await page.mouse.click(124, 24);
await page.waitForTimeout(700);

const snap = () => page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return {
    objects: s.children.list.length,
    tweens: s.tweens.getTweens().length,
    written: s.freeWritten.length,
    parts: s.freeParts.length,
    textures: Object.keys(s.textures.list).length,
    fps: Math.round(window.game.loop.actualFps),
  };
});

// Play the tune correctly, over and over, the way a child drilling a piece
// would. Each correct note appends to the written phrase; the phrase clears
// per line and per completed tune. This is the path that could accumulate.
const first = await snap();
console.log('start        :', JSON.stringify(first));
const samples = [];
const deadline = Date.now() + MINUTES * 60 * 1000;
let notes = 0, tunes = 0;
while (Date.now() < deadline) {
  const info = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { step: s.freeSequence[s.freeIndex], index: s.freeIndex,
             bottomY: s.freeStaff.bottomY, gap: s.freeStaff.stepGap };
  });
  if (info.index === 0 && notes > 0) tunes++;
  await page.mouse.click(300, Math.round(info.bottomY - info.step * info.gap));
  notes++;
  if (notes % 200 === 0) {
    const s = await snap();
    samples.push({ notes, ...s });
    console.log(`after ${notes} notes:`, JSON.stringify(s));
  }
}
const last = await snap();
console.log('end          :', JSON.stringify(last));
console.log(`played ${notes} notes, ~${tunes} times through the tune`);

const fail = [];
if (errs.length) fail.push('page errors: ' + errs.join(' | '));
// The staff is ~35 objects; a full line of written notes is a dozen more.
if (last.objects > first.objects + 60) {
  fail.push(`objects grew ${first.objects} -> ${last.objects} over ${notes} notes`);
}
if (last.tweens > first.tweens + 40) fail.push(`tweens grew ${first.tweens} -> ${last.tweens}`);
if (last.parts > first.parts + 20) fail.push(`freeParts grew ${first.parts} -> ${last.parts}`);
if (last.textures > first.textures + 30) fail.push(`textures grew ${first.textures} -> ${last.textures}`);
console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: drilling a tune for minutes leaks nothing');
await browser.close();
process.exit(fail.length ? 1 : 0);
