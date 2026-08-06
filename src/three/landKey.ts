/**
 * The land key: the hour relights the LAND, not only the sky.
 *
 * Wave 13's strongest cross-lens agreement (colour and value naming the
 * same five daylight frames) was that the sunset hours are authored and
 * the daylight hours are engine defaults: "the greens are an unbound
 * ladder — yellow-green mid grass, blue-green pine, blue-grey pines,
 * olive rocks — at equal saturation", "cerulean + Kelly green + orange
 * at equal volume, so nothing dominates and nothing accents". The sunset
 * frames escape this for free because a low warm sun tints every surface
 * toward one family; a high near-white sun shows every albedo raw.
 *
 * The key is the answer the colour script's noon section licenses: give
 * daylight a DOMINANT HUE FIELD by binding near-family hues toward the
 * biome's own green family — an attraction, not a tint. In the painterly
 * fragment, an albedo whose chroma points within 90° of the key's is
 * rotated part-way toward it; chroma pointing away (the terracotta road,
 * the bard's red, flowers, firelight) is untouched by construction. So
 * the unbound green ladder binds, the rogue teal water comes into the
 * family, and every designed dissenter keeps its full voice — which is
 * the palette's own "one family, one dissenter" rule, enforced by the
 * hour instead of hoped for.
 *
 * The schedule: zero below a sun height where the raking light already
 * unifies the frame (dawn/golden/dusk are CARRYING hours — the script
 * spends no runs there and this module must not touch them), rising to
 * its full pull at the high sun that has nothing else to offer.
 */

export type LandKeyBiome = 'village' | 'forest' | 'riverside';

/**
 * The binding target per biome — each biome's own grass-family hue from
 * palette.ts (village 0xb1cc63 warm yellow-green, forest 0x568752 deep
 * blue-green, riverside 0x8bbd93 cool grey-green). The KEY is a chroma
 * DIRECTION: only its hue matters in the shader (the attraction is
 * luma-preserving and magnitude-preserving), so these being grass hexes
 * rather than abstract hue angles keeps them honest against the palette.
 */
export const LAND_KEYS: Record<LandKeyBiome, number> = {
  village: 0xb1cc63,
  forest: 0x568752,
  riverside: 0x8bbd93,
};

/**
 * Full strength of the pull at high sun. 0.35 rotates a hue about a
 * third of the way toward the family — enough to read as one field,
 * deliberately short of collapsing the within-family variety the noon
 * design wants at full voice.
 */
export const LAND_KEY_MAX = 0.35;

/**
 * Sun heights (sunDirection.y, the sine of elevation) the ramp spans.
 * Morning's 0.38 rad sun (y ≈ 0.37) gets a partial pull; noon's 0.70 rad
 * (y ≈ 0.64) full; dawn (0.16 rad, y ≈ 0.16) and golden (0.34 rad on the
 * way down, y ≈ 0.33) little to none — those hours carry themselves.
 */
export const LAND_KEY_RISE_START = 0.3;
export const LAND_KEY_RISE_END = 0.55;

/** The daylight pull for a sun height; 0 at and below the horizon. */
export function landKeyAmount(sunHeight: number): number {
  const t = Math.min(
    1,
    Math.max(0, (sunHeight - LAND_KEY_RISE_START) / (LAND_KEY_RISE_END - LAND_KEY_RISE_START)),
  );
  return LAND_KEY_MAX * t * t * (3 - 2 * t);
}
