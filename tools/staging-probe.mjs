// staging-probe — where the staged people actually stand, and where they land
// in the frame.
//
// Answers the three questions the postcards can only hint at: is a figure ON
// the drawn ground (or sunk into it), is it INSIDE the frame the live camera
// is shooting, and is it inside the staff ribbon's screen area. Every number
// is read off the live scene through the same camera the shot uses, which is
// the only way to reason about a staging arrangement without guessing at the
// projection.
//
// The drawn ground height is interpolated across the terrain ribbon's own
// triangles rather than taken from `roadSurfaceHeight`, because the whole
// question a "sunk figure" asks is whether those two agree.
//
// Not a gate; always exits 0. It is an instrument for the busk/encounter
// staging in RoadStage.
import { BASE_URL, launch } from './browser.mjs';

const POSES = [
  { name: '05-golden-busk', s: 940, day: 0.82, phase: 'busking' },
  { name: '06-dusk-encounter', s: 1120, day: 0.88, phase: 'encounter' },
];

const VIEWPORT = { width: 1600, height: 900 };
/** Sweep these bearings (radians off the bard's heading) and radii (metres). */
const SWEEP = process.env.BARD_SWEEP === '1';

function probe(sweep) {
  const stage = window.bard.stage;
  const camera = stage.camera;
  camera.updateMatrixWorld(true);
  const V3 = Object.getPrototypeOf(camera.position).constructor;

  // --- the drawn ground, as triangles ------------------------------------
  const tris = [];
  stage.scene.traverse((o) => {
    if (!o.isMesh || !/^terrain-/.test(o.name)) return;
    o.updateMatrixWorld(true);
    const p = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i;
      const b = idx ? idx.getX(i + 1) : i + 1;
      const c = idx ? idx.getX(i + 2) : i + 2;
      tris.push([
        p.getX(a), p.getY(a), p.getZ(a),
        p.getX(b), p.getY(b), p.getZ(b),
        p.getX(c), p.getY(c), p.getZ(c),
      ]);
    }
  });

  /** Height of the drawn ribbon at (x, z), by barycentric interpolation. */
  const drawnGround = (x, z) => {
    for (const t of tris) {
      const [x1, y1, z1, x2, y2, z2, x3, y3, z3] = t;
      const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(det) < 1e-9) continue;
      const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det;
      if (l1 < -1e-6 || l1 > 1 + 1e-6) continue;
      const l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det;
      if (l2 < -1e-6 || l2 > 1 + 1e-6) continue;
      const l3 = 1 - l1 - l2;
      if (l3 < -1e-6) continue;
      return l1 * y1 + l2 * y2 + l3 * y3;
    }
    return null;
  };

  const project = (x, y, z) => {
    const v = new V3(x, y, z);
    v.project(camera);
    return { sx: (v.x + 1) / 2, sy: (1 - v.y) / 2, z: v.z };
  };

  const bard = stage.bardPosition;
  const heading = stage.subject ? stage.subject.heading : null;

  // --- the staff ribbon's screen box --------------------------------------
  let notes = null;
  const notesGroup = stage.notes?.group ?? null;
  if (notesGroup && notesGroup.visible) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, any = false;
    notesGroup.updateMatrixWorld(true);
    notesGroup.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const p = o.geometry.attributes.position;
      if (!p) return;
      const step = Math.max(1, Math.floor(p.count / 300));
      for (let i = 0; i < p.count; i += step) {
        const v = new V3(p.getX(i), p.getY(i), p.getZ(i));
        o.localToWorld(v);
        v.project(camera);
        if (v.z > 1) continue;
        any = true;
        x0 = Math.min(x0, (v.x + 1) / 2);
        x1 = Math.max(x1, (v.x + 1) / 2);
        y0 = Math.min(y0, (1 - v.y) / 2);
        y1 = Math.max(y1, (1 - v.y) / 2);
      }
    });
    if (any) notes = { x0, x1, y0, y1 };
  }

  const out = {
    bard: {
      x: bard.x, y: bard.y, z: bard.z,
      chest: project(bard.x, bard.y + 0.9, bard.z),
      head: project(bard.x, bard.y + 1.5, bard.z),
      feet: project(bard.x, bard.y, bard.z),
    },
    camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov },
    notes,
    people: [],
    sweep: [],
  };

  for (const person of stage.people ?? []) {
    if (!person.group.visible) continue;
    const g = person.group.position;
    const dx = g.x - bard.x;
    const dz = g.z - bard.z;
    const ground = drawnGround(g.x, g.z);
    out.people.push({
      kind: person.kind,
      x: g.x, y: g.y, z: g.z,
      radius: Math.hypot(dx, dz),
      groundY: ground,
      sink: ground === null ? null : ground - g.y,
      feet: project(g.x, g.y, g.z),
      chest: project(g.x, g.y + 0.85, g.z),
      head: project(g.x, g.y + 1.5, g.z),
    });
  }

  if (sweep && heading !== null) {
    for (const radius of [2.4, 3.0, 3.6, 4.4, 5.2]) {
      for (let b = -2.8; b <= 2.81; b += 0.2) {
        const angle = heading + b;
        const x = bard.x + Math.sin(angle) * radius;
        const z = bard.z + Math.cos(angle) * radius;
        const ground = drawnGround(x, z);
        const y = ground ?? bard.y;
        out.sweep.push({
          bearing: Math.round(b * 100) / 100,
          radius,
          groundDrop: ground === null ? null : ground - bard.y,
          feet: project(x, y, z),
          chest: project(x, y + 0.85, z),
          head: project(x, y + 1.5, z),
        });
      }
    }
  }
  return out;
}

const browser = await launch();
const results = {};
for (const pose of POSES) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 });
  await page.evaluate(({ s, day, phase }) => window.bard.pose({ s, dayFraction: day, phase }), pose);
  await page.waitForTimeout(1800);
  results[pose.name] = await page.evaluate(probe, SWEEP);
  await page.close();
}
await browser.close();

const f = (n, w = 7) => (n === null || n === undefined ? '—'.padStart(w) : n.toFixed(3).padStart(w));
for (const [name, r] of Object.entries(results)) {
  console.log(`\n== ${name}`);
  console.log(`   bard feet ${f(r.bard.feet.sx)},${f(r.bard.feet.sy)}  head ${f(r.bard.head.sx)},${f(r.bard.head.sy)}`);
  if (r.notes) {
    console.log(`   staff box  x ${f(r.notes.x0)}..${f(r.notes.x1)}   y ${f(r.notes.y0)}..${f(r.notes.y1)}`);
  }
  for (const p of r.people) {
    console.log(
      `   ${p.kind.padEnd(7)} r${f(p.radius)} sink${f(p.sink)} feet ${f(p.feet.sx)},${f(p.feet.sy)}` +
        ` head ${f(p.head.sx)},${f(p.head.sy)}`,
    );
  }
  if (r.sweep.length) {
    console.log('   sweep: bearing radius groundDrop feetX feetY headY  flags');
    for (const s of r.sweep) {
      const inFrame = s.chest.sx > 0.03 && s.chest.sx < 0.97 && s.head.sy > 0.02 && s.feet.sy < 0.98;
      const onStaff =
        r.notes && s.chest.sx > r.notes.x0 - 0.01 && s.chest.sx < r.notes.x1 + 0.01 &&
        s.head.sy < r.notes.y1 + 0.01 && s.feet.sy > r.notes.y0 - 0.01;
      const onBard = Math.abs(s.chest.sx - r.bard.chest.sx) < 0.055;
      console.log(
        `   ${f(s.bearing, 6)} ${f(s.radius, 5)} ${f(s.groundDrop)} ${f(s.feet.sx)} ${f(s.feet.sy)} ${f(s.head.sy)}` +
          `  ${inFrame ? 'in ' : 'OUT'}${onStaff ? ' STAFF' : '     '}${onBard ? ' BARD' : ''}`,
      );
    }
  }
}
process.exit(0);
