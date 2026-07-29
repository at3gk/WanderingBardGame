import Phaser from 'phaser';
import { ROAD_TILE_WIDTH } from '../render/scenery';

/**
 * Coins and steps: the two simplest readouts left in `setWalkChromeVisible`
 * once task 111 took the meter out (RoadScene 1783 lines — ROADMAP task
 * 112). Both are pure displays of a number RoadScene already owns (`coins`,
 * `distancePx`) with no interactive state and no entanglement with the
 * staff/clef/hit-line trio also named in that method — DESIGN.md groups
 * "steps and coins" together as counts of walking, and so did the comment
 * this split came from.
 *
 * Shaped like `./meterBar`: build once, lay out every frame, show or hide
 * with the rest of the walk chrome. `coinIcon`/`coinText`/`distanceText`
 * stay plain (non-private) fields on RoadScene rather than a returned
 * handle — same reason as the meter: a private class field can't satisfy a
 * plain interface type, and `tools/hud-check.mjs` and several other checks
 * already reach `scene.coinIcon`/`scene.coinText`/`scene.distanceText`/
 * `scene.coins`/`scene.distancePx` directly.
 */
export interface ReadoutsHost {
  add: Phaser.GameObjects.GameObjectFactory;
  scale: { width: number; height: number };
  coins: number;
  distancePx: number;
  coinIcon: Phaser.GameObjects.Image;
  coinText: Phaser.GameObjects.Text;
  distanceText: Phaser.GameObjects.Text;
}

const COIN_ICON_RADIUS = 8;
const COIN_MARGIN_TOP = 24;
const COIN_MARGIN_RIGHT = 24;
const DISTANCE_MARGIN_LEFT = 24;
const DISTANCE_MARGIN_BOTTOM = 20;

/** Builds the coin and distance readouts. Called once, from RoadScene.create(). */
export function createReadouts(host: ReadoutsHost): void {
  host.coinIcon = host.add.image(0, 0, 'coin-icon');
  host.coinText = host.add.text(0, 0, '0', {
    fontFamily: 'sans-serif',
    fontSize: '16px',
    color: '#e8d9c0',
  });
  host.coinText.setOrigin(0, 0.5);

  host.distanceText = host.add.text(0, 0, '0 steps', {
    fontFamily: 'sans-serif',
    fontSize: '14px',
    color: '#a89bb5',
  });
  host.distanceText.setOrigin(0, 1);
}

/** Repositions and re-renders both readouts every frame from the live state. */
export function layoutReadouts(host: ReadoutsHost): void {
  const iconX = host.scale.width - COIN_MARGIN_RIGHT - COIN_ICON_RADIUS;
  host.coinIcon.setPosition(iconX, COIN_MARGIN_TOP);
  host.coinText.setText(Math.floor(host.coins).toString());
  host.coinText.setPosition(iconX - COIN_ICON_RADIUS - host.coinText.width - 8, COIN_MARGIN_TOP);

  // Steps are `distancePx` converted through `ROAD_TILE_WIDTH` (the road's
  // own dash-tile size) rather than a new arbitrary unit, so one "step"
  // matches one tile of ground already scrolling past.
  const steps = Math.floor(host.distancePx / ROAD_TILE_WIDTH);
  host.distanceText.setText(`${steps} steps`);
  host.distanceText.setPosition(DISTANCE_MARGIN_LEFT, host.scale.height - DISTANCE_MARGIN_BOTTOM);
}

/** Shows or hides both readouts — called from RoadScene.setWalkChromeVisible alongside the rest of the walk-only chrome. */
export function setReadoutsVisible(host: ReadoutsHost, visible: boolean): void {
  host.coinIcon.setVisible(visible);
  host.coinText.setVisible(visible);
  host.distanceText.setVisible(visible);
}
