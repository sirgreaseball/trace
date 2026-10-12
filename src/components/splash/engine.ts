// The thread field: a few hundred threads drawn as screen-space ribbons, all
// positions computed on the GPU. Scroll picks the formation, the pointer combs
// the threads aside, a click plucks them, a drag turns the whole thing.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  LinearSRGBColorSpace,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export const FORMATIONS = 7; // tangle, wild tangle, loom, ropes, helix, field of knots, line

const COMMON = /* glsl */ `
uniform float uTime, uA, uB, uMix, uSpin, uSpinA, uSpinB, uTilt, uScale, uWidth, uAlpha, uDpr, uLens, uPluckT, uCamZ;
uniform vec2 uRes, uPointer, uPluck;
uniform vec3 uOffset;
attribute float aT, aSide, aId;
attribute vec4 aRand;
varying float vSide, vAlpha;
varying vec3 vColor;

#define PI 3.14159265
#define TAU 6.28318531

vec2 rot2(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

vec3 tangle(float t, float wild) {
  float tt = t * TAU;
  vec3 f = 1.0 + floor(aRand.xyz * 2.999);
  vec3 ph = aRand.wzy * TAU + uTime * vec3(0.07, -0.05, 0.06) * (0.4 + aRand.x);
  vec3 p = normalize(sin(f * tt + ph) + 1e-4);
  p *= 1.0 + 0.16 * sin(tt * (2.0 + floor(aRand.w * 3.0)) + aRand.x * 9.0 + uTime * 0.35);
  p *= mix(1.5, 2.15, wild);
  p += wild * 0.32 * sin(vec3(tt * 5.0 + aRand.y * 20.0, tt * 4.0 + aRand.z * 20.0, tt * 6.0) + uTime * 0.55);
  return p;
}

vec3 loom(float t) {
  float x = (t - 0.5) * 11.0;
  float y = (aId - 0.5) * 2.7;
  y += sin(x * 0.9 - uTime * 0.8 + aId * 5.0) * 0.12 + sin(x * 0.33 + uTime * 0.35) * 0.22;
  // Neighbouring rows go over and under each other, like cloth.
  float weave = sin(x * 8.0 + floor(aId * 500.0) * PI) * 0.04;
  float z = -x * x / 60.0 + weave + (aRand.x - 0.5) * 0.12;
  return vec3(x, y, z);
}

vec3 ropes(float t) {
  float k = floor(aRand.x * 4.0);
  float x = mix(-6.5, 2.35, t);
  float conv = smoothstep(0.55, 1.0, t);
  float y = (k - 1.5) * 0.66 * (1.0 - conv);
  float r = 0.17 * (1.0 - 0.8 * conv) * (0.3 + 0.7 * aRand.y);
  float th = t * 34.0 + aRand.z * TAU + uTime * (0.25 + 0.12 * k);
  return vec3(x, y + cos(th) * r, sin(th) * r);
}

vec3 helix(float t) {
  float x = (t - 0.5) * 12.0;
  float th = x * 1.05 + aId * TAU + uTime * 0.28;
  float r = 1.1 + 0.22 * sin(x * 0.4 + uTime * 0.2) + (aRand.y - 0.5) * 0.14;
  return vec3(x, cos(th) * r, sin(th) * r);
}

vec3 field(float t) {
  float g = floor(aRand.x * 24.0);
  vec3 c = vec3((mod(g, 6.0) - 2.5) * 1.32, (floor(g / 6.0) - 1.5) * 1.12, 0.0);
  float tt = t * TAU;
  vec3 p;
  if (mod(g, 5.0) < 0.5) {
    vec3 f = 1.0 + floor(aRand.yzw * 2.999);
    p = normalize(sin(f * tt + aRand.wzy * TAU + uTime * 0.12) + 1e-4) * 0.34;
  } else {
    float a = tt + aRand.y * 0.5;
    p = vec3(cos(a), sin(a), 0.0) * (0.27 + aRand.z * 0.05);
    p.xz = rot2(p.xz, aRand.w * 0.8 - 0.4);
  }
  return c + p;
}

vec3 line(float t) {
  float x = (t - 0.5) * 16.0;
  return vec3(x, 2.2 + (aRand.x - 0.5) * 0.035 + sin(x * 0.5 + uTime) * 0.012, (aRand.y - 0.5) * 0.06);
}

vec3 form(float k, float t) {
  if (k < 0.5) return tangle(t, 0.0);
  if (k < 1.5) return tangle(t, 1.0);
  if (k < 2.5) return loom(t);
  if (k < 3.5) return ropes(t);
  if (k < 4.5) return helix(t);
  if (k < 5.5) return field(t);
  return line(t);
}

// The red thread takes its own path through each formation.
vec3 hero(float k, float t) {
  if (k < 1.5) {
    float tt = t * TAU;
    vec3 p = normalize(sin(vec3(3.0, 2.0, 5.0) * tt + vec3(0.3, 1.7, 0.9) + uTime * 0.05) + 1e-4);
    return p * (k < 0.5 ? 1.62 : 2.2);
  }
  if (k < 2.5) {
    float x = (t - 0.5) * 11.0;
    return vec3(x, sin(x * 0.9 - uTime * 0.8 + 2.5) * 0.12 + sin(x * 0.33 + uTime * 0.35) * 0.22, 0.12);
  }
  if (k < 3.5) {
    float conv = smoothstep(0.55, 1.0, t);
    return vec3(mix(-6.5, 2.35, t), 1.05 * sin(t * PI * 3.0) * (1.0 - conv), 0.22 * cos(t * PI * 7.0) * (1.0 - conv));
  }
  if (k < 4.5) {
    float x = (t - 0.5) * 12.0;
    return vec3(x, 0.22 * sin(x * 0.8 + uTime * 0.5), 0.22 * cos(x * 0.8 + uTime * 0.5));
  }
  if (k < 5.5) return vec3((t - 0.5) * 8.4, 1.25 * sin(t * PI * 5.0), 0.35);
  return vec3((t - 0.5) * 16.0, 2.2, 0.0);
}

vec3 place(float t) {
  // Threads leave in a sweep, not all at once.
  float m = smoothstep(0.0, 1.0, clamp(uMix * 1.5 - aRand.w * 0.3 - t * 0.2, 0.0, 1.0));
  vec3 a, b;
  #ifdef HERO
    a = hero(uA, t);
    b = hero(uB, t);
  #else
    a = form(uA, t);
    b = form(uB, t);
  #endif
  vec3 p = mix(a, b, m);
  p += normalize(p + 1e-4) * sin(m * PI) * 0.18 * (0.5 + aRand.y);
  float spin = uSpin * mix(uSpinA, uSpinB, m);
  p.xz = rot2(p.xz, spin);
  p.yz = rot2(p.yz, uTilt);
  return p * uScale + uOffset;
}

vec2 toPx(vec4 clip) { return clip.xy / clip.w * uRes * 0.5; }

vec2 bend(vec2 s) {
  // Comb: threads near the pointer move out of its way.
  vec2 d = s - uPointer;
  float f = exp(-dot(d, d) / (uLens * uLens));
  s += normalize(d + 1e-4) * f * uLens * 0.32;
  // Pluck: a ring that runs outward and dies away.
  float age = uTime - uPluckT;
  if (age < 3.0) {
    vec2 q = s - uPluck;
    float r = length(q);
    float wave = sin(r * 0.045 - age * 9.0) * exp(-age * 1.6) * exp(-r * 0.004);
    s += normalize(q + 1e-4) * wave * 26.0 * uDpr * smoothstep(0.0, 1.0, age * 6.0 - r * 0.004);
  }
  return s;
}

void main() {
  vec4 view0 = modelViewMatrix * vec4(place(aT), 1.0);
  vec4 c0 = projectionMatrix * view0;
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(place(aT + 0.004), 1.0);
  vec2 s0 = bend(toPx(c0));
  vec2 s1 = bend(toPx(c1));
  vec2 dir = normalize(s1 - s0 + 1e-5);
  vec2 n = vec2(-dir.y, dir.x);
  float depth = -view0.z;
  float w = uWidth * uDpr * (0.65 + 0.7 * aRand.z) * clamp(uCamZ / depth, 0.6, 1.6);
  s0 += n * aSide * w;
  gl_Position = vec4(s0 / (uRes * 0.5) * c0.w, c0.z, c0.w);
  vSide = aSide;
  // Edges in ascending order: Direct3D's smoothstep returns 0 for reversed edges.
  vAlpha = uAlpha * (0.45 + 0.9 * aRand.y) * (1.0 - smoothstep(uCamZ - 2.0, uCamZ + 5.0, depth));
  #ifndef HERO
    // Hundreds of threads stacked into one line would glare; thin them out there.
    float settle = smoothstep(0.0, 1.0, clamp(uMix * 1.5 - aRand.w * 0.3 - aT * 0.2, 0.0, 1.0));
    float onLine = mix(step(5.5, uA), step(5.5, uB), settle);
    vAlpha *= mix(1.0, 0.16, onLine);
  #endif
  #ifdef HERO
    vColor = vec3(1.0, 0.32, 0.2);
  #else
    // Ropes are people: four tints. Unhealthy knots in the field glow amber.
    float k = floor(aRand.x * 4.0);
    vec3 who = k < 0.5 ? vec3(1.0, 0.62, 0.48) : k < 1.5 ? vec3(0.6, 0.78, 1.0) : k < 2.5 ? vec3(0.78, 1.0, 0.72) : vec3(1.0, 0.86, 0.55);
    float g = floor(aRand.x * 24.0);
    vec3 base = vec3(0.93, 0.91, 0.87);
    float m = smoothstep(0.0, 1.0, clamp(uMix * 1.5 - aRand.w * 0.3 - aT * 0.2, 0.0, 1.0));
    float ropeA = abs(uA - 3.0) < 0.5 ? 1.0 : 0.0, ropeB = abs(uB - 3.0) < 0.5 ? 1.0 : 0.0;
    float knotA = abs(uA - 5.0) < 0.5 ? 1.0 : 0.0, knotB = abs(uB - 5.0) < 0.5 ? 1.0 : 0.0;
    float sick = mod(g, 5.0) < 0.5 ? 1.0 : 0.0;
    vColor = mix(base, who, 0.75 * mix(ropeA, ropeB, m));
    vColor = mix(vColor, vec3(1.0, 0.7, 0.25), sick * 0.85 * mix(knotA, knotB, m));
    vColor = mix(vColor, vec3(1.0, 0.45, 0.32), step(0.965, aRand.z) * 0.8);
  #endif
}
`;

const FRAG = /* glsl */ `
varying float vSide, vAlpha;
varying vec3 vColor;
void main() {
  float s = abs(vSide);
  #ifdef GLOW
    float a = exp(-s * s * 4.5);
  #else
    float a = 1.0 - smoothstep(0.3, 1.0, s);
  #endif
  a *= vAlpha;
  gl_FragColor = vec4(vColor * a, a);
}
`;

function buildGeometry(threads: number, samples: number, seed = 7) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const verts = threads * samples * 2;
  const aT = new Float32Array(verts);
  const aSide = new Float32Array(verts);
  const aId = new Float32Array(verts);
  const aRand = new Float32Array(verts * 4);
  const position = new Float32Array(verts * 3);
  let v = 0;
  for (let i = 0; i < threads; i++) {
    const r = [rand(), rand(), rand(), rand()];
    for (let j = 0; j < samples; j++) {
      for (const side of [-1, 1]) {
        aT[v] = j / (samples - 1);
        aSide[v] = side;
        aId[v] = (i + 0.5) / threads;
        aRand.set(r, v * 4);
        v++;
      }
    }
  }
  const index = new Uint32Array(threads * (samples - 1) * 6);
  let k = 0;
  for (let i = 0; i < threads; i++) {
    for (let j = 0; j < samples - 1; j++) {
      const a = (i * samples + j) * 2;
      index.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], k);
      k += 6;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(position, 3));
  g.setAttribute("aT", new BufferAttribute(aT, 1));
  g.setAttribute("aSide", new BufferAttribute(aSide, 1));
  g.setAttribute("aId", new BufferAttribute(aId, 1));
  g.setAttribute("aRand", new BufferAttribute(aRand, 4));
  g.setIndex(new BufferAttribute(index, 1));
  return { geometry: g, perThread: (samples - 1) * 6 };
}

// How much each formation turns with scroll and drag, where it sits and how
// big it is (world units). Phones stack copy and pictures, so they get their own spots.
const SPIN = [1, 0.7, 0.04, 0.06, 0.22, 0.12, 0];
const SCALE = [1.04, 1.05, 1, 1, 1, 0.92, 1];
const PLACE_WIDE: [number, number][] = [
  [1.2, 0.5],
  [1.25, 0],
  [0, -0.75],
  [0, 0],
  [0, -0.1],
  [0, 0.35],
  [0, 0],
];
const PLACE_PHONE: [number, number][] = [
  [0, 2.75],
  [0, 0.6],
  [0, -2.3],
  [0, 0.9],
  [0, 0],
  [0, 0],
  [0, 0],
];

// Dense crossings add up past white. Leave everything below 0.7 untouched and
// roll the rest off smoothly, so the weave stays readable instead of clipping.
const SOFT_CLIP = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 k = 0.7 + 0.3 * (1.0 - exp(-(c - 0.7) / 0.3));
      gl_FragColor = vec4(mix(c, k, step(0.7, c)), 1.0);
    }`,
};

export type EngineOptions = { threads: number; samples: number; dpr: number; mobile: boolean; bloom: boolean };

const BG = new Color().setRGB(11 / 255, 11 / 255, 12 / 255, LinearSRGBColorSpace);

export class ThreadEngine {
  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass | null = null;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 0.1, 60);
  private uniforms: Record<string, { value: unknown }>;
  private field: Mesh;
  private heroCore: Mesh;
  private heroGlow: Mesh;
  private perThread: number;
  private threads: number;
  private target = 0;
  private chapter = 0;
  private spin = 0;
  private spinVel = 0;
  private pointer = new Vector2(-9999, -9999);
  private pointerTarget = new Vector2(-9999, -9999);
  private start = performance.now();
  private frames = 0;
  private slow = 0;
  private last = 0;
  private size = new Vector2(1, 1);
  // Short laptop screens: shrink the intro tangle so it clears the hero copy.
  private introFit = 1;
  private mobile: boolean;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.mobile = opts.mobile;
    this.dpr = opts.dpr;
    this.threads = opts.threads;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    // Colours in the shaders are written as display values, so skip colour-space conversion.
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(opts.dpr);
    this.renderer.setClearColor(BG, 1);
    this.camera.position.set(0, 0, 8.5);

    this.uniforms = {
      uTime: { value: 0 },
      uA: { value: 0 },
      uB: { value: 1 },
      uMix: { value: 0 },
      uSpin: { value: 0 },
      uSpinA: { value: 1 },
      uSpinB: { value: 1 },
      uTilt: { value: 0.18 },
      uScale: { value: 1 },
      uWidth: { value: 0.56 },
      uAlpha: { value: 0.085 },
      uDpr: { value: opts.dpr },
      uLens: { value: 120 * opts.dpr },
      uRes: { value: new Vector2(1, 1) },
      uPointer: { value: new Vector2(-9999, -9999) },
      uPluck: { value: new Vector2(0, 0) },
      uPluckT: { value: -100 },
      uOffset: { value: new Vector3() },
      uCamZ: { value: 8.5 },
    };

    // Ribbons are built in screen space, so their winding varies: draw both faces.
    const blend = { blending: CustomBlending, blendSrc: OneFactor, depthTest: false, depthWrite: false, transparent: true, side: DoubleSide };
    const fieldGeo = buildGeometry(opts.threads, opts.samples);
    this.perThread = fieldGeo.perThread;
    this.field = new Mesh(fieldGeo.geometry, new ShaderMaterial({ vertexShader: COMMON, fragmentShader: FRAG, uniforms: this.uniforms, ...blend, blendDst: OneFactor }));
    const heroGeo = buildGeometry(1, opts.mobile ? 320 : 560, 11).geometry;
    const heroUniforms = { ...this.uniforms, uWidth: { value: 1.45 }, uAlpha: { value: 1.2 } };
    const glowUniforms = { ...this.uniforms, uWidth: { value: 9 }, uAlpha: { value: 0.16 } };
    this.heroGlow = new Mesh(heroGeo, new ShaderMaterial({ vertexShader: COMMON, fragmentShader: FRAG, uniforms: glowUniforms, defines: { HERO: 1, GLOW: 1 }, ...blend, blendDst: OneFactor }));
    this.heroCore = new Mesh(heroGeo, new ShaderMaterial({ vertexShader: COMMON, fragmentShader: FRAG, uniforms: heroUniforms, defines: { HERO: 1 }, ...blend, blendDst: OneMinusSrcAlphaFactor }));
    for (const m of [this.field, this.heroGlow, this.heroCore]) {
      m.frustumCulled = false;
      this.scene.add(m);
    }
    this.heroGlow.renderOrder = 1;
    this.heroCore.renderOrder = 2;

    // Bloom lifts the dense parts of the weave so it reads as light, not wire.
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(opts.dpr);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (opts.bloom) {
      this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.38, 0.45, 0.62);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new ShaderPass(SOFT_CLIP));
  }

  /** Compile shaders up front so the first scrolled frame doesn't stutter. */
  warm() {
    this.renderer.compile(this.scene, this.camera);
  }

  resize(w: number, h: number) {
    this.size.set(w, h);
    this.introFit = this.mobile ? 1 : Math.min(1, Math.max(0.75, (h - 300) / 600));
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep the scene's width on narrow screens by pulling the camera back.
    this.camera.position.z = w / h < 1 ? 8.5 * Math.min(1.9, 1.05 / (w / h)) : 8.5;
    this.camera.updateProjectionMatrix();
    this.uniforms.uCamZ.value = this.camera.position.z;
    (this.uniforms.uRes.value as Vector2).set(w * this.dpr, h * this.dpr);
  }

  setChapter(c: number) {
    this.target = Math.max(0, Math.min(FORMATIONS - 1, c));
  }

  /** Jump straight to a formation, skipping the glide (used by still pages). */
  jump(c: number) {
    this.setChapter(c);
    this.chapter = this.target;
  }

  setPointer(x: number, y: number) {
    // Pixels from the centre, y up, in drawing-buffer units.
    this.pointerTarget.set((x - this.size.x / 2) * this.dpr, (this.size.y / 2 - y) * this.dpr);
  }

  clearPointer() {
    this.pointerTarget.set(-9999, -9999);
    this.pointer.set(-9999, -9999);
  }

  drag(dx: number) {
    this.spinVel = dx * 0.006;
    this.spin += this.spinVel;
  }

  pluck(x: number, y: number) {
    (this.uniforms.uPluck.value as Vector2).set((x - this.size.x / 2) * this.dpr, (this.size.y / 2 - y) * this.dpr);
    this.uniforms.uPluckT.value = this.uniforms.uTime.value;
  }

  render(scrollSpin: number, frozen = false) {
    const now = performance.now();
    const time = frozen ? 12 : (now - this.start) / 1000;
    this.uniforms.uTime.value = time;

    // Ease toward the scroll's chapter so formations glide rather than jump.
    this.chapter += (this.target - this.chapter) * 0.085;
    if (Math.abs(this.target - this.chapter) < 1e-4) this.chapter = this.target;
    const a = Math.min(Math.floor(this.chapter), FORMATIONS - 1);
    const b = Math.min(a + 1, FORMATIONS - 1);
    const m = this.chapter - a;
    const e = m * m * (3 - 2 * m);
    this.uniforms.uA.value = a;
    this.uniforms.uB.value = b;
    this.uniforms.uMix.value = m;
    this.uniforms.uSpinA.value = SPIN[a];
    this.uniforms.uSpinB.value = SPIN[b];

    this.spinVel *= 0.94;
    this.spin += this.spinVel;
    this.uniforms.uSpin.value = this.spin + scrollSpin + (frozen ? 0 : time * 0.03);

    const table = this.mobile ? PLACE_PHONE : PLACE_WIDE;
    const base = this.mobile ? 0.78 : 1;
    // The final line always lands just under the navigation bar.
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const at = (k: number) => (k === FORMATIONS - 1 ? [0, halfH * 0.8 - 2.2 * base] : table[k]);
    const pa = at(a);
    const pb = at(b);
    (this.uniforms.uOffset.value as Vector3).set(pa[0] + (pb[0] - pa[0]) * e, pa[1] + (pb[1] - pa[1]) * e, 0);
    const sa = SCALE[a] * (a === 0 ? this.introFit : 1);
    const sb = SCALE[b] * (b === 0 ? this.introFit : 1);
    this.uniforms.uScale.value = base * (sa + (sb - sa) * e);

    this.pointer.lerp(this.pointerTarget, this.pointerTarget.x < -9000 ? 1 : 0.18);
    (this.uniforms.uPointer.value as Vector2).copy(this.pointer);

    this.composer.render();
    this.watch(now);
  }

  // If the first seconds run slow, drop bloom, then resolution, then threads.
  private watch(now: number) {
    if (this.last && this.frames < 120) {
      if (now - this.last > 24) this.slow++;
      this.frames++;
      if (this.frames === 120 && this.slow > 50) this.degrade();
    }
    this.last = now;
  }

  private degrade() {
    if (this.bloom?.enabled) {
      this.bloom.enabled = false;
    } else if (this.dpr > 1) {
      this.dpr = 1;
      this.renderer.setPixelRatio(1);
      this.composer.setPixelRatio(1);
      this.uniforms.uDpr.value = 1;
      this.uniforms.uLens.value = 120;
      this.resize(this.size.x, this.size.y);
    } else {
      this.threads = Math.max(80, Math.floor(this.threads / 2));
      this.field.geometry.setDrawRange(0, this.threads * this.perThread);
    }
    this.frames = 0;
    this.slow = 0;
  }

  dispose() {
    for (const m of [this.field, this.heroGlow, this.heroCore]) {
      m.geometry.dispose();
      (m.material as ShaderMaterial).dispose();
    }
    this.bloom?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export function canRunGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/** Supersample: render above the screen's density so hairlines stay smooth. */
export function renderScale(mobile: boolean) {
  const dpr = window.devicePixelRatio || 1;
  return mobile ? Math.min(dpr, 2) : Math.min(2, Math.max(1.5, dpr * 1.5));
}
