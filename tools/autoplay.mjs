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
 * Plays the game by itself and checks both what happened and what was
 * heard. Two instruments:
 *   - every oscillator the AudioEngine creates is recorded (pitch + time),
 *     so the sounded performance can be compared against the written song;
 *   - a rAF loop dispatches real pointerdown events on the canvas at each
 *     note's hit time, so input goes through Phaser's normal plumbing.
 */
const SECONDS = Number(process.argv[2] ?? 60);

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

// Record every scheduled oscillator before the game boots, and keep a
// handle on the AudioContext so the audio clock can be compared with the
// visual one. Visuals run off Phaser's time, audio off
// AudioContext.currentTime — two independent clocks, and a rhythm game is
// only correct while they stay locked.
await page.addInitScript(() => {
  window.__ctxs = [];
  const OrigCtx = AudioContext;
  window.AudioContext = function (...args) {
    const ctx = new OrigCtx(...args);
    window.__ctxs.push(ctx);
    return ctx;
  };
  window.AudioContext.prototype = OrigCtx.prototype;
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

// Record the running order of tunes, so a long walk can be checked for
// actually rotating through the songbook rather than looping one song.
//
// Also count outcomes *cumulatively*. Markers are culled once they scroll
// off, so counting `resolved === 'hit'` over the live marker list at the
// end reports whatever happened in the last second — a number that looks
// like a total and isn't. `recordEncounter` is the one choke point both
// outcomes pass through, so hooking it is the honest count.
await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  window.__songs = [];
  const origAnnounce = scene.announceSong.bind(scene);
  scene.announceSong = (song) => {
    if (window.__songs[window.__songs.length - 1] !== song.title) window.__songs.push(song.title);
    return origAnnounce(song);
  };

  window.__outcomes = { hit: 0, miss: 0 };
  const origRecord = scene.recordEncounter.bind(scene);
  scene.recordEncounter = (step, outcome, walking) => {
    window.__outcomes[outcome] = (window.__outcomes[outcome] ?? 0) + 1;
    return origRecord(step, outcome, walking);
  };
});

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
  // Wait in slices so the page stays responsive, but only tap once the next
  // note is actually due. Tapping at the end of every slice regardless (the
  // old behaviour) fired roughly one tap into empty air for every real one,
  // which made the tap count meaningless as a denominator — and modelled a
  // player who mashes rather than one who plays.
  if (waitMs > 400) {
    await page.waitForTimeout(400);
    continue;
  }
  if (waitMs > 2) await page.waitForTimeout(waitMs);
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
      // Raw gap between the two clocks, reported for information only.
      // It is NOT a sync measurement and nothing asserts on it: the sound
      // hardware's clock simply is not the same rate as performance.now,
      // so this grows for as long as a session lasts and is harmless by
      // itself. See tools/README.md for the sync investigation and why
      // there is no automated assertion here.
      clockGapMs: window.__ctxs[0]
        ? Math.round(scene.time.now - scene.startTimeMs - window.__ctxs[0].currentTime * 1000)
        : null,
    };
    }));
  }
}

const result = await page.evaluate(() => {
  const hits = window.__outcomes.hit;
  const misses = window.__outcomes.miss;
  // Analyse *every* pitch in the page — slicing a prefix here would only
  // ever check the first biome's tune.
  const NAMES = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B'];
  const heard = new Set();
  const offPitch = [];
  for (const n of window.__notes) {
    const semis = Math.round(12 * Math.log2(n.hz / 261.63));
    const cents = Math.abs(1200 * Math.log2(n.hz / (261.63 * Math.pow(2, semis / 12))));
    const name = NAMES[((semis % 12) + 12) % 12];
    if (cents > 1 || name === null) offPitch.push({ hz: Math.round(n.hz), semis, cents: Math.round(cents) });
    else heard.add(name);
  }
  return {
    hits,
    misses,
    total: window.__notes.length,
    heard: [...heard].sort(),
    offPitch: offPitch.slice(0, 5),
    offPitchCount: offPitch.length,
    songsPlayed: window.__songs ?? [],
  };
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
// The whole point of the tool is that it *plays*. Without this, a change
// that stopped registering taps entirely would still pass: the meter and
// coin checks are indirect, and a scene that never resolved a note would
// simply never drain the meter. Autoplay taps on the beat, so nearly
// everything should land; allow slack for the first note's runway and for
// notes tapped during a song changeover.
if (result.hits < result.taps * 0.8) {
  fail.push(`only ${result.hits} hits from ${result.taps} taps — taps are not landing`);
}
if (result.misses > result.hits * 0.1) {
  fail.push(`${result.misses} misses against ${result.hits} hits under on-beat play`);
}
if (result.total === 0) fail.push('no audio scheduled at all');
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

// Marker list must not grow without bound over a long walk.
const markerCounts = samples.map((s) => s.liveMarkers);
if (Math.max(...markerCounts) > 120) fail.push(`marker list grew to ${Math.max(...markerCounts)}`);

// Texture count must plateau. It grows as new songs are met — each distinct
// (staff position, note value) pair bakes a lettered and a bare variant —
// but the songbook is finite, so it must stop. 85 note/rest textures plus
// scenery and UI is the whole set.
const texCounts = samples.map((s) => s.textures);
if (Math.max(...texCounts) > 160) fail.push(`texture count reached ${Math.max(...texCounts)} — baking is unbounded`);

const gaps = samples.map((s) => s.clockGapMs).filter((g) => g !== null);
if (gaps.length >= 2) {
  console.log(`clock gap drifted ${Math.round(gaps[gaps.length - 1] - gaps[0])}ms over the run (informational)`);
}

// Every sounded pitch must be a natural note in equal temperament from C4.
if (result.offPitchCount) {
  fail.push(`${result.offPitchCount} off-scale pitches, e.g. ${JSON.stringify(result.offPitch[0])}`);
}

console.log('samples:', JSON.stringify(samples, null, 1));
console.log('play:', { taps: result.taps, hits: result.hits, misses: result.misses, notesScheduled: result.total });
console.log('pitches heard:', result.heard.join(' '));
console.log('songs played:', result.songsPlayed.join(' -> ') || '(not tracked)');
console.log(fail.length ? `FAIL:\n - ${fail.join('\n - ')}` : 'PASS: all checks green');

await browser.close();
process.exit(fail.length ? 1 : 0);
