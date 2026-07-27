/**
 * The heads-up chrome must not overlap itself.
 *
 * Written after finding that the songbook and lute buttons — the two ways
 * into everything added in the 2026-07-26 session — were drawn *underneath*
 * the song meter on every portrait phone. The buttons counted pixels from
 * the left edge, the meter took 60% of the width and centred itself, and
 * nothing had ever asked those two rules to agree. On a 390px screen the
 * meter track began at x=78 and the songbook button sat at 68-90.
 *
 * It only looked right in landscape, which is where a headless check with
 * one viewport would most likely have been run.
 *
 * Unit tests cover the layout maths (src/core/hud.test.ts). This checks the
 * thing the maths cannot: that what is actually on the canvas matches, and
 * that a tap on each button reaches that button and no other.
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

const overlaps = (a, b) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const failures = [];

for (const [name, w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.mouse.click(Math.round(w / 2), Math.round(h * 0.8));
  await page.waitForTimeout(500);

  const boxes = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    const rect = (o, label) => {
      if (!o || !o.visible) return null;
      const ww = o.displayWidth ?? o.width;
      const hh = o.displayHeight ?? o.height;
      return {
        label,
        left: o.x - ww / 2, right: o.x + ww / 2,
        top: o.y - hh / 2, bottom: o.y + hh / 2,
      };
    };
    return {
      W: s.scale.width,
      icons: [rect(s.muteIcon, 'mute'), rect(s.bookIcon, 'songbook'), rect(s.luteIcon, 'lute')],
      zones: [rect(s.muteZone, 'muteZone'), rect(s.bookZone, 'bookZone'), rect(s.luteZone, 'luteZone')],
      meter: rect(s.meterTrack, 'meter'),
      title: (() => { s.songTitleText.setText('Twinkle Twinkle Little Star'); return rect(s.songTitleText, 'title'); })(),
      moonGlow: rect(s.moonGlow, 'moon'),
      staffTopY: s.staffY(10, s.laneY()),
      coinIcon: rect(s.coinIcon, 'coin'),
      coinText: rect(s.coinText, 'coinText'),
    };
  });

  const fail = (msg) => failures.push(`${name} (${w}x${h}): ${msg}`);

  // 1. No button may be drawn under the meter. This is the original bug.
  for (const icon of boxes.icons) {
    if (!icon || !boxes.meter) continue;
    if (overlaps(icon, boxes.meter)) {
      fail(`${icon.label} icon [${Math.round(icon.left)}-${Math.round(icon.right)}] is under the meter ` +
           `[${Math.round(boxes.meter.left)}-${Math.round(boxes.meter.right)}]`);
    }
  }

  // 2. Nor under the coin readout.
  for (const icon of boxes.icons) {
    for (const coin of [boxes.coinIcon, boxes.coinText]) {
      if (icon && coin && overlaps(icon, coin)) fail(`${icon.label} icon overlaps ${coin.label}`);
    }
  }
  if (boxes.meter) {
    for (const coin of [boxes.coinIcon, boxes.coinText]) {
      if (coin && overlaps(boxes.meter, coin)) fail(`meter overlaps ${coin.label}`);
    }
  }

  // 3. No two touch zones may overlap — an ambiguous tap goes to whichever
  //    object happens to be later in the display list, which is not a
  //    decision anyone made.
  for (let i = 0; i < boxes.zones.length; i++) {
    for (let j = i + 1; j < boxes.zones.length; j++) {
      const a = boxes.zones[i], b = boxes.zones[j];
      if (a && b && overlaps(a, b)) {
        fail(`${a.label} [${Math.round(a.left)}-${Math.round(a.right)}] overlaps ` +
             `${b.label} [${Math.round(b.left)}-${Math.round(b.right)}]`);
      }
    }
  }

  // 4. The moon keeps out of the longest song title, and out of the staff.
  //    The title had always been inside the moon's vertical span on portrait
  //    phones — "Twinkle Twinkle Little Star" overlapped the glow by 34px on
  //    a 320px screen — and a bright disc behind a note head costs contrast
  //    on the one thing the game is teaching.
  if (boxes.title && boxes.moonGlow && overlaps(boxes.title, boxes.moonGlow)) {
    fail(`the longest song title [${Math.round(boxes.title.left)}-${Math.round(boxes.title.right)}] ` +
         `overlaps the moon [${Math.round(boxes.moonGlow.left)}-${Math.round(boxes.moonGlow.right)}]`);
  }
  if (boxes.moonGlow && boxes.moonGlow.bottom > boxes.staffTopY) {
    fail(`the moon reaches y=${Math.round(boxes.moonGlow.bottom)}, past the top staff line at ` +
         `y=${Math.round(boxes.staffTopY)}`);
  }

  // 5. Everything stays on screen.
  for (const box of [...boxes.icons, boxes.meter, boxes.coinIcon]) {
    if (!box) continue;
    if (box.left < 0 || box.right > boxes.W) {
      fail(`${box.label} runs off the edge [${Math.round(box.left)}-${Math.round(box.right)}] of ${boxes.W}`);
    }
  }

  // 6. And the buttons still *work* — tapping each one does its own job and
  //    nobody else's. Overlap-free geometry is necessary, not sufficient.
  const before = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { muted: s.audioEngine.isMuted, mode: s.mode, picker: s.pickerOpen };
  });
  await page.mouse.click(Math.round(boxes.icons[0].left + 10), 24); // mute
  await page.waitForTimeout(250);
  const afterMute = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { muted: s.audioEngine.isMuted, mode: s.mode, picker: s.pickerOpen };
  });
  if (afterMute.muted === before.muted) fail('tapping the mute button did not toggle mute');
  if (afterMute.picker) fail('tapping the mute button opened the picker');
  if (afterMute.mode !== before.mode) fail('tapping the mute button changed mode');

  await page.mouse.click(Math.round(boxes.icons[0].left + 10), 24); // unmute
  await page.waitForTimeout(200);

  await page.mouse.click(Math.round((boxes.icons[1].left + boxes.icons[1].right) / 2), 24); // songbook
  await page.waitForTimeout(350);
  const afterBook = await page.evaluate(() => {
    const s = window.game.scene.scenes[0];
    return { muted: s.audioEngine.isMuted, mode: s.mode, picker: s.pickerOpen };
  });
  if (!afterBook.picker) fail('tapping the songbook button did not open the picker');
  if (afterBook.muted !== before.muted) fail('tapping the songbook button toggled mute');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.evaluate(() => window.game.scene.scenes[0].pickerOpen)) {
    // Not every build closes on Escape; tap the backdrop instead.
    await page.mouse.click(Math.round(w / 2), Math.round(h - 12));
    await page.waitForTimeout(300);
  }

  const stillOpen = await page.evaluate(() => window.game.scene.scenes[0].pickerOpen);
  if (!stillOpen) {
    await page.mouse.click(Math.round((boxes.icons[2].left + boxes.icons[2].right) / 2), 24); // lute
    await page.waitForTimeout(500);
    const afterLute = await page.evaluate(() => {
      const s = window.game.scene.scenes[0];
      return { muted: s.audioEngine.isMuted, mode: s.mode, picker: s.pickerOpen };
    });
    if (afterLute.mode !== 'play') fail(`tapping the lute button left mode as ${afterLute.mode}`);
    if (afterLute.muted !== before.muted) fail('tapping the lute button toggled mute');
  }

  if (errs.length) fail('page errors: ' + errs.join(' | '));
  console.log(`  ${name} (${w}x${h}): meter y=${Math.round((boxes.meter.top + boxes.meter.bottom) / 2)} ` +
              `[${Math.round(boxes.meter.left)}-${Math.round(boxes.meter.right)}], ` +
              `buttons at ${boxes.icons.map((i) => Math.round((i.left + i.right) / 2)).join(', ')}`);
  await page.close();
}

await browser.close();
if (failures.length) {
  console.log('FAIL:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('PASS: no two pieces of chrome overlap, and every button does its own job');
