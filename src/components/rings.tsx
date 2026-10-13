"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** True after the first frame, so things can animate in from zero. */
function useArrived(delay = 0) {
  const [on, setOn] = useState(false);
  useIso(() => {
    let id = 0;
    const t = setTimeout(() => (id = requestAnimationFrame(() => setOn(true))), delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [delay]);
  return on;
}

export const RING_COLORS = [
  ["var(--r1a)", "var(--r1b)"],
  ["var(--r2a)", "var(--r2b)"],
  ["var(--r3a)", "var(--r3b)"],
] as const;

/**
 * Concentric progress rings. Each value is 0..1. The fill is a CSS transition
 * on a registered custom property, so a new value (or a scrub) retargets
 * smoothly from wherever the ring is right now.
 */
export function Rings({
  values,
  size = 200,
  width = 0.115,
  gap = 0.03,
  delay = 120,
  colors = RING_COLORS,
  className = "",
  glow = false,
  label,
  follow = false,
}: {
  values: number[];
  size?: number;
  width?: number;
  gap?: number;
  delay?: number;
  colors?: readonly (readonly [string, string])[];
  className?: string;
  glow?: boolean;
  label?: string;
  /** Track a value that moves every frame (a scrub): short, still-soft transition. */
  follow?: boolean;
}) {
  const on = useArrived(delay);
  const w = size * width;
  const g = size * gap;
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      {values.map((v, i) => {
        const p = on ? Math.max(0, Math.min(1, v)) : 0;
        const [a, b] = colors[i % colors.length];
        return (
          <div
            key={i}
            className="dial"
            style={
              {
                "--inset": `${i * (w + g)}px`,
                "--w": `${w}px`,
                "--p": p,
                "--a": a,
                "--b": b,
                "--track": `color-mix(in oklab, ${b} 22%, transparent)`,
                transition: `--p ${follow ? 420 : 1500 + i * 180}ms var(--spring)`,
                filter: glow ? `drop-shadow(0 0 ${w * 0.6}px color-mix(in oklab, ${b} 45%, transparent))` : undefined,
              } as CSSProperties
            }
          >
            <span className="dial-track" />
            <span className="dial-fill" />
            {p > 0.004 && <span className="dial-cap" />}
            {p > 0.004 && <span className="dial-end" />}
          </div>
        );
      })}
    </div>
  );
}

/** Digits that roll into place instead of swapping. */
export function Roll({ value, className = "", instant = false }: { value: string | number; className?: string; instant?: boolean }) {
  const on = useArrived(60);
  const text = String(value);
  const chars = [...text];
  return (
    <span className={`roll ${className}`} data-instant={instant} aria-label={text}>
      {chars.map((ch, i) => {
        const key = chars.length - i; // keyed from the right so columns keep their place
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${key}`} aria-hidden>
              {ch}
            </span>
          );
        }
        const d = on ? Number(ch) : 0;
        return (
          <span key={`d${key}`} className="roll-col" aria-hidden>
            <span className="roll-strip" style={{ transform: `translateY(${-d}em)`, transitionDelay: instant ? "0ms" : `${(chars.length - i) * 40}ms` }}>
              {"0123456789".split("").map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

type SegItem = { key: string; label: ReactNode; href?: string; count?: number };

/**
 * A segmented control whose thumb slides between options. It moves on press,
 * before the new page arrives, so the control never feels like it waits.
 */
export function Segmented({ items, value, onChange, id, label, size = "md" }: { items: SegItem[]; value: string; onChange?: (key: string) => void; id: string; label: string; size?: "md" | "sm" }) {
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setPending(null);
  }
  const current = pending ?? value;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="seg" role="tablist" aria-label={label}>
      {items.map((it) => {
        const on = it.key === current;
        const inner = (
          <>
            {on && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={{ type: "spring", bounce: 0.14, duration: 0.5 }} />}
            {it.label}
            {it.count !== undefined && <span className={`num text-[12px] ${on ? "text-ink-2" : "text-ink-3"}`}>{it.count}</span>}
          </>
        );
        const cls = `seg-item ${size === "sm" ? "h-6 px-2.5 text-[12.5px]" : ""}`;
        return it.href ? (
          <Link key={it.key} href={it.href} scroll={false} role="tab" aria-selected={on} data-on={on} className={cls} onClick={() => setPending(it.key)}>
            {inner}
          </Link>
        ) : (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-on={on}
            className={cls}
            onClick={() => {
              setPending(it.key);
              onChange?.(it.key);
            }}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
