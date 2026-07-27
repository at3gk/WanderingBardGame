/**
 * The bard starts and stops walking without a jolt.
 *
 * Written because nothing in `tools/` had ever looked at the bard's limbs,
 * and the transitions were bad: every state change snapped every limb to
 * neutral on the frame the state changed, then started the new cycle. So
 * stopping slammed his legs shut from mid-stride, and starting teleported a
 * leg straight out to a full 20-degree swing before the first step. The
 * meter crosses the walking threshold often enough that both were visible
 * several times a minute.
 *
 * The assertion is **how long the limbs take to cross**, not how far they
 * move per frame.
 *
 * Per-frame delta was the obvious metric and it is the wrong one. Headless
 * frame times here swing between 25ms and 50ms, and a 150ms eased settle
 * covering 20 degrees can legitimately show a 10-degree step on one slow
 * frame — which is indistinguishable from the snap it exists to catch. Time
 * to traverse is frame-rate independent: a snap crosses from full swing to
 * neutral within a single frame however long that frame is, and an ease
 * cannot cross in less than its own duration no matter how fast the machine.
 */
const pw = await import(`${process.env.PLAYWRIGHT_PATH}/index.js`);
const chromium = pw.chromium ?? pw.default?.chromium;

/**
 * With a 150ms Sine.easeOut, the leg crosses from a full 20-degree swing
 * into the under-4 band at about 88ms, and out of it at about 74ms. A snap
 * does either inside one frame, which is 17ms here. 40 sits clearly between
 * the two and leaves room for sampling granularity.
 */
const MIN_TRANSITION_MS = 40;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.mouse.click(195, 560);
await page.waitForTimeout(800);

/**
 * Samples the bard's pose every animation frame for `ms`, inside the page.
 *
 * `triggerAt`/`setMeterTo` fire the state change from *within* the sample
 * rather than before it. Doing it from Node missed the transition entirely:
 * the settle is only 150ms and a round-trip plus a frame of latency meant
 * sampling began after the legs had already come to rest, so the crossing
 * this check exists to time was never in the data.
 */
const sample = (ms, triggerAt = null, setMeterTo = null, waitForLegOut = false) => page.evaluate(({ duration, triggerAt, setMeterTo, waitForLegOut }) => new Promise((resolve) => {
  const s = window.game.scene.scenes[0];
  const out = [];
  let fired = false;
  const t0 = performance.now();
  const tick = () => {
    const elapsed = performance.now() - t0;
    // Stop him mid-stride on purpose. Firing at a fixed time catches the leg
    // wherever it happens to be, and if that is near neutral there is no
    // crossing left to time — the measurement silently becomes "null" or,
    // worse, picks up an ordinary walk-cycle crossing instead.
    const ready = triggerAt !== null && elapsed >= triggerAt &&
      (!waitForLegOut || Math.abs(s.bardLegLeft.angle) > 17);
    if (!fired && ready) {
      fired = true;
      s.meter = setMeterTo === 'max' ? s.meterConfig.max : setMeterTo;
    }
    out.push({
      t: Math.round(performance.now() - t0),
      left: s.bardLegLeft.angle,
      upperY: s.bardUpper.y,
      scaleY: s.bardUpper.scaleY,
      walking: s.walking,
      fired,
    });
    if (performance.now() - t0 < duration) requestAnimationFrame(tick);
    else resolve(out);
  };
  requestAnimationFrame(tick);
}), { duration: ms, triggerAt, setMeterTo, waitForLegOut });

const fail = [];

/**
 * Hold the meter where this check needs it.
 *
 * Nothing here taps a note, so left alone the meter drains through the
 * walking threshold on its own — which had the bard already stopped before
 * the "stopping" sample began, so the transition being measured was never
 * in the data. Each stage now states the state it starts from.
 */
const setMeter = (to) => page.evaluate((v) => {
  const s = window.game.scene.scenes[0];
  s.meter = v === 'max' ? s.meterConfig.max : v;
}, to);

/**
 * How long the leg took to get from "well out" to "near neutral", or the
 * other way about — scanned only from the frame the state change fired.
 *
 * The scan has to start there. A walking leg passes through neutral twice
 * per stride anyway, so scanning the whole sample measured an ordinary
 * walk-cycle crossing (~131ms) and reported it as the stop. That made the
 * check pass against a build with the settle cut to 1ms, which is precisely
 * the fault it exists to catch.
 */
const crossingMs = (rows, fromOut) => {
  const start = rows.findIndex((r) => r.fired);
  if (start < 0) return null;
  const out = (r) => Math.abs(r.left) > 14;
  const near = (r) => Math.abs(r.left) < 4;
  const [leave, arrive] = fromOut ? [out, near] : [near, out];
  let last = null;
  for (let i = start; i < rows.length; i++) {
    if (leave(rows[i])) last = rows[i].t;
    else if (last !== null && arrive(rows[i])) return rows[i].t - last;
  }
  return null;
};

// --- walking: the legs must actually be swinging ---------------------------
await setMeter('max');
const walk = await sample(1000);
const swing = Math.max(...walk.map((r) => r.left)) - Math.min(...walk.map((r) => r.left));
const frames = walk.length;
console.log(`walking: leg swept ${Math.round(swing)}deg over ${frames} frames ` +
            `(${Math.round(1000 / Math.max(1, frames))}ms/frame)`);
if (!walk.some((r) => r.walking)) fail.push('the bard was not walking to begin with — check the meter');
if (swing < 10) fail.push(`the legs barely moved while walking (${Math.round(swing)}deg) — is the cycle running?`);

// --- stopping: drain the meter mid-stride ----------------------------------
// Set the meter directly rather than missing notes: this is about the pose
// transition, and missing notes would also move the learning model.
await setMeter('max');
await page.waitForTimeout(300);
const stopping = await sample(1600, 300, 0, true);
const stopMs = crossingMs(stopping, true);
console.log('stopping: leg went from stride to rest in', stopMs, 'ms');
if (stopping.every((r) => r.walking)) fail.push('the bard never stopped walking after the meter emptied');
if (stopMs === null) {
  fail.push('the leg never came to rest after the bard stopped');
} else if (stopMs < MIN_TRANSITION_MS) {
  fail.push(`stopping snapped the leg shut in ${stopMs}ms — that is a jolt, not a settle`);
}

// He must settle, not freeze mid-stride.
const settled = stopping.slice(-12);
const restAngle = Math.max(...settled.map((r) => Math.abs(r.left)));
const restBob = Math.max(...settled.map((r) => Math.abs(r.upperY)));
console.log('at rest: leg', Math.round(restAngle * 100) / 100, 'deg, body offset', Math.round(restBob * 100) / 100, 'px');
if (restAngle > 3) fail.push(`the bard rests with his leg ${Math.round(restAngle)}deg out — frozen mid-stride`);
if (restBob > 1.5) fail.push(`the bard rests ${Math.round(restBob)}px off his own feet`);

// --- and he breathes while stopped ----------------------------------------
const idle = await sample(1600);
const breath = Math.max(...idle.map((r) => r.scaleY)) - Math.min(...idle.map((r) => r.scaleY));
console.log('idle breath:', Math.round(breath * 1000) / 1000);
if (breath < 0.005) fail.push('the bard does not breathe while stopped — he is a statue');

// --- starting again: refill the meter mid-rest -----------------------------
await setMeter(0);
await page.waitForTimeout(400);
const starting = await sample(1400, 400, 'max');
const startMs = crossingMs(starting, false);
console.log('starting: leg went from rest to stride in', startMs, 'ms');
if (startMs === null) {
  fail.push('the bard did not start striding again after the meter refilled');
} else if (startMs < MIN_TRANSITION_MS) {
  fail.push(`starting teleported the leg out in ${startMs}ms — that is a jolt, not a step`);
}

if (errs.length) fail.push('page errors: ' + errs.join(' | '));
console.log(fail.length
  ? 'FAIL:\n - ' + fail.join('\n - ')
  : 'PASS: the bard starts, stops and rests without a jolt, and breathes while stopped');
await browser.close();
process.exit(fail.length ? 1 : 0);
