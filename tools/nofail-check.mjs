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
 * The game's central emotional promise, asserted rather than assumed.
 *
 * DESIGN.md: "no harsh buzzers or red flashes — a missed beat just lets a
 * note drop out of the tune"; "a miss just dims it to mauve. Nothing
 * flashes red." It is a game for a small child, and the whole stance is
 * that failing is not a thing that can happen. Every other harness plays
 * well or plays chaotically; none of them checks what the game does to a
 * child who is simply not managing.
 *
 * So this one does nothing at all for a minute, and checks the game stays
 * kind: silent on misses, never red, no game-over of any kind, the meter
 * floored rather than negative, and notes still arriving so the child can
 * rejoin whenever they like.
 */
const SECONDS = Number(process.argv[2] ?? 60);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.addInitScript(() => {
  window.__osc = [];
  const oc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    const o = oc.call(this);
    const os = o.start.bind(o);
    o.start = (w) => { window.__osc.push(w); return os(w); };
    return o;
  };
});

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// One tap to start the performance, then give up entirely.
await page.mouse.click(600, 500);
await page.waitForTimeout(1500);
const oscAtGiveUp = await page.evaluate(() => window.__osc.length);

await page.waitForTimeout(SECONDS * 1000);

const out = await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  const missed = s.markers.filter((m) => m.resolved === 'miss');
  return {
    meter: Math.round(s.meter),
    walking: s.walking,
    markers: s.markers.length,
    missedOnScreen: missed.length,
    missTints: [...new Set(missed.map((m) => m.gfx && m.gfx.tintTopLeft))],
    // Anything the scene might have added to shame the player.
    textObjects: s.children.list.filter((c) => c.type === 'Text').map((c) => c.text),
    sceneActive: s.scene.isActive(),
    coins: Math.floor(s.coins),
    osc: window.__osc.length,
  };
});

console.log(`did nothing for ${SECONDS}s:`, JSON.stringify(out));

const fail = [];
if (errors.length) fail.push('page errors: ' + errors.join(' | '));

// Never a fail state.
if (!out.sceneActive) fail.push('the scene stopped running — something ended the game');
if (out.meter < 0) fail.push(`meter went negative (${out.meter})`);
if (out.markers === 0) fail.push('notes stopped arriving — a child who paused could not rejoin');

// Nothing on screen may shame them. The only text is the readouts and the
// song title.
const ALLOWED = /steps$|^$/;
const shaming = out.textObjects.filter((t) => !ALLOWED.test(t) && !/^[A-G]$/.test(t));
// The song title is legitimate; anything with these words is not.
const cruel = shaming.filter((t) => /fail|game over|lost|try again|wrong|miss/i.test(t));
if (cruel.length) fail.push(`text on screen shames the player: ${JSON.stringify(cruel)}`);

// A miss dims to mauve. It must not go red — red channel dominant by a
// clear margin is the thing DESIGN.md rules out.
for (const tint of out.missTints) {
  if (tint === null || tint === undefined) continue;
  const r = (tint >> 16) & 0xff, g = (tint >> 8) & 0xff, b = tint & 0xff;
  if (r > g + 90 && r > b + 90) fail.push(`a missed note is tinted red (#${tint.toString(16)})`);
}

// Misses are silent. The tune itself plays on regardless of the meter —
// that is deliberate and is what lets a lost child hear where they are —
// so oscillators keep being created. What must NOT happen is an extra one
// per miss on top of that.
//
// Ceiling: three layers at 96 BPM is 3 x 1.6 = 4.8 oscillators/sec. A
// buzzer on every missed note would add another ~1.6/sec and blow past 6.
const perSec = (out.osc - oscAtGiveUp) / SECONDS;
console.log(`oscillators: ${oscAtGiveUp} -> ${out.osc} (${perSec.toFixed(1)}/sec of pure misses)`);
if (perSec > 6) {
  fail.push(`${perSec.toFixed(1)} oscillators/sec while missing everything — something is sounding on a miss`);
}

console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: giving up costs nothing but the walk — no fail state, no red, no shaming');
await browser.close();
process.exit(fail.length ? 1 : 0);
