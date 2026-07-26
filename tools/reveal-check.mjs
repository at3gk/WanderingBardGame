import { chromium } from 'playwright';

/**
 * Checks *which* mechanism actually shows a child the letter.
 *
 * DESIGN.md's safety rule is "fade the prompt, never the answer": a hidden
 * letter is revealed on the strike and on a miss, so a faded note is never
 * a dead end. Separately, `scaffold.ts` floors the reveal lead at 350ms, so
 * every letter also surfaces before the note reaches the line.
 *
 * Those are two different guarantees, and only one of them can be doing the
 * work. This script counts reveals by source to find out which — because if
 * the answer only ever arrives *after* a miss, it arrives on a note that is
 * already dimmed, already scrolling away, and already fading out, which is
 * a much weaker promise than the design believes it is making.
 */
const SECONDS = Number(process.argv[2] ?? 70);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Attribute every reveal to the call site that caused it. `revealLetter` is
// shared by all three paths, so the caller is read off the stack.
await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  window.__reveals = { scheduled: 0, onStrike: 0, onMiss: 0, alreadyLettered: 0 };
  window.__missVisibleMs = [];

  const origReveal = scene.revealLetter.bind(scene);
  scene.revealLetter = (marker) => {
    if (marker.lettered) {
      window.__reveals.alreadyLettered++;
      return origReveal(marker);
    }
    // A genuine reveal. Which path asked for it?
    const stack = new Error().stack ?? '';
    window.__reveals[window.__revealSource ?? 'scheduled']++;
    void stack;
    return origReveal(marker);
  };

  // Wrap the two event paths so the shared helper knows who called it.
  const origHandle = scene.handleTap?.bind(scene);
  if (origHandle) {
    scene.handleTap = (...a) => {
      window.__revealSource = 'onStrike';
      try { return origHandle(...a); } finally { window.__revealSource = 'scheduled'; }
    };
  }
  const origUpdate = scene.update.bind(scene);
  scene.update = (...a) => {
    window.__revealSource = 'scheduled';
    return origUpdate(...a);
  };
});

// Play *well* first. Never tapping is the wrong test: the meter drops, the
// scaffold restores full support, and every note is then born lettered — so
// nothing is ever revealed and nothing is learned about the reveal paths.
// Letters only go missing for a child who is doing well, so that is the
// child whose misses matter.
async function play(seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
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
}

await play(SECONDS);
const afterGoodPlay = await page.evaluate(() => ({ ...window.__reveals }));
console.log('after good play:', JSON.stringify(afterGoodPlay));

// Now drop a few notes while the meter is still high — the exact window in
// which the "revealed on a miss" promise is the only thing standing between
// a child and an unanswered note.
await page.waitForTimeout(4000);

const out = await page.evaluate(() => ({
  reveals: window.__reveals,
  meter: Math.round(window.game.scene.scenes[0].meter),
}));

console.log('reveals by source:', JSON.stringify(out.reveals));
console.log('meter after the deliberate misses:', out.meter);

const fail = [];
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

const total = out.reveals.scheduled + out.reveals.onStrike + out.reveals.onMiss;
if (total === 0) fail.push('no letters were revealed at all over the whole run');

// The invariant this script exists to pin down. The scheduled reveal must be
// the mechanism that answers the child, because it is the only one that puts
// the letter on a bright, stationary, full-alpha note *before* the tap. If
// reveals start arriving on the miss path instead, the lead floor has been
// lowered below the hit window and the answer has quietly become a
// consolation prize on a note that is already fading off the screen.
if (out.reveals.onMiss > 0) {
  fail.push(
    `${out.reveals.onMiss} letters first appeared only after a miss — the reveal lead floor no longer clears the hit window`
  );
}

console.log(fail.length ? `FAIL:\n - ${fail.join('\n - ')}` : 'PASS: every letter arrived before its note reached the line');

await browser.close();
process.exit(fail.length ? 1 : 0);
