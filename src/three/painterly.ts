/**
 * The painterly material — the single art-direction anchor.
 *
 * Every solid surface in the world runs this shader. That is the whole
 * point: a storybook look falls apart the moment two objects are lit by
 * different rules, and the fastest way to make low-poly 3D read as "cheap
 * asset pile" rather than "illustration" is to let three's default PBR
 * response anywhere near it. So there is one lighting model here and
 * everything obeys it.
 *
 * What it does, and why each part earns its cost:
 *
 * - **Banded diffuse.** Light is quantised into three broad bands with
 *   soft, slightly *irregular* edges. Hard toon banding reads as cel
 *   animation; a gradient reads as untextured 3D. The soft band edge,
 *   broken up by world-space noise, is what reads as a brush.
 * - **Sky-tinted shadow.** Unlit faces are not "the albedo times 0.4" —
 *   they take a cool tint from the sky colour, warm faces take the sun.
 *   This one substitution is most of the difference between "flat" and
 *   "painted", and it is what makes dusk work.
 * - **Rim light.** A fresnel edge in the sky's colour separates silhouettes
 *   from the background without an outline pass. Cheaper than post-process
 *   outlines and much friendlier to a phone.
 * - **World-space breakup.** Two octaves of cheap value noise, sampled in
 *   *world* space so it doesn't swim when objects move, applied as a small
 *   value-and-warmth wobble. This is the "watercolour paper" grain.
 * - **Wind.** A vertex sway driven by a per-vertex weight, so grass tips
 *   and cloak hems move and roots and shoulders don't.
 * - **Height fog** matched to the sky gradient, so distance dissolves into
 *   the horizon instead of ending at a hard silhouette.
 *
 * Real shadow maps are included (three's own chunks) rather than faked
 * with blob decals: the long raking shadows at dawn and dusk are load-
 * bearing for the time-of-day mood, and a blob can't do them.
 */

import {
  Color,
  DoubleSide,
  FrontSide,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type IUniform,
  type Side,
} from 'three';

/** Uniforms shared by every painterly surface in a scene. */
export interface PainterlyGlobals {
  uTime: IUniform<number>;
  uSunDirection: IUniform<Vector3>;
  uSunColor: IUniform<Color>;
  uSkyColor: IUniform<Color>;
  uHorizonColor: IUniform<Color>;
  uGroundBounce: IUniform<Color>;
  uFogColor: IUniform<Color>;
  uFogNear: IUniform<number>;
  uFogFar: IUniform<number>;
  uFogHeight: IUniform<number>;
  uWindStrength: IUniform<number>;
  uWindDirection: IUniform<Vector3>;
  uExposure: IUniform<number>;
  /**
   * The hearth: one warm point source, shared by every painterly surface.
   *
   * There is exactly one because the whole art direction rests on there
   * being one lighting model. The campfire is the only thing in the game
   * that lights the world from inside it, and before this existed the bard
   * rendered as a near-black mass at his own fire — the one frame DESIGN.md
   * says is allowed to be genuinely warm. The alternative on offer was a
   * warm tint faked onto the camp's own materials, which is a second
   * lighting model wearing the first one's clothes.
   *
   * Strength 0 means "no fire anywhere", which is the state for the whole
   * daylit walk, and the term costs a few instructions and no branch.
   */
  uHearthPosition: IUniform<Vector3>;
  uHearthColor: IUniform<Color>;
  uHearthStrength: IUniform<number>;
  uHearthRadius: IUniform<number>;
}

export interface PainterlyOptions {
  /** Base albedo. Vertex colours multiply this when `vertexColors` is on. */
  color?: Color | number | string;
  /** Second albedo, mixed in by the world-space breakup noise. */
  colorVariant?: Color | number | string;
  /** How much the breakup noise swings value. 0 disables the grain. */
  grain?: number;
  /** World-space frequency of the grain. Bigger = finer. */
  grainScale?: number;
  /** Fresnel rim strength. Foliage wants more than architecture. */
  rim?: number;
  /** Fresnel falloff exponent. Lower = broader rim. */
  rimPower?: number;
  /** Extra darkening toward the bottom of the object's own bounding box. */
  baseShade?: number;
  /** Local-space height over which `baseShade` fades out. */
  baseShadeHeight?: number;
  /** Wind sway amplitude in metres at full vertex weight. */
  sway?: number;
  /** Wind sway speed multiplier. */
  swaySpeed?: number;
  /** Read a per-vertex `aSway` attribute instead of deriving from height. */
  swayAttribute?: boolean;
  /** Derive sway weight from local Y over this height when no attribute. */
  swayHeight?: number;
  /** Use per-vertex colours. */
  vertexColors?: boolean;
  /**
   * Strength of the ground's own colour drift, 0 disables it.
   *
   * Only the terrain sets this. It turns on a pair of extra vertex
   * attributes, aToneLo and aToneHi, which give this fragment the dark
   * and pale ends of the ground palette it is standing on; the shader then
   * drifts between them with world-space noise. See the note by the drift
   * itself for why this cannot live in vertex colour.
   */
  groundTones?: number;
  /** Cast/receive shadows. Off for tiny scatter meshes that can't afford it. */
  receiveShadow?: boolean;
  /** How dark a shadowed surface goes, 0..1. Cosy games do not use black. */
  shadowDepth?: number;
  /** Softening applied to the light bands. 0 = hard cel edges. */
  bandSoftness?: number;
  side?: Side;
  /** Alpha-tested cutout, for billboard grass and leaves. */
  alphaTest?: number;
  transparent?: boolean;
  /** Emissive lift, used by lanterns, the campfire, and song magic. */
  emissive?: Color | number | string;
  emissiveStrength?: number;
  /** Flat-shade: derive the normal from screen-space derivatives. */
  flatShading?: boolean;
  /**
   * Per-material multiplier on the distance fog, 1 = the world's own haze.
   *
   * Exists for one specific job: the thing at the end of the road has to stay
   * visible. Fog is capped at 0.60 globally, and 60% of the way to the sky
   * colour is enough to take a chapel on a ridge at 150 m to within a few per
   * cent of the sky behind it — measured, it was less visible than a nearby
   * tree, which makes the one landmark the walk is aimed at the least legible
   * thing in the frame.
   *
   * Deliberately a per-material dial and not a change to the global fog. The
   * haze is doing real work everywhere else: it is what separates the
   * middle distance from the ridge line and stops the treeline ending in a
   * hard silhouette. What is wrong is not the amount of fog but that a
   * destination is subject to the same amount as the scenery it is meant to
   * stand out from. Landmarks are the exception because they are the only
   * objects in the world whose *purpose* is to be seen from far away.
   */
  fogScale?: number;
}

/**
 * Build the shared uniform block. One of these per scene; every material
 * created against it holds the *same* uniform objects, so moving the sun
 * is a single assignment rather than a walk over every material.
 */
export function createPainterlyGlobals(): PainterlyGlobals {
  return {
    uTime: { value: 0 },
    uSunDirection: { value: new Vector3(0.4, 0.8, 0.45).normalize() },
    uSunColor: { value: new Color(0xffe3b8) },
    uSkyColor: { value: new Color(0x9fc6e8) },
    uHorizonColor: { value: new Color(0xf2d6b8) },
    uGroundBounce: { value: new Color(0x6b7a52) },
    uFogColor: { value: new Color(0xd8e4ee) },
    uFogNear: { value: 40 },
    uFogFar: { value: 260 },
    uFogHeight: { value: 26 },
    uWindStrength: { value: 1 },
    uWindDirection: { value: new Vector3(1, 0, 0.35).normalize() },
    uExposure: { value: 1 },
    uHearthPosition: { value: new Vector3(0, 0, 0) },
    uHearthColor: { value: new Color(0xff9a4e) },
    uHearthStrength: { value: 0 },
    uHearthRadius: { value: 4.2 },
  };
}

const VERTEX = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>

uniform float uTime;
uniform float uSway;
uniform float uSwaySpeed;
uniform float uSwayHeight;
uniform float uWindStrength;
uniform vec3 uWindDirection;

#ifdef USE_SWAY_ATTRIBUTE
  attribute float aSway;
#endif
#ifdef PAINTERLY_VERTEX_COLORS
  attribute vec3 color;
  varying vec3 vVertexColor;
#endif
#ifdef PAINTERLY_GROUND_TONES
  attribute vec3 aToneLo;
  attribute vec3 aToneHi;
  varying vec3 vToneLo;
  varying vec3 vToneHi;
#endif
/*
 * Declared unconditionally, and so is its twin in the fragment shader.
 *
 * The obvious version guards both with an ifdef on USE_INSTANCING_COLOR — and
 * it silently loses every per-instance colour in the game, because three
 * injects that define into the *vertex* prefix only. The vertex shader
 * dutifully wrote the varying, the fragment shader had no declaration to
 * read it back, both compiled without a warning, and every tree in the
 * world came out white. One interpolator is a very cheap price for that
 * class of bug never recurring.
 */
varying vec3 vInstanceColor;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vLocalHeight;

/*
 * Cheap 3D value noise. Deliberately not simplex: this is sampled once
 * per vertex for wind and a handful of times per fragment for grain, and
 * on a mid phone the instruction count matters more than the isotropy.
 */
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise31(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;

  #ifdef USE_SWAY_ATTRIBUTE
    float swayWeight = aSway;
  #else
    float swayWeight = uSwayHeight > 0.0 ? clamp(position.y / uSwayHeight, 0.0, 1.0) : 0.0;
  #endif

  // The instance matrix has to be applied before the world position is
  // known, and the wind phase has to key off the *world* position or an
  // entire instanced field of grass sways in lockstep like a single object.
  mat4 modelMatrixFinal = modelMatrix;
  #ifdef USE_INSTANCING
    modelMatrixFinal = modelMatrix * instanceMatrix;
    objectNormal = mat3(instanceMatrix) * objectNormal;
  #endif

  vec3 worldSeed = (modelMatrixFinal * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  if (uSway > 0.0 && swayWeight > 0.0) {
    float phase = uTime * uSwaySpeed + worldSeed.x * 0.35 + worldSeed.z * 0.27;
    // Two detuned sines plus a slow noisy gust envelope. A single sine is
    // instantly readable as a machine; the gust is what sells "weather".
    float gust = 0.55 + 0.45 * noise31(vec3(worldSeed.xz * 0.03, uTime * 0.08));
    float wave = sin(phase) * 0.7 + sin(phase * 1.7 + 1.3) * 0.3;
    float amount = uSway * uWindStrength * gust * swayWeight * swayWeight;
    transformed += uWindDirection * (wave * amount);
    // A little vertical dip as it leans over, so tall grass doesn't stretch.
    transformed.y -= abs(wave) * amount * 0.25;
  }

  vLocalHeight = position.y;

  vec4 worldPosition = modelMatrixFinal * vec4(transformed, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrixFinal) * normal);

  #ifdef PAINTERLY_VERTEX_COLORS
    vVertexColor = color;
  #endif
  #ifdef PAINTERLY_GROUND_TONES
    vToneLo = aToneLo;
    vToneHi = aToneHi;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vInstanceColor = instanceColor;
  #else
    vInstanceColor = vec3(1.0);
  #endif

  // three's shadow chunk expects these two names.
  vec3 transformedNormal = normalize(normalMatrix * objectNormal);
  #include <shadowmap_vertex>

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAGMENT = /* glsl */ `
#include <common>

/*
 * The two numbers that set the whole world's exposure.
 *
 * They are compile-time constants rather than uniforms on purpose: they are
 * a property of the *lighting model*, not of a moment in the day, and having
 * them adjustable per-material was an invitation for one object to quietly
 * disagree with the rest of the scene about how bright the sun is.
 *
 * Roughly: a fully-lit surface reaches about 1.25 and a fully-shadowed one
 * about 0.13, so there are just over three stops between light and shade —
 * which is about right for an overcast-to-sunny storybook look and leaves
 * the ACES curve something to do at the top end.
 */
/*
 * Ambient down from 0.42, and the reason is what it does to the *shaded*
 * side of things rather than to the lit side.
 *
 * On a field at midday the sun is about seven tenths of the light arriving,
 * so a quarter off the ambient costs the lit ground under a tenth of its
 * value — but a canopy underside, the away-side of a rise and the inside of
 * a shadow have nothing else, and they lose the whole quarter. That is the
 * gap between lit and unlit, which is the only thing giving a low-poly
 * landscape any form at all; at 0.42 a hillside turned away from the sun was
 * within a few per cent of one turned toward it and the middle distance came
 * out as one flat wash of green.
 *
 * The night frames do not pay for this. They are ambient and hearth almost
 * entirely, so the same fraction comes straight off them — the dusk and
 * night keys carry a compensating lift in their own exposure instead, which
 * is a per-hour dial and leaves the daylight keys where they are.
 *
 * Down again, 0.32 to 0.27, and this time as the other half of SKY_SCATTER
 * below rather than for a reason of its own. That term adds a slice of
 * sky-coloured light to the shade side; this takes a comparable slice back
 * out of the multiplied ambient, so the shade side ends up about as bright as
 * it was but a fraction of its light now arrives through a path that can
 * actually carry a hue. Without this second half, the additive term is a
 * milky wash over the picture instead of colour in the shadows.
 */
#define AMBIENT_STRENGTH 0.27
#define SUN_STRENGTH 0.92
/*
 * Scattered skylight, added rather than multiplied.
 *
 * This exists because a critique measured the thing DESIGN.md has always
 * claimed the lighting does — "shadows are always the complement of the sun"
 * — and found it simply was not happening: shadowed grass came back at H36
 * S0.73 against lit grass at H36 S0.67. Identical hue, pure value darken. At
 * golden hour there was not one cool pixel below the skyline.
 *
 * The cause is arithmetic, and no amount of palette tuning could have fixed
 * it. Every other light term here reaches the frame through
 * albedo * lighting, and a multiply cannot put back a channel the albedo
 * has already thrown away: village grass is 0x839749, so its blue is 0x49 —
 * about a quarter — and multiplying that by the bluest sky in the palette
 * still leaves a warm olive, only darker. The sky-tinted ambient above is
 * doing exactly what its comment says, and it was never going to be visible
 * through a warm albedo.
 *
 * So a shadow gets its colour ADDED. Physically this is the part of skylight
 * that reaches the eye without having been filtered by the surface —
 * scattering in the air between here and the viewer, which is genuinely
 * additive and genuinely the colour of the sky rather than of the leaf. That
 * is also why painters put a cool wash into a warm shadow and why it does not
 * look wrong.
 *
 * Kept small, and shaped three ways so it buys a cool shadow without paying
 * for it in contrast:
 *
 * - Scaled by 1 - sunAmount, so it is absent in full sun and full in
 *   shadow. It lifts the shade side only, which is where the hue is missing.
 * - Scaled by how skyward the surface is, so a downward face — which cannot
 *   see the sky — keeps its warm bounce instead of being handed a blue it has
 *   no business receiving.
 * - Carried by ambient, which already collapses with the sky at night, so
 *   the night frames need no separate gate: when the sky is dark this term
 *   goes dark with it and the darks stay dark.
 *
 * Distinct from the floorLight term further down, which is an anti-black
 * measure gated to fire only on fragments that are already nearly black
 * (exp(-luma * 22.0) is 0.005 by a luma of 0.24). The two barely overlap:
 * that one rescues soot, this one colours shade.
 *
 * On the number, and on the thing that had to change with it.
 *
 * Measured, this term's effect saturates almost immediately: 0.13 and 0.09
 * give morning a hue spread of 0.367 and 0.359 against a baseline of 0.208,
 * and cost the phone-portrait framing the same 0.7 stops either way. So the
 * strength is not the dial that trades hue against contrast — the two are not
 * on a slider, and an early version of this comment claimed a smaller number
 * "gives back most of the contrast", which the numbers plainly did not
 * support.
 *
 * The contrast cost is inherent to *adding* light to shade, and the fix is
 * therefore not to add less but to multiply less: AMBIENT_STRENGTH comes down
 * from 0.32 to 0.27 alongside this. That is the real move here. Shadowed
 * surfaces get the same amount of light in total, but a slice of it now
 * arrives through a term that carries the sky's hue instead of through one
 * the albedo strips the blue out of. Hue in, range kept, and the net light on
 * the shade side roughly where it was.
 */
#define SKY_SCATTER 0.09
/*
 * What that term is multiplied by when the sun is on the horizon.
 *
 * STATE.md item 9 was left half-open by the commit that added SKY_SCATTER:
 * the general fix worked (morning hue spread 0.208 -> 0.356) and golden hour
 * did not move at all (0.036 -> 0.031). The note filed it as "treat golden
 * hour as its own case" without saying why the term misses it. It is
 * arithmetic, and it is worth writing down because the number above looks
 * like it should apply everywhere.
 *
 * Worked through at day 0.82 for flat ground: the sun sits at 0.12 rad, so
 * ndl is 0.12, lit is 0.56, and sunAmount comes out at 0.425. The
 * scatter is scaled by 1 - sunAmount, which leaves 0.57 of 0.09 — about
 * 0.05 — against a direct term of 0.425 * 0.92 = 0.39. The cool addition
 * is a seventieth of the ambient it rides and a thirtieth of the sun. There
 * is nothing to see. At noon the same reasoning gives a bigger sunAmount
 * and a smaller multiplier, but the SHADE side there has sunAmount near
 * zero and the term lands with its full weight; at a low sun there is barely
 * any shade side to land on, because almost the whole frame is lit.
 *
 * The physical case for scaling it up rather than adding a golden-hour-only
 * term: skylight and sunlight do not fall off together as the sun drops. The
 * direct beam crosses ten to forty air masses at these elevations and is
 * attenuated by most of a stop per air mass in the blue, while the sky's own
 * scattered light is what that attenuation TURNS INTO. The ratio of skylight
 * to sunlight climbs steeply toward the horizon; it is the whole reason a
 * photograph taken an hour before sunset has blue shadows and one taken at
 * noon has grey ones. So this is not a new lighting model, it is the one
 * term in the existing model whose real-world magnitude actually depends on
 * sun height, finally saying so.
 *
 * Driven by lowSun (see its note at the point it is computed), which is 0
 * from mid-morning onward — so morning, noon and afternoon are
 * arithmetically untouched by this and cannot regress from it — and 0 again
 * once the sun is well below the horizon, so deep night is untouched too. It
 * reaches full strength at first light, dawn, golden hour and dusk, which is
 * exactly the set of hours the ratio argument above is about.
 */
#define LOW_SUN_SCATTER 3.0
/*
 * How far an upward-facing surface's ambient swings from the zenith toward
 * the horizon as the sun drops.
 *
 * The gap this closes: at golden hour an apricot sky sits over cool olive
 * grass, and the sun side and the sky side of every canopy read as the same
 * value in the same hue. The cause is one line below — ambient mixes
 * uGroundBounce to uSkyColor by how skyward the normal is, and
 * uSkyColor is the ZENITH. At noon that is right: the zenith is the
 * brightest part of the hemisphere and a flat field's ambient really is
 * mostly zenith. At an elevation of seven degrees it is badly wrong. The
 * bright band of a golden-hour sky is the twenty degrees above the horizon,
 * which is where the light that has not yet been scattered out is piling up;
 * the zenith at that hour is the DIMMEST part of the sky and about four
 * stops under the horizon band. An upward face integrating that hemisphere
 * takes most of its light from the warm band, not from the blue overhead.
 *
 * So the warm bounce on upward faces is not a new term either — it is the
 * existing ambient finally pointing at the right part of the sky. The
 * sideways-facing horizon leak on the line after it stays exactly as it was:
 * that one is about grazing incidence and is a separate claim.
 *
 * Note what this does NOT touch. The scattered-skylight term above keeps its
 * own carrier (skyLight, computed before this warming), because that term
 * is the blue of the air between the surface and the eye and handing it the
 * horizon's apricot would cancel the very thing LOW_SUN_SCATTER exists to
 * buy. The result is the split the frames were missing: a face turned into
 * the light goes warm, and the same face inside a cast shadow goes cool.
 *
 * --- and it is weighted by the sun's BEARING, which the critique's own
 * prescription was not, because that version measured as the fault ---------
 *
 * Gap 2 is worded as "no warm bounce on upward faces", and the first build
 * here did exactly that: warmed the ambient by how skyward the normal is.
 * Measured on the six gate poses it made every low-sun frame MORE monochrome,
 * which is the opposite complaint from the same critique — golden hour's hue
 * spread fell 0.167 -> 0.106 and phone-landscape's 0.182 -> 0.097 — and it
 * cost golden 0.2 stops as well. Isolated by building each term alone: with
 * the scattered skylight and the haze change in and this one out, golden read
 * 0.184; with this one in and the skylight out, 0.080. The warming was not
 * merely failing to help, it was swamping the cool shadows the term beside it
 * had just bought.
 *
 * The reason is geometry, and it is the same shape of mistake as the one
 * sky.ts records about the zenith. At golden hour nearly every surface the
 * camera can see is upward-facing — it is a road across a meadow — so
 * "warm the upward faces" is "warm the frame", and a frame warmed uniformly
 * has no more colour in it than one that was not, only a different average.
 * What gap 2 is actually describing is a LOCAL difference: the sun side and
 * the sky side of one canopy reading alike. So the warmth is delivered along
 * the sun's own horizontal bearing instead, which is where a low sun's bright
 * band of sky actually is. A canopy now has a warm side and a cool side; a
 * flat field, whose normal is perpendicular to that bearing, is left alone,
 * which is why the whole-frame numbers hold. Same term, same physics, one
 * more factor — golden hour comes back at 0.182 against a baseline of 0.167.
 */
#define LOW_SUN_HORIZON 0.60
/*
 * How much of the shadow map's penumbra survives into the picture.
 *
 * Critique gap 3: broad soft dark ribbons rake the road with no visible
 * caster and their edges dissolve into blur. Measured by ablation — the same
 * pose rendered with uShadowDepth forced to 1, which is the only reliable
 * way to remove cast shadows at runtime (switching shadowMap.enabled off
 * leaves every material still sampling the now-stale map, and the frame
 * comes back byte-identical, which reads as "cast shadows do nothing") —
 * the ribbons ARE cast shadows and they do have casters: the roadside trees
 * at golden hour and the songboard itself in the morning frame.
 *
 * What they do not have is an EDGE. The shadow camera is 220 m across a 2048
 * map, so a texel is 10.7 cm and three's PCF kernel spans a few of them; at
 * a sun elevation of seven degrees that penumbra is projected along the
 * light direction and arrives on the ground stretched by a factor of eight.
 * A boundary that is 30 cm wide in the map is two and a half metres wide on
 * the road, which at these camera distances is a couple of hundred pixels of
 * gradient. A gradient that wide is not a shadow edge, it is a stain — and
 * the header of this file already makes the same argument about the light
 * bands: a gradient reads as untextured 3D and an edge broken up by noise
 * reads as a brush.
 *
 * The fix is a remap rather than a smaller kernel, because the kernel is
 * what stops the shadow aliasing into stair-steps in the first place and a
 * shadow map cannot be made sharper from inside a fragment shader anyway.
 * Centred on 0.5 so the shadow's AREA is unchanged — this narrows the
 * penumbra, it does not grow or shrink the shadow, which matters because the
 * long-shadow ladder at dawn and dusk is load-bearing for those frames and
 * must not be traded away for an edge.
 *
 * --- and then the narrowing alone was measured, and it was not enough ------
 *
 * 0.34 shipped for a round and the next blind critique put the cast shadows
 * back at the top of the list, five lenses out of six: "enormous soft
 * grey-brown smears", "they read as stains", "they clash with the hard-edged
 * low-poly vocabulary". The arithmetic above says why a narrowing on its own
 * cannot win. The penumbra on the morning road is about four hundred pixels
 * of gradient; 0.34 divides that by three, and a hundred and thirty pixels of
 * smooth ramp is still a stain, just a smaller one. Dividing further is the
 * obvious next move and it is the wrong one — a hard threshold on a PCF ramp
 * is a stair-step, which is the artifact the kernel exists to prevent, and it
 * arrives as a straight machine-cut line through a landscape whose entire
 * vocabulary is faceted planes.
 *
 * So the ramp is narrowed HARD and its centre is then walked about by
 * world-space noise. That is this file's own standing argument, applied to
 * the one boundary it had not been applied to: a gradient reads as untextured
 * 3D, an edge broken up by noise reads as a brush. The boundary lands
 * somewhere different every half metre, so what was a two-metre wash becomes
 * a ragged line of interlocking hard-edged lobes — the shape a shadow has
 * when a painter puts it down with a loaded brush, and the shape the rest of
 * this world is already made of.
 *
 * The two numbers are a pair and should be read as one. SHADOW_EDGE is how
 * wide the riser is; SHADOW_FRAY is how far the riser's centre wanders. The
 * fray must be several times the riser or the edge is merely soft again, and
 * their SUM must stay inside the penumbra or the boundary starts detaching
 * from the shadow it belongs to. 0.13 and 0.30 sit comfortably inside.
 *
 * The area argument from the paragraph above survives: the fray is zero-mean,
 * so it moves the boundary in and out in equal measure and the long-shadow
 * ladder at dawn and dusk keeps its reach.
 */
#define SHADOW_EDGE 0.13
#define SHADOW_FRAY 0.30
/*
 * The size of the lobes the shadow edge breaks into, as a world-space
 * frequency: 2.1 is a feature every fifty centimetres or so.
 *
 * Chosen against the road rather than against the shadow. Half a metre of
 * near ground is a couple of hundred pixels in one of these frames, which is
 * a brush mark; ten centimetres would be a pixel-level fuzz, which is the
 * same stain with more steps in it.
 *
 * And faded out with distance for the reason the near-ground mottle records
 * at length: there are no mipmaps on a noise function, and half a metre at
 * eighty metres is two pixels. A pattern sampled at two pixels a cycle is not
 * a brush mark, it is a hash — and on a shadow BOUNDARY it would crawl as the
 * camera moves, which is worse than the stain. Past the fade the riser is
 * still narrow, so the far shadows keep the edge and lose only the ragging;
 * at that range they are a few pixels across and there was never room for a
 * lobe in them.
 */
#define SHADOW_FRAY_SCALE 2.1
#define SHADOW_FRAY_NEAR_M 20.0
#define SHADOW_FRAY_FAR_M 70.0
/*
 * How much sky-coloured light a fragment gets for being inside a CAST shadow,
 * as a multiple of the skylight already arriving there.
 *
 * DESIGN's standing rule is that shadows are coloured and never grey, and
 * SKY_SCATTER above is the term that delivers it — but read its own note
 * carefully and it only ever promised the SHADE side. It is scaled by
 * 1 - sunAmount, which is large on a face turned away from the sun and, at
 * the top of the day, small on flat ground that a tree happens to be standing
 * in front of: noon ground takes sunAmount 0.81 lit and about 0.28 under a
 * cast shadow, so the term lands at 0.065 of a small number against 0.017.
 * Worked through the palette that is under two thousandths of the road's
 * value. The cast shadow was a pure multiply — the same brown, darker — which
 * is exactly what "grey-brown smear" describes, and it is why the complaint
 * survived a round of edge work that was otherwise correct.
 *
 * LOW_SUN_SCATTER already triples the term at dawn and dusk and its note
 * gives the physical argument. This is the same argument at the other end of
 * the day, which that note explicitly leaves open: a cast shadow at noon is a
 * patch of ground whose ONLY light source is the sky dome, so its
 * illuminant really is a saturated blue, while the lit ground beside it is
 * taking three quarters of its light from a warm sun. The blue shadow on a
 * bright day is not a stylisation, it is the single most photographed fact in
 * landscape painting.
 *
 * Keyed on 1 - shadowMask rather than on 1 - sunAmount, which is the whole
 * point: this is about being OCCLUDED, not about facing away. A canopy
 * underside is already served by the term above and must not be paid twice.
 * Scaled by sunHeight so the low-sun hours keep LOW_SUN_SCATTER as their one
 * answer and night, where there is no sun to be occluded from, is
 * arithmetically untouched.
 */
#define CAST_SHADOW_SKY 0.20
/*
 * How far the haze is pushed away from its own grey axis before it is mixed
 * into the picture — and the reason STATE.md item 10 survived the fix that
 * was supposed to close it.
 *
 * Item 10 prescribed committing the daylight fog keys to a hue at S~0.25-0.35
 * because they were near-neutral (it quotes morning 0xb2c1cc at S0.13). That
 * was done: sky.ts now ships morning 0xa4c3e3 at S0.278, high day
 * 0xa9c8e8 at S0.272, afternoon 0xd2c299 at S0.271, and the horizon keys
 * they are mixed with are saturated too. The distance still came back grey.
 *
 * The step nobody had put a number on is the tone mapper. The renderer runs
 * ACES filmic at an exposure of 1.05, and three's implementation multiplies
 * by toneMappingExposure / 0.6 first — so the real multiplier is 1.75, and
 * the haze is the BRIGHTEST large area in the frame after the sky. Worked
 * through the actual fit for the morning frame's fully-hazed distance: the
 * pre-tonemap fogTint is sRGB-equivalent S0.274, and it leaves the tone
 * mapper at S0.122. ACES desaturates its highlight shoulder by design — that
 * is what makes it look photographic — and it took more than half the hue
 * this file had just been given. Measured on the shipped build, the morning
 * frame's skyline band reads S0.121 and its far band S0.195; with the fog
 * switched off entirely the same bands read S0.273 and S0.377, so the haze
 * is cutting the distance's saturation almost exactly in half.
 *
 * So the correction has to be applied where the loss happens rather than at
 * the palette, and it has to be a HUE change and nothing else — see the note
 * on morning's horizon key in sky.ts for what happened the last time the
 * distance was reached for and its value moved: fog is applied after
 * uExposure, so anything taken out of the far land here cannot be paid
 * back by any later dial. mix(vec3(luma), c, k) at k > 1 pushes a colour
 * away from the grey axis and preserves its luminance EXACTLY, which is the
 * whole reason it is written that way rather than as a saturation curve.
 */
#define FOG_CHROMA 1.45
/*
 * How much further the haze carries the air's HUE than it carries its value,
 * and the second half of why item 10 outlived the fix aimed at it.
 *
 * fogAmount is capped at 0.60 — see the long note at the point of use for
 * why, and it is a good reason: a silhouette that dissolves completely into
 * the sky reads as a draw-distance failure. But the cap applies to the whole
 * mix, so the fully-hazed distance is still four tenths the terrain's own
 * colour, and the terrain's own colour is a warm olive. Four parts warm olive
 * to six parts cool blue is not a pale blue, it is a grey: the two hues are
 * near enough complementary that the average lands on the neutral axis. That
 * is item 10's own sentence — "a low-saturation cool mixed 60/40 into a
 * saturated warm lands on grey" — and the prescription it drew from it was to
 * saturate the cool, which does not help, because the arithmetic that
 * cancels is the MIX and not the endpoint.
 *
 * Real aerial perspective does not work that way either. A ridge eight miles
 * off has not become 60 per cent sky; it has lost its own colour almost
 * entirely while keeping a value distinctly below the sky's. Chroma is
 * scattered out of the sightline far faster than radiance is added to it,
 * which is exactly why a distant wood is BLUE and not a paler green. So the
 * blend is split: value blends at fogAmount and keeps every argument the cap
 * exists to protect, and hue blends most of the rest of the way to the air's
 * own, at the value the fog left it with.
 *
 * Not 1.0. At a full replacement the far land is one flat wash of air colour
 * with no trace of what it is made of, and the ridge's own comment in sky.ts
 * makes the matching point from the other side — a trace of the ground's own
 * colour is what keeps a forested skyline blue-GREEN rather than blue.
 */
#define FOG_HUE_LEAD 0.65
/*
 * How hard the near-ground mark rides the scattered-skylight term above.
 *
 * A relative swing on SKY_SCATTER, not an amplitude in its own right — see
 * the long note at the point of use for why the mark needs a second carrier
 * at a low sun and why this is the term it borrows rather than a new one.
 *
 * Shot at 0.85 and at 1.50 on the two frames the mark was missing, and the
 * larger one is better on every reading of both:
 *
 *   06-dusk-encounter  largest connected flat region 19.8 → 14.6 → 10.6 per
 *                      cent of frame, and its top edge moves down 129 rows,
 *                      so it is the plane breaking up rather than shrinking
 *   05-golden-busk     near band modal share 47.7 → 43.7 → 41.3, sd 10.7 →
 *                      10.9 → 11.1, every scale-resolved difference up
 *
 * Not higher than this. The clamp at the point of use starts to bind here:
 * at 1.50 the damp end of the patchwork takes the scatter term to zero over
 * the bottom sixth of the noise, and past that the extra amplitude is spent
 * flattening those patches against each other instead of separating them.
 * The measured cost is small and real — 06's land hue spread falls 0.103 to
 * 0.091 — and the cool-pixel share, which is what item 9 is actually about,
 * holds at 4.9 → 4.8 per cent.
 */
#define NEAR_SHADE_MARK 1.50
/*
 * --- the foreground tier -----------------------------------------------
 *
 * The one term that separates five metres from thirty-five, and it exists
 * because NOTHING ELSE IN THIS SHADER DOES. The fog block at the bottom of
 * this file claims to be "the only term in the frame that separates a
 * hundred and sixty metres from twenty", and that claim is true and is also
 * the whole problem: read it the other way round and the frame has no
 * distance cue at all inside the fog's near edge.
 *
 * The arithmetic, done properly, because the numbers in this file's own
 * defaults are not the numbers the game runs. "createPainterlyGlobals"
 * initialises uFogNear/uFogFar to 40 and 260, and "RoadStage" overwrites both
 * before the first frame with TERRAIN_REACH * 0.12 and * 1.47 — 19.8 m and
 * 242.5 m. It is worse than the defaults suggest, not better, because
 * "distanceFog" puts the smoothstep through a SECOND smoothstep:
 *
 *     depth     40 m    60 m    90 m   120 m   160 m
 *     fogAmount 0.001   0.013   0.084   0.233   0.463
 *
 * So the veil is a tenth of one per cent at forty metres and a hundredth at
 * sixty. On a walking frame the near and mid thirds of the picture are both
 * inside sixty metres — measured with a depth pass rather than a horizon row,
 * the phone-portrait frame reads 25 per cent of its pixels at 0-8 m, 19 per
 * cent at 8-20 m and 7 per cent at 20-40 m — and every one of those pixels is
 * lit and hazed identically. That is why the land reads as one grey tier: not
 * because it has no shape, but because two thirds of it is at one value.
 *
 * What this term is: a short-range darkening of the direct light, full at the
 * camera's feet and gone by forty-five metres, which hands the near ground a
 * value of its own to be read against the middle distance. It is the
 * reverse-facing half of aerial perspective — haze lightens the far, a
 * foreground shadow darkens the near — and it is the device a painter uses
 * when the near ground has nothing standing in it to cast one.
 *
 * Why it is scaled by sunHeight, which is the part worth keeping if anything
 * here is ever retuned. The two frames in this game's own sheet that already
 * have a genuine two-tier field are golden hour and dusk, and both get it from
 * long low-sun cast shadows lying across the foreground. Those frames need
 * nothing from this term and must not be paid for by it; the high-sun frames,
 * whose shadows are directly under the things casting them, are exactly the
 * ones that come back flat. Riding sunHeight puts the term where the shadows
 * are not, and takes it to zero at night, where the near ground is the
 * campfire's business and the hearth term owns it.
 *
 * Applied to "albedo * lighting" only — before the scattered skylight, the
 * rim, the hearth and the black floor. That ordering is deliberate three
 * times over: shade that is already dark barely moves (its light is mostly
 * scatter, which is not scaled), a near silhouette keeps its rim so the tier
 * cannot swallow an edge, and the anti-soot floor still fires underneath, so
 * this can darken the foreground without ever crushing it to black.
 */
#define FG_TIER_DEPTH 0.30
#define FG_TIER_NEAR_M 4.0
#define FG_TIER_FAR_M 45.0
/*
 * --- and the same ladder again, as TREADS rather than as a ramp -----------
 *
 * The term above was built as a smooth curve from four metres to forty-five,
 * and the next critique named the result precisely: a broad soft dark area
 * owning the bottom of the frame, dragging the eye to the bottom edge, with
 * no shape and no boundary. That is a fair description of a four-hundred-pixel
 * gradient, and it is the same complaint the cast shadows drew — this file has
 * now been told twice, by two independent routes, that a smooth value gradient
 * across a low-poly landscape reads as a smudge rather than as space.
 *
 * So the ramp is quantised into three treads with a narrow riser between them.
 * The near ground, the middle distance and the ground beyond forty-five metres
 * become three PLANES of different value, which is how a landscape painter
 * builds depth and is the same device the fog uses at the far end. The riser
 * is broken with the grain, exactly as the shadow edge is, so the boundary
 * between two treads is a brush line and not a contour on a map.
 *
 * The endpoints are unchanged by construction — floor(0) is 0 and floor(3)/3
 * is 1 — so the near ground is as dark as it was and the far ground as light,
 * and everything the note above says about the term's size still holds. What
 * moves is the middle: it used to sit wherever the curve happened to put it,
 * and now it sits on a tread with a stated value of its own.
 *
 * Three, not four or five. Four treads put a riser inside the near band where
 * the mottle already lives and the two patterns fought; two is the ramp again
 * with one step in it.
 */
#define FG_TIER_TREADS 3.0
#define FG_TIER_RISER 0.10
#define FG_TIER_FRAY 0.30
/*
 * How far each tread of the ladder above steps toward the colour of the air.
 *
 * The other half of the same critique: between the near ground's full local
 * colour and the haze band on the skyline there is no tinted middle rung, so
 * the noon frame reads as one bleached band. That is true and it is a gap in
 * the model rather than in the palette. The fog is the only term in this
 * shader that knows about distance, and by its own note it is a tenth of one
 * per cent at forty metres — so everything from the bard's feet out to sixty
 * metres is hazed identically, which is to say not at all.
 *
 * Aerial perspective is not only a veil, it is a HUE ROTATION, and it starts
 * far nearer than the veil does: the middle distance of a landscape is cooler
 * and less local than the foreground long before it is any paler. So each
 * tread takes a step toward the air's own hue, which hands the middle distance
 * a colour that is neither the foreground's green nor the horizon's wash.
 *
 * Normalised to unit luminance before it is applied, so this is a rotation and
 * not a lift: the ladder's VALUE is the term above's business and this must not
 * quietly re-tune it. Ridden by sunHeight for the same reason the ladder is —
 * at night the air has no colour of its own to lend.
 */
#define FG_TIER_HUE 0.50
/*
 * The warm/cool split across a mass, and how much value comes with it.
 *
 * Critique gap: the sun's direction exists in this world ONLY in the cast
 * shadows. A tree crown, a rock, a fallen log renders at one flat value
 * whether it faces the sun or turns away from it, and every reference frame
 * the panel judged against splits each form warm on one side and cool on the
 * other. That reads as a missing lighting term and it is not one — the banded
 * diffuse above has always had ndl. What it does not have, on the objects that
 * matter most, is a NORMAL that can carry it.
 *
 * world/geometry.ts tilts the foliage normals ninety-two per cent of the way
 * toward straight up, deliberately and with a good reason: it is what makes a
 * canopy read as one mass rather than as a heap of little walls. The price,
 * never written down, is that the horizontal component of a leaf normal is
 * left about eight hundredths of a unit long — so dot(N, L) on a crown at noon
 * separates its sun side from its shade side by a few per cent of one band,
 * and the crown comes back flat. The tilt is right and the flatness is right
 * next to it; both follow from the same line.
 *
 * The way out is that the tilt scales the bearing down without destroying it.
 * Normalising the horizontal part of the normal recovers WHICH WAY the surface
 * faces at full length whatever the tilt did to its magnitude, and a term
 * riding that gives a crown a sun side without giving back the heap of walls —
 * because it is the crown's HUE that splits, and its value only slightly.
 *
 * Hue first, and mostly hue, for two reasons. It is the honest one: the sun
 * side of a form is lit by sunlight and the shade side by skylight, and those
 * are two different colours, which is the whole of the physics here. And it is
 * the safe one: the split is applied as a luminance-normalised rotation of the
 * light, so a mass gains a warm side and a cool side without the frame's value
 * structure moving underneath the gates that guard it.
 *
 * MODEL_TURN sits the band edge slightly onto the shade side rather than at
 * the terminator, so the lit side is the larger of the two. That is what a
 * sphere does — the terminator on a real form is past the halfway point from
 * the viewer's side — and a form split exactly in half reads as a two-tone
 * decal instead.
 */
#define MODEL_SPLIT 0.36
#define MODEL_VALUE 0.15
#define MODEL_TURN 0.16
/**
 * How far the rim is turned up with the sun on the horizon. See the note at
 * the point it is applied: critique gap 7, the bard as the darkest thing in
 * the frame with no edge.
 */
#define RIM_LOW_SUN 0.6
/** Rec. 709 luminance weights, for the two hue rotations that must not lift. */
#define LUMA_W vec3(0.2126, 0.7152, 0.0722)
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform vec3 uColor;
uniform vec3 uColorVariant;
uniform vec3 uEmissive;
uniform float uEmissiveStrength;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uGroundBounce;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogHeight;
uniform float uFogScale;
uniform float uGrain;
uniform float uGrainScale;
uniform float uRim;
uniform float uRimPower;
uniform float uBaseShade;
uniform float uBaseShadeHeight;
uniform float uShadowDepth;
uniform float uBandSoftness;
uniform float uExposure;
uniform float uOpacity;
uniform vec3 uHearthPosition;
uniform vec3 uHearthColor;
uniform float uHearthStrength;
uniform float uHearthRadius;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vLocalHeight;
varying vec3 vInstanceColor;
#ifdef PAINTERLY_VERTEX_COLORS
  varying vec3 vVertexColor;
#endif
#ifdef PAINTERLY_GROUND_TONES
  uniform float uGroundTones;
  varying vec3 vToneLo;
  varying vec3 vToneHi;
#endif

float hash31f(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise31f(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31f(i), hash31f(i + vec3(1,0,0)), f.x),
        mix(hash31f(i + vec3(0,1,0)), hash31f(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31f(i + vec3(0,0,1)), hash31f(i + vec3(1,0,1)), f.x),
        mix(hash31f(i + vec3(0,1,1)), hash31f(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

#ifdef PAINTERLY_GROUND_TONES
/*
 * A two-dimensional twin of the noise above, for the ground only.
 *
 * The ground's drift is a property of the map, not of altitude, so the
 * third dimension buys it nothing — and it costs a great deal: a 3D lattice
 * needs eight corners where a 2D one needs four. The terrain is most of
 * every frame, and on a software rasteriser the difference between five 3D
 * octaves and two 2D ones plus the grain is the difference between a frame
 * and a timeout. That is not a hypothetical; it is what the first version
 * of this did.
 */
float hash21f(vec2 p) {
  p = fract(p * 0.3183099 + vec2(0.71, 0.113));
  p *= 27.13;
  return fract(p.x * p.y * (p.x + p.y));
}

float noise21f(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21f(i), hash21f(i + vec2(1.0, 0.0)), f.x),
    mix(hash21f(i + vec2(0.0, 1.0)), hash21f(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
#endif

void main() {
  #ifdef PAINTERLY_FLAT_SHADING
    vec3 N = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    // Screen-space derivatives give an unsigned facet normal; flip it back
    // toward the interpolated one so back-facing quantisation doesn't
    // invert the lighting on a silhouette.
    N *= sign(dot(N, vWorldNormal));
  #else
    vec3 N = normalize(vWorldNormal);
  #endif

  // The distance to the camera is wanted twice — once by the ground's fine
  // drift below and once by the fog at the end — so the vector is kept and
  // the view direction falls out of it. This is one square root fewer per
  // fragment than computing V and the fog depth separately.
  vec3 toCamera = cameraPosition - vWorldPosition;
  float viewDepth = length(toCamera);
  vec3 V = toCamera / max(viewDepth, 0.0001);
  vec3 L = normalize(uSunDirection);

  /*
   * How high the sun is, 0 at the horizon and 1 by mid-morning.
   *
   * Two things in this shader are only honest under a high sun, and both of
   * them turn black when it drops. This is the single term they are driven
   * from, so that they fade together and the world darkens along one axis
   * rather than three.
   */
  float sunHeight = smoothstep(-0.05, 0.32, uSunDirection.y);

  /*
   * The twilight band: 0 with the sun high, 1 with it on the horizon, and 0
   * again once it is well below.
   *
   * Two terms below are about what happens when the sun is LOW, and the
   * obvious driver for both is 1 - sunHeight. It is wrong at the bottom end
   * and the frames said so: driven that way, the night pose lost 0.77 stops
   * (6.18 -> 5.41) and every low-sun frame's hue spread fell — golden 0.167
   * -> 0.100, phone-landscape 0.182 -> 0.097 — because 1 - sunHeight is 1 at
   * midnight, so a deep-night frame was being handed the full golden-hour
   * treatment. Both claims are specifically about the RATIO of skylight to
   * sunlight and about where in the sky the bright band sits, and at midnight
   * there is no sunlight to have a ratio to and no bright band. Fading back
   * out below the horizon puts the terms where the argument for them holds
   * and leaves deep night arithmetically untouched.
   */
  float lowSun = (1.0 - sunHeight) * smoothstep(-0.22, 0.0, uSunDirection.y);

  // --- world-space grain -------------------------------------------------
  // Sampled in world space so it belongs to the *scene*, like paper
  // texture under the whole painting, rather than sliding around on each
  // object as it moves.
  float grainA = noise31f(vWorldPosition * uGrainScale);
  float grainB = noise31f(vWorldPosition * uGrainScale * 2.7 + 11.3);
  float grain = grainA * 0.68 + grainB * 0.32;

  // The near-ground mottle, carried out of the albedo block so the shade
  // side can use it too. Zero on every surface that is not near ground, and
  // on every material without PAINTERLY_GROUND_TONES, which is what keeps
  // the term below inert everywhere except the strip it is for.
  float nearWeight = 0.0;
  float nearMark = 0.0;

  vec3 albedo = uColor;
  #ifdef PAINTERLY_VERTEX_COLORS
    albedo *= vVertexColor;
  #endif
  // Per-instance colour: one draw call covers a whole biome's worth of
  // trees in different greens. Defaults to white for non-instanced meshes.
  albedo *= vInstanceColor;

  #ifdef PAINTERLY_GROUND_TONES
    /*
     * Where the meadow's colour drift lives, and why it is here.
     *
     * It used to be baked into the terrain's vertex colours, and it produced
     * the worst artifact the world has had: hard-edged tonal wedges with
     * dead-straight boundaries lying across the fields with no landform
     * under them, in six frames out of ten. The cause is that the drift is
     * built out of clamped ramps — a patch either has reached the dry tone
     * or it has not — and a clamp has a kink in it. Sample that kink every
     * 3.75 m along the road and every 5 to 15 m across it, interpolate
     * linearly over the quads in between, and the kink comes out as a crease
     * along the triangulation diagonal: a straight line, tens of metres
     * long, that no amount of tuning the colours will remove.
     *
     * Evaluated per fragment the same ramps are simply smooth, and the
     * result no longer depends on how finely the ground happens to be
     * tessellated — which is what the art direction was asking for in the
     * first place when it said texture comes from world-space noise.
     *
     * Vertex colour still carries what it is good at: the road and its
     * shoulder, and the slow business of one biome becoming the next.
     */
    // Two fresh octaves at roughly 70 m and 21 m, and the paper grain the
    // fragment had already paid for as the third.
    float driftA = noise21f(vWorldPosition.xz * 0.0145 + 17.3);
    float driftB = noise21f(vWorldPosition.xz * 0.0470 + 4.1);
    float drift = driftA * 0.52 + driftB * 0.30 + grainA * 0.18;
    /*
     * The edges sit close in around the mean on purpose. Three octaves of
     * value noise added together pile up near 0.5 — a standard deviation of
     * about an eighth — so ramps running out to 0 and 1 are ramps the ground
     * almost never reaches, and the first version of this left the meadow a
     * flat wash. These reach their ends at roughly two deviations out, which
     * is often enough to be a field with weather in it.
     *
     * Asymmetric: the pale tone comes in over a narrower range than the dark
     * one, so bleached ground reads as patches and damp ground reads as most
     * of the field.
     *
     * --- and the pale half did neither of those things ---------------------
     *
     * The paragraph above describes what these two lines are meant to do; the
     * numbers used to say something else, and nobody had put them next to the
     * noise field's own deviation.
     *
     *   dark ramp  0.50 -> 0.27   full at 1.84 sd below the mean, span 0.23
     *   pale ramp  0.56 -> 0.82   full at 2.56 sd ABOVE it,       span 0.26
     *
     * So the pale ramp was the WIDER of the two where the comment claims it is
     * the narrower, and it topped out two and a half deviations up, which on a
     * field of this size is a patch every few hundred metres. Between that and
     * a reach of 0.62, the pale tone in palette.ts was a colour the ground
     * could not actually arrive at: measured with a land-masked histogram, the
     * only pixels in a daylight frame above L170 were fog.
     *
     * THE FINDING STANDS; THE FIX WAS REVERTED, AND BOTH ARE RECORDED BECAUSE
     * THE NEXT ATTEMPT SHOULD START FROM HERE. 0.55 -> 0.73 with a reach of
     * 0.85 was built and shipped briefly: mirrored to the same 1.84 deviations
     * as the dark ramp, span 0.18, genuinely narrower, with a patch reaching
     * most of the way to the tone rather than two thirds.
     *
     * It was backed out when ROADMAP task 121 landed on main independently and
     * raised grass, grassVariant, grassDry, road and roadShoulder 35 per cent
     * across all three biomes. This ramp had been tuned against a much smaller
     * lift (only each biome's *Dry tone, by about a sixth), and the two
     * compound: a wider, further-reaching ramp toward an already much paler
     * tone lifts the darks instead of adding patches. Measured on the merge,
     * with the widened ramp against without it, everything else identical:
     *
     *   phone-portrait  2.57 -> 2.78 stops     noon  2.64 -> 2.73
     *   morning, golden, night, landscape unchanged
     *
     * — that is, the narrow-and-far ramp was costing 0.21 stops on the tightest
     * pose, which sits nearest the gate floor. So the constants below are the
     * pre-existing ones, and they are still wrong in the way described above.
     * Redoing this properly means re-deriving the span and the reach against
     * the NEW albedos rather than reinstating these numbers.
     */
    albedo = mix(albedo, vToneLo, smoothstep(0.50, 0.27, drift) * uGroundTones * 0.72);
    albedo = mix(albedo, vToneHi, smoothstep(0.56, 0.82, drift) * uGroundTones * 0.62);

    /*
     * --- and then the same thing again at a metre, for the near ground ----
     *
     * Everything above is calibrated for ground seen at fifty metres, and
     * the bottom of the frame is not that. It is worth being exact about the
     * scales, because the obvious repair is an order of magnitude too timid.
     * The bottom fifth of a 1600-pixel frame shows ground from about two
     * metres out to about six, which is under two metres of world across the
     * whole width of the bottom row: driftA's 69 m contributes a constant
     * across it, driftB's 21 m under a tenth of a cycle, and the paper grain
     * at 9 m not much more. That is the whole reason the near ground reads as
     * a flat fill with grass standing on it rather than as ground.
     *
     * A fourth octave at 4.5 m was tried first, which is what the arithmetic
     * gives if the near ground is taken to be ten metres deep — and then at
     * 0.95 m, added into the drift sum at a weight that leaves the field's overall
     * deviation and its dark and pale area fractions where they were. Both
     * were shot and measured and both are gone. The near band's modal
     * ten-level share moved from 32.0 to 28.2 per cent on the morning frame
     * and the wrong way, 46.9 to 50.1, on noon; the band's own standard
     * deviation fell slightly in all four frames. The reason is structural
     * rather than a matter of tuning: vToneLo and vToneHi on the
     * carriageway are deliberately pulled close to the road's own colour so
     * that a track stays a track, so the whole distance from one end of the
     * ramps to the other is about thirty levels of albedo there, and two
     * standard deviations of a fourth octave is a small fraction of thirty.
     *
     * So this is multiplicative instead, and it is not spending the ramps'
     * budget. A wet hollow in a cart track is darker and cooler than the
     * earth around it and a baked crust is lighter and warmer, in whatever
     * biome, so the two ends can be factors rather than tones — which makes
     * the amplitude a fraction of the surface's own albedo and takes it out
     * of the ramps' calibration entirely. One noise call, the same one the
     * failed version paid for.
     *
     * The distance fade is not a performance dodge, it is what makes a
     * feature this small safe at all. There are no mipmaps on a noise
     * function; a metre of ground at a hundred and fifty metres is two
     * pixels, and a pattern sampled at two pixels a cycle is not texture, it
     * is a hash. Gone by forty-five metres, a metre is still fourteen pixels
     * across, which is a brush mark. Beyond the fade the ground is
     * bit-identical to what it was, which is wanted: the mid and far bands of
     * these frames measure well and had nothing to gain here.
     *
     * Steepened into patches rather than left as the raw noise, and that is
     * the difference between a term that measures and a term that is
     * visible. The smooth version shipped for one round: it moved the near
     * band's modal ten-level share from 32.0 to 30.1 per cent on morning and
     * 52.7 to 42.3 on portrait, and in the zoomed frame the near ground was
     * indistinguishable from before. A gradient of fifteen levels spread
     * across four hundred pixels is not a mark. The same fifteen levels
     * either side of an edge a few tens of pixels wide is, which is the
     * argument this file's header already makes about the light bands: a
     * gradient reads as untextured 3D and an edge broken up by noise reads
     * as a brush.
     */
    float nearness = 1.0 - smoothstep(10.0, 45.0, viewDepth);
    float mottle = noise21f(vWorldPosition.xz * 1.05 + 31.7);
    // Four fifths of the way to a two-tone patchwork. Not all the way: at
    // full steepening the near ground reads as two colours of paint and the
    // last fifth of raw noise is what keeps a patch's interior from being
    // dead flat.
    mottle = mix(mottle, smoothstep(0.38, 0.62, mottle), 0.8);
    vec3 damp = vec3(0.78, 0.83, 0.93);
    vec3 baked = vec3(1.23, 1.18, 1.05);
    albedo *= mix(vec3(1.0), mix(damp, baked, mottle), nearness);
    nearWeight = nearness;
    // Signed, so the two ends of the patchwork pull opposite ways about the
    // field's own value rather than only lifting it.
    nearMark = mottle * 2.0 - 1.0;
  #endif

  albedo = mix(albedo, albedo * uColorVariant, smoothstep(0.35, 0.75, grain) * uGrain);

  // --- banded diffuse ----------------------------------------------------
  float ndl = dot(N, L);
  // See SHADOW_EDGE: three hands back a penumbra that a low sun stretches
  // into a stain metres wide. The riser is narrowed hard and then its centre
  // is walked about by world-space noise, so the boundary lands somewhere
  // different every half metre and the wash becomes a ragged line of
  // hard-edged lobes. Zero-mean, so the shadow keeps its place and its area.
  float frayA = noise31f(vWorldPosition * SHADOW_FRAY_SCALE);
  float frayB = noise31f(vWorldPosition * SHADOW_FRAY_SCALE * 2.9 + 5.1);
  float frayFade = 1.0 - smoothstep(SHADOW_FRAY_NEAR_M, SHADOW_FRAY_FAR_M, viewDepth);
  float shadowCentre = 0.5 + (frayA * 0.62 + frayB * 0.38 - 0.5) * SHADOW_FRAY * frayFade;
  float shadowMask = smoothstep(
    shadowCentre - SHADOW_EDGE * 0.5,
    shadowCentre + SHADOW_EDGE * 0.5,
    getShadowMask()
  );

  // Nudging the band edges with the grain is what keeps the terminator from
  // looking like a contour line on a map.
  float wobble = (grain - 0.5) * 0.09;
  float soft = max(uBandSoftness, 0.001);
  float lit = ndl * 0.5 + 0.5 + wobble;

  float band1 = smoothstep(0.46 - soft, 0.46 + soft, lit);
  float band2 = smoothstep(0.62 - soft, 0.62 + soft, lit);
  float band3 = smoothstep(0.86 - soft * 0.7, 0.86 + soft * 0.7, lit);

  // Cast shadows only bite into the *lit* bands: a face already turned away
  // from the sun does not get darker for also being in shadow, which is
  // physically wrong and visually much calmer.
  float sunAmount = (band1 * 0.42 + band2 * 0.38 + band3 * 0.20);
  sunAmount *= mix(uShadowDepth, 1.0, shadowMask);

  /*
   * --- what is NOT here: a cloud shadow ---------------------------------
   *
   * Two octaves of noise multiplying the sun term, driven by the same
   * coverage the sky's cloud uses, gated to the hours when the sun is high.
   * It is the classic answer to a flat midday field and it was built, tuned
   * three times and measured each time against the frame with the term
   * switched off in the same page session, and it is not here because it
   * lost every one of those comparisons.
   *
   * The reason is perspective, and it is worth writing down so nobody
   * builds it a fourth time. The near ground of one of these frames is
   * about ten metres deep and eight to twenty-five metres wide: nearly half
   * the picture's height, and a patch of world small enough to fit inside a
   * single cloud. Any shadow field whose features are larger than that
   * covers the whole foreground or none of it, and a veil that is uniform
   * across a band does not model that band — it multiplies it, which
   * *compresses* its contrast. Measured on the noon frame the near band
   * went from 0.67 stops between its tenth and ninetieth percentile to
   * 0.63, and the whole picture lost a tenth of its value, at every scale
   * from fifty metres down to twenty.
   *
   * What the near ground actually needs is a caster standing in it. The
   * meadow grass was tried for that and is not here either: a tuft is a
   * root patch 22 cm across against a shadow map whose texel is 10.7 cm at
   * this frustum, so two texels under a filter kernel that spans three, and
   * the twenty thousand instances it would add to the depth pass measured
   * as doubling a phone frame while the ten postcards came back flat or
   * slightly worse — the low-sun ones worse, because grass that receives
   * its neighbours' long shadows goes uniformly darker and loses the range
   * it had. That leaves the near ground of a high-sun frame genuinely
   * unsolved rather than solved badly.
   */

  // Ambient is *directional*: sky from above, warm bounce from below. This
  // is the whole trick — it gives shadowed faces colour instead of grey.
  //
  // It is scaled well below 1. The sky and horizon uniforms are *display*
  // colours — what you see when you look at the sky — and a surface lit by
  // the full value of them is a surface as bright as the sky itself. The
  // first version added them at full strength on top of a sun term and the
  // entire world came out as white paper.
  float skyFacing = N.y * 0.5 + 0.5;
  // The sky's own colour arriving here, kept before any horizon warming.
  // This is the carrier for the scattered-skylight term further down and for
  // nothing else: see LOW_SUN_HORIZON for why that term must not be handed
  // the warm end of the sky.
  vec3 skyLight = mix(uGroundBounce, uSkyColor, skyFacing) * AMBIENT_STRENGTH;
  // See LOW_SUN_HORIZON: an upward face takes the zenith at noon and the
  // horizon band at golden hour, because that is where the light is.
  // Weighted by how far the surface turns toward the sun's own bearing, and
  // that clause is the whole difference between this term working and this
  // term being the monochrome fault. See LOW_SUN_HORIZON.
  float sunBearing = clamp(dot(N, normalize(vec3(L.x, 0.0, L.z) + vec3(1e-5))), 0.0, 1.0);
  vec3 upperSky = mix(uSkyColor, uHorizonColor, lowSun * LOW_SUN_HORIZON * sunBearing);
  vec3 ambient = mix(uGroundBounce, upperSky, skyFacing);
  // Horizon warmth leaks into faces pointing sideways, which is what makes
  // dawn and dusk read as dawn and dusk.
  ambient = mix(ambient, uHorizonColor, (1.0 - abs(N.y)) * 0.35);
  ambient *= AMBIENT_STRENGTH;

  vec3 lighting = ambient + uSunColor * sunAmount * SUN_STRENGTH;

  /*
   * --- the sun side and the shade side of a mass -------------------------
   *
   * See MODEL_SPLIT. sunBearing above already asks which way a surface
   * turns relative to the sun, but it takes the raw normal — and on foliage
   * that normal has been tilted almost straight up, so the answer it gets is
   * within a few per cent of the same on both sides of a crown. Normalising
   * the horizontal part recovers the DIRECTION at full length whatever the
   * tilt did to its length, which is the one piece of information the tilt
   * scaled down rather than threw away.
   */
  vec3 sunHeading = normalize(vec3(L.x, 0.0, L.z) + vec3(1e-4, 0.0, 0.0));
  vec3 faceHeading = vec3(N.x, 0.0, N.z);
  float faceMag = length(faceHeading);
  float facing = faceMag > 1e-4 ? dot(faceHeading / faceMag, sunHeading) : 0.0;
  // Flat ground has no bearing to speak of and must not be handed one; by a
  // tenth of a unit — a gentle hillside, or a canopy normal after the tilt —
  // there is a side to model and the term is fully in.
  float faceWeight = smoothstep(0.02, 0.10, faceMag)
    // No sun below the horizon means no sun side. Deliberately not sunHeight,
    // which is already half gone at golden hour — the hour that needs this
    // most.
    * smoothstep(-0.10, 0.06, uSunDirection.y);
  // Banded with the same wobble and softness as the diffuse, so the split
  // arrives as a painted plane rather than as a gradient across the form.
  float faceBand = smoothstep(-MODEL_TURN - soft, -MODEL_TURN + soft, facing + wobble);
  // The sun side is lit by sunlight and the shade side by skylight. Both keys
  // normalised to unit luminance, so this rotates the light's hue and leaves
  // its value to the terms that own it.
  vec3 warmKey = uSunColor / max(dot(uSunColor, LUMA_W), 1e-4);
  vec3 coolKey = uSkyColor / max(dot(uSkyColor, LUMA_W), 1e-4);
  lighting *= mix(vec3(1.0), mix(coolKey, warmKey, faceBand), MODEL_SPLIT * faceWeight);
  lighting *= mix(1.0, mix(1.0 - MODEL_VALUE, 1.0 + MODEL_VALUE, faceBand), faceWeight);

  /*
   * See FG_TIER_DEPTH for what this term is and FG_TIER_TREADS for why it is
   * a staircase rather than a curve: the near ground, the middle distance and
   * everything past forty-five metres are three planes of stated value, with
   * a narrow riser between them broken by the grain so the boundary is a
   * brush line. The endpoints are exactly where the ramp left them.
   */
  float depthRamp = 1.0 - smoothstep(FG_TIER_NEAR_M, FG_TIER_FAR_M, viewDepth);
  float tread = depthRamp * FG_TIER_TREADS;
  float riser = smoothstep(
    0.5 - FG_TIER_RISER,
    0.5 + FG_TIER_RISER,
    fract(tread) + (grain - 0.5) * FG_TIER_FRAY
  );
  float foreground = (floor(tread) + riser) / FG_TIER_TREADS;
  float foregroundTier = 1.0 - FG_TIER_DEPTH * foreground * sunHeight;
  // See FG_TIER_HUE: each tread also steps toward the colour of the air, so
  // the middle distance is neither the foreground's local colour nor the
  // horizon's haze. Luminance-normalised, so this is the rotation and the
  // line above is the value.
  vec3 airKey = uFogColor / max(dot(uFogColor, LUMA_W), 1e-4);
  vec3 airward = mix(vec3(1.0), airKey, FG_TIER_HUE * (1.0 - foreground) * sunHeight);

  vec3 color = albedo * lighting * foregroundTier * airward;

  // The one light term that does not pass through the albedo. See
  // SKY_SCATTER: a warm albedo cannot be multiplied into a cool shadow, so
  // the shade side is given its colour additively instead.
  // See LOW_SUN_SCATTER for why the strength depends on sun height: skylight
  // and sunlight do not fall off together, and this term was a seventieth of
  // the light at golden hour, which is why item 9 stayed open there.
  float scatter = SKY_SCATTER * (1.0 + lowSun * (LOW_SUN_SCATTER - 1.0))
    * (1.0 - sunAmount) * mix(0.25, 1.0, skyFacing);
  /*
   * --- the near-ground mark's second carrier -----------------------------
   *
   * Not a new light term. The mark above is a factor on albedo, and a factor
   * on albedo is a fixed RELATIVE change in linear light — which the sRGB
   * encode turns into a level difference very nearly proportional to the
   * level itself. Measured through the real encode with the shipped damp and
   * baked constants, the same shader term is worth 12.8 sRGB levels at the
   * morning frame's near-band mean of L74 and 5.7 at the dusk frame's L25.
   * Against a ten-level bucket that is the difference between a band spread
   * over three buckets and a band sitting in one, and it is exactly the shape
   * of the failure: the mottle measures well on the six high-sun frames and
   * misses 05-golden-busk and 06-dusk-encounter, the two where the near
   * ground is LARGEST.
   *
   * The multiply cannot be turned up to fix it. Its amplitude is a fraction
   * of the surface's own albedo by construction — that is the whole reason it
   * is multiplicative rather than a fourth octave in the drift, and the note
   * above records what happened when the drift's own budget was spent
   * instead. At a low sun the surface simply has little light to take a
   * fraction of.
   *
   * So the mark rides the one term that is BIGGEST where the multiply is
   * weakest. SKY_SCATTER is scaled by 1 - sunAmount, so it is near nothing at
   * noon (flat ground there takes sunAmount ~0.81) and near everything at
   * dusk (the sun is below the horizon by 06's hour, so ~0.85 of it survives)
   * — the two frames that needed this are the two that get it, and the six
   * that already measure well are barely touched. It is the same patchwork
   * with the same edges, reinforcing the multiply rather than fighting it.
   *
   * The amplitude is a relative swing on a small term, not a term of its own,
   * so it cannot introduce light where the sky is dark: the ambient collapses
   * with the sky at night exactly as SKY_SCATTER's own note describes, and
   * the clamp keeps the damp end from ever subtracting more scatter than
   * there is.
   */
  scatter *= clamp(1.0 + nearMark * NEAR_SHADE_MARK * nearWeight, 0.0, 2.0);
  // See CAST_SHADOW_SKY: the term above serves the SHADE side and, by its own
  // arithmetic, barely reaches a cast shadow under a high sun. A patch of
  // ground a tree is standing in front of at noon has the sky dome for its
  // only illuminant, so it is the one genuinely blue thing in the frame.
  scatter += CAST_SHADOW_SKY * (1.0 - shadowMask) * sunHeight * mix(0.35, 1.0, skyFacing);
  color += skyLight * scatter * foregroundTier;

  // --- rim ---------------------------------------------------------------
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
  // Rim only where the sun can plausibly wrap around, plus a constant sliver
  // of sky light, so silhouettes never disappear into the fog.
  float sunWrap = clamp(dot(N, L) * 0.5 + 0.75, 0.0, 1.0);
  vec3 rimColor = mix(uSkyColor, uSunColor, 0.65);
  // Scaled by the surface's own albedo rather than added flat. A flat
  // additive rim is what turned a field of grass — thin blades, seen almost
  // edge-on, so fresnel is ~1 across the whole blade — into a field of white
  // slivers. Tying it to albedo keeps a rim a *highlight on a thing* instead
  // of a light source in its own right.
  /*
   * And turned up when the sun is on the horizon, which is critique gap 7:
   * in the vista, busk and encounter frames the bard is the darkest thing in
   * the picture with no edge to lift him off the ground behind him.
   *
   * This is the one term in the shader that models light wrapping round a
   * silhouette, and a low sun is when that actually happens — a figure with
   * the sun behind him at golden hour carries a bright line down one side,
   * and it is the single most reliable way a reference frame separates a
   * character from a landscape. Not a new light and not a per-object dial:
   * the same rim, riding the same lowSun the two colour terms above ride, so
   * a mood cannot disagree with the world about how the light works.
   *
   * The grass regression this file records is guarded by the multiply. That
   * failure was a FLAT addition; this one is scaled by uRim, which is 0.05 on
   * meadow blades and 0.5 to 1.15 on the bard's cloth. Turning the whole term
   * up by half turns the grass up from a twentieth to a thirteenth and the
   * figure up from a half to three quarters, which is the ratio that was
   * wanted in the first place.
   */
  color += rimColor * (0.35 + albedo * 0.65) * fresnel * uRim
    * (0.3 + 0.7 * sunWrap) * (1.0 + lowSun * RIM_LOW_SUN);

  // --- hearth ------------------------------------------------------------
  // Deliberately NOT banded, unlike the sun. Banding is a stylisation of
  // hard directional light; a fire is a small, flickering, close source and
  // its falloff is what makes a camp read as a pool of warmth rather than a
  // spotlight. Wrapped lambert (the 0.55/0.45 remap) lets the light bend
  // round a silhouette the way firelight actually does, so a figure sitting
  // with his back half-turned still catches an edge of it.
  if (uHearthStrength > 0.0) {
    vec3 toHearth = uHearthPosition - vWorldPosition;
    float hearthDist = length(toHearth);
    vec3 HL = toHearth / max(hearthDist, 1e-4);
    // Inverse-square, softened near zero so standing in the fire does not
    // divide by nothing and blow the frame out.
    float falloff = 1.0 / (1.0 + (hearthDist * hearthDist) / max(uHearthRadius * uHearthRadius, 1e-4));
    float wrapped = max(dot(N, HL) * 0.55 + 0.45, 0.0);
    color += albedo * uHearthColor * wrapped * falloff * uHearthStrength;
  }

  // --- contact shading ---------------------------------------------------
  // A soft darkening toward an object's base. Fakes the occlusion where a
  // trunk meets grass, which is otherwise the tell that nothing is touching.
  //
  // Faded out as the sun drops. Contact shading is an occlusion of the sun,
  // and under a low sun there is nothing much to occlude: the same figure
  // that reads as a tuft standing in grass at noon reads as a scorch mark at
  // dusk, because it is subtracting a third of a value that has already
  // fallen to almost nothing. Keeping a fifth of it at night stops the base
  // of every blade lifting off the ground it is standing in.
  if (uBaseShadeHeight > 0.0) {
    float base = 1.0 - clamp(vLocalHeight / uBaseShadeHeight, 0.0, 1.0);
    color *= mix(1.0, 1.0 - uBaseShade * mix(0.2, 1.0, sunHeight), base * base);
  }

  /*
   * --- sky floor ---------------------------------------------------------
   *
   * The one place the ambient stops being a plain multiplier, and the reason
   * is the standing rule that a shadow is coloured and never grey.
   *
   * A blade of grass is a thin double-sided sliver with a near-horizontal
   * normal. Under a low sun its diffuse term is nothing, so all it has left
   * is ambient times a dark green albedo — and a dark green albedo is about
   * two per cent reflectance in the red, so the product is not a dark green,
   * it is black. Mid-ground grass at golden hour was coming out as flecks of
   * soot. What is missing physically is that thin foliage does not only
   * reflect the sky, it transmits and scatters it, and what it scatters is
   * much closer to the colour of the light than to the colour of the leaf.
   *
   * So: a floor in the colour of the light arriving here, carrying part of
   * the surface's own hue so that grass at dusk goes deep blue-green rather
   * than mauve, and gated hard on how dark the fragment already is. The gate
   * is what keeps this out of the rest of the picture — by a fifth of a stop
   * up from black the term is already half gone, so noon keeps its contrast
   * and a night scene keeps its darks, which at night are dark because the
   * sky itself is dark and the floor comes down with it.
   */
  vec3 hue = albedo / max(max(albedo.r, max(albedo.g, albedo.b)), 0.001);
  vec3 floorLight = ambient * mix(vec3(1.0), hue, 0.5) * 0.28;
  color += floorLight * foregroundTier * exp(-dot(color, vec3(0.30, 0.59, 0.11)) * 22.0);

  /*
   * The emissive floor rides the surface's own painted field.
   *
   * It used to be added flat — one constant, the same on every fragment of
   * the material, laid on top of the albedo. A constant added to two values
   * compresses the ratio between them, and that is not a small effect here
   * because this term is at its largest exactly when the light is at its
   * smallest: the songboard's floor is sized as LIGHT_FLOOR minus the world's
   * own luminance, so at dusk it is most of what the plank is made of. The
   * plank carries its weathering and its printed rules as VERTEX COLOUR, a
   * 22 per cent value swing between fresh and worn timber and a factor of
   * eleven between paper and ink (BOARD_INK is 0.09 of the paper) — and a
   * flat addition arrives on all of them equally, so the worn end and the
   * fresh end converge and, worse, the rules fill in toward the paper at the
   * hour a player most needs to read a pitch off them.
   *
   * Multiplying by the painted field fixes both without touching the floor's
   * size: a fragment that is nine per cent of the paper's albedo receives
   * nine per cent of the lift, so every ratio the artist painted survives the
   * floor intact and the plank as a whole is lifted by the same amount it was.
   *
   * Deliberately vVertexColor * vInstanceColor and NOT the full albedo. The
   * distinction is what makes this safe: the field is the part of the albedo
   * somebody painted per vertex or per instance, while the rest of the albedo
   * (uColor, the grain's colour variant, the ground drift) is the material's
   * own base tone, and dividing a light term by that would tint every emitter
   * with the square of its own colour. Of the eight emissive surfaces in the
   * game, seven are the campfire's — flames, coals, lantern glass — and every
   * one of them is a plain mesh with neither vertex nor instance colour, so
   * this leaves the fire arithmetically identical. The songboard's timber is
   * the only material in the world with both, which is the one this is for.
   */
  vec3 emissiveField = vInstanceColor;
  #ifdef PAINTERLY_VERTEX_COLORS
    emissiveField *= vVertexColor;
  #endif
  color += uEmissive * uEmissiveStrength * emissiveField;
  color *= uExposure;

  // --- fog ---------------------------------------------------------------
  // Distance fog, thinned with altitude so hilltops stay legible while the
  // valley floor dissolves. Tinted toward the horizon low down.
  float depth = viewDepth;
  // A steeper near ramp, then a long tail.
  //
  // One smoothstep across the whole range spreads the veil so evenly that
  // the middle distance and the far distance sit within a few per cent of
  // each other — no staircase, so no depth. Squaring the near half pushes
  // most of the change into the first stretch beyond the treeline, which is
  // where the eye reads distance from, and leaves the tail to separate the
  // ridge from the sky.
  float fogRaw = smoothstep(uFogNear, uFogFar, depth);
  float distanceFog = fogRaw * fogRaw * (3.0 - 2.0 * fogRaw);
  float heightFalloff = uFogHeight > 0.0
    ? exp(-max(vWorldPosition.y, 0.0) / uFogHeight)
    : 1.0;
  // Capped below 1: a silhouette that dissolves *completely* into the sky
  // reads as a draw-distance failure rather than as distance.
  //
  // Raised from 0.82 once the sky dome grew its own bands of distant land.
  // The cap exists so that the furthest thing drawn does not vanish and
  // leave a hole; with a ridge standing behind it there is no hole to leave,
  // and the last tenth is worth having. It is the only term in the frame
  // that separates a hundred and sixty metres from twenty: the surfaces at
  // both ends are the same albedo under the same sun, so whatever value
  // range those two bands end up with, this is where it comes from.
  // Capped well below 1, and lower than it was.
  //
  // At 0.90 the far ground effectively became the fog colour, so a hill at
  // the limit had no silhouette left and the middle distance and the far
  // distance arrived at the same tone — the picture had a foreground and
  // then one undifferentiated pale mass. A cap of 0.60 keeps the furthest
  // land a recognisable value below the sky it stands against, which is what
  // makes it read as land rather than as haze.
  // uFogScale is per-material and 1 for everything except the landmarks the
  // road is aimed at. See the note on fogScale in PainterlyOptions: the cap
  // below is right for scenery and wrong for a destination.
  float fogAmount = clamp(distanceFog * mix(0.45, 1.0, heightFalloff) * uFogScale, 0.0, 0.60);
  vec3 fogTint = mix(uFogColor, uHorizonColor, clamp(0.55 - vWorldPosition.y * 0.02, 0.0, 0.6));
  vec3 hazed = mix(color, fogTint, fogAmount);

  // See FOG_HUE_LEAD and FOG_CHROMA. The value of the distance is whatever
  // the mix above made it and is not touched here — that is the whole point,
  // since fog is applied after uExposure and nothing downstream can pay this
  // band back. What moves is only its hue: most of the way to the air's own,
  // pre-compensated for the saturation ACES will take off it, and held at the
  // luminance the haze already decided.
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  float hazedLuma = dot(hazed, LUMA);
  float airLuma = dot(fogTint, LUMA);
  float hazeDepth = clamp(fogAmount * (1.0 / 0.60), 0.0, 1.0);
  vec3 airChroma = (fogTint - airLuma) * FOG_CHROMA;
  color = max(vec3(0.0), hazedLuma + mix(hazed - hazedLuma, airChroma, hazeDepth * FOG_HUE_LEAD));

  gl_FragColor = vec4(color, uOpacity);

  #ifdef PAINTERLY_ALPHATEST
    if (gl_FragColor.a < PAINTERLY_ALPHATEST) discard;
  #endif

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Create a painterly material bound to a scene's shared globals.
 *
 * The returned material shares the global uniform *objects*, so a single
 * write to globals.uSunDirection.value moves the sun for the whole world.
 * Per-material uniforms (colour, rim, sway) are private to each instance.
 */
export function createPainterlyMaterial(
  globals: PainterlyGlobals,
  options: PainterlyOptions = {},
): ShaderMaterial {
  const {
    color = 0x8fa86b,
    colorVariant = 0xffffff,
    grain = 0.5,
    grainScale = 0.35,
    rim = 0.2,
    rimPower = 2.5,
    baseShade = 0,
    baseShadeHeight = 0,
    sway = 0,
    swaySpeed = 1.1,
    swayAttribute = false,
    swayHeight = 1,
    vertexColors = false,
    groundTones = 0,
    receiveShadow = true,
    shadowDepth = 0.35,
    bandSoftness = 0.07,
    side = FrontSide,
    alphaTest = 0,
    transparent = false,
    emissive = 0x000000,
    emissiveStrength = 0,
    flatShading = false,
    fogScale = 1,
  } = options;

  const defines: Record<string, string | number | boolean> = {};
  if (vertexColors) defines.PAINTERLY_VERTEX_COLORS = '';
  if (groundTones > 0) defines.PAINTERLY_GROUND_TONES = '';
  if (swayAttribute) defines.USE_SWAY_ATTRIBUTE = '';
  if (flatShading) defines.PAINTERLY_FLAT_SHADING = '';
  if (alphaTest > 0) defines.PAINTERLY_ALPHATEST = alphaTest.toFixed(4);

  const material = new ShaderMaterial({
    defines,
    // UniformsLib.lights carries the shadow-map samplers and light structs
    // three's chunks expect; `lights: true` is what makes the renderer
    // actually populate them.
    uniforms: UniformsUtils.merge([
      UniformsLib.lights,
      {
        uColor: { value: new Color(color as never) },
        uColorVariant: { value: new Color(colorVariant as never) },
        uEmissive: { value: new Color(emissive as never) },
        uEmissiveStrength: { value: emissiveStrength },
        uGroundTones: { value: groundTones },
        uGrain: { value: grain },
        uGrainScale: { value: grainScale },
        uRim: { value: rim },
        uRimPower: { value: rimPower },
        uBaseShade: { value: baseShade },
        uBaseShadeHeight: { value: baseShadeHeight },
        uFogScale: { value: fogScale },
        uShadowDepth: { value: shadowDepth },
        uBandSoftness: { value: bandSoftness },
        uOpacity: { value: 1 },
        uSway: { value: sway },
        uSwaySpeed: { value: swaySpeed },
        uSwayHeight: { value: swayHeight },
      },
    ]),
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    lights: true,
    transparent,
    side,
    fog: false,
  });

  // Point the shared uniforms at the *same objects* the globals hold, after
  // the merge (UniformsUtils.merge deep-clones, which would otherwise give
  // every material its own private copy of the sun).
  bindGlobals(material, globals);

  material.userData.painterly = true;
  material.userData.receivesPainterlyShadow = receiveShadow;
  return material;
}

/** Re-point a material's shared uniforms at a globals block. */
export function bindGlobals(material: ShaderMaterial, globals: PainterlyGlobals): void {
  const shared = globals as unknown as Record<string, IUniform>;
  for (const key of Object.keys(shared)) {
    material.uniforms[key] = shared[key];
  }
}

/**
 * A double-sided cutout variant for billboarded foliage. Split out because
 * getting side and alphaTest wrong on grass is the single most common
 * way stylised foliage ends up looking like cardboard.
 */
export function createFoliageMaterial(
  globals: PainterlyGlobals,
  options: PainterlyOptions = {},
): ShaderMaterial {
  return createPainterlyMaterial(globals, {
    side: DoubleSide,
    // Foliage gets *less* rim than solid geometry, not more. Leaves and
    // blades are thin and mostly seen close to edge-on, so their fresnel
    // term sits near 1 over almost the whole surface — the same rim figure
    // that reads as a delicate edge on a rock reads as a light bulb here.
    rim: 0.16,
    rimPower: 2.4,
    bandSoftness: 0.12,
    shadowDepth: 0.45,
    baseShade: 0.35,
    ...options,
  });
}
