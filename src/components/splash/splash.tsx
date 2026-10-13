"use client";

import Lenis from "lenis";
import { motion, motionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Mark } from "../brand";
import { Icon } from "../icons";
import { TeamLight } from "../light";
import { Rings } from "../rings";
import { ThemeToggle } from "../theme";
import type { Pose, RingsEngine } from "./rings3d";
import { ChainScene, Chapters, CloseLegend, Copy, Exit, MentorScene, PracticeScene, Reveal, RewindScene, useChapter, WalletScene } from "./scenes";

/*
  The splash. One glossy set of rings lives behind the whole page and moves
  with the scroll: big and tilted in the hero, closing in the middle, tucked in
  a corner while the product scenes play, centre stage at the end. Every scene
  is scrubbed by the scroll (Lenis smooths the wheel), so nothing plays on its
  own clock and nothing snaps.
*/

const LIGHT = [
  { hue: 22, weight: 0.3 },
  { hue: 330, weight: 0.22 },
  { hue: 268, weight: 0.2 },
  { hue: 200, weight: 0.28 },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

type Key = { t: number; pose: Partial<Pose> };

function keyframes(mobile: boolean): { t: number; pose: Pose }[] {
  const corner: Partial<Pose> = mobile ? { x: 0.7, y: 0.83, s: 0.3, rx: 0, ry: 0, rz: 0, spread: 0 } : { x: 0.86, y: 0.8, s: 0.2, rx: 0, ry: 0, rz: 0, spread: 0 };
  const open: Pose["p"] = [0.74, 0.58, 0.42];
  const full: Pose["p"] = [1, 1, 1];
  // t runs i..i+1 through section i. A pinned section holds for the first
  // (len - 100) / len of its range, then the next one slides in, so each pose
  // lands as its section pins and moves while the next slides in.
  const keys: Key[] = mobile
    ? [
        { t: 0, pose: { x: 0, y: 0.5, s: 0.82, rx: -0.6, ry: 0.4, rz: -0.12, spread: 0, p: open } },
        { t: 0.4, pose: { x: 0, y: 0.46, s: 0.8, rx: -0.4, ry: 0.6, rz: -0.05, p: open } },
        { t: 0.95, pose: { ...corner, p: open } },
        { t: 1.75, pose: { ...corner, p: open } },
        { t: 2.1, pose: { x: 0, y: 0.48, s: 0.92, rx: -0.1, ry: -0.15, rz: 0, spread: 0, p: [0.25, 0.2, 0.3] } },
        { t: 2.7, pose: { x: 0, y: 0.48, s: 0.92, rx: 0, ry: -0.05, rz: 0, p: full } },
        { t: 3.05, pose: { ...corner, p: full } },
        { t: 4.05, pose: { ...corner, p: [0.12, 0.08, 0.15] } },
        { t: 4.6, pose: { ...corner, p: full } },
        { t: 6.5, pose: { ...corner, p: full } },
        { t: 7.0, pose: { x: 0, y: 0.06, s: 0.84, rx: -0.25, ry: 0, rz: Math.PI * 2, spread: 0, p: full } },
      ]
    : [
        { t: 0, pose: { x: 0.46, y: 0.06, s: 1.12, rx: -0.55, ry: 0.42, rz: -0.12, spread: 0, p: open } },
        { t: 0.3, pose: { x: 0.46, y: 0.02, s: 1.1, rx: -0.34, ry: 0.62, rz: -0.05, spread: 0.18, p: open } },
        { t: 0.85, pose: { ...corner, p: open } },
        { t: 1.7, pose: { ...corner, p: open } },
        { t: 2.02, pose: { x: 0.44, y: 0.03, s: 1.12, rx: -0.08, ry: -0.18, rz: 0, spread: 0, p: [0.25, 0.2, 0.3] } },
        { t: 2.5, pose: { x: 0.44, y: 0.03, s: 1.12, rx: 0, ry: -0.05, rz: 0, spread: 0, p: full } },
        { t: 2.64, pose: { x: 0.44, y: 0.03, s: 1.12, rx: 0, ry: 0, rz: 0, spread: 0, p: full } },
        { t: 3.05, pose: { ...corner, p: full } },
        { t: 3.7, pose: { ...corner, p: full } },
        { t: 4.06, pose: { ...corner, p: [0.12, 0.08, 0.15] } },
        { t: 4.48, pose: { ...corner, p: full } },
        { t: 6.45, pose: { ...corner, p: full } },
        { t: 6.98, pose: { x: 0, y: 0.02, s: 0.78, rx: -0.25, ry: 0, rz: Math.PI * 2, spread: 0, p: full } },
      ];
  // Fill each key from the one before, so keys only state what changes.
  const out: { t: number; pose: Pose }[] = [];
  for (const k of keys) out.push({ t: k.t, pose: { ...(out.at(-1)?.pose as Pose), ...k.pose } as Pose });
  return out;
}

function poseAt(t: number, keys: { t: number; pose: Pose }[]): Pose {
  if (t <= keys[0].t) return keys[0].pose;
  const j = keys.findIndex((k) => k.t > t);
  if (j < 0) return keys[keys.length - 1].pose;
  const a = keys[j - 1];
  const b = keys[j];
  const k = ease(clamp((t - a.t) / (b.t - a.t)));
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    x: mix(a.pose.x, b.pose.x),
    y: mix(a.pose.y, b.pose.y),
    s: mix(a.pose.s, b.pose.s),
    rx: mix(a.pose.rx, b.pose.rx),
    ry: mix(a.pose.ry, b.pose.ry),
    rz: mix(a.pose.rz, b.pose.rz),
    spread: mix(a.pose.spread, b.pose.spread),
    p: [mix(a.pose.p[0], b.pose.p[0]), mix(a.pose.p[1], b.pose.p[1]), mix(a.pose.p[2], b.pose.p[2])],
  };
}

// Section lengths in viewport heights (desktop). On phones every section is as tall as its content.
const LEN = [150, 230, 260, 230, 230, 220, 200, 115];

export function Splash() {
  const chapters = useMemo(() => LEN.map(() => motionValue(0)), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [gl, setGl] = useState<"pending" | "on" | "off">("pending");

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = matchMedia("(max-width: 767px)").matches;
    const keys = keyframes(mobile);
    const sections = [...document.querySelectorAll<HTMLElement>("[data-ch]")];
    let engine: RingsEngine | null = null;
    let alive = true;
    let geo = sections.map(() => ({ top: 0, h: 1 }));
    const measure = () => {
      geo = sections.map((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, h: el.offsetHeight }));
    };

    const update = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      let t = 0;
      geo.forEach(({ top, h }, i) => {
        // Pinned section: 0 when it pins, 1 when it lets go, negative while it slides in.
        // Unpinned (phones): 0 when its top reaches the top of the screen, 1 when it has gone.
        const span = h - vh > vh * 0.2 ? h - vh : h;
        const p = clamp((y - top) / span, -2, 1.5);
        chapters[i].set(reduce ? 1 : p);
        if (y + 1 >= top) t = i + clamp((y - top) / h);
      });
      engine?.setPose(poseAt(t, keys));
    };

    measure();
    const lenis = reduce ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, autoRaf: true });
    lenisRef.current = lenis;
    lenis?.on("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    const onResize = () => {
      measure();
      engine?.resize();
      update();
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);

    const move = (e: PointerEvent) => engine?.pointer(e.clientX, e.clientY);
    const leave = () => engine?.leave();
    const down = (e: PointerEvent) => {
      if (engine?.press(e.clientX, e.clientY)) {
        e.preventDefault();
        canvas.current?.setPointerCapture(e.pointerId);
        lenis?.stop();
      }
    };
    const up = () => {
      engine?.release();
      lenis?.start();
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    const c = canvas.current;
    c?.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    (async () => {
      const mod = await import("./rings3d");
      if (!alive || !c) return;
      if (!mod.canRunGL()) return setGl("off");
      try {
        engine = new mod.RingsEngine(c, poseAt(0, keys));
        setGl("on");
        update();
      } catch {
        setGl("off");
      }
    })();
    update();

    return () => {
      alive = false;
      lenis?.destroy();
      lenisRef.current = null;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      c?.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      engine?.dispose();
    };
  }, [chapters]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 1.8, easing: (k) => 1 - Math.pow(1 - k, 4) });
    else el.scrollIntoView();
  };

  return (
    <Chapters.Provider value={chapters}>
      <div className="relative">
        <TeamLight sources={LIGHT} className="fixed inset-0 h-[100lvh] opacity-90" />
        <div className="grain pointer-events-none fixed inset-0" aria-hidden />
        <canvas ref={canvas} className="fixed inset-0 z-[1] h-[100lvh] w-full touch-pan-y transition-opacity duration-1000" style={{ opacity: gl === "on" ? 1 : 0 }} aria-hidden />
        {gl === "off" && (
          <div className="pointer-events-none fixed inset-0 z-[1] grid place-items-center md:place-items-end md:pr-[10vw] md:pb-[20vh]" aria-hidden>
            <Rings values={[0.74, 0.58, 0.42]} size={300} glow />
          </div>
        )}

        <Nav onHow={() => go("how")} onMentors={() => go("mentors")} />

        <main className="pointer-events-none relative z-10 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <Hero onHow={() => go("how")} />
          <Scene i={1} id="how" visual={<ChainScene p={chapters[1]} />}>
            <Copy p={chapters[1]} label="Traceability" tone="var(--r1)" title="From requirement to commit, in one line.">
              Write stories the way your course asks: <i>As a student, I want…</i> Put <span className="ref text-ink">LF-12</span> in a commit message and it links itself. For the rest, Trace suggests a match and a teammate says yes or no.
            </Copy>
          </Scene>
          <Scene i={2} visual={<div className="h-[40vh] md:h-0" />}>
            <Copy p={chapters[2]} label="Today" tone="var(--r2)" title="Close the rings.">
              Three rings tell you how done you really are: stories traced end to end, tasks finished, commits tied to a story. When all three close, the project is done, and you can prove it.
            </Copy>
            <Exit p={chapters[2]}>
              <Reveal p={chapters[2]} at={-0.26} len={0.24}>
                <CloseLegend p={chapters[2]} />
              </Reveal>
            </Exit>
          </Scene>
          <Scene i={3} visual={<WalletScene p={chapters[3]} />}>
            <Copy p={chapters[3]} label="Receipts" tone="var(--r3)" title="Receipts, not opinions.">
              Every teammate gets a receipt, and every line on it is evidence: a commit, a finished task, a decision. Anyone can dispute a line. The lead resolves it, and the receipt keeps both sides. No line is written by AI.
            </Copy>
          </Scene>
          <Scene i={4} visual={<RewindScene p={chapters[4]} />}>
            <Copy p={chapters[4]} label="Rewind" tone="var(--accent)" title="Scrub through the whole project.">
              Drag a line back through time and watch the project rebuild itself, day by day: which stories were traced, who was doing the work. It&apos;s all in the record already.
            </Copy>
          </Scene>
          <Scene i={5} visual={<PracticeScene p={chapters[5]} />}>
            <Copy p={chapters[5]} label="Viva" tone="var(--r2)" title="Practise the parts you didn't build.">
              Flashcards on the code, decisions and requirements your teammates owned, answered from the team&apos;s own record. And when someone asks why, Ask finds the decision and the commit behind it.
            </Copy>
          </Scene>
          <Mentors />
          <Final />
          <Footer />
        </main>
      </div>
    </Chapters.Provider>
  );
}

function Nav({ onHow, onMentors }: { onHow: () => void; onMentors: () => void }) {
  return (
    <header className="fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-40 flex justify-center px-3">
      <motion.nav
        initial={{ y: -30, opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", bounce: 0.2, duration: 1, delay: 0.3 }}
        className="glass flex h-[52px] w-full max-w-[880px] items-center gap-1 rounded-[20px] pr-1.5 pl-3"
        aria-label="Main"
      >
        <Link href="/" className="press mr-auto inline-flex items-center gap-2" aria-label="Trace home">
          <Mark />
          <span className="text-[19px] leading-none font-[680] tracking-[-0.05em]">trace</span>
        </Link>
        <button onClick={onHow} className="btn btn-ghost btn-sm hidden sm:inline-flex">
          How it works
        </button>
        <button onClick={onMentors} className="btn btn-ghost btn-sm hidden sm:inline-flex">
          For mentors
        </button>
        <ThemeToggle className="size-9" />
        <Link href="/enter" className="btn btn-ghost btn-sm hidden sm:inline-flex">
          Sign in
        </Link>
        <Link href="/enter" className="btn btn-primary btn-sm h-9 px-4">
          Try the demo
        </Link>
      </motion.nav>
    </header>
  );
}

function Hero({ onHow }: { onHow: () => void }) {
  const p = useChapter(0);
  const opacity = useTransform(p, [0.2, 0.62], [1, 0], { clamp: true });
  const y = useTransform(p, [0, 0.62], [0, -90], { clamp: true });
  const filter = useTransform(p, [0.2, 0.62], ["blur(0px)", "blur(10px)"], { clamp: true });
  return (
    <section data-ch className="relative md:h-[150vh]">
      <div className="page flex min-h-[100svh] flex-col justify-center pt-24 pb-[46vh] md:sticky md:top-0 md:h-[100svh] md:pb-0">
        <motion.div style={{ opacity, y, filter }} className="max-w-[640px]">
          <p className="rise mb-6 text-[15px] font-[600] text-ink-2" style={{ "--i": 3 } as CSSProperties}>
            For student software teams and their mentors
          </p>
          <h1 className="t-display rise text-[clamp(54px,8.4vw,128px)]" style={{ "--i": 4 } as CSSProperties}>
            Every requirement, traced.
          </h1>
          <p className="rise mt-7 max-w-[30em] text-[18px] leading-relaxed text-ink-2 sm:text-[19px]" style={{ "--i": 6 } as CSSProperties}>
            Stories, tasks, commits and decisions, tied to the people who did the work. Your team can always answer who built this, why it was done that way, and what&apos;s left.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ "--i": 8 } as CSSProperties}>
            <Link href="/enter" className="btn btn-accent btn-lg">
              Try the demo <Icon name="arrow" size={16} />
            </Link>
            <button onClick={onHow} className="btn btn-lg">
              See how it works
            </button>
          </div>
        </motion.div>
        <motion.p style={{ opacity }} className="rise absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-[13px] text-ink-3 md:flex" aria-hidden>
          <span className="relative h-9 w-[2px] overflow-hidden rounded-full bg-line-2">
            <span className="absolute inset-x-0 top-0 h-3 rounded-full bg-ink-2" style={{ animation: "cue 2.4s var(--ease-in-out) infinite" }} />
          </span>
          Scroll, or drag the rings
        </motion.p>
      </div>
    </section>
  );
}

/** A pinned chapter: copy on the left, its own visual on the right. */
function Scene({ i, id, visual, children }: { i: number; id?: string; visual: ReactNode; children: ReactNode }) {
  const p = useChapter(i);
  return (
    <section data-ch id={id} className="relative py-24 md:py-0" style={{ "--len": `${LEN[i]}vh` } as CSSProperties}>
      <div className="md:h-[var(--len)]">
        <div className="page grid items-center gap-12 md:sticky md:top-0 md:h-[100svh] md:grid-cols-2 md:gap-10">
          <div>{children}</div>
          <Exit p={p} className="flex justify-center md:justify-end">
            <Reveal p={p} at={-0.38} len={0.3} dy={80} className="flex w-full justify-center md:justify-end">
              {visual}
            </Reveal>
          </Exit>
        </div>
      </div>
    </section>
  );
}

function Mentors() {
  const p = useChapter(6);
  return (
    <section data-ch id="mentors" className="relative py-24 md:py-0" style={{ "--len": `${LEN[6]}vh` } as CSSProperties}>
      <div className="md:h-[var(--len)]">
        <Exit p={p} className="page flex flex-col justify-center gap-12 md:sticky md:top-0 md:h-[100svh]">
          <div className="mx-auto max-w-[680px] text-center">
            <Reveal p={p} at={-0.5} len={0.2}>
              <p className="mb-4 text-[15px] font-[650] text-[var(--r3)]">Mentors</p>
            </Reveal>
            <Reveal p={p} at={-0.46} len={0.24} dy={56}>
              <h2 className="t-display text-[clamp(40px,5.4vw,76px)]">Every team, at a glance.</h2>
            </Reveal>
            <Reveal p={p} at={-0.38} len={0.24}>
              <p className="mx-auto mt-6 max-w-[34em] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
                A mentor sees every team they guide on one page: how much is traced, who is carrying the work, who went quiet, and which decisions disagree.
              </p>
            </Reveal>
          </div>
          <MentorScene p={p} />
        </Exit>
      </div>
    </section>
  );
}

function Final() {
  const p = useChapter(7);
  return (
    <section data-ch className="relative">
      <div className="page flex h-[100svh] min-h-[560px] flex-col items-center justify-between pt-[13vh] pb-[9vh] text-center">
        <Reveal p={p} at={-0.5} len={0.3} dy={60}>
          <h2 className="t-display text-[clamp(48px,7vw,104px)]">Your project, traced.</h2>
        </Reveal>
        <Reveal p={p} at={-0.3} len={0.3}>
          <div className="flex flex-wrap justify-center gap-3">
            <form action="/auth/demo" method="post">
              <input type="hidden" name="as" value="student" />
              <button className="btn btn-accent btn-lg">Try the demo as a student</button>
            </form>
            <form action="/auth/demo" method="post">
              <input type="hidden" name="as" value="mentor" />
              <button className="btn btn-lg">See the mentor view</button>
            </form>
          </div>
          <p className="t-caption mt-4">Fictional teams. Edit anything: the demo resets every six hours.</p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-line">
      <div className="page flex flex-wrap items-center gap-x-6 gap-y-3 py-8 text-[13px] text-ink-3">
        <span className="inline-flex items-center gap-2 text-ink">
          <Mark size={18} />
          <span className="font-[680] tracking-[-0.04em]">trace</span>
        </span>
        <span>© 2026 Dhruv Sonar. All rights reserved.</span>
        <span className="ml-auto flex gap-5">
          <Link href="/enter" className="transition-colors hover:text-ink">
            Sign in
          </Link>
          <Link href="/enter" className="transition-colors hover:text-ink">
            Demo
          </Link>
        </span>
      </div>
    </footer>
  );
}
