/**
 * Coins are a readout of song-meter performance, not a separate system —
 * they accrue continuously at a rate scaled by how full the meter is, so a
 * strong tune fills the coin case faster and a stalled one slows it to a
 * halt (ROADMAP task 11). There is no drain: a readout never takes coins
 * back, it just stops growing when performance dips.
 */
export function accumulateCoins(
  coins: number,
  meterRatio: number,
  deltaMs: number,
  ratePerSec: number
): number {
  if (deltaMs <= 0 || meterRatio <= 0) {
    return coins;
  }
  return coins + (ratePerSec * meterRatio * deltaMs) / 1000;
}

/**
 * True the instant continuous accrual crosses a whole multiple of `every`
 * (idea backlog: "coin chime cap"). Coins accrue as a fraction every frame,
 * so a whole-coin milestone can't be caught by equality against a round
 * number — it has to be read off the floor before and after this frame's
 * accrual.
 */
export function crossedCoinMilestone(prevCoins: number, coins: number, every: number): boolean {
  if (every <= 0) return false;
  return Math.floor(coins / every) > Math.floor(prevCoins / every);
}
