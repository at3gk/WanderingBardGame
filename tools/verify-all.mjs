import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs the headless suite and prints one summary.
 *
 * Expects the preview server on :4173 and Playwright installed in the
 * working directory — see Setup above in README.md. Runs the checks one at
 * a time on purpose: several Chromium instances at once starve each other,
 * and a long run measured under that contention reported 11fps and a third
 * of its taps missing against a game that was fine.
 *
 * The suite is small right now: v0.6 rebuilt the game's presentation in
 * Three.js (STATE.md), and every check that drove the old Phaser scene
 * through `window.game.scene.scenes[0]` went with it — that global no
 * longer exists. `shader-check.mjs` is the one survivor, driving the
 * current game through its `window.bard` handle. `postcard.mjs` is a
 * companion visual-QA tool (poses the bard and writes screenshots for a
 * human/agent to look at) rather than a pass/fail regression check, so it
 * is not wired in here — run it directly. New checks against the Three.js
 * game belong in this list as they're written.
 *
 * `frame-quality.mjs` joined it in Run 45: it measures the value range, hue
 * spread and largest flat area of six posed frames, which are the three
 * things successive art critiques kept reporting as adjectives.
 */

const here = dirname(fileURLToPath(import.meta.url));
const quick = process.argv[2] === 'quick';

/** `slow` scripts are skipped in quick mode. */
const CHECKS = [
  { name: 'shader-check', args: ['shader-check.mjs'] },
  // Boots the game once per pose at two aspect ratios, so it is the slower
  // of the two by some margin.
  { name: 'frame-quality', args: ['frame-quality.mjs'], slow: true },
];

function run(check) {
  return new Promise((resolve) => {
    const script = join(here, check.args[0]);
    if (!existsSync(script)) return resolve({ ...check, code: -1, tail: 'script not found' });
    const startedAt = Date.now();
    const child = spawn(process.execPath, [script, ...check.args.slice(1)], { cwd: process.cwd() });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      const lines = out.trimEnd().split('\n');
      const verdict = lines.filter((l) => /^(PASS|FAIL)/.test(l)).pop();
      resolve({
        ...check,
        code,
        seconds: Math.round((Date.now() - startedAt) / 1000),
        tail: verdict ?? lines.slice(-1)[0] ?? '(no output)',
        full: out,
      });
    });
  });
}

/**
 * Progress goes to stderr, not stdout. Node block-buffers stdout when it is
 * a pipe rather than a terminal, so `verify-all | tee log` showed absolutely
 * nothing for the full fourteen minutes and then everything at once — which
 * is indistinguishable from a hang, and was briefly mistaken for one.
 * stderr is unbuffered, so the running commentary streams either way.
 */
const progress = (text) => process.stderr.write(text);

const results = [];
for (const check of CHECKS) {
  if (quick && check.slow) {
    progress(`- ${check.name}: skipped (quick)\n`);
    continue;
  }
  progress(`- ${check.name}: running... `);
  const r = await run(check);
  results.push(r);
  progress(`${r.code === 0 ? 'ok' : 'FAILED'} (${r.seconds}s)\n`);
  if (r.code !== 0) progress(r.full.trimEnd().split('\n').slice(-12).join('\n') + '\n');
}

console.log('\n== summary ==');
for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name.padEnd(20)} ${r.tail}`);

const failed = results.filter((r) => r.code !== 0);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks green`);
process.exit(failed.length ? 1 : 0);
