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
 * Free play: the staff as an instrument.
 *
 * The thing worth checking is not that the mode opens — it is that
 * pointing at a line or a space plays *that note*. So this taps every one
 * of the thirteen positions in turn and listens: the pitches must come out
 * as thirteen distinct, ascending, in-tune naturals matching what the
 * labels say. A ladder that sounds wrong teaches the wrong thing far more
 * effectively than one that looks wrong.
 */
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// Record every pitch the engine sounds, before boot.
await page.addInitScript(() => {
  window.__heard = [];
  const orig = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    const osc = orig.call(this);
    const start = osc.start.bind(osc);
    osc.start = (when) => { window.__heard.push(osc.frequency.value); return start(when); };
    return osc;
  };
});

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.mouse.click(195, 500); // first gesture unlocks audio
await page.waitForTimeout(400);

await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  window.__enc = { hit: 0, miss: 0 };
  const rec = s.recordEncounter.bind(s);
  s.recordEncounter = (step, outcome, walking) => { window.__enc[outcome]++; return rec(step, outcome, walking); };
});

const fail = [];

// --- entering -------------------------------------------------------------
await page.mouse.click(124, 24); // the lute button
await page.waitForTimeout(400);
const entered = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { mode: s.mode, walking: s.walking, markers: s.markers.length, gap: s.freeStaff?.stepGap ?? null,
           clefVisible: s.clef.visible, hitLineVisible: s.hitLine.visible };
});
console.log('entered free play:', JSON.stringify({ ...entered, gap: Math.round(entered.gap) }));
if (entered.mode !== 'play') fail.push('the lute button did not enter free play');
if (entered.markers !== 0) fail.push(`${entered.markers} notes were left scrolling into a stationary staff`);
if (entered.walking) fail.push('the bard kept walking while there was no beat to keep');
if (entered.clefVisible || entered.hitLineVisible) fail.push('the walk chrome is still drawn behind the big staff');
// A finger covers about 40px. During the walk the steps are 9px apart,
// which is the entire reason this mode has its own geometry.
if (!(entered.gap >= 26)) fail.push(`step gap is only ${Math.round(entered.gap)}px — too small to aim at`);

// --- every position sounds its own note -----------------------------------
// Ask the scene where it actually put the steps, rather than recomputing
// the layout here — a check that re-derives the thing it is checking will
// agree with itself no matter how wrong both are.
const probe = await page.evaluate(() => {
  const staff = window.game.scene.scenes[0].freeStaff;
  return { bottomY: staff.bottomY, stepGap: staff.stepGap };
});

await page.evaluate(() => { window.__heard.length = 0; });
const played = [];
for (let step = 0; step <= 12; step++) {
  const y = Math.round(probe.bottomY - step * probe.stepGap);
  await page.evaluate(() => { window.__heard.length = 0; });
  await page.mouse.click(220, y);
  await page.waitForTimeout(160);
  const heard = await page.evaluate(() => window.__heard.slice());
  played.push({ step, y, hz: heard.length ? heard[heard.length - 1] : null });
}

// Free play plucks the written note an octave up (AudioEngine.pluck), so
// compare against that, in semitones from middle C.
const NAMES = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B'];
const semis = played.map((p) => (p.hz === null ? null : Math.round(12 * Math.log2(p.hz / 261.63))));
console.log('semitones heard, step 0..12:', JSON.stringify(semis));
const names = semis.map((n) => (n === null ? '-' : NAMES[((n % 12) + 12) % 12] ?? '?'));
console.log('as note names:', names.join(' '));

if (played.some((p) => p.hz === null)) fail.push('a position on the staff made no sound at all');
if (names.includes('?')) fail.push(`an accidental was sounded: ${names.join(' ')}`);
// Thirteen steps, strictly ascending, each exactly one natural above the
// last: C D E F G A B C D E F G A.
const EXPECTED = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'];
if (names.join(' ') !== EXPECTED.join(' ')) {
  fail.push(`the ladder does not read up the scale:\n     got ${names.join(' ')}\n     want ${EXPECTED.join(' ')}`);
}
for (let i = 1; i < semis.length; i++) {
  if (semis[i] !== null && semis[i - 1] !== null && semis[i] <= semis[i - 1]) {
    fail.push(`step ${i} is not higher than step ${i - 1} (${semis[i - 1]} -> ${semis[i]})`);
    break;
  }
}

// --- exploring is not evidence -------------------------------------------
const enc = await page.evaluate(() => ({ ...window.__enc }));
console.log('encounters recorded by exploring:', JSON.stringify(enc));
if (enc.hit || enc.miss) {
  fail.push('free play fed the learning model — a note the child picked is not evidence they can read one the game picked');
}

// --- practice: the chosen song, one note at a time ------------------------
// With a song chosen, free play stops being a ladder and becomes practice.
// The rule that makes it practice rather than a test is that a wrong note
// sounds and costs nothing — you simply have not moved on.
await page.mouse.click(124, 24); // back to the road so the choice can be made
await page.waitForTimeout(400);
await page.evaluate(() => window.game.scene.scenes[0].chooseSong('mary'));
await page.waitForTimeout(400);
await page.mouse.click(124, 24); // and into practice
await page.waitForTimeout(600);

const yFor = (step) =>
  page.evaluate((st) => {
    const s = window.game.scene.scenes[0];
    return Math.round(s.freeStaff.bottomY - st * s.freeStaff.stepGap);
  }, step);

const seq = await page.evaluate(() => window.game.scene.scenes[0].freeSequence.slice(0, 7));
console.log('Mary as positions to find:', JSON.stringify(seq));
// E D C D E E E — the opening of the tune, as staff steps.
if (JSON.stringify(seq) !== JSON.stringify([2, 1, 0, 1, 2, 2, 2])) {
  fail.push(`practice sequence is not the tune: ${JSON.stringify(seq)}`);
}

const wrongStep = seq[0] === 5 ? 6 : 5;
await page.mouse.click(230, await yFor(wrongStep));
await page.waitForTimeout(180);
const afterWrong = await page.evaluate(() => window.game.scene.scenes[0].freeIndex);
if (afterWrong !== 0) fail.push(`a wrong note advanced the tune (index ${afterWrong})`);

for (let i = 0; i < 6; i++) {
  const step = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return s.freeSequence[s.freeIndex];
  });
  await page.mouse.click(230, await yFor(step));
  await page.waitForTimeout(140);
}
const afterSix = await page.evaluate(() => window.game.scene.scenes[0].freeIndex);
console.log('index after one wrong note then six right ones:', afterSix);
if (afterSix !== 6) fail.push(`six correct notes advanced to ${afterSix}, expected 6`);

const titled = await page.evaluate(() => {
  const t = window.game.scene.scenes[0].songTitleText;
  return { text: t.text, alpha: Number(t.alpha.toFixed(2)) };
});
console.log('title while practising:', JSON.stringify(titled));
if (titled.text !== 'Mary Had a Little Lamb' || titled.alpha === 0) {
  fail.push('the tune being practised is not named on screen');
}

// Leave the choice as it found it, so the check is repeatable.
await page.evaluate(() => window.game.scene.scenes[0].chooseSong(null));

// --- and back to the road -------------------------------------------------
await page.mouse.click(124, 24);
await page.waitForTimeout(2600);
const back = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { mode: s.mode, markers: s.markers.length, clefVisible: s.clef.visible };
});
console.log('back on the road:', JSON.stringify(back));
if (back.mode !== 'walk') fail.push('could not get back out of free play');
if (back.markers === 0) fail.push('the road did not resume — no notes are coming');
if (!back.clefVisible) fail.push('the walk chrome did not come back');

if (errors.length) fail.push('page errors: ' + errors.join(' | '));
console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: every position on the staff plays its own note, and exploring is not graded');
await browser.close();
process.exit(fail.length ? 1 : 0);
