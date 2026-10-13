"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

const noop = () => () => {};

/*
  Pointer play for the splash. Everything here answers the cursor: buttons
  lean toward it, cards tilt and catch the light, the headline's letters lift
  as it passes, and a click anywhere throws out three rings. Touch screens and
  reduced motion get none of it.
*/

const canPlay = () => typeof window !== "undefined" && matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Leans toward the pointer when it comes close, springs home when it leaves. */
export function Magnetic({ children, strength = 0.32, reach = 70, className = "" }: { children: ReactNode; strength?: number; reach?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 17, mass: 0.6 });
  const y = useSpring(0, { stiffness: 220, damping: 17, mass: 0.6 });
  useEffect(() => {
    if (!canPlay()) return;
    const move = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.abs(dx) < r.width / 2 + reach && Math.abs(dy) < r.height / 2 + reach;
      x.set(near ? dx * strength : 0);
      y.set(near ? dy * strength : 0);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y, strength, reach]);
  return (
    <motion.span ref={ref} style={{ x, y }} className={`inline-flex ${className}`}>
      {children}
    </motion.span>
  );
}

/** Tilts toward the pointer like a card in the hand, with a sheen that follows it. */
export function Tilt({ children, max = 7, radius = 30, className = "", style }: { children: ReactNode; max?: number; radius?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const spring = { stiffness: 160, damping: 18, mass: 0.7 };
  const rx = useSpring(0, spring);
  const ry = useSpring(0, spring);
  const gx = useMotionValue(50);
  const gy = useMotionValue(30);
  const glow = useSpring(0, { stiffness: 120, damping: 20 });
  const sheen = useMotionTemplate`radial-gradient(520px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.28), transparent 55%)`;
  const [on] = useState(canPlay);
  return (
    <motion.div
      ref={ref}
      className={`pointer-events-auto relative ${className}`}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100, ...style }}
      onPointerMove={(e) => {
        if (!on) return;
        const r = ref.current!.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * max * 2);
        rx.set(-(py - 0.5) * max * 2);
        gx.set(px * 100);
        gy.set(py * 100);
        glow.set(1);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
        glow.set(0);
      }}
    >
      {children}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: sheen, opacity: glow, borderRadius: radius }} />
    </motion.div>
  );
}

/** A ring that trails the cursor and swells over anything clickable; clicks throw out rings. */
export function CursorFX() {
  const x = useSpring(-200, { stiffness: 520, damping: 38, mass: 0.45 });
  const y = useSpring(-200, { stiffness: 520, damping: 38, mass: 0.45 });
  const scale = useSpring(1, { stiffness: 260, damping: 20 });
  const on = useSyncExternalStore(noop, canPlay, () => false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  useEffect(() => {
    if (!on) return;
    let seq = 0;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      scale.set((e.target as Element | null)?.closest?.("a,button,[data-hover]") ? 2.1 : 1);
    };
    const down = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("a,button,input,textarea,select")) return;
      const id = ++seq;
      setBursts((b) => [...b.slice(-3), { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setBursts((b) => b.filter((q) => q.id !== id)), 1300);
    };
    const leave = () => {
      x.set(-200);
      y.set(-200);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [on, x, y, scale]);
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      <motion.div style={{ x, y, scale }} className="absolute -mt-[15px] -ml-[15px] size-[30px] rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--ink)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]" />
      {bursts.map((b) => (
        <span key={b.id}>
          {["var(--r1)", "var(--r2)", "var(--r3)"].map((c, i) => (
            <motion.span
              key={i}
              className="absolute size-5 rounded-full"
              style={{ left: b.x - 10, top: b.y - 10, border: `2.5px solid ${c}` }}
              initial={{ scale: 0.3, opacity: 0.95 }}
              animate={{ scale: 5 + i * 2.6, opacity: 0 }}
              transition={{ duration: 1.1, delay: i * 0.08, ease: [0.23, 1, 0.32, 1] }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}

/**
 * A headline whose letters lift, lean and warm toward the cursor as it moves
 * over them, then settle back. Transforms only, so the line never reflows.
 */
export function MagneticText({ text, className = "", style }: { text: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canPlay()) return;
    const letters = [...el.querySelectorAll<HTMLSpanElement>("[data-l]")];
    let centres: { x: number; y: number }[] = [];
    const measure = () => {
      const h = el.getBoundingClientRect();
      centres = letters.map((l) => {
        const r = l.getBoundingClientRect();
        return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
      });
    };
    measure();
    const k = letters.map(() => 0);
    const p = { x: -1e4, y: -1e4 };
    let raf = 0;
    const tick = () => {
      raf = 0;
      const h = el.getBoundingClientRect();
      let busy = false;
      letters.forEach((l, i) => {
        const dx = p.x - (h.left + centres[i].x);
        const dy = p.y - (h.top + centres[i].y);
        const target = Math.exp(-(dx * dx + dy * dy) / (2 * 150 * 150));
        k[i] += (target - k[i]) * 0.16;
        if (Math.abs(target - k[i]) > 0.002 || k[i] > 0.002) busy = true;
        const v = k[i];
        l.style.transform = v < 0.002 ? "" : `translate3d(${(-dx * 0.05 * v).toFixed(2)}px, ${(-16 * v).toFixed(2)}px, 0) rotate(${(dx * 0.03 * v).toFixed(2)}deg)`;
        l.style.color = v < 0.01 ? "" : `color-mix(in oklab, currentColor, var(--r${1 + (i % 3)}) ${Math.round(v * 85)}%)`;
      });
      if (busy) raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      p.x = e.clientX;
      p.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", measure);
    };
  }, [text]);
  const words = text.split(" ");
  return (
    <h1 ref={ref} className={className} style={style} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} aria-hidden className="inline-block whitespace-nowrap">
          {[...w].map((ch, ci) => (
            <span key={ci} data-l className="inline-block">
              {ch}
            </span>
          ))}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </h1>
  );
}
