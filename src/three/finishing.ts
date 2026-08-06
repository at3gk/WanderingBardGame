/**
 * The finishing pass (task 168): the last thing that happens to every frame.
 *
 * The scene is rendered into an offscreen target at RENDER_SCALE of the
 * canvas, then composited to the screen through a code-generated 3D LUT.
 * This is A Short Hike's unifier translated to this renderer: the slight
 * upscale softening forgives close-range low-poly crudeness, and one grade
 * applied to every pixel is what makes ten procedural materials read as one
 * painted place. The LUT itself is built at boot from `finishingGrade.ts` —
 * no image asset, per the repo's no-binary-assets rule.
 *
 * Colour pipeline, and why the composite owns the tone mapping: three only
 * applies `renderer.toneMapping` and the sRGB output encode when drawing to
 * the *canvas* — a render target receives raw linear scene light (verified
 * against three r180's WebGLPrograms: `toneMapping = NoToneMapping` unless
 * `currentRenderTarget === null`). So the offscreen target must be half
 * float (linear light overshoots 1.0 before ACES compresses it; bytes would
 * clip every highlight), and the composite shader runs the whole display
 * transform itself: ACES via three's own chunk, sRGB encode via the
 * colorspace chunk, and only then — in display-referred space, where LUTs
 * are meant to live — the grade.
 *
 * A knowing consequence: transparent surfaces now alpha-blend in linear
 * light instead of display space, because tone mapping happens after
 * blending rather than per-material before it. That is how physically-based
 * renderers (and the references) composite; it is also a real change to
 * every tuned alpha in the game, which is why the pass ships with gauges
 * and frame reads, not on faith.
 *
 * If the device cannot render to a half-float target (no
 * EXT_color_buffer_float/half_float — vanishingly rare on WebGL2 hardware),
 * the pass disables itself and frames draw exactly as they did before this
 * task: ungraded, but never black.
 */

import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Data3DTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { buildLutData, LUT_SIZE } from './finishingGrade';

/**
 * The scene renders at 0.8 of the canvas in each axis (0.64 of the
 * fragments), and the composite's bilinear upscale is the finishing
 * softness. Chosen by the task, kept because it is also the cheap
 * direction: on a phone the shaded work drops by a third while the one
 * full-resolution pass is a texture fetch and a LUT lookup.
 */
export const RENDER_SCALE = 0.8;

const COMPOSITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The tonemapping/colorspace pars chunks arrive in three's generated
 * prefix (ShaderMaterial, not Raw), the same way painterly.ts relies on
 * them; `toneMapped: true` on the material plus rendering to the canvas is
 * what turns them on. The LUT lookup maps [0,1] onto texel *centres*
 * (half-texel inset either end) so black and white land exactly on the
 * corner entries instead of being bilinearly pulled inward.
 */
const COMPOSITE_FRAGMENT = /* glsl */ `
precision mediump sampler3D;
uniform sampler2D tScene;
uniform mediump sampler3D tLut;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tScene, vUv);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float n = LUT_SIZE_F;
  vec3 uvw = clamp(gl_FragColor.rgb, 0.0, 1.0) * ((n - 1.0) / n) + 0.5 / n;
  gl_FragColor.rgb = texture(tLut, uvw).rgb;
}
`;

export class FinishingPass {
  /** False only when the device cannot render to half float; see above. */
  readonly enabled: boolean;

  private readonly target: WebGLRenderTarget | null = null;
  private readonly lut: Data3DTexture | null = null;
  private readonly compositeScene: Scene | null = null;
  private readonly compositeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial | null = null;

  constructor(renderer: WebGLRenderer, samples: number) {
    this.enabled =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float');
    if (!this.enabled) return;

    this.target = new WebGLRenderTarget(2, 2, {
      type: HalfFloatType,
      samples,
      depthBuffer: true,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });

    const lut = new Data3DTexture(buildLutData(), LUT_SIZE, LUT_SIZE, LUT_SIZE);
    lut.format = RGBAFormat;
    lut.type = UnsignedByteType;
    lut.minFilter = LinearFilter;
    lut.magFilter = LinearFilter;
    lut.wrapS = ClampToEdgeWrapping;
    lut.wrapT = ClampToEdgeWrapping;
    lut.wrapR = ClampToEdgeWrapping;
    lut.needsUpdate = true;
    this.lut = lut;

    this.material = new ShaderMaterial({
      defines: { LUT_SIZE_F: `${LUT_SIZE}.0` },
      uniforms: {
        tScene: { value: this.target.texture },
        tLut: { value: lut },
      },
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });

    // One triangle covering the screen — no quad seam, no camera math.
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const mesh = new Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    this.compositeScene = new Scene();
    this.compositeScene.add(mesh);
  }

  /** Width/height are CSS pixels, exactly what App.resize works in. */
  setSize(width: number, height: number, pixelRatio: number): void {
    this.target?.setSize(
      Math.max(1, Math.round(width * pixelRatio * RENDER_SCALE)),
      Math.max(1, Math.round(height * pixelRatio * RENDER_SCALE)),
    );
  }

  /** The whole pipeline: scene into the target, target through the LUT. */
  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    if (!this.enabled || !this.target || !this.compositeScene) {
      renderer.render(scene, camera);
      return;
    }
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.compositeScene, this.compositeCamera);
  }

  dispose(): void {
    this.target?.dispose();
    this.lut?.dispose();
    this.material?.dispose();
    this.compositeScene?.traverse((o) => {
      if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
    });
  }
}
