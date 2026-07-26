import { chromium } from 'playwright';

/**
 * Checks the two design pillars from CLAUDE.md that had never actually been
 * measured: "playable in under 5 seconds, no login" and "mobile-friendly:
 * touch input, small bundle".
 *
 * Layout is checked by reading the scene's real geometry at each viewport
 * rather than by eyeballing a screenshot, so a regression fails a run
 * instead of waiting for someone to notice a squashed staff. Frame rate is
 * deliberately NOT checked here — headless software GL says nothing about a
 * real phone (see the sharper-mobile-rendering note in ROADMAP).
 */

const VIEWPORTS = [
  // 320 is the narrowest screen still worth supporting (iPhone SE 1st gen,
  // and the width most CSS baselines treat as the floor). The odd aspect
  // ratios below it are not devices so much as the shapes a browser window
  // can actually take — a short landscape phone with chrome showing, a tall
  // narrow split-screen, a wide desktop window dragged short.
  { name: 'narrow 320', width: 320, height: 568 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12', width: 390, height: 664 },
  { name: 'Pixel 5', width: 393, height: 727 },
  { name: 'iPhone 12 landscape', width: 664, height: 390 },
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 900, height: 600 },
  { name: 'tall narrow', width: 360, height: 900 },
  { name: 'wide short', width: 1440, height: 560 },
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});

const fail = [];
const rows = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const t0 = Date.now();
  await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'domcontentloaded' });
  // "Playable" means a note is on its way and a tap would do something —
  // not merely that the page painted.
  await page.waitForFunction(
    () => window.game?.scene?.scenes?.[0]?.markers?.length > 0,
    null,
    { timeout: 15_000 }
  );
  const readyMs = Date.now() - t0;

  const geom = await page.evaluate(() => {
    const scene = window.game.scene.scenes[0];
    const w = scene.scale.width;
    const h = scene.scale.height;
    const lane = scene.laneY ? scene.laneY() : null;
    // Where the staff's five lines actually sit, and where a note head lands
    // at the extremes of the drawable range.
    const steps = [-2, 0, 2, 6, 10, 12];
    const ys = {};
    for (const s of steps) ys[s] = scene.staffY(s, lane ?? h * 0.5);
    return {
      w,
      h,
      dpr: window.devicePixelRatio,
      canvasW: window.game.canvas.width,
      canvasH: window.game.canvas.height,
      hitLineX: scene.hitLineX(),
      noteYs: ys,
      markers: scene.markers.length,
    };
  });

  // Every note the songbook can draw must land inside the viewport, with
  // room for the glyph itself (a stem reaches ~40px above a note head).
  const TOP_MARGIN = 46;
  const BOTTOM_MARGIN = 20;
  for (const [step, y] of Object.entries(geom.noteYs)) {
    if (y - TOP_MARGIN < 0) fail.push(`${vp.name}: step ${step} draws off the top (y=${Math.round(y)})`);
    if (y + BOTTOM_MARGIN > geom.h) fail.push(`${vp.name}: step ${step} draws off the bottom (y=${Math.round(y)} of ${geom.h})`);
  }
  // The hit line has to leave enough runway to the right for a note to be
  // read before it arrives, and enough room to the left to scroll away.
  if (geom.hitLineX < 60) fail.push(`${vp.name}: hit line at x=${Math.round(geom.hitLineX)} leaves no exit lane`);
  if (geom.w - geom.hitLineX < 200) fail.push(`${vp.name}: only ${Math.round(geom.w - geom.hitLineX)}px of approach runway`);

  if (readyMs > 5000) fail.push(`${vp.name}: took ${readyMs}ms to become playable (pillar: under 5s)`);
  if (errors.length) fail.push(`${vp.name}: page errors: ${errors.join(' | ')}`);

  // Note spacing is a *derived* property of viewport width, and it is the
  // one that bites hardest on a phone: notes are spaced in time, so a
  // narrow screen packs the same 1800ms of flight into a third of the
  // pixels. Eighth-note pairs are the tightest thing the songbook draws
  // (This Old Man and Itsy Bitsy Spider both use them), so measure the
  // closest two note heads ever actually get, over real play.
  // Computed, not sampled. Sampling was the first attempt and it quietly
  // measured nothing: over a few seconds of play only quarter notes came
  // around, so it reported a comfortable 110px gap and passed without ever
  // seeing the case it was written for. The spacing is fully determined by
  // tempo, flight time and runway, so derive the worst case directly.
  const BEAT_MS = 60000 / 96; // BPM, RoadScene
  const SHORTEST_BEATS = 0.5; // eighth note — the shortest value the songbook draws
  const minGap = ((SHORTEST_BEATS * BEAT_MS) / 1800) * (geom.w - geom.hitLineX);
  // A note head is ~24px wide inside its 42px texture. Heads that come
  // closer than that are overlapping, which would hide the letter — the
  // entire teaching surface — behind the next note.
  const HEAD_W = 24;
  if (Number.isFinite(minGap) && minGap < HEAD_W) {
    fail.push(`${vp.name}: note heads close to ${Math.round(minGap)}px apart, narrower than the ~${HEAD_W}px head`);
  }

  // A tap anywhere must register — the whole game is one touch target.
  await page.mouse.click(Math.round(geom.w / 2), Math.round(geom.h * 0.8));
  const tapWorked = await page.evaluate(() => window.game.scene.scenes[0].hintShown === false);
  if (!tapWorked) fail.push(`${vp.name}: a tap in the lower half did not register`);

  rows.push({
    viewport: vp.name,
    size: `${geom.w}x${geom.h}`,
    canvas: `${geom.canvasW}x${geom.canvasH}`,
    dpr: geom.dpr,
    readyMs,
    hitLineX: Math.round(geom.hitLineX),
    runway: Math.round(geom.w - geom.hitLineX),
    minNoteGap: Number.isFinite(minGap) ? Math.round(minGap) : null,
    staffTop: Math.round(geom.noteYs[12]),
    staffBottom: Math.round(geom.noteYs[-2]),
  });

  await page.close();
}

console.table(rows);
console.log(fail.length ? `FAIL:\n - ${fail.join('\n - ')}` : 'PASS: playable in time and laid out inside every viewport');

await browser.close();
process.exit(fail.length ? 1 : 0);
