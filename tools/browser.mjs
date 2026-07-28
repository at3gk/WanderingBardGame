// Shared browser launch for the headless checks.
//
// Two environments to satisfy. On a machine where Playwright installed its
// own matching browser, `chromium.launch()` with no path is correct. In the
// remote session this project is developed from, a Chromium is
// pre-installed under PLAYWRIGHT_BROWSERS_PATH but its build number does
// not always match the Playwright package that gets npm-installed ad hoc —
// Playwright then insists on a browser revision that isn't there and every
// check dies at launch. `CHROME_PATH` (or the auto-probe below) points it
// at the browser that actually exists.
//
// The WebGL flags are not optional: headless Chromium in CI has no GPU, and
// without SwiftShader enabled the page gets *no* WebGL context at all. The
// visual checks would then pass vacuously against a blank canvas, which is
// the worst possible failure mode for a check whose whole job is to notice
// a blank canvas.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const pwPath = process.env.PLAYWRIGHT_PATH
  ? (/\.[cm]?js$/.test(process.env.PLAYWRIGHT_PATH)
      ? process.env.PLAYWRIGHT_PATH
      : `${process.env.PLAYWRIGHT_PATH.replace(/\/$/, '')}/index.js`)
  : 'playwright';

const pw = await import(pwPath);
export const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`could not load playwright's chromium from ${pwPath}`);

export const GL_ARGS = [
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  // Deterministic frames matter more than smooth ones for a screenshot
  // check: without this, a shot can land mid-vsync and catch a half-drawn
  // frame, and the resulting flake looks exactly like a real regression.
  '--disable-frame-rate-limit',
];

function probeExecutable() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  // Prefer full Chromium over headless_shell: the shell build has no
  // support for some GL paths and reports subtly different pixels.
  const candidates = [];
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium')) continue;
    for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
      const full = join(root, entry, rel);
      if (existsSync(full)) candidates.push(full);
    }
  }
  candidates.sort((a, b) => (a.includes('headless_shell') ? 1 : 0) - (b.includes('headless_shell') ? 1 : 0));
  return candidates[0];
}

export async function launch(extraArgs = []) {
  const executablePath = probeExecutable();
  return chromium.launch({
    args: [...GL_ARGS, ...extraArgs],
    ...(executablePath ? { executablePath } : {}),
  });
}

export const BASE_URL = process.env.BARD_URL ?? 'http://localhost:4173/WanderingBardGame/';
