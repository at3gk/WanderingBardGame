import { Song } from './song';
import { BOOK_TWO_SONGS, SONGS, SONGS_BY_BIOME, songForBiome } from './songs';

/**
 * Choosing one song to learn, instead of letting the songbook rotate.
 *
 * Rotation is the right default — a long walk shouldn't be one tune on
 * repeat — but it is the wrong thing for *learning a piece*. A child who
 * wants to play Twinkle should be able to play Twinkle, and repetition is
 * the whole mechanism by which the letters fade off its notes.
 *
 * `null` means wander: the original behaviour, songs rotating per biome.
 */
export type SongChoice = string | null;

/** The chosen song, or the rotation's pick when wandering. Falls back to rotation for an unknown id. */
export function songForPass(choice: SongChoice, biomeId: string, pass: number): Song {
  if (choice) {
    // Both books resolve: a pinned Book Two song is the walk's tune like any
    // other (task 165). The rotation itself stays Book One — the road's own
    // scenery-matched curriculum; Book Two is only ever chosen.
    const chosen = SONGS.find((s) => s.id === choice) ?? BOOK_TWO_SONGS.find((s) => s.id === choice);
    if (chosen) return chosen;
  }
  return songForBiome(biomeId, pass);
}

/**
 * Which biome a song belongs to.
 *
 * The three biomes are the three registers — village sits around middle C,
 * forest in the middle of the staff, riverside in its upper half — so a
 * song's home is not decoration. Settling on one tune settles the road in
 * the place that tune lives, which keeps the scenery honest about what the
 * child is reading. Returns null for an unknown id (i.e. keep wandering).
 */
export function homeBiomeOf(choice: SongChoice): string | null {
  if (!choice) return null;
  for (const [biomeId, set] of Object.entries(SONGS_BY_BIOME)) {
    if (set.some((s) => s.id === choice)) return biomeId;
  }
  return null;
}

/** Every song, grouped for the picker, in the order the road would meet them. */
export function songMenu(): Array<{ biomeId: string; songs: Song[] }> {
  return Object.entries(SONGS_BY_BIOME).map(([biomeId, songs]) => ({ biomeId, songs }));
}

export interface GridLayout {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

/**
 * How to lay `count` picker entries out inside a panel.
 *
 * This exists because the picker has to fit a **short landscape phone**.
 * Twelve entries stacked vertically need ~460px, which fits a 320x568
 * portrait screen comfortably and does not fit a 664x390 landscape one at
 * all. So the column count is derived from the height available rather
 * than fixed, and the panel grows sideways instead of overflowing.
 *
 * Pure so the awkward viewport is a unit test rather than something to
 * notice on a real phone later.
 */
export function songGridLayout(
  count: number,
  panelW: number,
  panelH: number,
  minCellH = 34,
  maxCellW = 260
): GridLayout {
  const safeCount = Math.max(1, count);
  const rowsThatFit = Math.max(1, Math.floor(panelH / minCellH));
  const cols = Math.max(1, Math.min(safeCount, Math.ceil(safeCount / rowsThatFit)));
  const rows = Math.ceil(safeCount / cols);
  return {
    cols,
    rows,
    cellW: Math.min(maxCellW, panelW / cols),
    cellH: panelH / rows,
  };
}
