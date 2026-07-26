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
 * The two input paths nothing else touches: the mute toggle and the
 * keyboard.
 *
 * Every other harness taps the middle of the canvas. That exercises the one
 * core mechanic and nothing else, so a broken mute button or a dead
 * spacebar would go unnoticed indefinitely — and mute in particular is the
 * control a parent reaches for, in a game aimed at a five-year-old.
 *
 * Checks that muting actually silences the output rather than just changing
 * the icon, that tapping mute is never counted as a beat (it sits over the
 * playfield, so a stray press must not cost the child a note), that
 * unmuting restores sound, and that the spacebar plays.
 */
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const state = () => page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return {
    muted: s.audioEngine.isMuted,
    slashVisible: s.muteSlash.visible,
    // The master gain is what actually reaches the speakers. The icon can
    // lie; this cannot.
    masterGain: s.audioEngine.masterGain ? s.audioEngine.masterGain.gain.value : null,
    meter: Math.round(s.meter),
    coins: Math.floor(s.coins),
    started: s.audioEngine.isStarted,
  };
});

const fail = [];
const muteXY = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  // Count beats as they are scored, so "did pressing mute cost a note?" can
  // be answered directly. Watching the meter across the press was the first
  // version and it is flaky: notes keep arriving, so a beat can be missed
  // purely because time passed between the two readings. It passed by luck
  // once and then failed on a game that was fine.
  window.__enc = { hit: 0, miss: 0 };
  const orig = s.recordEncounter.bind(s);
  s.recordEncounter = (step, outcome, walking) => { window.__enc[outcome]++; return orig(step, outcome, walking); };
  return { x: Math.round(s.muteZone.x), y: Math.round(s.muteZone.y) };
});

// Start audio with a normal tap, away from the mute zone.
await page.mouse.click(600, 500);
await page.waitForTimeout(900);
const playing = await state();
console.log('after first tap  :', JSON.stringify(playing));
if (!playing.started) fail.push('audio never started from a tap');

// Mute. Gain ramps over ~50ms, so give it a moment.
const hitsBeforeMute = await page.evaluate(() => window.__enc.hit);
await page.mouse.click(muteXY.x, muteXY.y);
await page.waitForTimeout(400);
const muted = await state();
console.log('after mute tap   :', JSON.stringify(muted));
if (!muted.muted) fail.push('tapping the mute zone did not mute');
if (!muted.slashVisible) fail.push('muted, but the slash through the icon is not shown');
if (muted.masterGain !== 0) fail.push(`muted, but master gain is ${muted.masterGain} — the icon changed and the sound did not`);
// The mute button sits over the playfield. Pressing it must not be scored
// as a beat — checked on the scoring path itself, not on the meter, which
// moves on its own as unplayed notes go by.
const hitsAfterMute = await page.evaluate(() => window.__enc.hit);
if (hitsAfterMute > hitsBeforeMute) {
  fail.push(`pressing mute registered ${hitsAfterMute - hitsBeforeMute} beat(s) — the button is being scored`);
}

// Notes keep flowing while muted; the game must not stall.
await page.waitForTimeout(2500);
const whileMuted = await state();
if (whileMuted.coins <= muted.coins) fail.push('the walk stopped earning while muted');

// Unmute.
await page.mouse.click(muteXY.x, muteXY.y);
await page.waitForTimeout(400);
const unmuted = await state();
console.log('after unmute tap :', JSON.stringify(unmuted));
if (unmuted.muted) fail.push('tapping mute a second time did not unmute');
if (unmuted.slashVisible) fail.push('unmuted, but the slash is still shown');
if (unmuted.masterGain !== 1) fail.push(`unmuted, but master gain is ${unmuted.masterGain}`);

// Keyboard: space must play a beat, exactly like a tap.
const before = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  window.__kb = { hit: 0, miss: 0 };
  const orig = s.recordEncounter.bind(s);
  s.recordEncounter = (step, outcome, walking) => { window.__kb[outcome]++; return orig(step, outcome, walking); };
  return true;
});
void before;
await page.evaluate(() => window.game.canvas.focus());
for (let i = 0; i < 40; i++) {
  const waitMs = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    const now = s.time.now - s.startTimeMs;
    const next = s.markers.find((m) => m.resolved === null && m.beat.hitTimeMs > now - 40);
    return next ? next.beat.hitTimeMs - now : 50;
  });
  if (waitMs > 400) { await page.waitForTimeout(400); continue; }
  if (waitMs > 2) await page.waitForTimeout(waitMs);
  await page.keyboard.press('Space');
}
const kb = await page.evaluate(() => window.__kb);
console.log('spacebar         :', JSON.stringify(kb));
if (kb.hit === 0) fail.push('the spacebar never landed a beat — keyboard play is broken');

if (errors.length) fail.push('page errors: ' + errors.join(' | '));
console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: mute silences the output and costs no beat; the spacebar plays');
await browser.close();
process.exit(fail.length ? 1 : 0);
