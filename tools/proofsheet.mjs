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

// Notation proof sheet: bakes every note-value x staff-position combination
// the songbook can produce and lays them out in a grid, so engraving can be
// verified deterministically instead of by catching moving notes.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 980, height: 800 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const scene = window.game.scene.scenes[0];
  // Freeze the walk so nothing scrolls under the sheet.
  scene.scene.pause();
  const cam = scene.cameras.main;
  cam.setBackgroundColor(0x1a1420);
  scene.children.removeAll();

  const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SEMIS = [0, 2, 4, 5, 7, 9, 11];
  const VALUES = [
    { beats: 0.5, label: 'eighth' },
    { beats: 1, label: 'quarter' },
    { beats: 1.5, label: 'dotted qtr' },
    { beats: 2, label: 'half' },
    { beats: 4, label: 'whole' },
  ];

  const rows = [];
  // Two octaves: low (with ledger territory) and high (stem-flip territory).
  for (const octave of [0, 12]) {
    for (const v of VALUES) {
      rows.push({ octave, ...v });
    }
  }

  const startY = 40;
  const rowH = 72;
  rows.forEach((row, ri) => {
    const y = startY + ri * rowH;
    const label = scene.add.text(8, y - 8, `${row.label} ${row.octave ? '(hi)' : '(lo)'}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#8a7f95',
    });
    label.setDepth(10);
    // Staff lines for this row.
    for (const step of [2, 4, 6, 8, 10]) {
      const ly = y + (6 - step) * 9;
      scene.add.rectangle(560, ly, 780, 1.2, 0xe8d9c0, 0.25);
    }
    SEMIS.forEach((semi, ci) => {
      const semitone = semi + row.octave;
      const step = Math.floor(semitone / 12) * 7 + SEMIS.indexOf(semitone % 12);
      const key = window.engraving.noteTexture(scene, NAMES[ci], step, row.beats);
      const img = scene.add.image(200 + ci * 55, y + (6 - step) * 9, key);
      img.setOrigin(19 / 42, (step >= 6 ? 18 : 60 - 18) / 60);
      img.setTint(0xe8d9c0);
    });
  });
  return { rows: rows.length };
});

await page.screenshot({ path: 'proofsheet.png' });
console.log('rows:', info.rows, 'errors:', errors.length ? errors : 'none');
await browser.close();
