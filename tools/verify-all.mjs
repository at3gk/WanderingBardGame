import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs the whole headless suite and prints one summary.
 *
 * There are eighteen scripts here now, several of which take minutes, and a
 * run that has to remember all of them will sooner or later remember only
 * the fast ones. This is the single command to reach for.
 *
 *   node verify-all.mjs          # all 17 (~22 min)
 *   node verify-all.mjs quick    # the fast nine (~5 min)
 *
 * Expects the preview server on :4173 and Playwright installed in the
 * working directory — see Setup above in README.md. Runs the checks one at
 * a time on purpose: several Chromium instances at once starve each other,
 * and a long run measured under that contention reported 11fps and a third
 * of its taps missing against a game that was fine.
 */

const here = dirname(fileURLToPath(import.meta.url));
const quick = process.argv[2] === 'quick';

/** `slow` scripts are skipped in quick mode. */
const CHECKS = [
  { name: 'proofsheet', args: ['proofsheet.mjs'] },
  { name: 'scenery-sheet', args: ['scenery-sheet.mjs'] },
  { name: 'ui-sheet', args: ['ui-sheet.mjs'] },
  { name: 'autoplay', args: ['autoplay.mjs', '70'] },
  { name: 'pillar-check', args: ['pillar-check.mjs'] },
  { name: 'mash-check', args: ['mash-check.mjs', '60'] },
  { name: 'input-check', args: ['input-check.mjs'] },
  { name: 'songpick-check', args: ['songpick-check.mjs'], slow: true },
  { name: 'freeplay-check', args: ['freeplay-check.mjs'] },
  { name: 'dusk-check', args: ['dusk-check.mjs'] },
  { name: 'coinchime-check', args: ['coinchime-check.mjs'] },
  { name: 'title-check', args: ['title-check.mjs', '130'], slow: true },
  { name: 'nofail-check', args: ['nofail-check.mjs', '45'], slow: true },
  { name: 'backgrounding-check', args: ['backgrounding-check.mjs'], slow: true },
  { name: 'reveal-check', args: ['reveal-check.mjs', '90'], slow: true },
  { name: 'rotate-check', args: ['rotate-check.mjs'], slow: true },
  { name: 'learning-check', args: ['learning-check.mjs'], slow: true },
  { name: 'multisession-check', args: ['multisession-check.mjs'], slow: true },
  { name: 'timeaway-check', args: ['timeaway-check.mjs'], slow: true },
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
