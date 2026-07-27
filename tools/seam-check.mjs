/**
 * Cross-surface seams — the places two features meet.
 *
 * Every real defect in the last two sessions lived in a seam rather than in
 * a feature. Choosing a song *from inside free play* left a stale staff and
 * queued phantom road notes. Rotating the phone *while practising* left the
 * staff spread for the old screen. The practice staff's fade-in met the
 * one already inside its builder and cancelled it to nothing. Each surface
 * worked perfectly alone, every time.
 *
 * So this file does not test features. It tests pairs. The three here were
 * all correct when first probed, which is the point of writing them down —
 * the seams are the part that keeps breaking, so they are the part worth
 * holding still.
 *
 *   1. mute      x practice   — silence must cost nothing but sound
 *   2. tab-away  x practice   — coming back must not lose the tune
 *   3. rotation  x the ground — the newest plane must follow the screen
 */
const pw = await import(`${process.env.PLAYWRIGHT_PATH}/index.js`);
const chromium = pw.chromium ?? pw.default?.chromium;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

const fails = [];
const note = (msg) => console.log(msg);

const enterPractice = async (page, w, h) => {
  await page.mouse.click(Math.round(w / 2), Math.round(h * 0.82));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.game.scene.scenes[0].chooseSong('mary'));
  await page.waitForTimeout(500);
  await page.mouse.click(122, 24); // the lute button
  await page.waitForTimeout(900);
};

/** Taps whichever position the tune is asking for next. */
const tapNext = async (page, x) => {
  const p = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { step: s.freeSequence[s.freeIndex], bottomY: s.freeStaff.bottomY, gap: s.freeStaff.stepGap };
  });
  await page.mouse.click(x, Math.round(p.bottomY - p.step * p.gap));
  await page.waitForTimeout(180);
};

/**
 * Staff parts that cannot be seen.
 *
 * Excludes the opening hint, which is *supposed* to disappear the moment
 * the child plays their first note — it fades to nothing and is destroyed,
 * but stays in `freeParts` because that array is a teardown list rather
 * than a display list. Counting it reported a bug that was the check's own
 * assumption.
 */
const invisibleParts = (page) => page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return s.freeParts
    .filter((p) => typeof p.alpha === 'number' && p.alpha < 0.05 && p.active !== false)
    .map((p) => p.type + (p.text ? `:${p.text}` : ''));
});

// --- 1. mute x practice ----------------------------------------------------
// Muting is an output concern. It must not cost a beat on the road (which
// input-check covers) and it must not cost progress through a tune either.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await enterPractice(page, 390, 664);
  await page.mouse.click(34, 24); // mute
  await page.waitForTimeout(300);

  const read = () => page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { muted: s.audioEngine.isMuted, gain: s.audioEngine.masterGain?.gain.value ?? null, idx: s.freeIndex };
  });
  const before = await read();
  await tapNext(page, 300);
  await tapNext(page, 300);
  const after = await read();
  note(`mute x practice: ${JSON.stringify({ before, after })}`);

  if (!after.muted) fails.push('practice quietly unmuted the game');
  if (after.gain === null || after.gain > 0.01) {
    fails.push(`master gain is ${after.gain} while muted — practice notes are audible`);
  }
  if (after.idx <= before.idx) {
    fails.push('a muted practice tap did not advance the tune — mute cost progress, not just sound');
  }
  if (errs.length) fails.push('mute x practice page errors: ' + errs.join(' | '));
  await page.close();
}

// --- 2. backgrounding x practice ------------------------------------------
// A child putting the phone down mid-tune and coming back must find the
// tune where they left it, and a staff they can still see.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await enterPractice(page, 390, 664);
  await tapNext(page, 300);
  await tapNext(page, 300);

  const pre = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { mode: s.mode, idx: s.freeIndex, parts: s.freeParts.length, written: s.freeWritten.length };
  });

  const setHidden = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

  await setHidden(true);
  await page.waitForTimeout(1500);
  await setHidden(false);
  await page.waitForTimeout(900);

  const post = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { mode: s.mode, idx: s.freeIndex, parts: s.freeParts.length, written: s.freeWritten.length,
             scrim: !!s.freeScrim && s.freeScrim.visible };
  });
  const blind = await invisibleParts(page);
  note(`tab-away x practice: ${JSON.stringify({ pre, post, invisible: blind })}`);

  if (post.mode !== 'play') fails.push(`backgrounding kicked practice back to ${post.mode}`);
  if (post.idx !== pre.idx) fails.push(`backgrounding moved the tune from note ${pre.idx} to ${post.idx}`);
  if (post.written !== pre.written) fails.push('backgrounding changed the written phrase');
  if (blind.length) fails.push(`came back with invisible staff parts: ${blind.join(', ')}`);
  if (!post.scrim) fails.push('the practice scrim did not come back after backgrounding');

  await tapNext(page, 300);
  const advanced = await page.evaluate(() => window.game.scene.scenes[0].freeIndex);
  if (advanced === post.idx) fails.push('practice stopped responding to taps after backgrounding');
  if (errs.length) fails.push('backgrounding page errors: ' + errs.join(' | '));
  await page.close();
}

// --- 3. rotation x the ground ---------------------------------------------
// The near band is the newest plane and the only one sized from the bottom
// edge, so it is the one most likely to be left behind by a rotation.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.mouse.click(195, 545);
  await page.waitForTimeout(1200);

  const read = () => page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    const box = (o) => ({
      w: Math.round(o.displayWidth ?? o.width),
      top: Math.round(o.y - (o.displayHeight ?? o.height) / 2),
      bot: Math.round(o.y + (o.displayHeight ?? o.height) / 2),
    });
    return { W: s.scale.width, H: s.scale.height, near: box(s.near), road: box(s.road) };
  });

  const seen = [];
  seen.push(['portrait', await read()]);
  await page.setViewportSize({ width: 664, height: 390 });
  await page.waitForTimeout(1000);
  seen.push(['landscape', await read()]);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(1000);
  seen.push(['back to portrait', await read()]);

  for (const [name, v] of seen) {
    note(`${name}: ${v.W}x${v.H} road ${v.road.top}-${v.road.bot}, ground ${v.near.top}-${v.near.bot}`);
    if (v.near.w !== v.W) fails.push(`${name}: ground is ${v.near.w}px wide on a ${v.W}px screen`);
    if (v.near.top > v.road.bot + 2) {
      fails.push(`${name}: ${v.near.top - v.road.bot}px of sky showing between the road and the ground`);
    }
    if (v.near.bot < v.H) fails.push(`${name}: the ground stops ${v.H - v.near.bot}px short of the bottom`);
  }
  if (errs.length) fails.push('rotation page errors: ' + errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(fails.length
  ? 'FAIL:\n - ' + fails.join('\n - ')
  : 'PASS: mute costs only sound, tab-away keeps the tune, and the ground follows the screen');
process.exit(fails.length ? 1 : 0);
