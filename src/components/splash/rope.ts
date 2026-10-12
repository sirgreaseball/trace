import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  FloatType,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  NearestFilter,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/*
  Ropes for the splash. Every rope is a tube whose centreline lives in a float texture
  (position, frame, glow, radius and a neighbour-occlusion moment per point). The vertex
  shader builds the tube from that texture, so morphing between formations is a CPU loop
  over a few thousand points and one upload. Frames render only while something moves.
*/

export type Formation = "knot" | "tangle" | "lanes" | "weave" | "rings" | "bundle";
/** x × half-width, y × half-height, scale, rotation x/y/z. */
export type Place = [x: number, y: number, s: number, rx: number, ry: number, rz: number];
export type Chapter = { form: Formation; desk: Place; phone: Place };

const FOV = 30;
const HH = 10 * Math.tan(((FOV / 2) * Math.PI) / 180); // half-height of the view at z = 0
const CAPS = 4; // rings per end cap
const ROWS = 6; // texture rows per rope
const PALETTES = {
  light: ["#14161b", "#f4f5f7", "#2b3cff"],
  dark: ["#2a2e37", "#e8eaee", "#5b6bff"],
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};
const smoothstep = (a: number, b: number, x: number) => smooth((x - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (dt: number, rate: number) => 1 - Math.exp(-rate * dt);

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canRunGL() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** Calls fn(a, b) once for every pair of points closer than h (and some a little further). */
function pairs(P: Float32Array, n: number, h: number, fn: (a: number, b: number) => void) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  let nx = 0, ny = 0, nz = 0;
  for (;;) {
    nx = Math.floor((x1 - x0) / h) + 1;
    ny = Math.floor((y1 - y0) / h) + 1;
    nz = Math.floor((z1 - z0) / h) + 1;
    if (nx * ny * nz <= 2e6) break;
    h *= 2;
  }
  const cells = nx * ny * nz, start = new Int32Array(cells + 1), cell = new Int32Array(n), items = new Int32Array(n);
  const cx = new Int32Array(n), cy = new Int32Array(n), cz = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    cx[i] = Math.floor((P[i * 3] - x0) / h);
    cy[i] = Math.floor((P[i * 3 + 1] - y0) / h);
    cz[i] = Math.floor((P[i * 3 + 2] - z0) / h);
    cell[i] = (cx[i] * ny + cy[i]) * nz + cz[i];
    start[cell[i] + 1]++;
  }
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cells);
  for (let i = 0; i < n; i++) items[fill[cell[i]]++] = i;
  for (let a = 0; a < n; a++)
    for (let dx = -1; dx <= 1; dx++) {
      const X = cx[a] + dx;
      if (X < 0 || X >= nx) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const Y = cy[a] + dy;
        if (Y < 0 || Y >= ny) continue;
        for (let dz = -1; dz <= 1; dz++) {
          const Z = cz[a] + dz;
          if (Z < 0 || Z >= nz) continue;
          const c = (X * ny + Y) * nz + Z;
          for (let j = start[c]; j < start[c + 1]; j++) if (items[j] > a) fn(a, items[j]);
        }
      }
    }
}

/**
 * Rotation-minimising frames along M points starting at point o. The first normal follows
 * `seed` (and is written back) so frames stay put from one frame to the next. Returns the length.
 */
function frames(P: Float32Array, o: number, M: number, N: Float32Array, B: Float32Array, S: Float32Array | null, seed: Vector3, closed: boolean) {
  let tx = 1, ty = 0, tz = 0, nx = seed.x, ny = seed.y, nz = seed.z, len = 0;
  for (let i = 0; i < M; i++) {
    const p = (o + i) * 3;
    const a = (o + (i > 0 ? i - 1 : closed ? M - 2 : 0)) * 3;
    const b = (o + (i < M - 1 ? i + 1 : closed ? 1 : M - 1)) * 3;
    const x = P[b] - P[a], y = P[b + 1] - P[a + 1], z = P[b + 2] - P[a + 2], l = Math.hypot(x, y, z);
    if (l > 1e-9) {
      tx = x / l;
      ty = y / l;
      tz = z / l;
    }
    const d = nx * tx + ny * ty + nz * tz;
    nx -= d * tx;
    ny -= d * ty;
    nz -= d * tz;
    let nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-4) {
      if (Math.abs(tx) < 0.9) [nx, ny, nz] = [0, -tz, ty];
      else [nx, ny, nz] = [tz, 0, -tx];
      nl = Math.hypot(nx, ny, nz);
    }
    nx /= nl;
    ny /= nl;
    nz /= nl;
    if (i === 0) seed.set(nx, ny, nz);
    N[p] = nx;
    N[p + 1] = ny;
    N[p + 2] = nz;
    B[p] = ty * nz - tz * ny;
    B[p + 1] = tz * nx - tx * nz;
    B[p + 2] = tx * ny - ty * nx;
    if (i > 0) len += Math.hypot(P[p] - P[p - 3], P[p + 1] - P[p - 2], P[p + 2] - P[p - 1]);
    if (S) S[o + i] = len;
  }
  return len;
}

/** Radius of a ring of K strands (radius r) that twist at `rate` rad per unit without touching. */
function strandRadius(K: number, r: number, rate: number) {
  const r0 = (K * 2 * r * 1.04) / (2 * Math.PI);
  let rho = r0;
  for (let i = 0; i < 6; i++) rho = r0 * Math.sqrt(1 + (rho * rate) ** 2);
  return rho;
}

// Formations: K ropes × M points × xyz, in local units.

function knot(K: number, M: number, r: number) {
  const C = new Float32Array(M * 3), N = new Float32Array(M * 3), B = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    const s = 0.262 + (2 * Math.PI * i) / (M - 1); // starts at an under-crossing, which hides the seam
    C[i * 3] = 0.74 * (Math.sin(s) + 2 * Math.sin(2 * s));
    C[i * 3 + 1] = 0.74 * (Math.cos(s) - 2 * Math.cos(2 * s) + 0.47);
    C[i * 3 + 2] = -0.74 * Math.sin(3 * s);
  }
  const len = frames(C, 0, M, N, B, null, new Vector3(0, 0, 1), true);
  const e = (M - 1) * 3;
  const hol = Math.atan2(N[e] * B[0] + N[e + 1] * B[1] + N[e + 2] * B[2], N[e] * N[0] + N[e + 1] * N[1] + N[e + 2] * N[2]);
  const tw = 2 * Math.PI * 7 - hol, rho = strandRadius(K, r, tw / len);
  const P = new Float32Array(K * M * 3);
  for (let k = 0; k < K; k++)
    for (let i = 0; i < M; i++) {
      const f = (2 * Math.PI * k) / K + (tw * i) / (M - 1), c = Math.cos(f) * rho, s = Math.sin(f) * rho, p = (k * M + i) * 3, q = i * 3;
      for (let a = 0; a < 3; a++) P[p + a] = C[q + a] + c * N[q + a] + s * B[q + a];
    }
  return P;
}

function tangle(K: number, M: number, r: number) {
  const rnd = mulberry32(7), P = new Float32Array(K * M * 3), AMP = [1.5, 0.6, 0.25];
  for (let k = 0; k < K; k++) {
    const ph = Array.from({ length: 9 }, () => rnd() * 2 * Math.PI);
    const ox = (rnd() - 0.5) * 0.6, oy = (rnd() - 0.5) * 0.6, oz = (rnd() - 0.5) * 0.4, sc = 0.8 + 0.35 * rnd(), t0 = rnd() * 2 * Math.PI;
    for (let i = 0; i < M; i++) {
      const t = t0 + (2 * Math.PI * 0.9 * i) / (M - 1), p = (k * M + i) * 3;
      let x = 0, y = 0, z = 0;
      for (let h = 0; h < 3; h++) {
        x += AMP[h] * Math.sin((h + 1) * t + ph[h]);
        y += AMP[h] * Math.sin((h + 1) * t + ph[3 + h]);
        z += AMP[h] * Math.sin((h + 1) * t + ph[6 + h]);
      }
      P[p] = ox + x * sc;
      P[p + 1] = oy + y * sc * 0.8;
      P[p + 2] = oz + z * 0.5 * sc;
    }
  }
  relax(P, K, M, r, 48);
  return P;
}

/** A twisted bundle low on the left that fans out into one flat lane per rope on the right. */
function lanes(K: number, M: number, r: number, W: number, phone: boolean) {
  const rho = strandRadius(K, r, 2.2), gap = phone ? 0.2 : 0.24, yb = phone ? -1.2 : -2.25;
  const fa = (phone ? -0.7 : -0.3) * W, fb = (phone ? -0.1 : 0.02) * W, X = W + 0.6;
  const P = new Float32Array(K * M * 3);
  for (let k = 0; k < K; k++)
    for (let i = 0; i < M; i++) {
      const x = -X + (2 * X * i) / (M - 1), f = smoothstep(fa, fb, x), phi = (2 * Math.PI * k) / K + 2.2 * x, p = (k * M + i) * 3;
      P[p] = x;
      P[p + 1] = mix(yb + rho * Math.cos(phi), ((K - 1) / 2 - k) * gap, f);
      P[p + 2] = mix(rho * Math.sin(phi), 0, f) + (k % 2 ? -0.06 : 0.06) * f;
    }
  relax(P, K, M, r, 24);
  return P;
}

/** Plain weave: half the ropes run across, half run down, each passing over then under. K/2 must be odd. */
function weave(K: number, M: number, r: number) {
  const n = K / 2, c = (n - 1) / 2, g = 0.4, A = 1.1 * r, L = (n * g) / 2 + 0.5;
  const P = new Float32Array(K * M * 3);
  for (let k = 0; k < K; k++) {
    const warp = k < n, j = warp ? k : k - n;
    for (let i = 0; i < M; i++) {
      const t = -L + (2 * L * i) / (M - 1), p = (k * M + i) * 3;
      const x = warp ? t : (j - c) * g, y = warp ? (j - c) * g : t;
      const z = warp ? A * Math.cos((Math.PI * x) / g + j * Math.PI) : -A * Math.cos((Math.PI * y) / g + j * Math.PI);
      P[p] = x;
      P[p + 1] = y;
      P[p + 2] = z + 0.25 * Math.sin(0.9 * x + 0.6 * y);
    }
  }
  return P;
}

/** Nested open rings, one per rope, on Fibonacci-spread planes. Radii differ, so they never touch. */
function rings(K: number, M: number, r: number) {
  const rnd = mulberry32(11), P = new Float32Array(K * M * 3), ga = Math.PI * (3 - Math.sqrt(5));
  const n = new Vector3(), e1 = new Vector3(), e2 = new Vector3(), Y = new Vector3(0, 1, 0), X = new Vector3(1, 0, 0);
  for (let k = 0; k < K; k++) {
    const R = 1.15 + k * 2.1 * r, y = 1 - (2 * (k + 0.5)) / K, rr = Math.sqrt(1 - y * y), th = ga * k, a0 = rnd() * 2 * Math.PI;
    n.set(rr * Math.cos(th), y, rr * Math.sin(th));
    e1.crossVectors(n, Math.abs(n.y) < 0.9 ? Y : X).normalize();
    e2.crossVectors(n, e1);
    for (let i = 0; i < M; i++) {
      const a = a0 + (0.86 * 2 * Math.PI * i) / (M - 1), ca = Math.cos(a) * R, sa = Math.sin(a) * R, p = (k * M + i) * 3;
      P[p] = ca * e1.x + sa * e2.x;
      P[p + 1] = ca * e1.y + sa * e2.y;
      P[p + 2] = ca * e1.z + sa * e2.z;
    }
  }
  return P;
}

function bundle(K: number, M: number, r: number, W: number) {
  const X = W + 0.6, rho = strandRadius(K, r, 3.2), P = new Float32Array(K * M * 3);
  for (let k = 0; k < K; k++)
    for (let i = 0; i < M; i++) {
      const x = -X + (2 * X * i) / (M - 1), phi = (2 * Math.PI * k) / K + 3.2 * x, p = (k * M + i) * 3;
      P[p] = x;
      P[p + 1] = -0.15 * Math.sin(0.7 * x) + rho * Math.cos(phi);
      P[p + 2] = 0.3 * Math.sin(0.5 * x) + rho * Math.sin(phi);
    }
  return P;
}

/** Pushes apart points of different ropes (or far-apart points of one rope) that sit closer than a rope's width. */
function relax(P: Float32Array, K: number, M: number, r: number, iters: number) {
  const n = K * M;
  let tot = 0;
  for (let k = 0; k < K; k++)
    for (let i = 1; i < M; i++) {
      const p = (k * M + i) * 3;
      tot += Math.hypot(P[p] - P[p - 3], P[p + 1] - P[p - 2], P[p + 2] - P[p - 1]);
    }
  const ds = tot / (K * (M - 1)), min = 2.25 * r + 0.5 * ds, min2 = min * min, skip = Math.ceil((3 * min) / ds);
  const D = new Float32Array(n * 3), T = new Float32Array(n * 3);
  for (let it = 0; it < iters; it++) {
    D.fill(0);
    pairs(P, n, min, (a, b) => {
      if (b - a < skip && Math.floor(a / M) === Math.floor(b / M)) return;
      const x = P[b * 3] - P[a * 3], y = P[b * 3 + 1] - P[a * 3 + 1], z = P[b * 3 + 2] - P[a * 3 + 2], d2 = x * x + y * y + z * z;
      if (d2 >= min2 || d2 < 1e-12) return;
      const d = Math.sqrt(d2), f = ((min - d) / d) * 0.5;
      D[a * 3] -= x * f;
      D[a * 3 + 1] -= y * f;
      D[a * 3 + 2] -= z * f;
      D[b * 3] += x * f;
      D[b * 3 + 1] += y * f;
      D[b * 3 + 2] += z * f;
    });
    for (let j = 0; j < n * 3; j++) P[j] += D[j];
    T.set(P);
    for (let k = 0; k < K; k++)
      for (let i = 1; i < M - 1; i++) {
        const p = (k * M + i) * 3;
        for (let c = 0; c < 3; c++) P[p + c] += 0.2 * ((T[p - 3 + c] + T[p + 3 + c]) / 2 - T[p + c]);
      }
  }
}

function add(O: Float32Array, o: number, x: number, y: number, z: number, w: number) {
  O[o] += w * x;
  O[o + 1] += w * y;
  O[o + 2] += w * z;
  O[o + 3] += w;
  O[o + 4] += w * x * x;
  O[o + 5] += w * y * y;
  O[o + 6] += w * z * z;
  O[o + 7] += w * x * y;
  O[o + 8] += w * x * z;
  O[o + 9] += w * y * z;
}

/**
 * Per point: first moment (xyz), total weight and second moment (xx yy zz xy xz yz) of the
 * directions to nearby rope. The shader reads how much rope sits on the side a surface faces.
 */
function occlusion(P: Float32Array, K: number, M: number, r: number) {
  const n = K * M, RAD = 0.55, O = new Float32Array(n * 10), ds = new Float32Array(K);
  for (let k = 0; k < K; k++) {
    let l = 0;
    for (let i = 1; i < M; i++) {
      const p = (k * M + i) * 3;
      l += Math.hypot(P[p] - P[p - 3], P[p + 1] - P[p - 2], P[p + 2] - P[p - 1]);
    }
    ds[k] = l / (M - 1);
  }
  pairs(P, n, RAD, (a, b) => {
    const ka = Math.floor(a / M), kb = Math.floor(b / M);
    if (ka === kb && (b - a) * ds[ka] < 0.6) return;
    let x = P[b * 3] - P[a * 3], y = P[b * 3 + 1] - P[a * 3 + 1], z = P[b * 3 + 2] - P[a * 3 + 2];
    const d2 = x * x + y * y + z * z;
    if (d2 >= RAD * RAD || d2 < 1e-12) return;
    const d = Math.sqrt(d2), dd = Math.max(d, 2 * r), w = (r * (1 - d / RAD) ** 2) / (Math.PI * dd * dd);
    x /= d;
    y /= d;
    z /= d;
    add(O, a * 10, x, y, z, w * ds[kb]);
    add(O, b * 10, -x, -y, -z, w * ds[ka]);
  });
  return O;
}

function build(form: Formation, K: number, M: number, r: number, W: number, phone: boolean) {
  switch (form) {
    case "knot":
      return knot(K, M, r);
    case "tangle":
      return tangle(K, M, r);
    case "lanes":
      return lanes(K, M, r, W, phone);
    case "weave":
      return weave(K, M, r);
    case "rings":
      return rings(K, M, r);
    case "bundle":
      return bundle(K, M, r, W);
  }
}

/** Index buffer for K tubes; position = (point index, angle round the tube, rope), aInfo = (cap angle, palette slot). */
function tubes(K: number, M: number, R: number, pal: (k: number) => number) {
  const rings = M + 2 * CAPS, vpr = R + 1, nv = K * rings * vpr;
  const pos = new Float32Array(nv * 3), info = new Float32Array(nv * 2);
  for (let k = 0, v = 0; k < K; k++)
    for (let r = 0; r < rings; r++) {
      const i = Math.min(Math.max(r - CAPS, 0), M - 1);
      const cap = r < CAPS ? ((-Math.PI / 2) * (CAPS - r)) / CAPS : r >= CAPS + M ? ((Math.PI / 2) * (r - CAPS - M + 1)) / CAPS : 0;
      for (let j = 0; j <= R; j++, v++) {
        pos[v * 3] = i;
        pos[v * 3 + 1] = (2 * Math.PI * j) / R;
        pos[v * 3 + 2] = k;
        info[v * 2] = cap;
        info[v * 2 + 1] = pal(k);
      }
    }
  const idx = new Uint32Array(K * (rings - 1) * R * 6);
  for (let k = 0, o = 0; k < K; k++)
    for (let r = 0; r < rings - 1; r++)
      for (let j = 0; j < R; j++) {
        const a = (k * rings + r) * vpr + j, b = a + 1, d = a + vpr, c = d + 1;
        idx.set([a, b, c, a, c, d], o);
        o += 6;
      }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aInfo", new BufferAttribute(info, 2));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

const VERT_HEAD = /* glsl */ `
attribute vec2 aInfo;
uniform highp sampler2D uData;
uniform float uRadius, uCalm;
uniform vec2 uAO;
uniform vec3 uInk, uPorcelain, uAccent;
varying vec3 vRopeColor, vTan;
varying float vGlow, vTh, vS, vAO;`;

const VERT_BODY = /* glsl */ `
int rI = int(position.x + 0.5), rK = int(position.z + 0.5) * ${ROWS};
float rTh = position.y;
vec4 rC = texelFetch(uData, ivec2(rI, rK), 0);
vec4 rN = texelFetch(uData, ivec2(rI, rK + 1), 0);
vec4 rB = texelFetch(uData, ivec2(rI, rK + 2), 0);
vec4 rO1 = texelFetch(uData, ivec2(rI, rK + 3), 0);
vec4 rO2 = texelFetch(uData, ivec2(rI, rK + 4), 0);
vec4 rO3 = texelFetch(uData, ivec2(rI, rK + 5), 0);
vec3 rT = cross(rN.xyz, rB.xyz);
float rR = uRadius * rB.w;
float rCp = cos(aInfo.x), rSp = sin(aInfo.x);
vec3 objectNormal = normalize((cos(rTh) * rN.xyz + sin(rTh) * rB.xyz) * rCp + rT * rSp);
vec3 ropePos = rC.xyz + rR * objectNormal;
vec3 rn = objectNormal;
float rMM = rO2.x * rn.x * rn.x + rO2.y * rn.y * rn.y + rO2.z * rn.z * rn.z + 2.0 * (rO2.w * rn.x * rn.y + rO3.x * rn.x * rn.z + rO3.y * rn.y * rn.z);
vAO = 1.0 - clamp(uAO.x * 0.5 * (dot(rn, rO1.xyz) + rMM) + uAO.y * rO1.w, 0.0, 0.8);
vTh = rTh;
vS = rC.w + rR * rSp;
vGlow = rN.w;
vRopeColor = aInfo.y < 0.5 ? uInk : (aInfo.y < 1.5 ? uPorcelain : mix(uAccent, uPorcelain, uCalm));
vTan = normalize((modelViewMatrix * vec4(rT, 0.0)).xyz);`;

const FRAG_HEAD = /* glsl */ `
uniform vec3 uAccent;
uniform float uLay, uBump, uRadius;
varying vec3 vRopeColor, vTan;
varying float vGlow, vTh, vS, vAO;`;

// Three-strand lay: a shallow helical groove, faded out once it gets finer than a pixel.
const FRAG_COLOR = /* glsl */ `
float rPsi = 3.0 * vTh + vS * uLay;
float rFade = 1.0 - smoothstep(0.8, 2.0, fwidth(rPsi));
diffuseColor.rgb *= mix(vRopeColor, uAccent, vGlow) * (1.0 - rFade * 0.2 * (0.5 - 0.5 * cos(rPsi)));`;

const FRAG_NORMAL = /* glsl */ `
{
  vec3 rT = normalize(vTan);
  vec3 rE = normalize(cross(rT, normal));
  normal = normalize(normal + uBump * rFade * sin(rPsi) * (3.0 / uRadius * rE + uLay * rT));
}`;

const FRAG_AO = /* glsl */ `
float ambientOcclusion = vAO;
reflectedLight.indirectDiffuse *= ambientOcclusion;
#if defined( USE_CLEARCOAT )
  clearcoatSpecularIndirect *= ambientOcclusion;
#endif
#if defined( USE_SHEEN )
  sheenSpecularIndirect *= ambientOcclusion;
#endif
#if defined( USE_ENVMAP ) && defined( STANDARD )
  float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
  reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
#endif
reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, 0.6 );`;

type Opts = { chapters: Chapter[]; mobile: boolean; interactive?: boolean; intro?: boolean; onReady?: () => void };
type Form = { P: Float32Array; O: Float32Array };

const blocked = (t: EventTarget | null) => t instanceof Element && !!t.closest("a,button,input,textarea,select,label,[data-solid]");

export class RopeEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly chapters: Chapter[];
  private readonly interactive: boolean;
  private readonly onReady?: () => void;
  private readonly K: number;
  private readonly M: number;
  private readonly r: number;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  private readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshPhysicalMaterial;
  private readonly tex: DataTexture;
  private readonly data: Float32Array;
  private readonly env: Texture;
  private readonly colors = { ink: new Color(), porcelain: new Color(), accent: new Color() };

  private readonly forms = new Map<Formation, Form>();
  private formsW = 0;
  private formsPhone = false;
  private readonly P: Float32Array;
  private readonly N: Float32Array;
  private readonly B: Float32Array;
  private readonly S: Float32Array;
  private readonly D: Float32Array; // pointer push, local units
  private readonly DV: Float32Array;
  private readonly sx: Float32Array; // last projected screen position of every point
  private readonly sy: Float32Array;
  private readonly seeds: Vector3[];
  private readonly glow: Float32Array;
  private readonly glowT: Float32Array;
  private readonly rad: Float32Array;
  private readonly radT: Float32Array;
  private lit = new Set<number>();
  /** 1 while other ropes are lit: the blue thread steps back so only the traced lanes read as blue. */
  private readonly calm = { value: 0 };
  private hover = -1;
  private pulses: { k: number; u: number; age: number }[] = [];

  private w = 0;
  private h = 0;
  private stage = 0;
  private stageT = 0;
  private primed = false;
  private intro: number;
  private readonly tilt = [0, 0];
  private readonly turn = [0, 0];
  private readonly turnV = [0, 0];
  private readonly ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, has: false, fine: false, inside: false, blocked: false };
  private down: { x: number; y: number; t: number; touch: boolean } | null = null;
  private drag: { x: number; y: number; t: number } | null = null;
  private pushing = false;
  private dirty = true;
  private ready = false;
  private raf = 0;
  private last = 0;
  private readonly mvp = new Matrix4();
  private readonly q = new Quaternion();
  private readonly dir = new Vector3();

  constructor(canvas: HTMLCanvasElement, opts: Opts) {
    this.canvas = canvas;
    this.chapters = opts.chapters;
    this.interactive = opts.interactive ?? true;
    this.onReady = opts.onReady;
    this.intro = opts.intro ? 0 : 1;
    this.K = opts.mobile ? 10 : 14;
    this.M = opts.mobile ? 180 : 300;
    this.r = opts.mobile ? 0.06 : 0.042;
    const { K, M } = this, n = K * M;
    this.P = new Float32Array(n * 3);
    this.N = new Float32Array(n * 3);
    this.B = new Float32Array(n * 3);
    this.S = new Float32Array(n);
    this.D = new Float32Array(n * 3);
    this.DV = new Float32Array(n * 3);
    this.sx = new Float32Array(n).fill(-1e9);
    this.sy = new Float32Array(n).fill(-1e9);
    this.seeds = Array.from({ length: K }, () => new Vector3(0, 0, 1));
    this.glow = new Float32Array(K);
    this.glowT = new Float32Array(K);
    this.rad = new Float32Array(K).fill(1);
    this.radT = new Float32Array(K).fill(1);

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = NeutralToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    this.renderer = renderer;

    const pm = new PMREMGenerator(renderer), room = new RoomEnvironment();
    this.env = pm.fromScene(room, 0.04).texture;
    room.dispose();
    pm.dispose();
    this.scene.environment = this.env;
    const light = new DirectionalLight(0xffffff, 1.4);
    light.position.set(-3, 4, 5);
    this.scene.add(light);
    this.camera.position.set(0, 0, 10);
    this.camera.updateMatrixWorld(); // picking projects points before the first render

    this.data = new Float32Array(M * ROWS * K * 4);
    this.tex = new DataTexture(this.data, M, ROWS * K, RGBAFormat, FloatType);
    this.tex.minFilter = NearestFilter;
    this.tex.magFilter = NearestFilter;
    this.geometry = tubes(K, M, opts.mobile ? 10 : 12, (k) => (k === Math.floor(K / 3) ? 2 : k % 3 === 2 ? 1 : 0));

    const uniforms = {
      uData: { value: this.tex },
      uRadius: { value: this.r },
      uInk: { value: this.colors.ink },
      uPorcelain: { value: this.colors.porcelain },
      uAccent: { value: this.colors.accent },
      uCalm: this.calm,
      uLay: { value: (6 * Math.PI) / (7 * this.r) },
      uBump: { value: 0.07 * this.r },
      uAO: { value: new Vector2(1.6, 0.25) },
    };
    this.material = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      sheen: 0.5,
      sheenRoughness: 0.45,
      sheenColor: 0xffffff,
    });
    this.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
        .replace("#include <beginnormal_vertex>", VERT_BODY)
        .replace("#include <begin_vertex>", "vec3 transformed = ropePos;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
        .replace("#include <color_fragment>", FRAG_COLOR)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uAccent * vGlow * 0.35;")
        .replace("#include <aomap_fragment>", FRAG_AO);
    };
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.scene.add(this.group);

    this.setTheme(false);
    this.resize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
    if (this.interactive) {
      addEventListener("pointermove", this.onMove, { passive: true });
      addEventListener("pointerdown", this.onDown);
      addEventListener("pointerup", this.onUp);
      addEventListener("pointercancel", this.onCancel);
      addEventListener("blur", this.onLeave);
      document.documentElement.addEventListener("pointerleave", this.onLeave);
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  resize(w: number, h: number) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2, Math.sqrt(4.5e6 / (w * h))));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.ensureForms();
    if (this.ready) this.frame(); // resizing clears the canvas; repaint now rather than flash
    else this.dirty = true;
  }

  /** Scroll position in chapters: 1.5 is halfway from the second formation to the third. */
  setStage(x: number) {
    x = Math.min(Math.max(x, 0), this.chapters.length - 1);
    this.stageT = x;
    if (!this.primed) {
      this.primed = true;
      this.stage = x;
      this.dirty = true;
    }
  }

  setTheme(dark: boolean) {
    const [ink, porcelain, accent] = dark ? PALETTES.dark : PALETTES.light;
    this.colors.ink.set(ink);
    this.colors.porcelain.set(porcelain);
    this.colors.accent.set(accent);
    this.scene.environmentIntensity = dark ? 0.85 : 1;
    this.dirty = true;
  }

  /** Lights these ropes up (e.g. the lanes a commit links to). */
  highlight(ropes: number[]) {
    this.lit = new Set(ropes);
    this.targets();
  }

  /** Sends a ripple along rope k from u (0..1 along its length). */
  pulse(k: number, u = 0.5) {
    if (k < 0 || k >= this.K) return;
    this.pulses.push({ k, u, age: 0 });
    if (this.pulses.length > 6) this.pulses.shift();
  }

  /** The rope that carries lane i (0..5) of the lanes formation. */
  lane(i: number) {
    return Math.round(1 + (i * (this.K - 3)) / 5);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    removeEventListener("pointermove", this.onMove);
    removeEventListener("pointerdown", this.onDown);
    removeEventListener("pointerup", this.onUp);
    removeEventListener("pointercancel", this.onCancel);
    removeEventListener("blur", this.onLeave);
    document.documentElement.removeEventListener("pointerleave", this.onLeave);
    delete document.documentElement.dataset.rope;
    this.geometry.dispose();
    this.material.dispose();
    this.tex.dispose();
    this.env.dispose();
    this.renderer.dispose(); // no forceContextLoss: StrictMode remounts onto the same canvas
  }

  private ensureForms() {
    const W = (HH * this.w) / this.h, phone = this.w < 768;
    const stale = !this.formsW || Math.abs(W - this.formsW) > 0.02 * this.formsW || phone !== this.formsPhone;
    if (stale) {
      this.formsW = W;
      this.formsPhone = phone;
    }
    const done = new Set<Formation>();
    for (const { form } of this.chapters) {
      if (done.has(form) || (this.forms.has(form) && !(stale && (form === "lanes" || form === "bundle")))) continue;
      done.add(form);
      const P = build(form, this.K, this.M, this.r, W, phone);
      this.forms.set(form, { P, O: occlusion(P, this.K, this.M, this.r) });
    }
  }

  private targets() {
    for (let k = 0; k < this.K; k++) {
      const hov = k === this.hover, lit = this.lit.has(k);
      this.glowT[k] = hov ? 1 : lit ? 0.85 : 0;
      this.radT[k] = hov ? 1.15 : lit ? 1.08 : 1;
    }
  }

  private setHover(k: number) {
    if (k === this.hover) return;
    this.hover = k;
    this.targets();
    if (this.drag) return;
    if (k >= 0) document.documentElement.dataset.rope = "hover";
    else delete document.documentElement.dataset.rope;
  }

  private pick(x: number, y: number, radius: number) {
    let best = radius * radius, at = -1;
    for (let j = 0; j < this.sx.length; j++) {
      const dx = this.sx[j] - x, dy = this.sy[j] - y, d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        at = j;
      }
    }
    return at < 0 ? null : { k: Math.floor(at / this.M), u: (at % this.M) / (this.M - 1) };
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 20) : 1 / 60;
    this.last = now;
    let active = this.dirty;
    this.dirty = false;

    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt / 2.8);
      active = true;
    }
    if (this.stage !== this.stageT) {
      this.stage += (this.stageT - this.stage) * damp(dt, 7);
      if (Math.abs(this.stageT - this.stage) < 1e-4) this.stage = this.stageT;
      active = true;
    }

    const p = this.ptr, fine = this.interactive && p.has && p.fine;
    const tilt = [fine ? Math.max(-1, Math.min(1, (p.y / this.h) * 2 - 1)) * 0.06 : 0, fine ? Math.max(-1, Math.min(1, (p.x / this.w) * 2 - 1)) * 0.08 : 0];
    for (const i of [0, 1]) {
      const d = tilt[i] - this.tilt[i];
      if (Math.abs(d) > 1e-5) {
        this.tilt[i] += d * damp(dt, 3);
        active = true;
      }
    }

    if (!this.drag) {
      for (const i of [0, 1]) {
        this.turnV[i] += (-3 * this.turn[i] - 2.5 * this.turnV[i]) * dt;
        this.turn[i] += this.turnV[i] * dt;
      }
      if (Math.abs(this.turn[0]) + Math.abs(this.turn[1]) + Math.abs(this.turnV[0]) + Math.abs(this.turnV[1]) > 1e-4) active = true;
      else this.turn[0] = this.turn[1] = this.turnV[0] = this.turnV[1] = 0;
    }

    const kg = damp(dt, 6);
    for (let k = 0; k < this.K; k++) {
      const dg = this.glowT[k] - this.glow[k], dr = this.radT[k] - this.rad[k];
      if (Math.abs(dg) > 1e-4 || Math.abs(dr) > 1e-4) {
        this.glow[k] += dg * kg;
        this.rad[k] += dr * kg;
        active = true;
      } else {
        this.glow[k] = this.glowT[k];
        this.rad[k] = this.radT[k];
      }
    }
    const ct = this.lit.size && !this.lit.has(Math.floor(this.K / 3)) ? 1 : 0, dc = ct - this.calm.value;
    if (Math.abs(dc) > 1e-4) {
      this.calm.value += dc * kg;
      active = true;
    } else this.calm.value = ct;

    if (this.pulses.length) {
      for (const q of this.pulses) q.age += dt;
      this.pulses = this.pulses.filter((q) => q.age < 2.2);
      active = true;
    }

    // A moving cursor brushes nearby rope along its direction of travel; springs bring it back.
    const decay = Math.exp(-4 * dt);
    p.vx *= decay;
    p.vy *= decay;
    const strength = fine && p.inside && !this.drag ? clamp01(Math.hypot(p.vx, p.vy) / 1200) : 0;
    if (strength > 0.002 || this.pushing) {
      const { D, DV, sx, sy } = this, amp = strength > 0.002 ? strength * 0.35 : 0;
      if (amp) this.dir.set(p.vx, -p.vy, 0).normalize().applyQuaternion(this.q.copy(this.group.quaternion).invert());
      let energy = 0;
      for (let j = 0; j < sx.length; j++) {
        const ex = sx[j] - p.x, ey = sy[j] - p.y, g = amp ? Math.exp(-(ex * ex + ey * ey) / 8100) * amp : 0;
        for (let c = 0; c < 3; c++) {
          const i = j * 3 + c;
          DV[i] += (60 * (g * this.dir.getComponent(c) - D[i]) - 12 * DV[i]) * dt;
          D[i] += DV[i] * dt;
          energy += D[i] * D[i] + DV[i] * DV[i];
        }
      }
      this.pushing = energy > 1e-7;
      if (!this.pushing) {
        D.fill(0);
        DV.fill(0);
      }
      active = true;
    }

    if (!active) return;
    this.frame();
    if (fine && p.inside && !p.blocked && !this.drag) this.setHover(this.pick(p.x, p.y, 24)?.k ?? -1);
    if (!this.ready) {
      this.ready = true;
      this.onReady?.();
    }
  };

  private frame() {
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  private update() {
    const { K, M, P, N, B, S, D, data, chapters: ch } = this;
    const last = ch.length - 1, a = Math.min(Math.floor(this.stage), last), b = Math.min(a + 1, last), t = this.stage - a, e = smooth(t);
    const phone = this.w < 768, pa = phone ? ch[a].phone : ch[a].desk, pb = phone ? ch[b].phone : ch[b].desk;
    const g = this.group;
    g.position.set(mix(pa[0], pb[0], e) * ((HH * this.w) / this.h), mix(pa[1], pb[1], e) * HH, 0);
    g.scale.setScalar(mix(pa[2], pb[2], e));
    g.rotation.set(mix(pa[3], pb[3], e) + this.tilt[0] + this.turn[0], mix(pa[4], pb[4], e) + this.tilt[1] + this.turn[1], mix(pa[5], pb[5], e));
    g.updateMatrixWorld();

    const A = this.forms.get(ch[a].form)!, Z = this.forms.get(ch[b].form)!, si = smooth(this.intro), row = M * 4;
    for (let k = 0; k < K; k++) {
      const kf = K > 1 ? k / (K - 1) : 0, base = k * ROWS * row;
      for (let i = 0; i < M; i++) {
        const u = i / (M - 1), j = k * M + i, j3 = j * 3, o = j * 10, d = base + i * 4;
        // Ropes leave their formation one after another, front to back, and lift apart in depth on the way.
        const s = smooth((t - 0.45 * (0.65 * u + 0.35 * kf)) / 0.55);
        P[j3] = mix(A.P[j3], Z.P[j3], s) + D[j3];
        P[j3 + 1] = mix(A.P[j3 + 1], Z.P[j3 + 1], s) + D[j3 + 1];
        P[j3 + 2] = mix(A.P[j3 + 2], Z.P[j3 + 2], s) + D[j3 + 2] + Math.sin(Math.PI * s) * (kf - 0.5) * 1.2;
        data[d + 3 * row] = mix(A.O[o], Z.O[o], s);
        data[d + 3 * row + 1] = mix(A.O[o + 1], Z.O[o + 1], s);
        data[d + 3 * row + 2] = mix(A.O[o + 2], Z.O[o + 2], s);
        data[d + 3 * row + 3] = mix(A.O[o + 3], Z.O[o + 3], s);
        data[d + 4 * row] = mix(A.O[o + 4], Z.O[o + 4], s);
        data[d + 4 * row + 1] = mix(A.O[o + 5], Z.O[o + 5], s);
        data[d + 4 * row + 2] = mix(A.O[o + 6], Z.O[o + 6], s);
        data[d + 4 * row + 3] = mix(A.O[o + 7], Z.O[o + 7], s);
        data[d + 5 * row] = mix(A.O[o + 8], Z.O[o + 8], s);
        data[d + 5 * row + 1] = mix(A.O[o + 9], Z.O[o + 9], s);
      }

      // Intro: each rope grows from its start; everything past the growing end waits on it.
      const front = this.intro < 1 ? clamp01(si * 1.35 - 0.35 * kf) : 1;
      if (front < 1) {
        const f = front * (M - 1), fl = Math.floor(f), fr = f - fl, p0 = (k * M + fl) * 3, p1 = (k * M + Math.min(fl + 1, M - 1)) * 3;
        const x = mix(P[p0], P[p1], fr), y = mix(P[p0 + 1], P[p1 + 1], fr), z = mix(P[p0 + 2], P[p1 + 2], fr);
        for (let i = fl + 1; i < M; i++) {
          const q = (k * M + i) * 3;
          P[q] = x;
          P[q + 1] = y;
          P[q + 2] = z;
        }
      }
      frames(P, k * M, M, N, B, S, this.seeds[k], false);

      const grow = front < 1 ? smooth(front * 25) : 1;
      for (let i = 0; i < M; i++) {
        const u = i / (M - 1), j = k * M + i, j3 = j * 3, d = base + i * 4;
        let pg = 0;
        for (const q of this.pulses)
          if (q.k === k) {
            const reach = 0.55 * q.age, d1 = (u - q.u - reach) / 0.05, d2 = (u - q.u + reach) / 0.05;
            pg = Math.max(pg, (1 - q.age / 2.2) * Math.exp(-Math.min(d1 * d1, d2 * d2)));
          }
        data[d] = P[j3];
        data[d + 1] = P[j3 + 1];
        data[d + 2] = P[j3 + 2];
        data[d + 3] = S[j];
        data[d + row] = N[j3];
        data[d + row + 1] = N[j3 + 1];
        data[d + row + 2] = N[j3 + 2];
        data[d + row + 3] = Math.max(this.glow[k], pg);
        data[d + 2 * row] = B[j3];
        data[d + 2 * row + 1] = B[j3 + 1];
        data[d + 2 * row + 2] = B[j3 + 2];
        data[d + 2 * row + 3] = this.rad[k] * (1 + 0.25 * pg) * grow;
      }
    }
    this.tex.needsUpdate = true;

    const m = this.mvp.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).multiply(g.matrixWorld).elements;
    for (let j = 0; j < K * M; j++) {
      const x = P[j * 3], y = P[j * 3 + 1], z = P[j * 3 + 2], w = m[3] * x + m[7] * y + m[11] * z + m[15];
      this.sx[j] = (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5) * this.w;
      this.sy[j] = (0.5 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5) * this.h;
    }
  }

  private local(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private onMove = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const [x, y] = this.local(e), now = performance.now(), p = this.ptr;
    if (p.has) {
      const s = Math.max(now - p.t, 4) / 1000;
      p.vx = mix(p.vx, (x - p.x) / s, 0.35);
      p.vy = mix(p.vy, (y - p.y) / s, 0.35);
    }
    Object.assign(p, { x, y, t: now, has: true, fine: e.pointerType !== "touch", inside: x >= 0 && y >= 0 && x <= this.w && y <= this.h, blocked: blocked(e.target) });
    const d = this.drag;
    if (d) {
      if (e.buttons === 0) return this.endDrag();
      const s = Math.max(now - d.t, 4) / 1000, dx = (e.clientX - d.x) * 0.006, dy = (e.clientY - d.y) * 0.006;
      this.turn[1] += dx;
      this.turn[0] += dy;
      this.turnV[1] = mix(this.turnV[1], dx / s, 0.5);
      this.turnV[0] = mix(this.turnV[0], dy / s, 0.5);
      Object.assign(d, { x: e.clientX, y: e.clientY, t: now });
      this.dirty = true;
      return;
    }
    if (p.fine) this.setHover(p.inside && !p.blocked ? (this.pick(x, y, 24)?.k ?? -1) : -1);
  };

  private onDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0 || blocked(e.target)) return;
    const [x, y] = this.local(e);
    if (x < 0 || y < 0 || x > this.w || y > this.h) return;
    const now = performance.now(), touch = e.pointerType === "touch";
    this.down = { x: e.clientX, y: e.clientY, t: now, touch };
    if (touch || this.hover < 0) return;
    e.preventDefault();
    this.drag = { x: e.clientX, y: e.clientY, t: now };
    this.turnV[0] = this.turnV[1] = 0;
    document.documentElement.dataset.rope = "drag";
  };

  private onUp = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const d = this.down;
    this.down = null;
    if (this.drag) this.endDrag();
    if (!d || blocked(e.target) || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 400) return;
    const [x, y] = this.local(e), hit = this.pick(x, y, d.touch ? 36 : 24);
    if (hit) this.pulse(hit.k, hit.u);
  };

  private onCancel = () => {
    this.down = null;
    if (this.drag) this.endDrag();
  };

  private onLeave = () => {
    this.ptr.inside = false;
    this.setHover(-1);
  };

  private endDrag() {
    const held = performance.now() - (this.drag?.t ?? 0) > 80; // let go after holding still: no fling
    this.drag = null;
    for (const i of [0, 1]) {
      this.turn[i] = Math.atan2(Math.sin(this.turn[i]), Math.cos(this.turn[i]));
      this.turnV[i] = held ? 0 : Math.max(-6, Math.min(6, this.turnV[i]));
    }
    if (this.hover >= 0) document.documentElement.dataset.rope = "hover";
    else delete document.documentElement.dataset.rope;
  }
}
