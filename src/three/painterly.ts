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
   * attributes, `aToneLo` and `aToneHi`, which give this fragment the dark
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

  vec3 V = normalize(cameraPosition - vWorldPosition);
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

  // --- world-space grain -------------------------------------------------
  // Sampled in world space so it belongs to the *scene*, like paper
  // texture under the whole painting, rather than sliding around on each
  // object as it moves.
  float grainA = noise31f(vWorldPosition * uGrainScale);
  float grainB = noise31f(vWorldPosition * uGrainScale * 2.7 + 11.3);
  float grain = grainA * 0.68 + grainB * 0.32;

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
     */
    albedo = mix(albedo, vToneLo, smoothstep(0.50, 0.27, drift) * uGroundTones * 0.72);
    albedo = mix(albedo, vToneHi, smoothstep(0.56, 0.82, drift) * uGroundTones * 0.62);
  #endif

  albedo = mix(albedo, albedo * uColorVariant, smoothstep(0.35, 0.75, grain) * uGrain);

  // --- banded diffuse ----------------------------------------------------
  float ndl = dot(N, L);
  float shadowMask = getShadowMask();

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
  vec3 ambient = mix(uGroundBounce, uSkyColor, skyFacing);
  // Horizon warmth leaks into faces pointing sideways, which is what makes
  // dawn and dusk read as dawn and dusk.
  ambient = mix(ambient, uHorizonColor, (1.0 - abs(N.y)) * 0.35);
  ambient *= AMBIENT_STRENGTH;

  vec3 lighting = ambient + uSunColor * sunAmount * SUN_STRENGTH;

  vec3 color = albedo * lighting;

  // The one light term that does not pass through the albedo. See
  // SKY_SCATTER: a warm albedo cannot be multiplied into a cool shadow, so
  // the shade side is given its colour additively instead.
  color += ambient * SKY_SCATTER * (1.0 - sunAmount) * mix(0.25, 1.0, skyFacing);

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
  color += rimColor * (0.35 + albedo * 0.65) * fresnel * uRim * (0.3 + 0.7 * sunWrap);

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
  color += floorLight * exp(-dot(color, vec3(0.30, 0.59, 0.11)) * 22.0);

  color += uEmissive * uEmissiveStrength;
  color *= uExposure;

  // --- fog ---------------------------------------------------------------
  // Distance fog, thinned with altitude so hilltops stay legible while the
  // valley floor dissolves. Tinted toward the horizon low down.
  float depth = length(cameraPosition - vWorldPosition);
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
  color = mix(color, fogTint, fogAmount);

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
 * write to `globals.uSunDirection.value` moves the sun for the whole world.
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
 * getting `side` and `alphaTest` wrong on grass is the single most common
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
