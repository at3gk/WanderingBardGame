/**
 * The application shell: renderer, frame loop, resize, quality tiers.
 *
 * Deliberately thin. It owns exactly the things that must be owned once —
 * the WebGL context, the clock, the sun, the shared painterly uniforms —
 * and knows nothing about the road, the bard, or the song. Everything else
 * plugs in as a `Stage`.
 *
 * The frame loop is fixed-step for simulation and interpolated for
 * rendering. A rhythm game cannot have its timing wander with the frame
 * rate, and this one has to feel identical on a 60 Hz phone and a 120 Hz
 * tablet.
 */

import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  DirectionalLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createPainterlyGlobals, type PainterlyGlobals } from './painterly';

/** Anything the app can run. Stages own their own content and disposal. */
export interface Stage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Fixed-step simulation. `dt` is always `FIXED_STEP_MS / 1000`. */
  update(dt: number, elapsed: number): void;
  /** Per-frame, post-simulation. Camera smoothing and anything visual-only. */
  render?(alpha: number, frameDt: number): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}

/**
 * Quality tiers. Picked once at boot from a cheap capability probe and
 * then *never* changed automatically mid-session: a game that silently
 * drops its own foliage density while you are looking at it is worse than
 * one that is honestly a bit slower.
 */
export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Multiplier on instanced scatter counts. */
  foliageDensity: number;
  /** Multiplier on particle budgets. */
  particleDensity: number;
  /** How far the world is drawn, in metres. */
  viewDistance: number;
}

const FIXED_STEP_MS = 1000 / 60;
/**
 * If the tab is backgrounded or the main thread stalls, don't try to catch
 * up on minutes of simulation at once — that spikes a frame to seconds and
 * on a rhythm game it would fire every missed beat in one burst. Clamp and
 * let the accumulated time go.
 */
const MAX_CATCHUP_MS = 250;

export function detectQuality(): QualitySettings {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const memory = (navigator as unknown as { deviceMemory?: number })?.deviceMemory ?? 4;
  const coarse =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;

  // A coarse pointer with few cores is a phone; treat it conservatively.
  // Nothing here reads the GPU string — WEBGL_debug_renderer_info is
  // increasingly privacy-gated and returns "Apple GPU" for every iOS
  // device anyway, which tells us nothing useful.
  let tier: QualityTier = 'high';
  if (coarse && (cores <= 4 || memory <= 3)) tier = 'low';
  else if (coarse || cores <= 4 || memory <= 4) tier = 'medium';

  const byTier: Record<QualityTier, QualitySettings> = {
    low: {
      tier: 'low',
      pixelRatio: Math.min(dpr, 1.5),
      shadows: true,
      shadowMapSize: 1024,
      foliageDensity: 0.45,
      particleDensity: 0.5,
      viewDistance: 180,
    },
    medium: {
      tier: 'medium',
      pixelRatio: Math.min(dpr, 2),
      shadows: true,
      shadowMapSize: 2048,
      foliageDensity: 0.75,
      particleDensity: 0.8,
      viewDistance: 240,
    },
    high: {
      tier: 'high',
      pixelRatio: Math.min(dpr, 2),
      shadows: true,
      shadowMapSize: 2048,
      foliageDensity: 1,
      particleDensity: 1,
      viewDistance: 300,
    },
  };
  return byTier[tier];
}

export class App {
  readonly renderer: WebGLRenderer;
  readonly globals: PainterlyGlobals;
  readonly quality: QualitySettings;
  /**
   * The one shadow-casting light in the world. Stages move it; nobody adds
   * a second, because two shadow-casting directionals is both a doubled
   * shadow-map cost and an instant tell that the lighting is fake.
   */
  readonly sun: DirectionalLight;

  private stage: Stage | null = null;
  private readonly clock = new Clock();
  private accumulatorMs = 0;
  private elapsedMs = 0;
  private frameHandle = 0;
  private running = false;
  private readonly host: HTMLElement;
  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => {
    // Coming back from a backgrounded tab: throw away the wall-clock gap so
    // the accumulator doesn't try to simulate it. Idle progress that
    // *should* accrue while away is credited by the idle system from real
    // timestamps, not by replaying frames.
    if (!document.hidden) this.clock.getDelta();
  };

  constructor(host: HTMLElement, quality: QualitySettings = detectQuality()) {
    this.host = host;
    this.quality = quality;

    this.renderer = new WebGLRenderer({
      antialias: quality.tier !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      // The sky is a full-screen gradient drawn every frame, so there is
      // never anything to preserve and never a reason to read back.
      preserveDrawingBuffer: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    // ACES compresses the highlights on the sun-facing bands so a bright
    // dawn doesn't clip to white paper. The exposure is pulled slightly
    // above 1 to keep the midtones from going muddy after that compression.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(new Color(0x9fc6e8), 1);

    host.appendChild(this.renderer.domElement);

    this.globals = createPainterlyGlobals();

    this.sun = new DirectionalLight(0xffffff, 1);
    this.sun.castShadow = quality.shadows;
    this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    // A tight ortho frustum around the player is what buys crisp shadows
    // from a 2K map. The road only ever needs shadows near the bard.
    const extent = 42;
    this.sun.shadow.camera.left = -extent;
    this.sun.shadow.camera.right = extent;
    this.sun.shadow.camera.top = extent;
    this.sun.shadow.camera.bottom = -extent;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    // Normal bias rather than constant bias: it scales with the surface's
    // angle to the light, which is what stops raking dawn light from
    // shadow-acneing every blade of grass.
    this.sun.shadow.normalBias = 0.06;
    this.sun.shadow.bias = -0.0004;

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setStage(stage: Stage): void {
    if (this.stage && this.stage !== stage) this.stage.dispose?.();
    this.stage = stage;
    // The sun belongs to the app but has to live in whichever scene graph is
    // currently being rendered, along with its target.
    stage.scene.add(this.sun);
    stage.scene.add(this.sun.target);
    this.resize();
  }

  get currentStage(): Stage | null {
    return this.stage;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const tick = () => {
      this.frameHandle = requestAnimationFrame(tick);
      this.frame();
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  private frame(): void {
    const stage = this.stage;
    if (!stage) return;

    const frameDt = this.clock.getDelta();
    this.accumulatorMs = Math.min(this.accumulatorMs + frameDt * 1000, MAX_CATCHUP_MS);

    while (this.accumulatorMs >= FIXED_STEP_MS) {
      this.elapsedMs += FIXED_STEP_MS;
      stage.update(FIXED_STEP_MS / 1000, this.elapsedMs / 1000);
      this.accumulatorMs -= FIXED_STEP_MS;
    }

    this.globals.uTime.value = this.elapsedMs / 1000;
    stage.render?.(this.accumulatorMs / FIXED_STEP_MS, frameDt);
    this.renderer.render(stage.scene, stage.camera);
  }

  resize(): void {
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    const stage = this.stage;
    if (stage) {
      stage.camera.aspect = width / Math.max(1, height);
      stage.camera.updateProjectionMatrix();
      stage.resize?.(width, height);
    }
  }

  /** Aim the sun at a world point, keeping its direction. */
  aimSunAt(target: Vector3): void {
    const direction = this.globals.uSunDirection.value;
    this.sun.position.copy(target).addScaledVector(direction, 90);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.stage?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
