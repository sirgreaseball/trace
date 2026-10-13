"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";
import { TeamLight } from "../light";
import { Pass } from "../pass";
import { Rings } from "../rings";
import { personColor } from "../ui";

/* Every scene reads its chapter's scroll progress, 0..1, from here. */
export const Chapters = createContext<MotionValue<number>[]>([]);
export const useChapter = (i: number) => useContext(Chapters)[i];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Fades, lifts and un-blurs a piece of a scene between two points of its chapter. */
export function Reveal({ p, at, len = 0.14, dy = 36, children, className = "", blur = true }: { p: MotionValue<number>; at: number; len?: number; dy?: number; children: ReactNode; className?: string; blur?: boolean }) {
  const k = useTransform(p, [at, at + len], [0, 1], { clamp: true, ease: easeOut });
  const y = useTransform(k, [0, 1], [dy, 0]);
  const filter = useTransform(k, (v) => (blur ? `blur(${((1 - v) * 8).toFixed(2)}px)` : "none"));
  return (
    <motion.div style={{ opacity: k, y, filter }} className={className}>
      {children}
    </motion.div>
  );
}

/** Leaves as its chapter lets go: fades and lifts, so the next one has the stage. */
export function Exit({ p, children, className = "" }: { p: MotionValue<number>; children: ReactNode; className?: string }) {
  const opacity = useTransform(p, [0.84, 1], [1, 0], { clamp: true });
  const y = useTransform(p, [0.84, 1], [0, -48], { clamp: true });
  return (
    <motion.div style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Copy that arrives while its chapter slides in and drifts off as it ends. */
export function Copy({ p, label, title, children, tone }: { p: MotionValue<number>; label: string; title: ReactNode; children: ReactNode; tone: string }) {
  return (
    <Exit p={p} className="pointer-events-auto max-w-[460px]">
      <Reveal p={p} at={-0.46} len={0.2}>
        <p className="mb-4 text-[15px] font-[650] tracking-[-0.01em]" style={{ color: tone }}>
          {label}
        </p>
      </Reveal>
      <Reveal p={p} at={-0.42} len={0.24} dy={56}>
        <h2 className="t-display text-[clamp(40px,5.4vw,76px)]">{title}</h2>
      </Reveal>
      <Reveal p={p} at={-0.34} len={0.24}>
        <div className="mt-6 text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">{children}</div>
      </Reveal>
    </Exit>
  );
}

// ---------------------------------------------------------------------------
// Fictional team, used by every scene.

export const TEAM = [
  { name: "Aarav Mehta", short: "Aarav", hue: 210 },
  { name: "Isha Kulkarni", short: "Isha", hue: 18 },
  { name: "Meera Iyer", short: "Meera", hue: 320 },
  { name: "Kabir Rao", short: "Kabir", hue: 150 },
];

function Face({ who, size = 26 }: { who: (typeof TEAM)[number]; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-[640] text-white shadow-[0_0_0_2px_var(--surface)]"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(160deg, ${personColor(who.hue, 0.7, 0.15)}, ${personColor(who.hue, 0.56, 0.17)})` }}
    >
      {who.name
        .split(" ")
        .map((w) => w[0])
        .join("")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 1. A story, traced: the rows of evidence arrive one by one.

export function ChainScene({ p }: { p: MotionValue<number> }) {
  const line = useTransform(p, [0.16, 0.7], [0, 1], { clamp: true });
  const traced = useTransform(p, [0.66, 0.74], [0, 1], { clamp: true });
  const rows: { label: string; body: ReactNode; at: number }[] = [
    {
      label: "Tasks",
      at: 0.2,
      body: (
        <div className="space-y-2">
          {[
            ["Items table and access policies", TEAM[2]],
            ["Report form with validation", TEAM[0]],
            ["Photo upload with compression", TEAM[1]],
          ].map(([t, who]) => (
            <div key={t as string} className="flex items-center gap-2.5 text-[14px]">
              <span className="grid size-[18px] place-items-center rounded-full bg-ink text-[10px] text-inv">✓</span>
              <span className="flex-1">{t as string}</span>
              <Face who={who as (typeof TEAM)[number]} size={22} />
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Commits",
      at: 0.34,
      body: (
        <div className="space-y-2">
          {[
            ["a3f9c21", "LF-6: report form with validation", TEAM[0]],
            ["7bd0e14", "compress photo before saving", TEAM[1]],
          ].map(([sha, msg, who]) => (
            <div key={sha as string} className="flex items-center gap-2.5 text-[14px]">
              <span className="h-5 w-[3px] rounded-full" style={{ background: personColor((who as (typeof TEAM)[number]).hue) }} />
              <span className="ref">{sha as string}</span>
              <span className="flex-1 truncate">{msg as string}</span>
            </div>
          ))}
          <div className="ml-[13px] flex items-center gap-2 rounded-[12px] bg-accent-soft px-3 py-1.5 text-[12.5px]">
            <span className="font-[620] text-accent-ink">Looks like LF-7</span>
            <span className="text-ink-3">“compress”, “photo”</span>
            <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[11.5px] font-[600] text-inv">Confirm</span>
          </div>
        </div>
      ),
    },
    {
      label: "Decision",
      at: 0.48,
      body: (
        <div className="flex items-start gap-2.5 text-[14px]">
          <span className="mt-1 size-2.5 rotate-45 rounded-[2px] bg-[var(--r2)]" />
          <span>
            <span className="ref mr-1.5 text-[var(--r2)]">D-3</span>Compress photos to WebP at 1280px, because the free storage tier is 1 GB.
          </span>
        </div>
      ),
    },
    {
      label: "People",
      at: 0.6,
      body: (
        <div className="flex items-center gap-1">
          {TEAM.slice(0, 3).map((w) => (
            <Face key={w.name} who={w} size={30} />
          ))}
          <span className="ml-2 text-[13px] text-ink-2">Aarav, Isha and Meera built this</span>
        </div>
      ),
    },
  ];
  return (
    <div className="glass-strong pointer-events-auto relative w-full max-w-[520px] rounded-[30px] p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ref">LF-4</p>
          <p className="mt-1 text-[22px] font-[640] tracking-[-0.03em]">Report a lost item</p>
        </div>
        <motion.span style={{ opacity: traced }} className="chip chip-accent mt-1 h-7 px-3 text-[13px]">
          <span className="mark mark-traced size-2" /> Traced
        </motion.span>
      </div>
      <p className="mt-2 text-[14px] text-ink-2">As a student who lost something, I want to report it with a photo, so that a finder can recognise it.</p>
      <div className="relative mt-6 pl-7">
        <span className="absolute top-1 bottom-1 left-[5px] w-[2px] rounded-full bg-line-2" />
        <motion.span style={{ scaleY: line }} className="absolute top-1 bottom-1 left-[5px] w-[2px] origin-top rounded-full bg-[linear-gradient(var(--r1a),var(--r1b))]" />
        <div className="space-y-5">
          {rows.map((r) => (
            <Reveal key={r.label} p={p} at={r.at} len={0.1} dy={18} blur={false} className="relative">
              <span className="absolute top-0.5 -left-[29px] size-[14px] rounded-full bg-surface shadow-[0_0_0_2.5px_var(--r1)]" />
              <p className="mb-2 text-[12.5px] font-[620] text-ink-3">{r.label}</p>
              {r.body}
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. The rings close: three numbers count up with the scroll.

export function CloseLegend({ p }: { p: MotionValue<number> }) {
  const rows = [
    { label: "Stories traced", total: 10, color: "var(--r1)" },
    { label: "Tasks done", total: 17, color: "var(--r2)" },
    { label: "Commits linked", total: 28, color: "var(--r3)" },
  ];
  return (
    <div className="pointer-events-auto mt-10 grid max-w-[460px] grid-cols-3 gap-4">
      {rows.map((r, i) => (
        <Count key={r.label} p={p} {...r} start={[0.25, 0.2, 0.3][i]} />
      ))}
    </div>
  );
}

function Count({ p, label, total, color, start }: { p: MotionValue<number>; label: string; total: number; color: string; start: number }) {
  const n = useTransform(p, [0.14, 0.82], [Math.round(total * start), total], { clamp: true });
  const text = useTransform(n, (v) => String(Math.round(v)));
  return (
    <div>
      <p className="flex items-center gap-2 text-[13px] font-[560] text-ink-2">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="num mt-1.5 text-[34px] font-[650] tracking-[-0.04em]">
        <motion.span>{text}</motion.span>
        <span className="text-[16px] font-[520] text-ink-3"> of {total}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Receipts: the passes fan out, then one prints its slip.

export function WalletScene({ p }: { p: MotionValue<number> }) {
  const fan = useTransform(p, [0.12, 0.45], [0, 1], { clamp: true, ease: easeOut });
  const print = useTransform(p, [0.5, 0.8], [0, 1], { clamp: true });
  const clip = useTransform(print, (v) => `inset(0 0 ${((1 - v) * 100).toFixed(1)}% 0)`);
  const slipY = useTransform(print, [0, 1], [-60, 0]);
  const passes = [
    { who: TEAM[0], share: 0.32, stats: { commits: 7, lines: 772, tasks: 5, decisions: 4 } },
    { who: TEAM[1], share: 0.31, stats: { commits: 9, lines: 640, tasks: 6, decisions: 2 } },
    { who: TEAM[2], share: 0.28, stats: { commits: 8, lines: 515, tasks: 4, decisions: 1 } },
  ];
  return (
    <div className="pointer-events-auto relative w-full max-w-[460px]">
      <div className="relative h-[330px]">
        {passes.map((x, i) => (
          <PassCard key={x.who.name} fan={fan} i={i} n={passes.length}>
            <Pass
              p={{ name: x.who.name, hue: x.who.hue, share: x.share, even: 0.25, stats: x.stats, serial: `LF-${x.who.short.toUpperCase().slice(0, 4)}` }}
              style={{ height: 210 }}
            />
          </PassCard>
        ))}
      </div>
      <motion.div style={{ clipPath: clip, y: slipY }} className="relative z-0 -mt-[52px] mx-5">
        <div className="slip px-6 pt-12 pb-9 [animation:none]">
          <p className="text-center text-[10.5px] tracking-[0.3em]">TRACE · CONTRIBUTION RECEIPT</p>
          <div className="slip-rule" />
          {[
            ["COMMIT a3f9c21 → LF-4", "LF-6: report form with validation", "+171 −9"],
            ["TASK LF-6 → LF-4", "Report form with validation", "done"],
            ["DECISION D-7", "Email only for match alerts in v1", "decided"],
          ].map(([k, t, d]) => (
            <div key={k} className="mb-2.5 flex items-start gap-3 text-[12px]">
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block text-[10px] text-[var(--paper-2)]">{k}</span>
                {t}
              </span>
              <span className="shrink-0">{d}</span>
            </div>
          ))}
          <div className="mt-2 border-l-2 border-[#d0562c] pl-2.5 text-[11px] leading-snug">
            <b>DISPUTED</b> by Kabir: we paired on the form.
            <span className="block text-[var(--paper-2)]">→ Shared credit, agreed in lab.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PassCard({ fan, i, n, children }: { fan: MotionValue<number>; i: number; n: number; children: ReactNode }) {
  const y = useTransform(fan, [0, 1], [i * 14, i * 62]);
  const scale = useTransform(fan, [0, 1], [1 - (n - 1 - i) * 0.04, 1]);
  const rotate = useTransform(fan, [0, 1], [0, (i - 1) * -1.5]);
  return (
    <motion.div className="absolute inset-x-0 top-0" style={{ y, scale, rotate, zIndex: i + 1 }}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 4. Rewind: the playhead walks with the scroll, the project rebuilds itself.

const BARS = [3, 0, 5, 2, 7, 4, 0, 6, 8, 3, 0, 4, 9, 5, 2, 7, 6, 0, 8, 10, 4, 6, 3, 9, 7, 5, 8, 4, 6, 9];
const BAR_WHO = [0, 1, 2, 3, 1, 0, 2, 1, 0, 3, 2, 1, 0, 2, 1, 3, 0, 1, 2, 0, 1, 3, 2, 0, 1, 2, 0, 3, 1, 2];

export function RewindScene({ p }: { p: MotionValue<number> }) {
  const at = useTransform(p, [0.12, 0.85], [0, 1], { clamp: true });
  const left = useTransform(at, (v) => `${(v * 100).toFixed(2)}%`);
  const traced = useTransform(at, (v) => String(Math.round(1 + v * 9)));
  const pct = useTransform(at, (v) => `${Math.round(8 + v * 92)}%`);
  const date = useTransform(at, (v) => {
    const d = new Date(Date.UTC(2026, 7, 4) + v * 70 * 86_400_000);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  });
  return (
    <div className="glass-strong pointer-events-auto w-full max-w-[540px] rounded-[30px] p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-[560] text-ink-3">As it stood on</p>
          <motion.p className="num mt-1 text-[24px] font-[640] tracking-[-0.03em]">{date}</motion.p>
        </div>
        <div className="text-right">
          <motion.p className="num text-[44px] leading-none font-[680] tracking-[-0.05em]">{pct}</motion.p>
          <p className="mt-1 text-[13px] text-ink-3">
            <motion.span>{traced}</motion.span> of 10 stories traced
          </p>
        </div>
      </div>
      <div className="relative mt-8 h-24">
        <div className="absolute inset-x-0 bottom-0 flex h-20 items-end">
          {BARS.map((b, i) => (
            <Bar key={i} at={at} i={i} n={BARS.length} h={b} who={BAR_WHO[i]} />
          ))}
        </div>
        <motion.div className="absolute inset-y-0" style={{ left }}>
          <span className="absolute inset-y-[-4px] -ml-px w-[2px] rounded-full bg-ink" />
          <span className="absolute -top-2 -ml-[8px] size-4 rounded-full bg-ink shadow-[0_0_0_4px_var(--surface),0_2px_8px_rgb(0_0_0/0.3)]" />
        </motion.div>
      </div>
      <div className="mt-3 flex justify-between text-[12px] text-ink-3">
        <span>4 Aug</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Bar({ at, i, n, h, who }: { at: MotionValue<number>; i: number; n: number; h: number; who: number }) {
  const past = useTransform(at, (v) => ((i + 0.5) / n <= v ? 1 : 0));
  const bg = useTransform(past, (v) => (v ? personColor(TEAM[who].hue, 0.68, 0.16) : "var(--line-3)"));
  return (
    <span className="flex h-full flex-1 items-end justify-center">
      <motion.span className="w-[min(6px,60%)] rounded-full" style={{ height: h ? `${18 + h * 8.2}%` : 3, background: bg }} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// 5. Practice: a flashcard flips with the scroll; Ask answers below.

export function PracticeScene({ p }: { p: MotionValue<number> }) {
  const rotateY = useTransform(p, [0.24, 0.5], [0, 180], { clamp: true, ease: (t) => t * t * (3 - 2 * t) });
  return (
    <div className="pointer-events-auto w-full max-w-[520px]">
      <div className="[perspective:1400px]">
        <motion.div className="relative grid [transform-style:preserve-3d]" style={{ rotateY }}>
          <div className="glass-strong col-start-1 row-start-1 flex min-h-[260px] flex-col rounded-[30px] p-7 [backface-visibility:hidden]">
            <p className="flex items-center gap-2 text-[13px] text-ink-3">
              <span className="chip">Code</span>
              <span className="ref">src/claims</span>
            </p>
            <p className="mt-5 text-[23px] leading-snug font-[560] tracking-[-0.025em]">Meera changed the claim dialog in “LF-17: secret question”. What does it do for LF-16?</p>
            <p className="mt-auto pt-6 text-[13px] text-ink-3">Say it out loud, then flip the card.</p>
          </div>
          <div className="pane col-start-1 row-start-1 flex min-h-[260px] flex-col rounded-[30px] p-7 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="t-section">From the record</p>
            <ul className="mt-4 space-y-2 text-[15px] leading-relaxed">
              <li>Commit 3c1e7a0 stores the answer hashed, never in plain text.</li>
              <li>It serves LF-16: an owner proves an item is theirs before it is handed back.</li>
            </ul>
            <div className="mt-auto flex gap-1.5 pt-5">
              <span className="chip mono">3c1e7a0</span>
              <span className="chip mono">LF-16</span>
            </div>
          </div>
        </motion.div>
      </div>
      <Reveal p={p} at={0.56} len={0.12} dy={24}>
        <div className="glass mt-5 rounded-[24px] p-5">
          <p className="flex items-center gap-2.5 text-[15px] font-[560]">
            <span className="grid size-7 place-items-center rounded-[9px] bg-accent text-white">?</span>
            Why did we email match alerts instead of push?
          </p>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
            Push needed a service worker and Firebase setup the team didn&apos;t have time for{" "}
            <span className="num inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-soft px-1 text-[11px] font-semibold text-accent-ink">1</span>, so v1 emails a match and push moved to v2{" "}
            <span className="num inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-soft px-1 text-[11px] font-semibold text-accent-ink">2</span>.
          </p>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Mentors: every team as a card with its own light.

const TEAMS = [
  { key: "LF", name: "Campus Lost & Found", traced: 0.4, done: 0.7, linked: 0.75, flag: "Kabir has 10% of the work", hues: [210, 18, 320, 150], w: [0.32, 0.31, 0.28, 0.09] },
  { key: "MB", name: "Hostel Mess Feedback", traced: 0.71, done: 0.8, linked: 0.9, flag: "Looks healthy", hues: [200, 340, 100], w: [0.36, 0.33, 0.31] },
  { key: "LB", name: "Lab Slot Booking", traced: 0.22, done: 0.35, linked: 0.5, flag: "No activity for 6 days", hues: [280, 25, 300], w: [0.7, 0.2, 0.1] },
  { key: "CB", name: "Campus Carpool", traced: 0.55, done: 0.62, linked: 0.8, flag: "2 decisions may conflict", hues: [170, 60, 230], w: [0.4, 0.3, 0.3] },
  { key: "EV", name: "Club Events Hub", traced: 0.86, done: 0.9, linked: 0.95, flag: "Looks healthy", hues: [130, 350, 80, 260], w: [0.28, 0.26, 0.24, 0.22] },
];

export function MentorScene({ p }: { p: MotionValue<number> }) {
  return (
    <div className="pointer-events-auto grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {TEAMS.map((t, i) => (
        <Reveal key={t.key} p={p} at={-0.26 + i * 0.06} len={0.22} dy={70} className={i === 4 ? "max-lg:hidden" : ""}>
          <div className="pane overflow-hidden">
            <div className="relative h-24 overflow-hidden">
              <TeamLight still sources={t.hues.map((h, k) => ({ hue: h, weight: t.w[k] }))} className="absolute inset-0 scale-125" />
              <div className="relative flex h-full items-end justify-between p-3.5">
                <span className="mono rounded-[7px] bg-[light-dark(rgb(255_255_255/0.75),rgb(0_0_0/0.35))] px-1.5 py-0.5 text-[10.5px] font-semibold backdrop-blur">{t.key}</span>
                <Rings values={[t.traced, t.done, t.linked]} size={52} width={0.14} delay={200} />
              </div>
            </div>
            <div className="p-3.5">
              <p className="truncate text-[14px] font-[620] tracking-[-0.02em]">{t.name}</p>
              <p className="num mt-0.5 text-[12.5px] text-ink-3">{Math.round(t.traced * 100)}% traced</p>
              <p className={`mt-2.5 text-[12px] leading-snug ${t.flag === "Looks healthy" ? "text-ink-3" : "text-warn"}`}>{t.flag}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
