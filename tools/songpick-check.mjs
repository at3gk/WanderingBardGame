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
 * Choosing one song to learn, checked as a player experiences it.
 *
 * Unit tests cover which song a pass resolves to. What they cannot cover is
 * everything around the button: that the picker swallows taps instead of
 * playing notes through itself, that the chosen tune starts *promptly*
 * rather than after the previous one finishes, that the road settles in
 * that song's biome, and that the choice is still there tomorrow.
 */
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const fail = [];
const state = () => page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return {
    choice: s.songChoice,
    open: s.pickerOpen,
    song: s.currentSongId,
    biome: s.currentBiomeId(),
    meter: Math.round(s.meter),
    saved: localStorage.getItem('wb.learn.v1'),
  };
});

// Track every tune that actually starts playing, so "it repeats" is
// observed rather than inferred from the chosen id.
await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  window.__played = [];
  const orig = s.announceSong.bind(s);
  s.announceSong = (song) => {
    if (window.__played[window.__played.length - 1] !== song.id) window.__played.push(song.id);
    return orig(song);
  };
  window.__enc = { hit: 0, miss: 0 };
  const rec = s.recordEncounter.bind(s);
  s.recordEncounter = (step, outcome, walking) => { window.__enc[outcome]++; return rec(step, outcome, walking); };
});

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
    await page.mouse.click(195, 430);
  }
}

// --- the picker swallows taps ---------------------------------------------
await play(8);
await page.mouse.click(79, 24); // songbook button, beside mute
await page.waitForTimeout(400);
const opened = await state();
if (!opened.open) fail.push('the songbook button did not open the picker');

const encBefore = await page.evaluate(() => ({ ...window.__enc }));
// Poke around the panel the way a child would, for longer than a note takes
// to cross the line. None of it may reach the lane.
for (let i = 0; i < 25; i++) {
  await page.mouse.click(195, 120 + (i % 8) * 40);
  await page.waitForTimeout(60);
}
const stillOpen = await page.evaluate(() => window.game.scene.scenes[0].pickerOpen);
const encAfter = await page.evaluate(() => ({ ...window.__enc }));
console.log('encounters while poking the picker:', JSON.stringify({ before: encBefore, after: encAfter }));
if (encAfter.miss > encBefore.miss) {
  fail.push(`${encAfter.miss - encBefore.miss} misses were charged while the picker was open`);
}
if (encAfter.hit > encBefore.hit) {
  fail.push('taps reached the lane through the picker');
}
void stillOpen;

// --- choosing a song ------------------------------------------------------
// Pick a riverside tune from a village start, so biome pinning is visible.
const chose = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  s.chooseSong('spider');
  s.closePicker();
  return s.songChoice;
});
if (chose !== 'spider') fail.push(`choosing did not stick (got ${chose})`);

await page.evaluate(() => { window.__played.length = 0; });
await play(6);
const soonAfter = await state();
console.log('6s after choosing:', JSON.stringify({ song: soonAfter.song, biome: soonAfter.biome }));
// Promptness is the point: a child who presses a button should not wait out
// the previous tune. One song is ~20-35s, so anything still playing the old
// one here means cancellation did not happen.
if (soonAfter.song !== 'spider') {
  fail.push(`chosen song had not started 6s later (playing ${soonAfter.song}) — pending audio was not cancelled`);
}
if (soonAfter.biome !== 'riverside') {
  fail.push(`road did not settle in the song's home biome (in ${soonAfter.biome})`);
}

// --- and it repeats -------------------------------------------------------
await play(80);
const played = await page.evaluate(() => window.__played.slice());
console.log('tunes played after choosing:', played.join(' -> ') || '(none)');
const others = played.filter((id) => id !== 'spider');
if (others.length) fail.push(`rotation continued after choosing: ${others.join(', ')}`);
if (!played.length) fail.push('no song was announced at all after choosing');

const afterPlay = await state();
if (afterPlay.biome !== 'riverside') fail.push(`biome drifted to ${afterPlay.biome} during a long walk`);
if (!afterPlay.saved || !JSON.parse(afterPlay.saved).s) fail.push('the choice was never written to storage');

// --- it survives coming back ----------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const reloaded = await state();
console.log('after reload:', JSON.stringify({ choice: reloaded.choice, biome: reloaded.biome }));
if (reloaded.choice !== 'spider') fail.push(`the choice did not survive a reload (got ${reloaded.choice})`);
if (reloaded.biome !== 'riverside') fail.push('the road did not come back to the chosen song\'s biome');

// --- and can be given back ------------------------------------------------
await page.evaluate(() => { window.__played = []; const s = window.game.scene.scenes[0];
  const orig = s.announceSong.bind(s);
  s.announceSong = (song) => { if (window.__played[window.__played.length - 1] !== song.id) window.__played.push(song.id); return orig(song); };
  s.chooseSong(null);
});
await play(70);
const wandered = await page.evaluate(() => window.__played.slice());
console.log('tunes after choosing to wander:', wandered.join(' -> ') || '(none)');
if (new Set(wandered).size < 2) fail.push('wander did not restore the rotation');

if (errors.length) fail.push('page errors: ' + errors.join(' | '));
console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: a chosen song starts promptly, repeats, settles the road, and is remembered');
await browser.close();
process.exit(fail.length ? 1 : 0);
