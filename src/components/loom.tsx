"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type LoomRow = {
  id: string;
  ref: string;
  title: string;
  href: string;
  state: "untraced" | "planned" | "building" | "traced";
  start: number;
  knots: { t: number; hue: number; label: string; kind: "commit" | "task" | "decision" }[];
};

const ROW = 30;

/**
 * The loom: one thread per story across the life of the project. Commits are
 * knots in their author's colour, finished tasks are ticks, decisions are
 * diamonds. Untraced stories show as loose dashed thread.
 */
export function Loom({ rows, from, to }: { rows: LoomRow[]; from: number; to: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  // Draw in real pixels so knots stay round at any width.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const span = Math.max(to - from, 86_400_000);
  const x = (t: number) => 8 + ((t - from) / span) * (W - 16);
  const H = rows.length * ROW + 8;

  const weeks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    // UTC Mondays, so server and browser draw the same ticks.
    const d = new Date(from);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
    for (let t = d.getTime(); t < to; t += 7 * 86_400_000) {
      out.push({ x: x(t), label: new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, W]);

  return (
    <div className="relative grid grid-cols-[minmax(0,200px)_minmax(0,1fr)] gap-x-4 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="pt-6">
        {rows.map((r) => (
          <Link key={r.id} href={r.href} className="group flex items-center gap-2 overflow-hidden" style={{ height: ROW }}>
            <span className="mono w-11 shrink-0 text-[11px] text-fg-3">{r.ref}</span>
            <span className="truncate text-[13px] text-fg-2 transition-colors group-hover:text-fg">{r.title}</span>
          </Link>
        ))}
      </div>
      <div ref={box} className="relative min-w-0">
        <svg viewBox={`0 0 ${W} 24`} className="block h-6 w-full" aria-hidden>
          {weeks.map((w) => (
            <line key={w.x} x1={w.x} x2={w.x} y1={18} y2={24} stroke="var(--line-2)" />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6">
          {weeks.map((w) => (
            <span key={w.x} className="absolute top-0 -translate-x-1/2 text-[10.5px] whitespace-nowrap text-fg-3" style={{ left: w.x }}>
              {w.label}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full overflow-visible"
          style={{ height: H }}
          role="img"
          aria-label="Each story as a thread over time. Dots are commits, ticks are finished tasks, diamonds are decisions."
          onMouseLeave={() => setTip(null)}
        >
          {weeks.map((w) => (
            <line key={w.x} x1={w.x} x2={w.x} y1={0} y2={H} stroke="var(--line)" />
          ))}
          <line x1={x(to)} x2={x(to)} y1={0} y2={H} stroke="var(--thread)" strokeOpacity={0.35} strokeDasharray="2 3" />
          {rows.map((r, i) => {
            const y = i * ROW + ROW / 2;
            const x0 = x(Math.max(r.start, from));
            const pts = [...r.knots].sort((a, b) => a.t - b.t);
            // The thread dips a little around every knot, like stitching.
            let d = `M${x0} ${y}`;
            let px = x0;
            pts.forEach((k, j) => {
              const kx = x(k.t);
              const dy = j % 2 ? 2.2 : -2.2;
              d += ` Q${(px + kx) / 2} ${y + dy} ${kx} ${y}`;
              px = kx;
            });
            d += ` L${x(to)} ${y}`;
            const style =
              r.state === "traced"
                ? { stroke: "var(--thread)", width: 1.6, dash: undefined, opacity: 1 }
                : r.state === "building"
                  ? { stroke: "var(--fg-2)", width: 1.2, dash: undefined, opacity: 0.9 }
                  : r.state === "planned"
                    ? { stroke: "var(--fg-3)", width: 1, dash: "4 4", opacity: 0.9 }
                    : { stroke: "var(--warn)", width: 1, dash: "2 5", opacity: 0.8 };
            return (
              <g key={r.id}>
                <path d={d} fill="none" stroke={style.stroke} strokeWidth={style.width} strokeDasharray={style.dash} strokeOpacity={style.opacity} />
                {pts.map((k, j) => {
                  const kx = x(k.t);
                  const show = () => setTip({ x: kx, y, text: k.label });
                  return k.kind === "commit" ? (
                    <circle key={j} cx={kx} cy={y} r={4} fill={`oklch(0.64 0.14 ${k.hue})`} stroke="var(--bg)" strokeWidth={1.5} onMouseEnter={show} className="cursor-default" />
                  ) : k.kind === "task" ? (
                    <line key={j} x1={kx} x2={kx} y1={y - 6} y2={y + 6} stroke="var(--fg)" strokeWidth={1.5} onMouseEnter={show} />
                  ) : (
                    <rect key={j} x={kx - 4} y={y - 4} width={8} height={8} transform={`rotate(45 ${kx} ${y})`} fill="var(--bg)" stroke="var(--thread)" strokeWidth={1.5} onMouseEnter={show} />
                  );
                })}
              </g>
            );
          })}
        </svg>
        {tip && (
          <div
            className="pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 -translate-y-full rounded-lg border border-line-2 bg-bg-2 px-2.5 py-1.5 text-[12px] shadow-[var(--shadow)]"
            style={{ left: Math.min(Math.max(tip.x, 120), W - 120), top: tip.y + 24 - 10 }}
          >
            {tip.text}
          </div>
        )}
      </div>
    </div>
  );
}
