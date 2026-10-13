"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

const noop = () => () => {};

/*
  Pointer play for the splash. Everything here answers the cursor: buttons
  lean toward it, cards tilt and catch the light, the headline's letters lift
  as it passes, and a click anywhere throws out three rings. Touch screens and
  reduced motion get none of it.
*/

const canPlay = () => typeof window !== "undefined" && matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Leans a few pixels toward the pointer while the pointer is on it, the way
 * an iPad button lifts under the cursor. Only the hovered element moves, and
 * never more than `max` pixels, so neighbours can't run into each other.
 */
export function Magnetic({ children, strength = 0.16, max = 5, className = "" }: { children: ReactNode; strength?: number; max?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 260, damping: 20, mass: 0.5 });
  const y = useSpring(0, { stiffness: 260, damping: 20, mass: 0.5 });
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  return (
    <motion.span
      ref={ref}
      style={{ x, y }}
      className={`inline-flex ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        x.set(clamp((e.clientX - (r.left + r.width / 2)) * strength));
        y.set(clamp((e.clientY - (r.top + r.height / 2)) * strength));
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
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

type PointerMode = "dot" | "button" | "grab" | "grabbing";

/**
 * The splash's pointer, in place of the system cursor (one cursor, never two).
 * A soft dot that tracks the mouse exactly; over a button it grows into a
 * highlight hugging the button's shape, iPad style; over the 3D rings it opens
 * into a ring you can grab. A click on empty space throws out three rings.
 */
export function CursorFX() {
  const on = useSyncExternalStore(noop, canPlay, () => false);
  const fast = { stiffness: 1500, damping: 90, mass: 0.3 };
  const morph = { stiffness: 380, damping: 32, mass: 0.6 };
  const cx = useSpring(-100, fast);
  const cy = useSpring(-100, fast);
  const w = useSpring(16, morph);
  const h = useSpring(16, morph);
  const r = useSpring(8, morph);
  const scale = useSpring(1, { stiffness: 520, damping: 26 });
  const left = useTransform([cx, w], ([c, s]: number[]) => c - s / 2);
  const top = useTransform([cy, h], ([c, s]: number[]) => c - s / 2);
  const [mode, setMode] = useState<PointerMode>("dot");
  const [shown, setShown] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.classList.add("pointer-fx");
    let seq = 0;
    let target: HTMLElement | null = null;
    let grab = false;
    let dragging = false;
    const at = { x: -100, y: -100 };
    const pick = (el: Element | null) => (el?.closest?.("a,button,[role=button]") as HTMLElement | null) ?? null;

    const place = () => {
      if (dragging) {
        setMode("grabbing");
        w.set(28);
        h.set(28);
        r.set(14);
        cx.set(at.x);
        cy.set(at.y);
      } else if (target) {
        // Hug the button, leaning a few pixels after the pointer.
        const b = target.getBoundingClientRect();
        const pad = 6;
        const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 12;
        const midX = b.left + b.width / 2;
        const midY = b.top + b.height / 2;
        const lean = (v: number, mid: number) => Math.max(-4, Math.min(4, (v - mid) * 0.08));
        setMode("button");
        w.set(b.width + pad * 2);
        h.set(b.height + pad * 2);
        r.set(Math.min(radius + pad, (b.height + pad * 2) / 2));
        cx.set(midX + lean(at.x, midX));
        cy.set(midY + lean(at.y, midY));
      } else {
        setMode(grab ? "grab" : "dot");
        w.set(grab ? 46 : 16);
        h.set(grab ? 46 : 16);
        r.set(grab ? 23 : 8);
        cx.set(at.x);
        cy.set(at.y);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      at.x = e.clientX;
      at.y = e.clientY;
      target = dragging ? null : pick(e.target as Element);
      setShown(true);
      place();
    };
    // The page scrolls under a still pointer: find what is under it now.
    const scroll = () => {
      if (at.x < 0) return;
      target = dragging ? null : pick(document.elementFromPoint(at.x, at.y));
      place();
    };
    const ring = (e: Event) => {
      grab = (e as CustomEvent<boolean>).detail;
      place();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      scale.set(0.84);
      if (grab) {
        dragging = true;
        target = null;
        place();
        return;
      }
      if ((e.target as Element | null)?.closest?.("a,button,input,textarea,select,[role=button]")) return;
      const id = ++seq;
      setBursts((b) => [...b.slice(-3), { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setBursts((b) => b.filter((q) => q.id !== id)), 1300);
    };
    const up = () => {
      scale.set(1);
      if (dragging) {
        dragging = false;
        place();
      }
    };
    const leave = () => setShown(false);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("trace:grab", ring);
    root.addEventListener("pointerleave", leave);
    return () => {
      root.classList.remove("pointer-fx");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("trace:grab", ring);
      root.removeEventListener("pointerleave", leave);
    };
  }, [on, cx, cy, w, h, r, scale]);

  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden>
      <motion.div data-mode={mode} className="pointer" style={{ x: left, y: top, width: w, height: h, borderRadius: r, scale, opacity: shown ? 1 : 0 }} />
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
