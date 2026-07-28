// postcard — bake a sheet of framed moments from the live game.
//
// This is the harness the art-critique loop runs on. A critic agent cannot
// play the game, so the game has to be able to *pose* for it: drive to a
// known point on the road, set a known time of day, set a phase, settle,
// shoot. Every shot is deterministic (the road comes from a fixed seed and
// the clock is driven, not observed), so two runs of this tool differ only
// where the rendering actually changed — which is what makes "is this
// better than last round" a question with an answer.
//
// Shots are written as individual PNGs so a critic can open them at full
// size. A contact sheet is deliberately not produced: judging a painterly
// look from thumbnails is how you ship something that falls apart at 1x.
import { mkdirSync } from 'node:fs';
import { BASE_URL, launch } from './browser.mjs';

const outDir = process.argv[2] ?? 'postcards';
const only = process.argv[3] ?? null;
mkdirSync(outDir, { recursive: true });

// The moments worth looking at. Chosen to cover the things that are hard to
// get right rather than the things that are easy: raking light, silhouettes
// against a bright sky, a busy foreground, a night scene with a single warm
// source, and the two phone aspect ratios where a desktop framing breaks.
const SHOTS = [
  { name: '01-dawn-road', s: 60, day: 0.24, phase: 'walking', viewport: [1600, 900] },
  { name: '02-morning-open', s: 340, day: 0.42, phase: 'walking', viewport: [1600, 900] },
  { name: '03-noon-forest', s: 620, day: 0.55, phase: 'walking', viewport: [1600, 900] },
  { name: '04-golden-vista', s: 900, day: 0.8, phase: 'vista', viewport: [1600, 900] },
  { name: '05-golden-busk', s: 940, day: 0.82, phase: 'busking', viewport: [1600, 900] },
  { name: '06-dusk-encounter', s: 1120, day: 0.88, phase: 'encounter', viewport: [1600, 900] },
  { name: '07-night-campfire', s: 1400, day: 0.95, phase: 'resting', viewport: [1600, 900] },
  { name: '08-phone-portrait', s: 420, day: 0.5, phase: 'walking', viewport: [390, 844] },
  { name: '09-phone-landscape', s: 900, day: 0.82, phase: 'busking', viewport: [844, 390] },
  { name: '10-tablet', s: 700, day: 0.7, phase: 'walking', viewport: [1024, 768] },
];

const browser = await launch();
const problems = [];
const written = [];

for (const shot of SHOTS) {
  if (only && !shot.name.includes(only)) continue;
  const [width, height] = shot.viewport;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => problems.push(`${shot.name}: pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`${shot.name}: console: ${m.text()}`);
    if (/THREE.WebGLProgram|shader error|not compile/i.test(m.text())) {
      problems.push(`${shot.name}: shader: ${m.text()}`);
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'load' });

  // Wait for the debug handle rather than a fixed timeout: a fixed sleep is
  // either too short on a cold SwiftShader start (blank frame, false
  // "regression") or wastefully long on every other run.
  const ready = await page
    .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    problems.push(`${shot.name}: window.bard.pose never appeared — cannot pose the game`);
    await page.close();
    continue;
  }

  await page.evaluate(
    ({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }),
    shot,
  );
  // Let the camera's damping settle into the new framing and the wind and
  // particle systems reach a steady state. Shooting immediately catches the
  // camera mid-transition, which reads as a composition failure that isn't.
  await page.waitForTimeout(1800);

  const path = `${outDir}/${shot.name}.png`;
  await page.screenshot({ path });
  written.push(path);
  await page.close();
}

await browser.close();

console.log(`wrote ${written.length} postcards to ${outDir}/`);
for (const p of written) console.log(`  ${p}`);
if (problems.length) {
  console.log(`\nproblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
}
process.exit(problems.length ? 1 : 0);
