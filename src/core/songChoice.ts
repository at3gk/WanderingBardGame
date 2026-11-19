import { Song } from './song';
import { BOOK_TWO_SONGS, SONGS, songForBiome } from './songs';
import { isCustomSongId, loadCustomSongs } from './customSongs';

/**
 * Choosing one song to learn, instead of letting the songbook rotate.
 *
 * Rotation is the right default — a long walk shouldn't be one tune on
 * repeat — but it is the wrong thing for *learning a piece*. A child who
 * wants to play Twinkle should be able to play Twinkle, and repetition is
 * the whole mechanism by which the letters fade off its notes.
 *
 * `null` means wander: the original behaviour, songs rotating per biome.
 * A pinned tune plays wherever the road goes — the road keeps its own
 * geography (it once settled in the tune's home biome; the 3D road of v0.6
 * dropped that, and run 324 cut the leftover `homeBiomeOf`).
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
    // A family's own tune (task 176) resolves the same way — a saved song
    // is the walk's tune like any other, no home biome required.
    if (isCustomSongId(choice)) {
      const custom = loadCustomSongs().find((s) => s.id === choice);
      if (custom) return custom;
    }
  }
  return songForBiome(biomeId, pass);
}
