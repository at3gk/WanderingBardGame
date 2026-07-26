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
 * DESIGN.md's art direction makes a specific promise about the slow dusk
 * cycle: it darkens *the world* — sky, scenery, road — but never the bard
 * and never the notation, because "warmth belongs to the bard and the
 * music" and the letters inside the note heads are the entire teaching
 * surface. A child four minutes into a walk must be able to read them
 * exactly as well as a child who just started.
 *
 * That promise has been asserted nowhere. This checks it directly: jump to
 * the deepest point of the cycle and confirm the sky genuinely darkened
 * while the notation's tint and alpha did not move at all.
 *
 * Deep night is reached by setting `distancePx` rather than by walking to
 * it — it is ~24000px in, about four minutes of play.
 */
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.mouse.click(600, 500);
await page.waitForTimeout(1200);

const sample = (distancePx) =>
  page.evaluate(async (d) => {
    const s = window.game.scene.scenes[0];
    s.distancePx = d;
    await new Promise((r) => setTimeout(r, 900));
    const notes = s.markers.filter((m) => m.gfx && m.resolved === null);
    return {
      sky: s.cameras.main.backgroundColor.color,
      // The notation: note glyph tint and alpha, the staff lines, the clef.
      noteTint: notes.length ? notes[0].gfx.tintTopLeft : null,
      noteAlpha: notes.length ? Number(notes[0].gfx.alpha.toFixed(3)) : null,
      staffAlpha: Number(s.staffLines[0].alpha.toFixed(3)),
      staffColor: s.staffLines[0].fillColor,
      clefAlpha: Number(s.clef.alpha.toFixed(3)),
      clefTint: s.clef.tintTopLeft,
      // The world, which is *supposed* to move.
      roadTint: s.road.tintTopLeft,
      sceneryTint: s.scenery.tintTopLeft,
    };
  }, distancePx);

const bright = await sample(0);
const deep = await sample(24000);
console.log('cycle start (dusk) :', JSON.stringify(bright));
console.log('mid-cycle (night)  :', JSON.stringify(deep));

const fail = [];
if (errors.length) fail.push('page errors: ' + errors.join(' | '));

// The world must actually darken, or the check proves nothing.
if (deep.sky === bright.sky) fail.push('the sky did not change between dusk and deep night — the cycle is not running');
if (deep.roadTint === bright.roadTint) fail.push('the road did not darken at deep night');
if (deep.sceneryTint === bright.sceneryTint) fail.push('the scenery did not darken at deep night');

// The notation must not move at all. This is the promise.
const held = [
  ['note tint', bright.noteTint, deep.noteTint],
  ['note alpha', bright.noteAlpha, deep.noteAlpha],
  ['staff line alpha', bright.staffAlpha, deep.staffAlpha],
  ['staff line color', bright.staffColor, deep.staffColor],
  ['clef alpha', bright.clefAlpha, deep.clefAlpha],
  ['clef tint', bright.clefTint, deep.clefTint],
];
for (const [name, a, b] of held) {
  if (a === null || b === null) {
    fail.push(`${name} could not be sampled (no note in flight?)`);
  } else if (a !== b) {
    fail.push(`${name} changed with the dusk cycle (${a} -> ${b}) — the notation is being darkened with the world`);
  }
}

console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: deep night darkens the world and leaves the notation alone');
await browser.close();
process.exit(fail.length ? 1 : 0);
