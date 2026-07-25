import { chromium } from 'playwright';

// Usage: node shot.mjs [outPrefix] [settleMs]
const prefix = process.argv[2] ?? 'shot';
const settleMs = Number(process.argv[3] ?? 1500);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(settleMs);

await page.screenshot({ path: `${prefix}-full.png` });
// Bard region: hitLineX = width*0.25 = 225, feet at laneY+110 = 410.
await page.screenshot({ path: `${prefix}-bard.png`, clip: { x: 135, y: 280, width: 190, height: 160 } });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
