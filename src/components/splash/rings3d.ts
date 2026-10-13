import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/*
  The splash centrepiece: the three Trace rings as glossy objects. Each ring
  is a full torus whose fragments past its progress are discarded, with a
  sphere for each round cap. Pose comes from the scroll; tilt follows the
  pointer; a drag spins the rings and lets go with momentum.
*/

export type Pose = {
  x: number; // -1..1, half viewport widths from centre
  y: number; // -1..1, half viewport heights from centre (down is +)
  s: number; // scale, 1 = rings fill ~62% of the shorter side
  rx: number;
  ry: number;
  rz: number;
  spread: number; // rings pushed apart in depth
  p: [number, number, number];
};

const COLORS: [string, string][] = [
  ["#ff7a3c", "#ff2f6d"],
  ["#c8adff", "#6c47ff"],
  ["#4beed6", "#1f8fff"],
];
const RADII = [1, 0.755, 0.51];
const TUBE = 0.105;

const VERT_HEAD = `attribute float arc;\nvarying float vArc;\n`;
const FRAG_HEAD = `uniform float uP;\nuniform vec3 uA;\nuniform vec3 uB;\nuniform float uGlow;\nvarying float vArc;\n`;

export class RingsEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private group = new THREE.Group();
  private rings: { root: THREE.Group; fill: THREE.Mesh; track: THREE.Mesh; capA: THREE.Mesh; capB: THREE.Mesh; proxy: THREE.Mesh; u: { uP: { value: number }; uGlow: { value: number } } }[] = [];
  private pmrem: THREE.PMREMGenerator;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2(9, 9);

  private target: Pose;
  private pose: Pose;
  private tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  private spin = { a: 0, v: 0, dragging: false, lastX: 0, lastT: 0 };
  private hovered = -1;
  private pulse = [0, 0, 0];
  private raf = 0;
  private quiet = 0;
  private last = performance.now();
  private w = 1;
  private h = 1;
  private disposed = false;
  onHover?: (i: number) => void;

  constructor(private canvas: HTMLCanvasElement, start: Pose) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera.position.set(0, 0, 7.2);
    this.scene.add(this.group);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 4, 5);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

    RADII.forEach((r, i) => this.rings.push(this.makeRing(r, i)));
    this.target = { ...start, p: [...start.p] };
    this.pose = { ...start, p: [...start.p] };
    this.resize();
    this.wake();
  }

  private makeRing(radius: number, i: number) {
    const geo = new THREE.TorusGeometry(radius, TUBE, 40, 360);
    // Arc position along the ring, 0 at the start and 1 all the way round.
    const uv = geo.getAttribute("uv");
    const arc = new Float32Array(uv.count);
    for (let k = 0; k < uv.count; k++) arc[k] = uv.getX(k);
    geo.setAttribute("arc", new THREE.BufferAttribute(arc, 1));

    const [a, b] = COLORS[i].map((c) => new THREE.Color(c));
    const u = { uP: { value: 0 }, uGlow: { value: 0 } };
    const fillMat = new THREE.MeshPhysicalMaterial({ roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 1.2, sheen: 0.4, sheenColor: b });
    fillMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u, { uA: { value: a }, uB: { value: b } });
      sh.vertexShader = VERT_HEAD + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvArc = arc;");
      sh.fragmentShader =
        FRAG_HEAD +
        sh.fragmentShader
          .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vArc > uP) discard;")
          .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(uA, uB, clamp(vArc / max(uP, 0.001), 0.0, 1.0));")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow;");
    };
    const fill = new THREE.Mesh(geo, fillMat);

    const track = new THREE.Mesh(
      new THREE.TorusGeometry(radius, TUBE * 0.94, 24, 240),
      new THREE.MeshPhysicalMaterial({ color: b, roughness: 0.6, transparent: true, opacity: 0.13, depthWrite: false }),
    );

    // A coarse, invisible copy to raycast against: cheap hover tests.
    const proxy = new THREE.Mesh(new THREE.TorusGeometry(radius, TUBE * 1.6, 8, 72), new THREE.MeshBasicMaterial({ visible: false }));

    const capGeo = new THREE.SphereGeometry(TUBE, 32, 24);
    const capA = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({ color: a, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 1.2 }));
    const capB = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({ color: b, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 1.2 }));

    // Start at twelve o'clock and run clockwise, like a watch.
    const root = new THREE.Group();
    root.add(track, fill, capA, capB, proxy);
    root.rotation.z = Math.PI / 2;
    root.scale.x = -1;
    this.group.add(root);
    return { root, fill, track, capA, capB, proxy, u };
  }

  setPose(p: Pose) {
    this.target = p;
    this.wake();
  }

  /** Pointer anywhere on the page: the rings lean toward it. */
  pointer(clientX: number, clientY: number) {
    const nx = (clientX / this.w) * 2 - 1;
    const ny = (clientY / this.h) * 2 - 1;
    this.tilt.tx = nx;
    this.tilt.ty = ny;
    this.ndc.set(nx, -ny);
    if (this.spin.dragging) {
      const now = performance.now();
      const dx = clientX - this.spin.lastX;
      const dt = Math.max(1, now - this.spin.lastT);
      this.spin.a += dx * 0.009;
      this.spin.v = ((dx * 0.009) / dt) * 1000;
      this.spin.lastX = clientX;
      this.spin.lastT = now;
    }
    this.wake();
  }

  /** Returns true if the press landed on a ring (so the page shouldn't scroll-drag). */
  press(clientX: number, clientY: number) {
    this.pointer(clientX, clientY);
    const hit = this.pick();
    if (hit < 0) return false;
    this.spin.dragging = true;
    this.spin.v = 0;
    this.spin.lastX = clientX;
    this.spin.lastT = performance.now();
    this.pulse[hit] = 1;
    this.wake();
    return true;
  }

  release() {
    this.spin.dragging = false;
    this.wake();
  }

  leave() {
    this.tilt.tx = 0;
    this.tilt.ty = 0;
    this.ndc.set(9, 9);
    this.wake();
  }

  private pick() {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.rings.map((r) => r.proxy),
      false,
    );
    return hits.length ? this.rings.findIndex((r) => r.proxy === hits[0].object) : -1;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.wake();
  }

  private wake() {
    this.quiet = 0;
    if (!this.raf && !this.disposed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // Frame-rate independent easing toward the scroll's pose.
    const k = 1 - Math.exp(-dt * 7);
    const P = this.pose;
    const T = this.target;
    let moved = 0;
    for (const key of ["x", "y", "s", "rx", "ry", "rz", "spread"] as const) {
      const d = T[key] - P[key];
      P[key] += d * k;
      moved += Math.abs(d);
    }
    for (let i = 0; i < 3; i++) {
      const d = T.p[i] - P.p[i];
      P.p[i] += d * (1 - Math.exp(-dt * 5));
      moved += Math.abs(d);
    }
    const kt = 1 - Math.exp(-dt * 4);
    this.tilt.x += (this.tilt.tx - this.tilt.x) * kt;
    this.tilt.y += (this.tilt.ty - this.tilt.y) * kt;
    moved += Math.abs(this.tilt.tx - this.tilt.x) + Math.abs(this.tilt.ty - this.tilt.y);
    if (!this.spin.dragging) {
      this.spin.a += this.spin.v * dt;
      this.spin.v *= Math.exp(-dt * 2.4);
      // Ease the spin back to rest so the pose the page asked for wins in the end.
      this.spin.a *= Math.exp(-dt * 1.2);
      moved += Math.abs(this.spin.v) * 0.05 + Math.abs(this.spin.a) * 0.05;
    }

    // Hover is tested against coarse proxies, and only while something moves.
    const hover = this.spin.dragging ? this.hovered : this.pick();
    if (hover !== this.hovered) {
      this.hovered = hover;
      this.canvas.style.cursor = hover >= 0 ? "grab" : "";
      this.onHover?.(hover);
    }
    if (this.spin.dragging) this.canvas.style.cursor = "grabbing";

    // Place the group: x/y are in half-viewport units at the rings' depth.
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const vw = vh * this.camera.aspect;
    const fit = Math.min(vw, vh) * 0.31;
    this.group.position.set((P.x * vw) / 2, (-P.y * vh) / 2, 0);
    this.group.scale.setScalar(P.s * fit);
    this.group.rotation.set(P.rx + this.tilt.y * 0.22, P.ry + this.tilt.x * 0.3 + this.spin.a, P.rz);

    this.rings.forEach((r, i) => {
      const p = Math.max(0, Math.min(1, P.p[i]));
      r.u.uP.value = p;
      this.pulse[i] *= Math.exp(-dt * 3.2);
      const glow = (hover === i ? 0.22 : 0) + this.pulse[i] * 0.35;
      r.u.uGlow.value += (glow - r.u.uGlow.value) * (1 - Math.exp(-dt * 10));
      r.root.position.z = (1 - i) * P.spread;
      const swell = 1 + this.pulse[i] * 0.06;
      r.root.scale.set(-swell, swell, swell);
      const show = p > 0.003;
      r.capA.visible = show;
      r.capB.visible = show;
      const R = RADII[i];
      r.capA.position.set(R, 0, 0);
      const ang = p * Math.PI * 2;
      r.capB.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0);
      moved += this.pulse[i] + Math.abs(glow - r.u.uGlow.value);
    });

    this.renderer.render(this.scene, this.camera);
    // Sleep when nothing has moved for a while: no animation on its own clock.
    this.quiet = moved < 0.0004 ? this.quiet + 1 : 0;
    if (this.quiet < 40) this.raf = requestAnimationFrame(this.frame);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}

export function canRunGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
