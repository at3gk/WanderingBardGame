import { chromium } from 'playwright';
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
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

  const keys = ['note-glyph', 'coin-icon', 'hit-line', 'treble-clef'];
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
process.exit(errors.length || drawn !== 4 ? 1 : 0);
