import { chromium } from 'playwright';
import { existsSync, unlinkSync } from 'node:fs';

/**
 * The scenery equivalent of `proofsheet.mjs`: bakes every world texture the
 * game can draw — road band and silhouette tile for all three biomes, both
 * water-glint phases, the star field and the signpost — and lays them out
 * in one labelled sheet.
 *
 * A live screenshot only ever shows the biome you happen to be walking
 * through, so scenery changes used to be checked by temporarily shrinking
 * the transition distances and rebuilding. This is deterministic instead,
 * and makes a refactor of the drawing code checkable byte-for-byte.
 */
const OUT = 'scenery-sheet.png';
// Delete first. Comparing against a leftover file from the previous run is
// how a crashed script once "proved" that nothing had changed.
if (existsSync(OUT)) unlinkSync(OUT);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const rows = await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  scene.scene.pause();
  scene.children.removeAll();
  scene.cameras.main.setBackgroundColor('#1a1621');

  const S = window.scenery;
  const BIOMES = [
    { id: 'village', name: 'Village Dusk', skyColor: 0x2a1a2e, roadBandColor: 0x4a3450, roadDashColor: 0x66486c, sceneryColor: 0x1c1020, sceneryAccent: 0xe8c157 },
    { id: 'forest', name: 'Forest Dusk', skyColor: 0x0f2818, roadBandColor: 0x24422a, roadDashColor: 0x3c6242, sceneryColor: 0x081a0e, sceneryAccent: 0xb5d98a },
    { id: 'riverside', name: 'Riverside Camp', skyColor: 0x0f2438, roadBandColor: 0x22475c, roadDashColor: 0x3d7291, sceneryColor: 0x081624, sceneryAccent: 0x5da8c9 },
  ];

  const label = (x, y, text) =>
    scene.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '13px', color: '#e8d9c0' }).setOrigin(0, 0.5);

  let y = 30;
  let drawn = 0;
  for (const b of BIOMES) {
    label(8, y, b.id);
    scene.add.image(120, y, S.sceneryTileTexture(scene, b)).setOrigin(0, 0.5);
    scene.add.image(400, y, S.roadTileTexture(scene, b)).setOrigin(0, 0.5);
    drawn += 2;
    y += 130;
  }
  label(8, y, 'glint 0 / 1');
  scene.add.image(120, y, S.glintTexture(scene, 0)).setOrigin(0, 0.5);
  scene.add.image(400, y, S.glintTexture(scene, 1)).setOrigin(0, 0.5);
  y += 130;
  label(8, y, 'stars / signpost / moon');
  scene.add.image(120, y, S.starFieldTexture(scene)).setOrigin(0, 0.5);
  scene.add.image(400, y, S.signpostTexture(scene)).setOrigin(0, 1);
  scene.add.image(460, y, S.moonTexture(scene, 24)).setOrigin(0, 0.5);
  drawn += 5;

  return drawn;
});

await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
console.log('textures drawn:', rows, 'errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
