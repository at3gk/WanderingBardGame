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
 * What happens when a phone gets put down: app switch, screen lock, an
 * incoming call. Mobile browsers suspend the AudioContext, and without a
 * resume the game keeps playing in silence forever — which for a game whose
 * entire teaching premise is "the tune you already know carries you" is a
 * quiet, total failure.
 *
 * PLAYTEST.md has carried this as a *human* item ("audio resume after
 * backgrounding") since round 1. It does not need to be: the suspend can be
 * forced directly and the resume observed. What still needs a real device is
 * whether iOS suspends in ways Chromium does not — this narrows that
 * question rather than answering all of it.
 *
 * Also checks the other half of the handler: going away force-saves the
 * child's learning progress, since leaving may be the last chance to write.
 */
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

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
    await page.mouse.click(600, 500);
  }
}

// Read the AudioEngine's OWN context, not whichever one happens to be
// first. Phaser's sound manager used to create a second, unused
// AudioContext, and an earlier version of this check grabbed that one —
// then watched Phaser resume it and concluded the game had failed to
// suspend. (That context is disabled now, but reaching for the engine's own
// is still the correct thing to do rather than a lucky one.)
const audioState = () =>
  page.evaluate(() => {
    const ctx = window.game.scene.scenes[0].audioEngine.context;
    return ctx ? ctx.state : null;
  });

await play(25);
const beforeState = await audioState();
await page.evaluate(() => localStorage.removeItem('wb.learn.v1'));
const wipedBefore = await page.evaluate(() => localStorage.getItem('wb.learn.v1'));

// Go away: hide the document exactly as a backgrounded tab does, and
// suspend the context the way a mobile browser would.
await page.evaluate(async () => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await window.game.scene.scenes[0].audioEngine.context.suspend();
});
await page.waitForTimeout(600);
const hiddenState = await audioState();
const savedOnLeave = await page.evaluate(() => localStorage.getItem('wb.learn.v1'));

// Come back.
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(900);
const backState = await audioState();

// And prove it is not merely "running" but actually sounding again.
const oscBefore = await page.evaluate(() => {
  window.__after = 0;
  const oc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { window.__after++; return oc.call(this); };
  return 0;
});
void oscBefore;
await play(20);
const after = await page.evaluate(() => ({ osc: window.__after, meter: Math.round(window.game.scene.scenes[0].meter) }));

console.log(`audio state: ${beforeState} -> hidden:${hiddenState} -> back:${backState}`);
console.log(`storage on leaving: ${wipedBefore === null ? 'was wiped, ' : ''}after hide = ${savedOnLeave ? 'written' : 'NOT written'}`);
console.log(`after returning: ${after.osc} oscillators over 20s of play, meter ${after.meter}`);

const fail = [];
if (errors.length) fail.push('page errors: ' + errors.join(' | '));
if (beforeState !== 'running') fail.push(`audio was not running before backgrounding (${beforeState})`);
if (hiddenState !== 'suspended') fail.push(`the context did not suspend, so the resume path was never exercised (${hiddenState})`);
if (backState !== 'running') fail.push(`audio did NOT resume on returning (${backState}) — the game would play in silence forever`);
if (!savedOnLeave) fail.push('leaving did not force-save the learning record — a child who app-switches loses the sitting');
if (after.osc === 0) fail.push('no sound was scheduled after returning');
if (after.meter < 50) fail.push(`the walk did not recover after returning (meter ${after.meter})`);

console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: backgrounding saves progress and coming back restores the sound');
await browser.close();
process.exit(fail.length ? 1 : 0);
