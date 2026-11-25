// Pillar 1 check (task 259): how long from navigation to the first tap the
// road actually credits? Not "the canvas exists" — the first tap that lands
// as a hit on the walk's tune, read from game state.
//
// Usage: npm run build && npx vite preview &  node tools/first-tap.mjs
//
// A page-side loop taps the canvas every 40 ms from the instant
// `window.bard` appears and records three moments (all ms since navigation
// start, performance.now()), plus the bundle's arrival from resource timing:
//   js    — the last script finished downloading
//   boot  — main.ts finished: world generated, stage built, loop started
//           (the walk's tune starts here too: `tune` is recorded, = boot)
//   frame — two animation frames after boot: the first frame on screen
//   hit   — performance.hits first goes above zero
// `hit − frame` is mostly the wait for the tune's first note to reach the
// line, which is the game's own pacing, not load time. Exits 1 if any first
// visit is over 5 s.
//
// Profiles: unthrottled, and a throttled phone (1.6 Mbps / 150 ms RTT,
// CPU 4×). Each as a first visit (fresh context: cold cache, no service
// worker) and a return visit (same context reloaded once the worker is
// ready). Headless SwiftShader says nothing about real frame rate on a
// phone GPU; read these as load and boot cost, not as smoothness.
import { launch, BASE_URL } from './browser.mjs';

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 664, height: 390 },
];
const PROFILES = [
  { name: 'unthrottled', net: null, cpu: 1 },
  {
    name: 'phone',
    net: { latency: 150, downloadThroughput: (1.6e6 / 8) | 0, uploadThroughput: (0.75e6 / 8) | 0 },
    cpu: 4,
  },
];

const TAPPER = () => {
  const marks = { boot: null, frame: null, tune: null, hit: null };
  window.__firstTap = marks;
  const tick = () => {
    const bard = window.bard;
    if (bard) {
      if (marks.boot === null) {
        marks.boot = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => (marks.frame = performance.now())));
      }
      const perf = bard.stage?.performance;
      if (perf && marks.tune === null) marks.tune = performance.now();
      if (perf && perf.hits > 0) {
        marks.hit = performance.now();
        return;
      }
      const canvas = bard.app?.renderer?.domElement;
      canvas?.dispatchEvent(
        new PointerEvent('pointerdown', { isPrimary: true, pointerType: 'touch', bubbles: true }),
      );
    }
    setTimeout(tick, 40);
  };
  setTimeout(tick, 0);
};

async function throttle(page, profile) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.net?.latency ?? 0,
    downloadThroughput: profile.net?.downloadThroughput ?? -1,
    uploadThroughput: profile.net?.uploadThroughput ?? -1,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
}

async function measure(page) {
  await page.waitForFunction(() => window.__firstTap?.hit !== null, null, { timeout: 60000 });
  return page.evaluate(() => {
    // The breakdown: when the bundle finished arriving, and when the first
    // frame after boot was presented. boot − js is parse + world
    // generation + stage construction (main.ts runs as a module, so it
    // starts as soon as the bundle is in).
    const js = performance
      .getEntriesByType('resource')
      .filter((e) => e.initiatorType === 'script' || /\.js$/.test(e.name))
      .reduce((max, e) => Math.max(max, e.responseEnd), 0);
    const kb = performance
      .getEntriesByType('resource')
      .reduce((sum, e) => sum + (e.transferSize || 0), performance.getEntriesByType('navigation')[0]?.transferSize || 0);
    return { ...window.__firstTap, js, kb: Math.round(kb / 1024) };
  });
}

const browser = await launch(['--autoplay-policy=no-user-gesture-required']);
const rows = [];
for (const viewport of VIEWPORTS) {
  for (const profile of PROFILES) {
    const context = await browser.newContext({ viewport, hasTouch: true });
    await context.addInitScript(TAPPER);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await throttle(page, profile);
    await page.goto(BASE_URL, { waitUntil: 'commit' });
    const cold = await measure(page);
    await page.evaluate(() => navigator.serviceWorker?.ready);
    const sw = await page.evaluate(() => !!navigator.serviceWorker?.controller || 'pending');
    // A fresh page in the same context: the worker now controls the scope.
    await page.close();
    const page2 = await context.newPage();
    await throttle(page2, profile);
    await page2.goto(BASE_URL, { waitUntil: 'commit' });
    const warm = await measure(page2);
    const warmControlled = await page2.evaluate(() => !!navigator.serviceWorker?.controller);
    rows.push({ viewport: `${viewport.width}x${viewport.height}`, profile: profile.name, cold, warm, warmControlled, sw, errors });
    await context.close();
  }
}
await browser.close();

const f = (n) => (n === null ? '—' : `${(n / 1000).toFixed(2)}s`);
console.log('viewport  profile      visit  kB    js      boot    frame   hit');
let over = false;
for (const r of rows) {
  for (const [visit, m] of [['first', r.cold], ['return', r.warm]]) {
    console.log(`${r.viewport.padEnd(9)} ${r.profile.padEnd(12)} ${visit.padEnd(6)} ${String(m.kb).padEnd(5)} ${f(m.js).padEnd(7)} ${f(m.boot).padEnd(7)} ${f(m.frame).padEnd(7)} ${f(m.hit)}`);
    if (visit === 'first' && m.hit > 5000) over = true;
  }
  if (!r.warmControlled) console.log(`  (return visit not served by the worker: ${r.sw})`);
  if (r.errors.length) console.log(`  page errors: ${r.errors.join(' | ')}`);
}
console.log(over ? 'OVER 5 s on a first visit — queue a fix with the breakdown.' : 'Every first visit credited a tap inside 5 s.');
process.exitCode = over ? 1 : 0;
