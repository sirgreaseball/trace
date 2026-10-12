"use client";

import { useEffect, useRef, useState } from "react";
import { ThreadEngine, canRunGL, renderScale } from "./engine";

/** A single live thread formation filling its box, for pages other than the splash. */
export function ThreadCanvas({ formation, className = "" }: { formation: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c || innerWidth < 1024 || matchMedia("(prefers-reduced-motion: reduce)").matches || !canRunGL()) return;
    let engine: ThreadEngine;
    try {
      engine = new ThreadEngine(c, { threads: 280, samples: 240, dpr: renderScale(false), mobile: false, bloom: true });
    } catch {
      return;
    }
    engine.jump(formation);
    const fit = () => {
      const r = c.getBoundingClientRect();
      if (r.width && r.height) engine.resize(r.width, r.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      engine.setPointer(e.clientX - r.left, e.clientY - r.top);
    };
    const leave = () => engine.clearPointer();
    const click = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      engine.pluck(e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerleave", leave);
    c.addEventListener("click", click);
    let raf = 0;
    const loop = () => {
      engine.render(0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(() => {
      loop();
      setLive(true);
    });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerleave", leave);
      c.removeEventListener("click", click);
      engine.dispose();
    };
  }, [formation]);

  return <canvas ref={ref} aria-hidden className={`transition-opacity duration-1000 ${live ? "opacity-100" : "opacity-0"} ${className}`} />;
}
