import { chromium } from 'playwright';

/**
 * Plays the game by itself and checks both what happened and what was
 * heard. Two instruments:
 *   - every oscillator the AudioEngine creates is recorded (pitch + time),
 *     so the sounded performance can be compared against the written song;
 *   - a rAF loop dispatches real pointerdown events on the canvas at each
 *     note's hit time, so input goes through Phaser's normal plumbing.
 */
const SECONDS = Number(process.argv[2] ?? 60);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

// Record every scheduled oscillator before the game boots.
await page.addInitScript(() => {
  window.__notes = [];
  const origCreate = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    const osc = origCreate.call(this);
    const origStart = osc.start.bind(osc);
    osc.start = (when) => {
      window.__notes.push({ hz: osc.frequency.value, when, type: osc.type });
      return origStart(when);
    };
    return osc;
  };
});

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Autoplay: real trusted input (synthetic PointerEvents don't reach
// Phaser's input manager). Ask the page how long until the next unresolved
// note is due, wait that long, click.
let taps = 0;
const deadline = Date.now() + SECONDS * 1000;
const samples = [];
let nextSampleAt = Date.now() + 10_000;

while (Date.now() < deadline) {
  const waitMs = await page.evaluate(() => {
    const scene = window.game.scene.scenes[0];
    const now = scene.time.now - scene.startTimeMs;
    const next = scene.markers.find((m) => m.resolved === null && m.beat.hitTimeMs > now - 40);
    return next ? next.beat.hitTimeMs - now : 50;
  });
  if (waitMs > 2) await page.waitForTimeout(Math.min(waitMs, 400));
  await page.mouse.click(600, 520);
  taps++;

  if (Date.now() >= nextSampleAt) {
    nextSampleAt += 10_000;
    samples.push(await page.evaluate(() => {
    const scene = window.game.scene.scenes[0];
    return {
      t: Math.round((scene.time.now - scene.startTimeMs) / 1000),
      meter: Math.round(scene.meter),
      coins: Math.floor(scene.coins),
      steps: Math.floor(scene.distancePx / 64),
      liveMarkers: scene.markers.length,
      textures: scene.textures.list ? Object.keys(scene.textures.list).length : -1,
      fps: Math.round(window.game.loop.actualFps),
      song: scene.currentSongId,
    };
    }));
  }
}

const result = await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  const hits = scene.markers.filter((m) => m.resolved === 'hit').length;
  const misses = scene.markers.filter((m) => m.resolved === 'miss').length;
  return { hits, misses, notes: window.__notes.slice(0, 400), total: window.__notes.length };
});
result.taps = taps;

// --- assertions -----------------------------------------------------------
const fail = [];
const last = samples[samples.length - 1];
if (last.meter < 90) fail.push(`meter dropped to ${last.meter} under perfect play`);
// One road tile per beat at 96 BPM = 1.6 steps/sec while walking; allow
// for the first note's runway and any warm-up misses.
if (last.steps < SECONDS * 1.2) fail.push(`only ${last.steps} steps walked in ${SECONDS}s`);
if (last.coins < SECONDS * 2) fail.push(`only ${last.coins} coins in ${SECONDS}s`);
// Headless Chromium renders through software GL, so this is a floor check
// for pathological slowness, not a real-device frame-rate measurement.
if (last.fps < 12) fail.push(`fps ${last.fps}`);
if (result.taps < 10) fail.push(`autoplay only tapped ${result.taps} times`);
if (result.total === 0) fail.push('no audio scheduled at all');
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

// Marker list must not grow without bound over a long walk.
const markerCounts = samples.map((s) => s.liveMarkers);
if (Math.max(...markerCounts) > 120) fail.push(`marker list grew to ${Math.max(...markerCounts)}`);

// Every sounded pitch must be a natural note in equal temperament from C4.
const NAMES = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B'];
const offPitch = [];
const heard = new Set();
for (const n of result.notes) {
  const semis = Math.round(12 * Math.log2(n.hz / 261.63));
  const cents = Math.abs(1200 * Math.log2(n.hz / (261.63 * Math.pow(2, semis / 12))));
  const name = NAMES[((semis % 12) + 12) % 12];
  if (cents > 1 || name === null) offPitch.push({ hz: Math.round(n.hz), semis, cents: Math.round(cents) });
  else heard.add(name);
}
if (offPitch.length) fail.push(`${offPitch.length} off-scale pitches, e.g. ${JSON.stringify(offPitch[0])}`);

console.log('samples:', JSON.stringify(samples, null, 1));
console.log('play:', { taps: result.taps, hits: result.hits, misses: result.misses, notesScheduled: result.total });
console.log('pitches heard:', [...heard].sort().join(' '));
console.log(fail.length ? `FAIL:\n - ${fail.join('\n - ')}` : 'PASS: all checks green');

await browser.close();
process.exit(fail.length ? 1 : 0);
