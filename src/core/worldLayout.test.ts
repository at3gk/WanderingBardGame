import { describe, expect, it } from 'vitest';
import {
  BARD_HEIGHT,
  BOTTOM_MARGIN,
  IDEAL_LANE_TO_GROUND,
  MIN_LANE_Y,
  NOTATION_ABOVE_LANE,
  TOP_CHROME_BOTTOM,
  worldLayout,
} from './worldLayout';

/** Height only — the vertical layout doesn't care how wide the screen is. */
const HEIGHTS: Array<[string, number]> = [
  ['iphone se portrait', 568],
  ['iphone se landscape', 320],
  ['phone portrait', 664],
  ['phone landscape', 390],
  ['tablet portrait', 1024],
  ['tablet landscape', 768],
  ['desktop', 800],
  ['narrow desktop', 700],
];

describe('worldLayout', () => {
  it('keeps the whole road on screen at every height', () => {
    // The bug: 568x320 put the road at 308-368 on a 320px screen, leaving
    // 12 of its 60px visible.
    for (const [name, h] of HEIGHTS) {
      const l = worldLayout(h);
      expect(l.roadBottom, `${name} road bottom`).toBeLessThanOrEqual(h);
      expect(l.roadTop, `${name} road top`).toBeGreaterThan(0);
      expect(l.roadBottom - l.roadTop, `${name} road height`).toBe(60);
    }
  });

  it('keeps the bard whole — feet on the road, head on screen', () => {
    for (const [name, h] of HEIGHTS) {
      const l = worldLayout(h);
      expect(l.groundY, `${name} feet`).toBeLessThanOrEqual(h);
      expect(l.groundY - BARD_HEIGHT, `${name} head`).toBeGreaterThan(0);
    }
  });

  it('never lets the notation reach the top chrome', () => {
    for (const [name, h] of HEIGHTS) {
      const highestNote = worldLayout(h).laneY - NOTATION_ABOVE_LANE;
      expect(highestNote, `${name}`).toBeGreaterThanOrEqual(TOP_CHROME_BOTTOM);
    }
  });

  it('leaves every viewport that already fitted pixel-identical', () => {
    // The whole point of anchoring on the old constant: this change must
    // not move the game on the phones it already suited.
    for (const h of [568, 664, 1024, 768, 800, 700]) {
      const l = worldLayout(h);
      expect(l.laneY, `${h}px lane`).toBe(h / 2);
      expect(l.groundY, `${h}px ground`).toBe(h / 2 + IDEAL_LANE_TO_GROUND);
      expect(l.cramped, `${h}px cramped`).toBe(false);
    }
  });

  it('only pulls the lane up on screens too short for the old layout', () => {
    for (const [name, h] of HEIGHTS) {
      const l = worldLayout(h);
      expect(l.laneY, `${name}`).toBeLessThanOrEqual(h / 2);
      expect(l.laneY, `${name}`).toBeGreaterThanOrEqual(MIN_LANE_Y);
    }
  });

  it('fixes the landscape phone that was broken', () => {
    const l = worldLayout(390);
    expect(l.roadBottom).toBeLessThanOrEqual(390);
    // And it is not merely on screen — the bard clears the lowest note.
    expect(l.cramped).toBe(false);
  });

  it('reports the short-screen trade rather than hiding it', () => {
    // 320px tall cannot fit chrome + notation + bard + road at these sizes.
    // Something has to give, and the layout says which.
    const l = worldLayout(320);
    expect(l.cramped).toBe(true);
    expect(l.roadBottom).toBeLessThanOrEqual(320);
    expect(l.laneY).toBe(MIN_LANE_Y);
  });

  it('degrades sanely far below any real device', () => {
    for (const h of [240, 200, 160]) {
      const l = worldLayout(h);
      expect(Number.isFinite(l.laneY), `${h}`).toBe(true);
      expect(Number.isFinite(l.groundY), `${h}`).toBe(true);
      expect(l.laneY, `${h}`).toBe(MIN_LANE_Y);
    }
  });

  it('puts the bard on the road, not floating above or sunk below it', () => {
    for (const [name, h] of HEIGHTS) {
      const l = worldLayout(h);
      expect(l.groundY, name).toBeGreaterThan(l.roadTop);
      expect(l.groundY, name).toBeLessThan(l.roadBottom);
    }
  });

  it('leaves a margin under the road so the world is not sheared off', () => {
    for (const [name, h] of HEIGHTS) {
      const l = worldLayout(h);
      if (l.roadBottom < h) {
        expect(h - l.roadBottom, name).toBeGreaterThanOrEqual(BOTTOM_MARGIN);
      }
    }
  });
});
