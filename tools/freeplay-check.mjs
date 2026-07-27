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

// The staff has to be *visible*, not merely present.
//
// Every assertion in this file used to be about behaviour — a tap sounds
// the right note, the walk stops, nothing is graded — and all of them
// passed for a build in which the entire practice staff was drawn at
// alpha 0. It was built, positioned, laid out correctly at every viewport,
// responded to taps, and could not be seen. Two fade-ins ran back to back:
// the first zeroed each part's alpha and tweened it back, the second read
// those alphas on the same frame, captured 0 as the target, and tweened
// 0 to 0.
//
// A mode whose whole purpose is *reading* the staff needs one assertion
// that the staff can be read. Sampled after the 220ms lay-in has finished.
await page.waitForTimeout(500);
const inked = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  const alphas = s.freeParts
    .map((p) => (typeof p.alpha === 'number' ? p.alpha : null))
    .filter((a) => a !== null);
  return {
    parts: alphas.length,
    invisible: alphas.filter((a) => a < 0.05).length,
    brightest: alphas.length ? Math.max(...alphas) : 0,
    distinct: new Set(alphas.map((a) => a.toFixed(2))).size,
  };
});
console.log('staff ink:', JSON.stringify(inked));
if (inked.parts === 0) fail.push('the staff has no parts at all');
if (inked.invisible > 0) {
  fail.push(`${inked.invisible} of ${inked.parts} staff parts are invisible (alpha < 0.05)`);
}
if (inked.brightest < 0.9) {
  fail.push(`the brightest thing on the staff is only alpha ${inked.brightest}`);
}
// The lay-in exists to preserve the staff's hierarchy — line-notes are
// landmarks, the spaces between them are not. One flat alpha would mean
// the fade had flattened what it was written to protect.
if (inked.distinct < 2) fail.push('every staff part has the same alpha — the landmark hierarchy is gone');

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

// --- the tune writes itself out, left to right ----------------------------
// Reading order is not obvious to a beginner. Correct notes are laid across
// the staff in the order they are played, so the phrase accumulates the way
// it would on paper.
const written = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return s.freeWritten.map((n) => Math.round(n.x));
});
console.log('written-out phrase, note x positions:', JSON.stringify(written));
if (written.length < 6) {
  fail.push(`only ${written.length} notes were written out after six correct ones`);
}
for (let i = 1; i < written.length; i++) {
  if (written[i] <= written[i - 1]) {
    fail.push(`the phrase is not laid out left to right (${written[i - 1]} -> ${written[i]})`);
    break;
  }
}
// Note this must be read BEFORE the tune is played to its end: finishing it
// clears the written phrase on purpose, so a check placed after that sees
// an empty staff and reports a bug that is not there. It did, once.

const titled = await page.evaluate(() => {
  const t = window.game.scene.scenes[0].songTitleText;
  return { text: t.text, alpha: Number(t.alpha.toFixed(2)) };
});
console.log('title while practising:', JSON.stringify(titled));
if (titled.text !== 'Mary Had a Little Lamb' || titled.alpha === 0) {
  fail.push('the tune being practised is not named on screen');
}

// Walk-only readouts, and coins that must not tick for sitting still.
const readouts = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { coinVisible: s.coinText.visible, stepsVisible: s.distanceText.visible, coins: Math.floor(s.coins) };
});
console.log('walk readouts while practising:', JSON.stringify(readouts));
if (readouts.coinVisible || readouts.stepsVisible) {
  fail.push('steps/coins are still on screen while the road is stopped');
}

// Play the rest of the tune out, to the end and round again.
const remaining = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return s.freeSequence.length - s.freeIndex;
});
for (let i = 0; i < remaining; i++) {
  const step = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return s.freeSequence[s.freeIndex];
  });
  await page.mouse.click(230, await yFor(step));
  await page.waitForTimeout(90);
}
await page.waitForTimeout(500);
const finished = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { index: s.freeIndex, coins: Math.floor(s.coins) };
});
console.log('after playing the tune to the end:', JSON.stringify(finished));
if (finished.index !== 0) fail.push(`finishing the tune left the cursor at ${finished.index}, not back at the start`);
// The meter keeps whatever value it had on entering, so without gating this
// the child would be paid for sitting still.
if (finished.coins !== readouts.coins) {
  fail.push(`coins moved by ${finished.coins - readouts.coins} while practising`);
}

// Leave the choice as it found it, so the check is repeatable.
await page.evaluate(() => window.game.scene.scenes[0].chooseSong(null));

// --- choosing a song from *inside* free play ------------------------------
// The songbook is reachable from free play, so this is a likely path, and
// it used to do two wrong things at once: leave the staff showing the
// previous song's notes, and queue a pass of road notes that scrolled
// invisibly behind the staff, went missed, drained the meter and fed the
// learning model with misses the child never had a chance at.
await page.evaluate(() => window.game.scene.scenes[0].chooseSong('buns'));
await page.waitForTimeout(500);
const switched = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { choice: s.songChoice, seqLen: s.freeSequence.length, pips: s.freePips.length,
           cursor: !!s.freeCursor, markers: s.markers.length, title: s.songTitleText.text };
});
console.log('switched song from inside free play:', JSON.stringify(switched));
if (!switched.seqLen || !switched.pips || !switched.cursor) {
  fail.push('switching song in free play left the staff showing the old tune');
}
if (switched.markers !== 0) {
  fail.push(`${switched.markers} road notes were queued behind the free-play staff`);
}
if (switched.title !== 'Hot Cross Buns') fail.push(`title still reads "${switched.title}"`);

// --- rotating the phone mid-practice --------------------------------------
// The walk's staff is recomputed every frame and rides a resize for free.
// This one is laid out once from the height available, so after a rotation
// into landscape it was still spread for a portrait screen and the lowest
// notes ran off the bottom, unreachable.
await page.evaluate(() => window.game.scene.scenes[0].chooseSong('mary'));
await page.waitForTimeout(400);
for (let i = 0; i < 3; i++) {
  const step = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return s.freeSequence[s.freeIndex];
  });
  await page.mouse.click(230, await yFor(step));
  await page.waitForTimeout(120);
}
const beforeRotate = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { index: s.freeIndex, gap: Math.round(s.freeStaff.stepGap) };
});
await page.setViewportSize({ width: 664, height: 390 });
await page.waitForTimeout(900);
const afterRotate = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { index: s.freeIndex, gap: Math.round(s.freeStaff.stepGap), h: s.scale.height,
           lowest: Math.round(s.freeStaff.bottomY) };
});
console.log('practice across a rotation:', JSON.stringify({ beforeRotate, afterRotate }));
if (afterRotate.gap === beforeRotate.gap) {
  fail.push('the staff kept its portrait layout in landscape — the low notes are off screen');
}
if (afterRotate.lowest > afterRotate.h) {
  fail.push(`the lowest note sits at y=${afterRotate.lowest} on a ${afterRotate.h}px screen`);
}
// Turning the phone is not starting the tune again.
if (afterRotate.index !== beforeRotate.index) {
  fail.push(`rotation reset practice progress (${beforeRotate.index} -> ${afterRotate.index})`);
}
// And the next note is still findable at the new layout.
const nextStep = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return s.freeSequence[s.freeIndex];
});
await page.mouse.click(330, await yFor(nextStep));
await page.waitForTimeout(200);
const advanced = await page.evaluate(() => window.game.scene.scenes[0].freeIndex);
if (advanced === afterRotate.index) fail.push('could not play the next note after rotating');
await page.setViewportSize({ width: 390, height: 664 });
await page.waitForTimeout(700);
await page.evaluate(() => window.game.scene.scenes[0].chooseSong(null));
await page.waitForTimeout(300);

// --- choosing "wander" from inside free play ------------------------------
// Everything on screen at this point — pips, cursor, the written phrase,
// the title — belongs to a song that is about to stop being chosen.
await page.evaluate(() => window.game.scene.scenes[0].chooseSong(null));
await page.waitForTimeout(500);
const wandering = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { choice: s.songChoice, seq: s.freeSequence.length, pips: s.freePips.length,
           cursor: !!s.freeCursor, written: s.freeWritten.length,
           title: s.songTitleText.text, markers: s.markers.length,
           hint: s.freeHint ? s.freeHint.text : null };
});
console.log('wander from inside free play:', JSON.stringify(wandering));
if (wandering.seq || wandering.pips || wandering.cursor || wandering.written) {
  fail.push('choosing wander left the previous song on the staff');
}
if (wandering.title !== '') fail.push(`the title still names "${wandering.title}" with nothing chosen`);
if (wandering.markers !== 0) fail.push(`${wandering.markers} road notes were queued behind the staff`);
if (wandering.hint !== 'tap a line to hear it') {
  fail.push(`the hint still reads "${wandering.hint}" with no song to follow`);
}

// --- reloading while in free play ------------------------------------------
// The mode is deliberately not persisted — the road is the game, and that is
// where a fresh page should start. The *song* is persisted, though, and the
// road has to actually be running when it comes back.
await page.evaluate(() => window.game.scene.scenes[0].chooseSong('buns'));
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const reloaded = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  return { mode: s.mode, choice: s.songChoice, markers: s.markers.length, biome: s.currentBiomeId() };
});
console.log('reloaded from free play:', JSON.stringify(reloaded));
if (reloaded.mode !== 'walk') fail.push('a reload came back into free play rather than onto the road');
if (reloaded.choice !== 'buns') fail.push('the song choice did not survive a reload from free play');
if (reloaded.markers === 0) fail.push('the road was not running after reloading out of free play');
await page.evaluate(() => window.game.scene.scenes[0].chooseSong(null));
await page.waitForTimeout(300);
// Re-enter, since the checks below expect to be in free play.
await page.mouse.click(124, 24);
await page.waitForTimeout(500);

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
