// Playwright is deliberately not a project dependency (CLAUDE.md: the game
// itself stays dependency-free), so it lives wherever it was installed. Set
// PLAYWRIGHT_PATH to that install and these scripts run *in place*, straight
// out of the repo, instead of having to be copied next to it.
//
// That copy step is not just friction: this session twice ran a stale copy
// of a script and once had a crashed run "prove" that nothing had changed.
// Running the file you actually edited removes the whole class of mistake.
const pwPath = process.env.PLAYWRIGHT_PATH
  ? (/\.[cm]?js$/.test(process.env.PLAYWRIGHT_PATH)
      ? process.env.PLAYWRIGHT_PATH
      : `${process.env.PLAYWRIGHT_PATH.replace(/\/$/, '')}/index.js`)
  : 'playwright';
// playwright's entry is CommonJS, so a dynamic import may deliver the
// module under `default` rather than as named exports.
const pw = await import(pwPath);
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`could not load playwright's chromium from ${pwPath}`);

/**
 * Does the title on screen name the tune you are actually hearing?
 *
 * This is not cosmetic. The entire premise is that the child already knows
 * these songs — "if you know how the tune goes, the pitch is free". Naming
 * the wrong one does not just look sloppy, it teaches a false association
 * to exactly the child who is paying attention.
 *
 * The timing is non-obvious and therefore worth guarding: song passes are
 * queued a lookahead ahead of playback, so `announceSong` holds the title
 * back until the music actually reaches that song's first note. That
 * arithmetic (`nextPassStartTimeMs - songDurationMs`) has no test.
 *
 * Here each pass is recorded with the real time window its notes occupy,
 * and every title change is checked against the window of the song it names.
 */
const SECONDS = Number(process.argv[2] ?? 150);

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:4173/WanderingBardGame/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const s = window.game.scene.scenes[0];
  window.__passes = [];
  window.__titles = [];

  // Take each pass's window from the scene's own bookkeeping.
  // `nextPassStartTimeMs` is exactly where the next pass begins, so the
  // window of the pass appended by a call is [before, after).
  //
  // Two earlier attempts got this wrong, both by reading the wrong thing.
  // Slicing `s.markers` from a remembered index fails because that array is
  // filtered in place as notes scroll off, so it shrinks under the index.
  // Recording the notes handed to `audioEngine.schedule` fails differently:
  // the first call carries the entire pre-tap backlog rather than one song,
  // so pass N and title N are not the same thing and pairing them by index
  // is meaningless. Both produced confident, specific failures against a
  // game that was fine.
  const origAppend = s.appendSongPass.bind(s);
  s.appendSongPass = (...a) => {
    const from = s.nextPassStartTimeMs;
    const r = origAppend(...a);
    window.__passes.push({
      id: s.currentSongId,
      title: s.pendingAnnounce.length ? s.pendingAnnounce[s.pendingAnnounce.length - 1].title : null,
      fromMs: Math.round(from),
      toMs: Math.round(s.nextPassStartTimeMs),
    });
    return r;
  };

  // Record every title actually shown, with the game time it appeared.
  const setText = s.songTitleText.setText.bind(s.songTitleText);
  s.songTitleText.setText = (t) => {
    window.__titles.push({ title: t, atMs: Math.round(s.time.now - s.startTimeMs) });
    return setText(t);
  };
});

await page.mouse.click(600, 500);

async function play(seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    const waitMs = await page.evaluate(() => {
      const s = window.game.scene.scenes[0];
      const now = s.time.now - s.startTimeMs;
      const next = s.markers.find((m) => m.resolved === null && m.beat.hitTimeMs > now - 40);
      return next ? next.beat.hitTimeMs - now : 50;
    });
    if (waitMs > 400) { await page.waitForTimeout(400); continue; }
    if (waitMs > 2) await page.waitForTimeout(waitMs);
    await page.mouse.click(600, 500);
  }
}
await play(SECONDS);

const out = await page.evaluate(() => ({
  passes: window.__passes,
  titles: window.__titles,
  titlesById: window.__passes.map((p) => p.id),
}));

console.log('passes queued :', out.passes.length);
console.log('titles shown  :', out.titles.length);

const fail = [];
if (errors.length) fail.push('page errors: ' + errors.join(' | '));
if (out.titles.length < 3) fail.push(`only ${out.titles.length} titles were shown in ${SECONDS}s — nothing to check`);
if (out.passes.length < 3) fail.push(`only ${out.passes.length} passes queued`);

// For each title actually shown, find which pass was playing at that
// moment, and check the title names THAT song. No index pairing.
let checked = 0;
for (const t of out.titles) {
  const playing = out.passes.find((p) => t.atMs >= p.fromMs && t.atMs < p.toMs);
  if (!playing) {
    // Titles shown before the first tap (while the walk is queued but not
    // started) have no pass playing yet; ignore rather than fail.
    console.log(`  "${t.title}" at ${t.atMs}ms — no pass in flight, skipped`);
    continue;
  }
  checked++;
  const ok = playing.title === t.title;
  console.log(`  ${ok ? 'ok ' : 'BAD'} "${t.title}" at ${t.atMs}ms — playing pass is "${playing.title}" (${playing.fromMs}-${playing.toMs}ms)`);
  if (!ok) {
    fail.push(`"${t.title}" was on screen at ${t.atMs}ms while "${playing.title}" was the tune actually playing`);
  }
}
if (checked < 3) fail.push(`only ${checked} titles could be matched to a playing pass`);

console.log(fail.length ? 'FAIL:\n - ' + fail.join('\n - ') : 'PASS: every title names the tune that is actually playing');
await browser.close();
process.exit(fail.length ? 1 : 0);
