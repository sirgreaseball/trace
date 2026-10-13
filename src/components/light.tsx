"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { isDark, subscribeTheme } from "./theme";

/*
  Team light: every person on the team is a soft pool of coloured light, sized
  by their share of the work. A balanced team glows evenly; a team carried by
  one person is mostly one colour. WebGL when it can, a still CSS version
  otherwise (and under reduced motion).
*/

export type LightSource = { hue: number; weight: number };

const MAX = 8;

// OKLCH -> linear sRGB, enough for colour pools (clamped, no gamut mapping).
function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    clamp(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    clamp(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  ];
}

const tone = (dark: boolean) => (dark ? { l: 0.56, c: 0.17, alpha: 0.78 } : { l: 0.8, c: 0.14, alpha: 0.9 });

function normalise(sources: LightSource[]) {
  const list = sources.length ? sources.slice(0, MAX) : [{ hue: 30, weight: 1 }];
  const total = list.reduce((n, s) => n + Math.max(0, s.weight), 0);
  return list.map((s) => ({ hue: s.hue, weight: total ? Math.max(0.06, s.weight / total) : 1 / list.length }));
}

/** Where each pool sits: spread across the width, gently staggered. */
function anchor(i: number, n: number): [number, number] {
  const x = n === 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1);
  const y = 0.32 + (i % 2 ? 0.16 : -0.04) + Math.sin(i * 2.3) * 0.05;
  return [x, y];
}

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision highp float;
uniform vec2 res;uniform float t;uniform int n;uniform vec2 pos[${MAX}];uniform vec3 col[${MAX}];uniform float rad[${MAX}];uniform vec2 ptr;uniform float ptrOn;uniform float alpha;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=gl_FragCoord.xy/res; uv.y=1.-uv.y;
  float asp=res.x/res.y; vec2 q=vec2(uv.x*asp,uv.y);
  q+=0.035*vec2(sin(q.y*3.1+t*0.21),cos(q.x*2.7-t*0.17));
  vec3 acc=vec3(0.); float sum=0.;
  for(int i=0;i<${MAX};i++){ if(i>=n) break;
    vec2 c=vec2(pos[i].x*asp,pos[i].y);
    c+=0.06*vec2(sin(t*0.13+float(i)*1.7),cos(t*0.11+float(i)*2.3));
    c+=(vec2(ptr.x*asp,ptr.y)-c)*0.06*ptrOn;
    vec2 d=q-c; float r=rad[i]*mix(1.,asp,0.35);
    float f=exp(-dot(d,d)/(r*r));
    acc+=col[i]*f; sum+=f;
  }
  vec3 color=acc/max(sum,1e-4);
  float a=(1.-exp(-sum*1.6))*alpha;
  vec2 pd=q-vec2(ptr.x*asp,ptr.y); a+=0.12*ptrOn*exp(-dot(pd,pd)/0.05)*alpha;
  a+=(hash(gl_FragCoord.xy+t)-.5)/255.;
  a=clamp(a,0.,1.);
  gl_FragColor=vec4(pow(color,vec3(1./2.2))*a,a);
}`;

function cssFallback(sources: LightSource[], dark: boolean): CSSProperties {
  const { l, c, alpha } = tone(dark);
  const list = normalise(sources);
  return {
    background: list
      .map((s, i) => {
        const [x, y] = anchor(i, list.length);
        const r = Math.round(26 + Math.sqrt(s.weight) * 40);
        return `radial-gradient(${r}% ${Math.round(r * 1.5)}% at ${Math.round(x * 100)}% ${Math.round(y * 100)}%, oklch(${l} ${c} ${s.hue} / ${alpha}), transparent 70%)`;
      })
      .join(", "),
  };
}

export function TeamLight({
  sources,
  className = "",
  interactive = true,
  still = false,
  style,
}: {
  sources: LightSource[];
  className?: string;
  interactive?: boolean;
  /** CSS only, no WebGL: for small cards where several sit on one page. */
  still?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  const [gl, setGl] = useState(false);
  const live = useRef({ sources: normalise(sources), dark });
  useEffect(() => {
    live.current = { sources: normalise(sources), dark };
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || still || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(prog, name);
    const U = { res: u("res"), t: u("t"), n: u("n"), pos: u("pos"), col: u("col"), rad: u("rad"), ptr: u("ptr"), ptrOn: u("ptrOn"), alpha: u("alpha") };
    setGl(true);

    // The canvas renders at half resolution: it's all soft light, nobody can tell.
    const size = () => {
      const r = canvas.getBoundingClientRect();
      const s = 0.5;
      canvas.width = Math.max(2, Math.round(r.width * s));
      canvas.height = Math.max(2, Math.round(r.height * s));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const ptr = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, on: 0, ton: 0 };
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ptr.tx = (e.clientX - r.left) / r.width;
      ptr.ty = (e.clientY - r.top) / r.height;
      ptr.ton = ptr.tx > -0.2 && ptr.tx < 1.2 && ptr.ty > -0.3 && ptr.ty < 1.3 ? 1 : 0;
    };
    if (interactive) window.addEventListener("pointermove", move, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const { sources: list, dark: dk } = live.current;
      const { l, c, alpha } = tone(dk);
      // Pointer follows on a soft spring-ish lerp, so the light drifts after you.
      ptr.x += (ptr.tx - ptr.x) * 0.045;
      ptr.y += (ptr.ty - ptr.y) * 0.045;
      ptr.on += (ptr.ton - ptr.on) * 0.03;
      const n = list.length;
      const pos = new Float32Array(MAX * 2);
      const col = new Float32Array(MAX * 3);
      const rad = new Float32Array(MAX);
      list.forEach((s, i) => {
        const [x, y] = anchor(i, n);
        pos[i * 2] = x;
        pos[i * 2 + 1] = y;
        const rgb = oklchToLinear(l, c, s.hue);
        col.set(rgb, i * 3);
        rad[i] = 0.2 + Math.sqrt(s.weight) * 0.34;
      });
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.t, (now - t0) / 1000);
      gl.uniform1i(U.n, n);
      gl.uniform2fv(U.pos, pos);
      gl.uniform3fv(U.col, col);
      gl.uniform1fv(U.rad, rad);
      gl.uniform2f(U.ptr, ptr.x, ptr.y);
      gl.uniform1f(U.ptrOn, ptr.on);
      gl.uniform1f(U.alpha, alpha);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", move);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      setGl(false);
    };
  }, [interactive, still]);

  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} style={style} aria-hidden>
      <div className="absolute inset-0 transition-opacity duration-1000" style={{ ...cssFallback(sources, dark), filter: "blur(12px)", opacity: gl ? 0 : 1 }} />
      <canvas ref={ref} className="absolute inset-0 h-full w-full transition-opacity duration-1000" style={{ opacity: gl ? 1 : 0 }} />
    </div>
  );
}
