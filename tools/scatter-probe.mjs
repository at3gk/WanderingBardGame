// scatter-probe — where the ordinary scatter (grass/fern/flower/reed/shrub/
// log/rock) actually lands inside a vista frame, in world space.
//
// Run 134's handoff measured `04-golden-vista` (s:900, day:0.8, phase:
// 'vista') reading with an almost-empty lower-left quadrant, ruled out the
// camera rig (headroom intact) and the wayside sentinel trees (both sides
// covered within ~80 m at s 900), and named "ordinary scatter" as the one
// uninvestigated cause — unlike trees (`waysideSentinelSites`), scatter has
// no cross-side balance guarantee at all: `WorldStreamer.buildScatter`
// draws each clump's side from a plain `rand() < 0.5` coin flip. The sized
// next step it left undone: measure actual world-space object positions
// inside the vista frustum, not infer a cause from a screenshot.
//
// Not a pass/fail check — an instrument, like staging-probe.mjs. It poses
// the exact pinned vista shots, walks the live scene for every InstancedMesh
// an ordinary scatter kind produces (`${kind}-${chunkIndex}`, never
// `tree-*`), projects each instance through the live camera the same way
// staging-probe.mjs does, and buckets what actually falls inside the frame
// by screen quadrant. That turns "the lower-left looks empty" into a count.
import { BASE_URL, launch } from './browser.mjs';

// 04 is the frame in question, pinned in postcard.mjs — never renumber or
// retime it. 11 is the other pinned vista shot, already checked by eye in
// run 134's sweep and included here as an in-frustum-count comparison. The
// rest are unpinned probe points along the same 'vista' mood (matching run
// 134's screenshot sweep positions) purely to see whether s=900's count is
// ordinary variance or an outlier against the kind of counts a vista frame
// normally gets.
const POSES = [
  { name: '04-golden-vista (pinned)', s: 900, day: 0.8 },
  { name: '11-morning-vista (pinned)', s: 500, day: 0.35 },
  { name: 'probe s=100', s: 100, day: 0.2 },
  { name: 'probe s=300', s: 300, day: 0.3 },
  { name: 'probe s=700', s: 700, day: 0.45 },
  { name: 'probe s=1100', s: 1100, day: 0.6 },
  { name: 'probe s=1500', s: 1500, day: 0.75 },
  { name: 'probe s=1900', s: 1900, day: 0.9 },
];

const VIEWPORT = { width: 1600, height: 900 };

function measure() {
  // Matches `${kind.key}-${chunkIndex}` for every ordinary scatter kind
  // (`SCATTER_KINDS` in WorldStreamer.ts), never `tree-*`, `terrain-*`,
  // `river-*`, `landmark-*` or `stop-*`. Declared inside `measure` because
  // `page.evaluate` only serializes the function body, not the module's
  // outer scope.
  const SCATTER_RE =
    /^(roadgrass|roadstone|puddle|grass|fern|flower|reed|bankreed|bankgrass|shrub|log|rock)-\d+$/;

  const stage = window.bard.stage;
  const camera = stage.camera;
  const scene = stage.scene;
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);

  const V3 = Object.getPrototypeOf(camera.position).constructor;
  const M4 = Object.getPrototypeOf(camera.projectionMatrix).constructor;
  const scratchMatrix = new M4();

  // Screen fractions: sx 0..1 left-to-right, sy 0..1 top-to-bottom — same
  // convention staging-probe.mjs uses, so "lower-left" means sx<0.5, sy>0.5.
  const project = (v) => {
    v.project(camera);
    return { sx: (v.x + 1) / 2, sy: (1 - v.y) / 2, depth: v.z };
  };

  const items = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !SCATTER_RE.test(o.name)) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, scratchMatrix);
      scratchMatrix.premultiply(o.matrixWorld);
      const world = new V3().setFromMatrixPosition(scratchMatrix);
      const p = project(world.clone());
      // In front of the camera and inside the clip cube on all three axes —
      // the same "is this point actually in the shot" test `project()`'s
      // callers elsewhere in tools/ use (depth > 1 is behind or past the
      // far plane).
      const visible = p.depth >= -1 && p.depth <= 1 && p.sx >= 0 && p.sx <= 1 && p.sy >= 0 && p.sy <= 1;
      if (!visible) continue;
      items.push({
        kind: o.name.replace(/-\d+$/, ''),
        sx: p.sx,
        sy: p.sy,
        world: { x: world.x, y: world.y, z: world.z },
      });
    }
  });

  const quadrant = (it) => (it.sy < 0.5 ? (it.sx < 0.5 ? 'upperLeft' : 'upperRight') : (it.sx < 0.5 ? 'lowerLeft' : 'lowerRight'));
  const counts = { upperLeft: 0, upperRight: 0, lowerLeft: 0, lowerRight: 0 };
  for (const it of items) counts[quadrant(it)]++;

  return {
    camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov },
    total: items.length,
    counts,
    lowerLeftItems: items.filter((it) => quadrant(it) === 'lowerLeft'),
  };
}

const browser = await launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error(`pageerror: ${e.message}`));

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
const ready = await page
  .waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 })
  .then(() => true)
  .catch(() => false);
if (!ready) {
  console.error('window.bard.pose never appeared — cannot pose the game');
  process.exit(1);
}

console.log(
  `${'pose'.padEnd(26)} ${'total'.padStart(6)} ${'UL'.padStart(5)} ${'UR'.padStart(5)} ${'LL'.padStart(5)} ${'LR'.padStart(5)}`,
);
const rows = [];
for (const pose of POSES) {
  await page.evaluate(
    ({ s, day }) => window.bard.pose({ s, dayFraction: day, phase: 'vista' }),
    pose,
  );
  await page.waitForTimeout(1800);
  const result = await page.evaluate(measure);
  rows.push({ pose, result });
  const c = result.counts;
  console.log(
    `${pose.name.padEnd(26)} ${String(result.total).padStart(6)} ${String(c.upperLeft).padStart(5)} ${String(c.upperRight).padStart(5)} ${String(c.lowerLeft).padStart(5)} ${String(c.lowerRight).padStart(5)}`,
  );
}

const s900 = rows.find((r) => r.pose.s === 900);
console.log(`\n04-golden-vista (s=900) lower-left instances (${s900.result.lowerLeftItems.length}):`);
for (const it of s900.result.lowerLeftItems) {
  console.log(
    `  ${it.kind.padEnd(10)} sx=${it.sx.toFixed(3)} sy=${it.sy.toFixed(3)} world=(${it.world.x.toFixed(1)}, ${it.world.y.toFixed(1)}, ${it.world.z.toFixed(1)})`,
  );
}

// Raw instance counts treat a grass blade and a rock as equally "mass",
// which a screen is not obliged to agree with — a lower-left full of thin
// ground cover can still read as visually empty next to a lower-left with a
// rock or shrub anchoring it. Break each pose's lower-left bucket down by
// kind to see whether s=900 is short on large forms specifically, not just
// short on instances.
console.log('\nlower-left bucket by kind, per pose:');
for (const { pose, result } of rows) {
  const byKind = {};
  for (const it of result.lowerLeftItems) byKind[it.kind] = (byKind[it.kind] ?? 0) + 1;
  const summary = Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}:${n}`)
    .join(' ');
  console.log(`  ${pose.name.padEnd(26)} ${summary}`);
}

const lowerLeftCounts = rows.map((r) => r.result.counts.lowerLeft);
const mean = lowerLeftCounts.reduce((a, b) => a + b, 0) / lowerLeftCounts.length;
console.log(
  `\nlowerLeft counts across all ${rows.length} vista poses: [${lowerLeftCounts.join(', ')}], mean ${mean.toFixed(1)}`,
);

await browser.close();
