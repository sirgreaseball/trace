import type { CSSProperties } from "react";
import { initials } from "@/lib/format";

export type PassData = {
  name: string;
  hue: number;
  share: number;
  even: number;
  stats: { commits: number; lines: number; tasks: number; decisions: number };
  serial: string;
  disputes?: number;
};

/** A barcode drawn from the serial, so every pass looks like its own. */
export function Barcode({ serial, className = "" }: { serial: string; className?: string }) {
  const bars = Array.from(serial).flatMap((ch, i) => {
    const c = ch.charCodeAt(0);
    return [0, 1, 2].map((k) => ({ x: i * 11 + k * 3.4, w: (c >> k) & 1 ? 2.2 : 1 }));
  });
  return (
    <svg className={className} viewBox={`0 0 ${serial.length * 11} 40`} preserveAspectRatio="none" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * A person's receipt as a Wallet-style pass: their colour, their share of the
 * team's work, and what it's made of.
 */
export function Pass({ p, className = "", style }: { p: PassData; className?: string; style?: CSSProperties }) {
  const c1 = `oklch(0.7 0.16 ${p.hue})`;
  const c2 = `oklch(0.5 0.19 ${(p.hue + 28) % 360})`;
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] text-white select-none ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, ${c1}, transparent 60%), linear-gradient(150deg, ${c1}, ${c2})`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 0 0 1px rgb(255 255 255 / 0.12), 0 18px 40px -18px ${c2}, 0 2px 6px rgb(0 0 0 / 0.12)`,
        ...style,
      }}
    >
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/22 text-[14px] font-[650] backdrop-blur-sm">{initials(p.name)}</span>
            <span className="min-w-0">
              <span className="block text-[10.5px] font-[650] tracking-[0.14em] text-white/75 uppercase">Trace receipt</span>
              <span className="block truncate text-[19px] font-[650] tracking-[-0.025em]">{p.name}</span>
            </span>
          </div>
          <span className="text-right">
            <span className="block text-[10.5px] font-[650] tracking-[0.14em] text-white/75 uppercase">Share</span>
            <span className="num block text-[30px] leading-none font-[680] tracking-[-0.04em]">{Math.round(p.share * 100)}%</span>
          </span>
        </div>
        <dl className="mt-6 grid grid-cols-4 gap-2">
          {[
            ["Commits", p.stats.commits],
            ["Lines", p.stats.lines.toLocaleString("en-IN")],
            ["Tasks", p.stats.tasks],
            ["Decisions", p.stats.decisions],
          ].map(([k, val]) => (
            <div key={k}>
              <dt className="text-[10.5px] font-[600] tracking-[0.06em] text-white/70 uppercase">{k}</dt>
              <dd className="num mt-0.5 text-[16px] font-[640] tracking-[-0.02em]">{val}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <span className="text-[12px] text-white/80">
            Even split {Math.round(p.even * 100)}%{p.disputes ? ` · ${p.disputes} disputed` : ""}
          </span>
          <span className="rounded-[10px] bg-white px-3 py-2 text-[#15151b]">
            <Barcode serial={p.serial} className="h-6 w-28" />
          </span>
        </div>
      </div>
    </div>
  );
}
