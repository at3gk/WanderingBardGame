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
 * What a child comes back to after days away.
 *
 * `scaffoldStorage.loadScaffold` reads the saved record, works out how long
 * it has been, and hands `decayForDaysAway` a whole number of days. That
 * arithmetic is unit-tested; the round trip through real `localStorage` with
 * a real backdated timestamp is not, and it is the path where a mistake is
 * both silent and unkind — a child who returns to letters that vanished, or
 * whose week of practice was thrown away.
 *
 * So: play until some positions have faded, backdate the stored timestamp,
 * reload, and check what survived.
 */
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

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
    await page.mouse.click(600, 520);
  }
}

const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('wb.learn.v1') ?? 'null'));
const bands = (rec) => Object.fromEntries(Object.entries(rec?.p ?? {}).map(([k, v]) => [k, v[2]]));
const strengths = (rec) => Object.fromEntries(Object.entries(rec?.p ?? {}).map(([k, v]) => [k, v[0]]));

// Two sittings, so positions actually get past the per-sitting cap.
await play(70);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await play(70);

/**
 * Flush the live state to storage and read it back.
 *
 * Reading storage directly is not enough: saves are throttled to every 5s,
 * so a read straight after playing can be several hits out of date. Both
 * the baseline and the post-gap readings have to be taken the same way, or
 * the stale baseline makes the gap look like it *added* practice. A reload
 * fires visibilitychange->hidden, which is the scene's force-save path.
 */
async function settleAndRead() {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return read();
}

const practised = await settleAndRead();
console.log('after practice          :', JSON.stringify(strengths(practised)), JSON.stringify(bands(practised)));

const fail = [];
if (!practised) fail.push('nothing was saved at all after two sittings of play');

/**
 * Backdate the stored record by `days`, reload, and read back the decayed
 * state *without practising first*.
 *
 * The decay is applied on load and only written out on the next save, so
 * simply reloading and reading storage returns the pre-decay numbers. The
 * first version of this played for 20s to force a save — which of course
 * also practised the positions, so the gap and the practice were measured
 * together and every position looked like it had grown. Backgrounding the
 * tab hits the scene's page-hide handler, which force-saves and touches
 * nothing else.
 */
async function afterDaysAway(days) {
  // Storage is already settled by the caller. Backdating has to happen
  // AFTER any reload: a reload fires visibilitychange->hidden, which hits
  // the scene's force-save and writes the live state — and a fresh
  // timestamp — over whatever is in storage, silently undoing the backdate
  // so the gap never happens at all.
  await page.evaluate((d) => {
    const rec = JSON.parse(localStorage.getItem('wb.learn.v1'));
    rec.t = rec.t - d * 24 * 3600 * 1000;
    localStorage.setItem('wb.learn.v1', JSON.stringify(rec));
  }, days);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  return read();
}

const oneDay = await afterDaysAway(1);
console.log('after 1 day away        :', JSON.stringify(strengths(oneDay)), JSON.stringify(bands(oneDay)));
if (!oneDay) fail.push('a 1-day gap wiped the saved record');

const afterMonth = await afterDaysAway(30);
console.log('after 30 days away      :', JSON.stringify(strengths(afterMonth)), JSON.stringify(bands(afterMonth)));

if (!afterMonth) fail.push('a 30-day gap wiped the saved record');
if (afterMonth) {
  // Decay is capped, so a month away must not be worse than starting over,
  // and must not leave a position stronger than it was practised to.
  for (const [step, v] of Object.entries(afterMonth.p)) {
    if (v[0] < 0) fail.push(`step ${step} decayed to a negative strength (${v[0]})`);
    if (v[2] < 0 || v[2] > 4) fail.push(`step ${step} has an out-of-range band (${v[2]})`);
  }
  // Time away may only ever hand help BACK. A gap that left a position
  // with less support than before would mean a child returning after a
  // week found the game harder than they left it.
  const bandsBefore = bands(practised);
  const bandsAfter = bands(afterMonth);
  for (const [step, band] of Object.entries(bandsAfter)) {
    if (band < bandsBefore[step]) {
      fail.push(`step ${step} lost support across a 30-day gap (band ${bandsBefore[step]} -> ${band})`);
    }
  }
  // ...but it must not erase the history either: peak remembers that the
  // child once knew this, and nothing about being away should raise it.
  for (const [step, v] of Object.entries(afterMonth.p)) {
    const before = practised?.p?.[step];
    if (before && v[1] > before[1] + 1e-6) {
      fail.push(`step ${step} peak grew across a gap (${before[1]} -> ${v[1]})`);
    }
  }
}

// Corrupt record: the game must start fresh, never break.
await page.evaluate(() => localStorage.setItem('wb.learn.v1', '{"v":1,"t":"nonsense","p":{"0":"not-a-tuple"}}'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const survivedGarbage = await page.evaluate(() => window.game.scene.scenes[0].markers.length > 0);
if (!survivedGarbage) fail.push('a corrupt saved record stopped the game from starting');
console.log('corrupt record          : game still starts =', survivedGarbage);

if (errors.length) fail.push('page errors: ' + errors.join(' | '));
console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: time away hands help back without losing the child’s history');
await browser.close();
process.exit(fail.length ? 1 : 0);
