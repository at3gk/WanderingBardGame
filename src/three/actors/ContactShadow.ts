/**
 * The mark a figure makes on the ground it is standing on.
 *
 * --- what this is for -----------------------------------------------------
 *
 * The world has real shadow maps (see painterly.ts's SHADOW_EDGE block for
 * why they are real and not blob decals), and at noon they do this job
 * perfectly: the bard's own shadow pools at his feet and the figure is
 * anchored. Measured with `tools/figground-partition.mjs`, the knees-down
 * band of `03-noon-forest` and `10-tablet` is 0% bard — it is entirely his
 * cast shadow lying on a bright road, 16.6 and 8.7 L* below it. That contact
 * is what the eye reads as "standing on".
 *
 * At a low sun the same shadow map casts the same shadow SIX AND A HALF
 * TIMES his height (01-dawn's sun sits at elevation 8.6 degrees), so it lands
 * metres away, usually out of frame entirely, and the ground under his boots
 * comes back at exactly the value of the road four metres off. Measured on
 * `01-dawn-road`: road under the figure L*22.8, surround L*22.8. The figure
 * is not dark at dawn — the partition harness measured him at 1.6x the road's
 * luminance with his albedos flooded white — he is simply not attached to
 * anything. Nothing in the picture says where he meets the world.
 *
 * So this supplies the contact the sun's angle has taken away, and only
 * then: it fades out as the sun climbs, because above that elevation the
 * shadow map's own shadow is back inside the footprint and a second darkening
 * would be double-counting the same occlusion.
 *
 * --- what it must not read as ---------------------------------------------
 *
 * A halo or a sticker. Three things keep it honest. It is DRAPED over the
 * terrain rather than laid flat, exactly as Campfire's light pool is and for
 * the reason recorded there — a flat disc on a crowned road verge is mostly
 * underground. It is ELONGATED and OFFSET along the sun's own bearing, so it
 * is the near end of the long shadow the sun is actually casting rather than
 * a symmetrical pad centred under the feet. And its rim is per-segment
 * IRREGULAR and eased to nothing, so there is no edge to catch.
 *
 * It darkens by MULTIPLY, into a slightly cool tint. A multiply cannot
 * invert the surface it lies on (that is the failure painterly.ts's
 * SHADOW_GAIN_CAP exists to rule out on the shader side), and the cool tint
 * is the same claim CAST_SHADOW_HUE makes: a shadow is lit by the sky, so it
 * is not the same hue as the sunlit ground, only darker.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  NormalBlending,
  ShaderMaterial,
} from 'three';

/**
 * The colour the darkest point of the mark carries, and how much of it lands
 * there.
 *
 * A shadow decal wants to be a MULTIPLY: multiplying whatever is underneath
 * cannot invert it and needs no knowledge of the surface. That was the first
 * build and it does not work here — three's MultiplyBlending was set on the
 * material (verified at runtime: blending === 4, transparent, drawn, in the
 * transparent queue) and the patch still composited as if it were normal
 * blending, arriving as a near-white polygon that RAISED the road around the
 * bard by 15 L*. Not worth chasing through the renderer's blend state for a
 * decal; alpha-over-a-dark-colour is the same picture through a path this
 * repo already relies on everywhere else, and it is equally unable to
 * invert, because the colour it blends toward is darker than any road.
 *
 * The tint is not black. DESIGN's standing rule is that shadows are coloured,
 * and this one is lit by the sky alone, so it is a very dark slate with the
 * blue channel kept highest — the same claim CAST_SHADOW_HUE makes in the
 * shader, made here in the one place the shader cannot reach.
 *
 * The blend lands on an already tone-mapped, sRGB-encoded pixel, which is
 * convenient: L* ~ 116*v^0.733 - 16, so the arithmetic is direct.
 *
 * 0.66 is set against the passing frames' own numbers, not against a darker
 * ideal: 03-noon and 10-tablet anchor their figures on a cast shadow 8-17 L*
 * under the local road, so that is the band to land in. Measured on the
 * shipped build, at the mark's core (the pixels it moves by more than 36/255
 * summed across channels) against the same pixels with the mark hidden:
 * 01-dawn 9.9 under its road, 02-morning 11.8, 03-noon 12.2, 04-golden 7.7,
 * 08-portrait 11.6, 10-tablet 11.8. Averaged over the whole mark, rim
 * included, 3-7. A blob 25 L* under the road is a sticker and the panels have
 * said so, twice.
 *
 * The tint was cooler than this at first — 0.10/0.11/0.14, blue a full 40%
 * over red. On the warm brown road of 10-tablet that read as a grey-blue
 * patch belonging to a different picture. 12% over red keeps the shadow off
 * the grey axis without arguing with the ground it lies on.
 */
const CONTACT_TINT = new Color(0.108, 0.112, 0.126);
const CONTACT_ALPHA = 0.66;

/**
 * The sun elevation (as sin, i.e. the sun direction's y) below which the mark
 * fades away, and the reason there is no fade at the other end.
 *
 * The first build of this had a second ramp that handed the job back to the
 * shadow map as the sun climbed, on the assumption that a high sun pools the
 * figure's own shadow at his feet. Measured on settled frames — and it has to
 * be settled frames, the sun direction eases toward its target and a reading
 * taken 400 ms after a pose is still in transit, which is how the first set of
 * thresholds came to be wrong by a factor of two — this world's sun does not
 * climb. The seven postcard hours: 04-golden 0.136, 06-dusk -0.066, 01-dawn
 * 0.278, 02-morning 0.348, 08-portrait 0.369, 03-noon 0.371, 10-tablet 0.405.
 * Sunrise to noon is 0.278 to 0.371. Noon here is 21.8 degrees of elevation,
 * which puts the shortest shadow this world ever casts at 2.5x the figure's
 * height — always long, always away, never underfoot. There is no hour to
 * hand back to, so there is no top ramp.
 *
 * What that leaves is the horizon. After the sun has set the ground is lit by
 * the sky dome alone, which is an area source and casts no directional shadow
 * for this to be the root of; the mark thins out with it. 06-dusk sits at
 * -0.066 and keeps 28% — enough to be the ambient occlusion a figure makes
 * against a sky-lit ground, not enough to be a shadow with no sun.
 *
 * Measured cost to the frames that were already passing, at full strength:
 * 03-noon changes 72 pixels in a 1.4-megapixel frame (the camera there looks
 * along the bard's own body and he occludes his own contact), and 10-tablet's
 * figure/ground numbers move by less than the harness's own frame-to-frame
 * noise. Nothing is darkened twice because nothing was dark there to begin
 * with.
 */
const CONTACT_SUN_SET_LOW = -0.14;
const CONTACT_SUN_SET_HIGH = 0.02;

/**
 * Radius across the sun's bearing, metres. Boot-to-boot is about 0.4 m, so
 * the mark is a little wider than the stance and no wider: the first build
 * ran 0.52 and covered enough of the road to move the whole knees-down band's
 * mean, which is a stain, not a contact. Compact is the brief.
 */
const CONTACT_RADIUS_M = 0.42;
/**
 * How much longer the mark is along the sun's bearing than across it, and how
 * far down that bearing its centre sits.
 *
 * A real contact shadow is the near end of a long one, so symmetry is what
 * makes a blob read as a pad glued under a sprite: the mark is a third longer
 * than it is wide and leans away from the sun. The lean is only 6 cm. It was
 * 20 cm, and at 10-tablet's grazing camera that plus the stretch put the
 * visible mass clear of the boots with road showing between — a figure
 * walking past a puddle rather than standing in his own shade. The asymmetry
 * has to come from the shape, not from moving the shape off the feet.
 */
const CONTACT_STRETCH = 1.3;
const CONTACT_OFFSET_M = 0.06;

const SEGMENTS = 16;
const RINGS = 4;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** How much of the mark the sun's elevation calls for, 0..1. */
function contactStrengthForSun(sunY: number): number {
  return smoothstep(CONTACT_SUN_SET_LOW, CONTACT_SUN_SET_HIGH, sunY);
}

export class ContactShadow {
  readonly mesh: Mesh;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly position: Float32Array;
  /** Unit-disc offsets, before the stretch and the sun's bearing. */
  private readonly local: Float32Array;

  constructor() {
    const rimScale: number[] = [];
    // A fixed irregular rim rather than a circle. Deterministic: the postcard
    // shoots must be byte-repeatable, so this cannot be seeded off time.
    for (let s = 0; s < SEGMENTS; s++) {
      rimScale.push(0.82 + 0.3 * (0.5 + 0.5 * Math.sin(s * 2.399963 + 1.7)) * (0.7 + 0.3 * Math.sin(s * 5.1)));
    }

    const local: number[] = [];
    const falloffs: number[] = [];
    const index: number[] = [];
    // Centre vertex first, then RINGS rings of SEGMENTS.
    local.push(0, 0);
    falloffs.push(1);
    for (let ring = 1; ring <= RINGS; ring++) {
      const t = ring / RINGS;
      for (let s = 0; s < SEGMENTS; s++) {
        const angle = (s / SEGMENTS) * Math.PI * 2;
        const radius = t * rimScale[s];
        local.push(Math.sin(angle) * radius, Math.cos(angle) * radius);
        // Eased once. Campfire's pool eases twice because it is a light and
        // a light wants a hot core; a shadow wants a body. The doubled curve
        // was the first build here and it put 90% of the disc under 0.1 —
        // measured as no darkening at all outside a few centimetres.
        const f = 1 - t;
        falloffs.push(f * f * (3 - 2 * f));
      }
    }
    for (let s = 0; s < SEGMENTS; s++) {
      const n = (s + 1) % SEGMENTS;
      index.push(0, 1 + s, 1 + n);
      for (let ring = 1; ring < RINGS; ring++) {
        const a = 1 + (ring - 1) * SEGMENTS;
        const b = 1 + ring * SEGMENTS;
        index.push(a + s, b + s, b + n, a + s, b + n, a + n);
      }
    }

    this.local = new Float32Array(local);
    this.position = new Float32Array((this.local.length / 2) * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    this.geometry.setAttribute('aFalloff', new BufferAttribute(new Float32Array(falloffs), 1));
    this.geometry.setIndex(index);

    this.material = new ShaderMaterial({
      uniforms: {
        uTint: { value: CONTACT_TINT.clone() },
        uStrength: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aFalloff;
        varying float vFalloff;
        void main() {
          vFalloff = aFalloff;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        uniform float uStrength;
        varying float vFalloff;
        void main() {
          gl_FragColor = vec4(uTint, uStrength * vFalloff);
        }
      `,
      blending: NormalBlending,
      transparent: true,
      depthWrite: false,
      // Two-sided on purpose. The fan's winding is whatever the ring loop
      // above produces, the mesh is draped over terrain so it can tilt past
      // horizontal on a rut, and a ground decal that vanishes when the
      // triangle happens to face away is a bug that costs nothing to rule
      // out — the first build of this rendered nothing at all for exactly
      // that reason and measured as a no-op across every frame.
      side: DoubleSide,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'bardContact';
    this.mesh.frustumCulled = false;
    // Draws after the ground it multiplies into and before nothing in
    // particular; it writes no depth and covers a metre of road.
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  /**
   * Place the mark under a figure standing at `x, z`, draped over whatever
   * `groundHeightAt` reports, leaning away from a sun on `sunDir`.
   */
  update(
    x: number,
    z: number,
    sunDirX: number,
    sunDirY: number,
    sunDirZ: number,
    footY: number,
    groundHeightAt: (x: number, z: number) => number,
    enabled: boolean,
  ): void {
    const strength = enabled ? contactStrengthForSun(sunDirY) : 0;
    this.material.uniforms.uStrength.value = strength * CONTACT_ALPHA;
    this.mesh.visible = strength > 0.004;
    if (!this.mesh.visible) return;

    // Away from the sun, on the ground plane. At the exact zenith this is
    // degenerate; the strength ramp has been zero for a long while by then.
    const flat = Math.hypot(sunDirX, sunDirZ);
    const ax = flat > 1e-4 ? -sunDirX / flat : 0;
    const az = flat > 1e-4 ? -sunDirZ / flat : 1;
    const cx = x + ax * CONTACT_OFFSET_M;
    const cz = z + az * CONTACT_OFFSET_M;

    // Anchored to the figure's own foot height, with the terrain sample used
    // only for the SHAPE of the drape. The road is a carved surface and the
    // raw terrain under it is not where the boots are; sampling it absolutely
    // put the mark a few centimetres off, and at a grazing postcard camera a
    // few centimetres of ground is tens of pixels of gap between a bard and
    // his shadow — which reads, correctly, as a puddle he is walking past.
    const lift = footY - groundHeightAt(cx, cz);

    for (let i = 0, p = 0; i < this.local.length; i += 2, p += 3) {
      // Local u runs across the bearing, v along it.
      const u = this.local[i] * CONTACT_RADIUS_M;
      const v = this.local[i + 1] * CONTACT_RADIUS_M * CONTACT_STRETCH;
      const wx = cx + v * ax - u * az;
      const wz = cz + v * az + u * ax;
      this.position[p] = wx;
      // Two centimetres proud of the ground it is draped on: enough to win
      // the depth test against the terrain's own triangles at grazing camera
      // angles, little enough that it never lifts off a rut.
      this.position[p + 1] = groundHeightAt(wx, wz) + lift + 0.02;
      this.position[p + 2] = wz;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
