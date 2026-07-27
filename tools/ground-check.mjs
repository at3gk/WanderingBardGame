/**
 * The bard stands on a road that is actually on the screen.
 *
 * Written after finding that in landscape the road ran off the bottom
 * edge. The lane was `height / 2` and the ground a flat 178px below it —
 * a fixed offset hung off a proportional anchor, the same shape of bug as
 * the free-play staff overflowing a landscape phone, failing the same way.
 * On a 568x320 screen the ground landed at y=338: twelve of the road's
 * sixty pixels were visible and the bard was cut off at the shins.
 *
 * Portrait was fine, which is exactly why it went unseen for so long.
 *
 * The maths is unit-tested (src/core/worldLayout.test.ts). This checks the
 * part the maths cannot: that the bard's rendered bounds — a container of
 * a dozen parts, not a rectangle anyone declared — really do land on the
 * road, on a real canvas, at every viewport the game claims to support.
 */
const pw = await import(`${process.env.PLAYWRIGHT_PATH}/index.js`);
const chromium = pw.chromium ?? pw.default?.chromium;

const VIEWPORTS = [
  ['iphone se portrait', 320, 568],
  ['iphone se landscape', 568, 320],
  ['phone portrait', 390, 664],
  ['phone landscape', 664, 390],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['desktop', 1280, 800],
  ['narrow desktop', 900, 700],
];

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const failures = [];

for (const [name, w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.mouse.click(Math.round(w / 2), Math.round(h * 0.8));
  await page.waitForTimeout(1400);

  const m = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    const b = s.bard.getBounds();
    const road = s.road;
    const roadTop = road.y - (road.displayHeight ?? road.height) / 2;
    const roadBottom = road.y + (road.displayHeight ?? road.height) / 2;
    return {
      H: s.scale.height,
      bard: { top: b.y, bottom: b.y + b.height, height: b.height },
      roadTop, roadBottom,
      laneY: s.laneY(),
      // Lowest and highest the songbook ever writes.
      lowestNoteY: s.staffY(0, s.laneY()),
      highestNoteY: s.staffY(12, s.laneY()),
    };
  });

  const fail = (msg) => failures.push(`${name} (${w}x${h}): ${msg}`);

  // 1. The whole road is on screen. This is the bug.
  if (m.roadBottom > m.H) fail(`road runs ${Math.round(m.roadBottom - m.H)}px off the bottom`);
  if (m.roadTop < 0) fail(`road starts ${Math.round(-m.roadTop)}px above the top`);

  // 2. The bard is whole — not sheared by either edge.
  if (m.bard.bottom > m.H + 2) fail(`bard's feet are ${Math.round(m.bard.bottom - m.H)}px below the screen`);
  if (m.bard.top < 0) fail(`bard's head is ${Math.round(-m.bard.top)}px above the screen`);

  // 3. And he is standing ON the road, not hovering over it or sunk in it.
  if (m.bard.bottom < m.roadTop) fail(`bard floats ${Math.round(m.roadTop - m.bard.bottom)}px above the road`);
  if (m.bard.bottom > m.roadBottom) fail(`bard sinks ${Math.round(m.bard.bottom - m.roadBottom)}px through the road`);

  // 4. The highest note the songbook can write stays clear of the chrome.
  //    (The meter row's underside — see core/hud.)
  if (m.highestNoteY < 86) fail(`the top of the songbook's range reaches y=${Math.round(m.highestNoteY)}, into the chrome`);

  if (errs.length) fail('page errors: ' + errs.join(' | '));

  const clearance = Math.round(m.bard.top - m.lowestNoteY);
  console.log(`  ${name} (${w}x${h}): road ${Math.round(m.roadTop)}-${Math.round(m.roadBottom)} of ${m.H}, ` +
    `bard ${Math.round(m.bard.top)}-${Math.round(m.bard.bottom)}, ` +
    `${clearance >= 0 ? `${clearance}px under the lowest note` : `hat overlaps low notes by ${-clearance}px (cramped)`}`);
  await page.close();
}

await browser.close();
if (failures.length) {
  console.log('FAIL:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('PASS: the road is on screen and the bard is standing on it, at every viewport');
