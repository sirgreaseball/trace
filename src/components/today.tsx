"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { Rings, Roll } from "./rings";
import { personColor, TeamBar } from "./ui";
import { asOf, balance, contributions, coverage, moments, traceStories } from "@/lib/trace";
import type { TraceData } from "@/lib/types";

const DAY = 86_400_000;
const fmt = (t: number, opts: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * The pulse of a workspace: three rings (stories traced, tasks done, commits
 * linked) over a timeline you can drag back through. Everything on the card
 * is recomputed from the record as it stood at that moment.
 */
export function Pulse({ data, now, start }: { data: TraceData; now: number; start: number }) {
  const [t, setT] = useState(now);
  const [mode, setMode] = useState<"idle" | "drag" | "play">("idle");
  const track = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const span = Math.max(now - start, 3 * DAY);
  const at = Math.min(1, Math.max(0, (t - start) / span));
  const live = now - t < 60_000;

  const view = useMemo(() => {
    const d = asOf(data, t);
    const cov = coverage(traceStories(d));
    const done = d.tasks.filter((k) => k.status === "done").length;
    const linked = new Set(d.links.filter((l) => l.status === "confirmed").map((l) => l.commit_id)).size;
    const team = contributions(d);
    return { cov, done, tasks: d.tasks.length, linked, commits: d.commits.length, team, bal: balance(team.map((x) => x.weight)) };
  }, [data, t]);

  const hue = useMemo(() => new Map(data.members.map((m) => [m.user_id, m.profile.hue])), [data.members]);
  const name = useMemo(() => new Map(data.members.map((m) => [m.user_id, m.profile.name.split(" ")[0]])), [data.members]);

  // Activity per day, coloured by whoever did the most that day.
  const days = useMemo(() => {
    const n = Math.max(1, Math.ceil(span / DAY));
    const rows = Array.from({ length: n }, () => ({ count: 0, by: new Map<string, number>() }));
    for (const m of moments(data)) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((m.t - start) / DAY)));
      rows[i].count++;
      if (m.who) rows[i].by.set(m.who, (rows[i].by.get(m.who) ?? 0) + 1);
    }
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({ h: r.count ? 0.18 + 0.82 * Math.sqrt(r.count / max) : 0, who: [...r.by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }));
  }, [data, span, start]);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    setMode("idle");
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function glide(from: number, to: number, ms: number, as: "play" | "idle") {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    setMode(as === "play" ? "play" : "idle");
    const step = (ts: number) => {
      const k = Math.min(1, (ts - t0) / ms);
      setT(from + (to - from) * ease(k));
      if (k < 1) raf.current = requestAnimationFrame(step);
      else setMode("idle");
    };
    raf.current = requestAnimationFrame(step);
  }
  const play = () => {
    if (mode === "play") return stop();
    const from = live ? start : t;
    glide(from, now, 1400 + 7200 * ((now - from) / span), "play");
  };

  const toTime = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return start + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * span;
  };
  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(raf.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    setMode("drag");
    setT(toTime(e.clientX));
  };
  const onMove = (e: React.PointerEvent) => mode === "drag" && setT(toTime(e.clientX));
  const onUp = () => mode === "drag" && setMode("idle");
  const onKey = (e: React.KeyboardEvent) => {
    const stepBy = (e.shiftKey ? 7 : 1) * DAY;
    const keys: Record<string, number> = { ArrowLeft: t - stepBy, ArrowRight: t + stepBy, Home: start, End: now, PageUp: t - 7 * DAY, PageDown: t + 7 * DAY };
    if (!(e.key in keys)) return;
    e.preventDefault();
    stop();
    setT(Math.min(now, Math.max(start, keys[e.key])));
  };

  const moving = mode !== "idle";
  const pct = view.cov.pct;
  const ticks = useMemo(() => {
    const n = Math.min(5, Math.max(2, Math.round(span / (10 * DAY))));
    return Array.from({ length: n }, (_, i) => start + (span * i) / (n - 1));
  }, [span, start]);

  const rows = [
    { label: "Stories traced", a: view.cov.traced, b: view.cov.total, ring: 0 },
    { label: "Tasks done", a: view.done, b: view.tasks, ring: 1 },
    { label: "Commits linked", a: view.linked, b: view.commits, ring: 2 },
  ];
  const share = (a: number, b: number) => (b ? a / b : 0);

  return (
    <section aria-label="Project pulse" className="glass relative overflow-hidden rounded-[32px] p-5 sm:p-8">
      <div className="grid grid-cols-1 items-center gap-7 md:grid-cols-[auto_1fr] md:gap-10">
        <div className="mx-auto md:mx-0">
          <Rings
            values={rows.map((r) => share(r.a, r.b))}
            size={232}
            glow
            label={`${pct}% of stories traced`}
            className="hidden sm:block"
            follow={moving}
          />
          <Rings values={rows.map((r) => share(r.a, r.b))} size={188} glow className="sm:hidden" follow={moving} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="t-figure text-[76px] sm:text-[92px]">
              <Roll value={pct} instant={moving} />
              <span className="text-[0.55em] tracking-[-0.03em] text-ink-3">%</span>
            </p>
            <p className="pb-3 text-[17px] font-[560] text-ink-2">traced end to end</p>
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {rows.map((r) => (
              <li key={r.label} className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] font-[560] text-ink-2">
                  <span className="size-2.5 rounded-full" style={{ background: `linear-gradient(135deg, var(--r${r.ring + 1}a), var(--r${r.ring + 1}b))` }} />
                  {r.label}
                </p>
                <p className="num mt-1 text-[22px] font-[640] tracking-[-0.03em]">
                  <Roll value={r.a} instant={moving} />
                  <span className="text-[15px] font-[520] text-ink-3"> of {r.b}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[12.5px] text-ink-2">
              <span className="font-[560]">Who did the work</span>
              <span className="num text-ink-3">Balance {Math.round(view.bal * 100)}%</span>
            </div>
            <TeamBar parts={view.team.map((c) => ({ label: name.get(c.user_id) ?? "", value: c.weight, hue: hue.get(c.user_id) }))} height={10} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
              {view.team.map((c) => (
                <span key={c.user_id} className="num inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: personColor(hue.get(c.user_id)) }} />
                  {name.get(c.user_id)} {Math.round(c.weight * 100)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rewind */}
      <div className="mt-8 border-t border-line pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={play} className="btn btn-sm gap-1.5" aria-label={mode === "play" ? "Pause the replay" : "Replay the project"}>
            <Icon name={mode === "play" ? "pause" : "play"} size={13} weight="fill" />
            {mode === "play" ? "Pause" : live ? "Replay the project" : "Play from here"}
          </button>
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <Icon name="rewind" size={15} className="text-ink-3" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={live ? "live" : "past"} initial={{ opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(4px)" }}>
                {live ? "Drag the line to see any day of the project" : <span className="num font-[560] text-ink">As it stood on {fmt(t, { weekday: "short", day: "numeric", month: "short" })}</span>}
              </motion.span>
            </AnimatePresence>
          </span>
          {!live && (
            <button onClick={() => glide(t, now, 900, "idle")} className="btn btn-ghost btn-sm ml-auto">
              Back to today <Icon name="arrow" size={13} />
            </button>
          )}
        </div>

        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Rewind the project"
          aria-valuemin={start}
          aria-valuemax={now}
          aria-valuenow={Math.round(t)}
          aria-valuetext={fmt(t, { weekday: "long", day: "numeric", month: "long" })}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
          className="group relative h-16 cursor-ew-resize touch-none rounded-[12px] outline-none select-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className="absolute inset-x-0 bottom-0 flex h-12 items-end">
            {days.map((d, i) => {
              const past = (i + 0.5) / days.length <= at;
              return (
                <span key={i} className="flex h-full min-w-0 flex-1 items-end justify-center">
                  <span
                    className="w-[min(5px,64%)] rounded-full transition-[background-color] duration-500"
                    style={{
                      height: d.h ? `${d.h * 100}%` : 3,
                      background: d.h ? (past ? personColor(d.who ? hue.get(d.who) : 260, 0.68, 0.16) : "var(--line-3)") : "var(--line-2)",
                    }}
                  />
                </span>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0" style={{ left: `${at * 100}%` }}>
            <span className="absolute inset-y-[-2px] -ml-px w-[2px] rounded-full bg-ink" />
            <span className="absolute -top-1 -ml-[7px] size-[14px] rounded-full bg-ink shadow-[0_0_0_4px_var(--surface),0_2px_8px_rgb(0_0_0/0.3)] transition-transform duration-200 group-active:scale-125" />
          </div>
        </div>
        <div className="relative mt-2 h-4 text-[11.5px] text-ink-3">
          {ticks.map((x, i) => (
            <span key={i} className="num absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full" style={{ left: `${((x - start) / span) * 100}%` }}>
              {i === ticks.length - 1 ? "Today" : fmt(x, { day: "numeric", month: "short" })}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
