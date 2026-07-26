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
 * Proves the learning model actually works in the running game, which unit
 * tests cannot: it plays well for a while and checks the letters FADE, then
 * deliberately stops playing and checks they COME BACK.
 *
 * It measures the only thing that matters to a child: `leadMs` — how long
 * before the hit line a note's letter becomes readable. 1800 = present for
 * the whole flight (full help). 0 = never arrives before the tap.
 *
 * autoplay.mjs is a perfect player and can only ever demonstrate the fade
 * half of the loop; the stop-playing phase here is the other half, and it
 * is the accessibility mechanism, so it is the half worth testing hardest.
 */
const PLAY_SECONDS = Number(process.argv[2] ?? 100);
const SULK_SECONDS = Number(process.argv[3] ?? 25);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// Watch every marker as it spawns and record the lead time it was given.
await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  window.__lead = [];
  setInterval(() => {
    const now = scene.time.now - scene.startTimeMs;
    for (const m of scene.markers) {
      if (m.gfx && m.revealAtMs !== undefined && !m.__seen) {
        m.__seen = true;
        window.__lead.push({
          t: Math.round(now),
          step: m.step,
          leadMs: Math.round(m.beat.hitTimeMs - m.revealAtMs),
          lettered: !!m.lettered,
          firstInPass: !!m.firstInPass,
        });
      }
    }
  }, 60);
});

async function play(seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    const waitMs = await page.evaluate(() => {
      const scene = window.game.scene.scenes[0];
      const now = scene.time.now - scene.startTimeMs;
      const next = scene.markers.find((m) => m.resolved === null && m.beat.hitTimeMs > now - 40);
      return next ? next.beat.hitTimeMs - now : 50;
    });
    // Only tap when a note is actually due — see autoplay.mjs. Tapping at
    // the end of every wait slice models a masher, not a player, and here
    // that would be worse than cosmetic: this script's whole claim is about
    // what *good* play does to the scaffold.
    if (waitMs > 400) {
      await page.waitForTimeout(400);
      continue;
    }
    if (waitMs > 2) await page.waitForTimeout(waitMs);
    await page.mouse.click(600, 520);
  }
}

console.log(`playing well for ${PLAY_SECONDS}s...`);
await play(PLAY_SECONDS);
const afterPlay = await page.evaluate(() => window.__lead.slice());

console.log(`now doing nothing for ${SULK_SECONDS}s (letters should come back)...`);
await page.waitForTimeout(SULK_SECONDS * 1000);
// Play again briefly so fresh markers spawn and reveal the restored support.
await play(12);
const afterSulk = await page.evaluate(() => window.__lead.slice());

const finalMeter = await page.evaluate(() => Math.round(window.game.scene.scenes[0].meter));

// --- analysis -------------------------------------------------------------
const repeats = (rows) => rows.filter((r) => !r.firstInPass);
const bestLeadByStep = (rows) => {
  const best = {};
  for (const r of repeats(rows)) best[r.step] = Math.min(best[r.step] ?? Infinity, r.leadMs);
  return best;
};

const playRows = afterPlay;
const sulkRows = afterSulk.slice(afterPlay.length);

const fadedDuring = bestLeadByStep(playRows);
const faded = Object.entries(fadedDuring).filter(([, lead]) => lead < 1800);
const bare = repeats(playRows).filter((r) => !r.lettered).length;

// After a stretch of misses, newly spawned repeats should carry more help
// than the most-faded state reached during good play.
const recoveredLeads = repeats(sulkRows).map((r) => r.leadMs);
const minDuringPlay = Math.min(...repeats(playRows).map((r) => r.leadMs), Infinity);
const maxAfterSulk = recoveredLeads.length ? Math.max(...recoveredLeads) : -1;

const fail = [];
if (!playRows.length) fail.push('no markers observed at all');
if (!faded.length) fail.push('no staff position ever faded — the scaffold never withdrew');
if (!bare) fail.push('no note ever spawned without its letter — the child was never asked to recall');
if (repeats(playRows).filter((r) => r.lettered).length === 0) {
  fail.push('every repeat was letterless — help was withdrawn too aggressively');
}
if (playRows.filter((r) => r.firstInPass && r.leadMs < 1800).length > playRows.filter((r) => r.firstInPass).length * 0.5) {
  fail.push('first sighting in a pass lost its letter too often — the per-tune anchor is not holding');
}
if (maxAfterSulk <= minDuringPlay) fail.push(`letters did not come back after a bad stretch (min during play ${minDuringPlay}, max after ${maxAfterSulk})`);
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

console.log('\nmarkers observed:', playRows.length, '(+', sulkRows.length, 'after the bad stretch)');
console.log('letterless repeats during good play:', bare);
console.log('best (lowest) lead time reached per step:', JSON.stringify(fadedDuring));
console.log('min lead during play:', minDuringPlay, '-> max lead after the bad stretch:', maxAfterSulk);
console.log('meter after doing nothing:', finalMeter);
console.log(fail.length ? `FAIL:\n - ${fail.join('\n - ')}` : 'PASS: letters faded with practice and came back after struggling');

await browser.close();
process.exit(fail.length ? 1 : 0);
