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
import { existsSync, unlinkSync } from 'node:fs';

/**
 * Bakes the shared UI glyphs — the tintable eighth note (beat markers and
 * the mute toggle), the note-stamped coin, the hit line and the treble
 * clef — and lays them out in one image (`ui-sheet.png`).
 *
 * The third of the three texture sheets (notes, scenery, ui). Between them
 * every texture the game draws is checkable in a single deterministic
 * image, which is what let all three render extractions be proved
 * byte-for-byte rather than eyeballed.
 */
const OUT = 'ui-sheet.png';
// Delete first — see proofsheet.mjs for the run where a crashed script
// "proved" nothing had changed by comparing against its own leftover file.
if (existsSync(OUT)) unlinkSync(OUT);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 320 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const drawn = await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  scene.scene.pause();
  scene.children.removeAll();
  scene.cameras.main.setBackgroundColor('#1a1621');

  window.ui.createStyleTextures(scene);

  window.ui.songbookTexture(scene);
  const keys = ['note-glyph', 'coin-icon', 'hit-line', 'treble-clef', 'songbook-icon'];
  let x = 40;
  for (const k of keys) {
    scene.add.image(x, 160, k).setOrigin(0.5, 0.5);
    scene.add.text(x, 280, k, { fontFamily: 'sans-serif', fontSize: '11px', color: '#e8d9c0' }).setOrigin(0.5, 0.5);
    x += 120;
  }
  return keys.length;
});

await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
console.log('ui textures drawn:', drawn, 'errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
process.exit(errors.length || drawn !== 5 ? 1 : 0);
