/**
 * Boot.
 *
 * Deliberately tiny. It creates the app, puts the road on it, starts the
 * loop, and exposes a handle for the headless checks. Everything that could
 * plausibly go wrong at start-up — no WebGL, a shader that will not compile,
 * storage that throws — is caught here and turned into something a player
 * can read, because a blank dark-plum page is indistinguishable from a
 * broken deploy.
 */

import { App } from './three/App';
import { RoadStage } from './three/RoadStage';
import type { Phase } from './core/journey';

const host = document.getElementById('game');
if (!host) throw new Error('no #game host element');

function fail(message: string, detail?: unknown): void {
  // No framework and no styling system: this has to work in exactly the
  // circumstances where the rest of the game does not.
  const box = document.createElement('div');
  box.setAttribute(
    'style',
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'padding:2rem;color:#e8d9c0;background:#1a1621;font:16px/1.6 system-ui,sans-serif;' +
      'text-align:center;',
  );
  box.textContent = message;
  document.body.appendChild(box);
  if (detail) console.error(detail);
}

try {
  const app = new App(host);
  const stage = new RoadStage(app);
  app.setStage(stage);
  app.start();

  /**
   * The handle the headless checks drive the game through — the only global
   * the game defines. `pose` in particular is what lets
   * `tools/postcard.mjs` stand the bard somewhere specific at a specific
   * hour and photograph it: a critic reviewing the art cannot play, so the
   * game has to be able to hold a pose.
   */
  (window as unknown as { bard: unknown }).bard = {
    app,
    stage,
    pose: (options: { s?: number; dayFraction?: number; phase?: Phase }) => stage.pose(options),
    describe: () => stage.describe(),
  };
} catch (error) {
  fail(
    'The road will not open in this browser. It needs WebGL 2 — a different browser, or turning hardware acceleration back on, usually does it.',
    error,
  );
}
