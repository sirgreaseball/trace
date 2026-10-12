"use client";

import { useEffect, useRef } from "react";
import { Mark } from "@/components/brand";
import { isDark, subscribeTheme } from "@/components/shell";
import { canRunGL, RopeEngine, type Chapter } from "./rope";

const KNOT: Chapter[] = [{ form: "knot", desk: [0, 0.3, 0.62, 0.25, -0.35, 0], phone: [0, 0.3, 0.62, 0.25, -0.35, 0] }];

/** The splash knot on its own: drag it, click a strand. Falls back to the flat mark without WebGL. */
export function RopeCanvas({ className = "relative" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current!, cv = canvas.current!;
    let engine: RopeEngine | null = null;
    try {
      if (canRunGL())
        engine = new RopeEngine(cv, {
          chapters: KNOT,
          mobile: innerWidth < 768,
          intro: !matchMedia("(prefers-reduced-motion: reduce)").matches,
          onReady: () => el.setAttribute("data-ready", ""),
        });
    } catch {
      engine = null;
    }
    if (!engine) {
      el.dataset.gl = "off";
      return;
    }
    const e = engine;
    e.setStage(0);
    e.setTheme(isDark());
    const off = subscribeTheme(() => e.setTheme(isDark()));
    const ro = new ResizeObserver(() => e.resize(cv.clientWidth, cv.clientHeight));
    ro.observe(cv);
    return () => {
      ro.disconnect();
      off();
      e.dispose();
    };
  }, []);

  return (
    <div ref={wrap} className={`rope-canvas ${className}`}>
      <canvas ref={canvas} aria-hidden />
      <Mark size={160} className="rope-poster text-fg-3" />
    </div>
  );
}
