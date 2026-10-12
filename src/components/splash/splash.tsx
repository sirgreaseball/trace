"use client";

import Lenis from "lenis";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { refs, suggest } from "@/lib/trace";
import type { Story } from "@/lib/types";
import { Mark } from "../brand";
import { Icon } from "../icons";
import { ThreadEngine, canRunGL, renderScale } from "./engine";

// Each chapter of the page maps to one thread formation, in order:
// tangle, wild tangle, loom, ropes, helix, field of knots, line.
const RAIL = ["Intro", "The problem", "Trace", "Receipts", "Viva", "Mentors", "Start"];
const pad = (n: number) => String(n).padStart(2, "0");

// Everything below is the live demo data (scripts/seed-demo.ts prints it).
const GRID = [
  { id: "LF-1", title: "Sign in with college email", state: "Traced", tasks: "2/2", commits: 4 },
  { id: "LF-4", title: "Report a lost item", state: "Traced", tasks: "3/3", commits: 4 },
  { id: "LF-11", title: "Search and filter items", state: "Building", tasks: "1/2", commits: 5 },
  { id: "LF-16", title: "Claim an item with a secret question", state: "Building", tasks: "1/2", commits: 2 },
  { id: "LF-23", title: "Moderation queue for the security office", state: "Planned", tasks: "0/2", commits: 0 },
  { id: "LF-26", title: "Map of drop-off points", state: "Untraced", tasks: "-", commits: 0 },
] as const;
const STORIES = GRID.map((g) => ({ id: g.id, number: Number(g.id.slice(3)), title: g.title }) as Story);
const TRY = ["LF-16: lock the claim after three wrong answers", "add category filter to the item search", "fix footer typo"];

const RECEIPT = [
  { kind: "COMMIT a10e5e2", title: "limit wrong answers on claim dialog", detail: "+38 -5" },
  { kind: "COMMIT 3a276ea → LF-16", title: "LF-18: claim dialog", detail: "+140 -0" },
  { kind: "COMMIT e67ae1b → LF-14", title: "LF-15: claimed state on item page", detail: "+24 -9" },
  { kind: "TASK LF-21 → LF-19", title: "Email template for match alerts", detail: "done" },
  { kind: "COMMIT bdd14e0 → LF-19", title: "LF-21: match alert email template", detail: "+96 -0", disputed: "Kabir: We paired on this in the lab. I wrote the email copy and the subject lines." },
];

const TEAMS = [
  { key: "MB", name: "Hostel Mess Feedback", traced: 50, balance: 19, flag: "Rohan Desai is carrying 77% of the work" },
  { key: "LB", name: "Lab Slot Booking", traced: 17, balance: 52, flag: "No activity for 7 days" },
  { key: "EV", name: "Club Events Hub", traced: 33, balance: 63, flag: "2 open disputes" },
  { key: "LF", name: "Campus Lost & Found", traced: 40, balance: 77, flag: "Kabir Rao has 10% of the work" },
  { key: "CB", name: "Campus Carpool", traced: 83, balance: 75, flag: "6 commits not linked to any story" },
];

const STATE_STYLE: Record<string, string> = {
  Traced: "text-thread-ink",
  Building: "text-fg",
  Planned: "text-fg-2",
  Untraced: "text-warn",
};

// The problem, read word by word as you scroll. Starred runs are set in italic red.
const PROBLEM = "Four people, one repo, eight weeks. By the viva, nobody can say *who built what,* or *why it changed.*"
  .split(" ")
  .reduce<{ w: string; em: boolean }[]>((out, w) => {
    const open = w.startsWith("*") || (out.at(-1)?.em && !out.at(-1)!.w.endsWith("*"));
    out.push({ w, em: !!open });
    return out;
  }, [])
  .map((x) => ({ w: x.w.replaceAll("*", ""), em: x.em }));

export function Splash() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "gl" | "poster">("loading");
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = root.current!;
    const sections = [...el.querySelectorAll<HTMLElement>("[data-chapter]")];
    const bar = el.querySelector<HTMLElement>("[data-progress]")!;
    const foot = el.querySelector<HTMLElement>("[data-foot]");
    const chNum = el.querySelector<HTMLElement>("[data-ch-num]");
    const chName = el.querySelector<HTMLElement>("[data-ch-name]");
    const railItems = [...el.querySelectorAll<HTMLElement>("[data-rail-item]")];
    const dot = el.querySelector<HTMLElement>("[data-cursor-dot]");
    const ring = el.querySelector<HTMLElement>("[data-cursor-ring]");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(pointer: fine)").matches;
    const nogl = new URLSearchParams(location.search).has("nogl");
    const mobile = innerWidth < 768;
    const gl = !reduced && !nogl && canRunGL();

    let engine: ThreadEngine | null = null;
    if (gl && canvas.current) {
      try {
        engine = new ThreadEngine(canvas.current, {
          threads: mobile ? 180 : 420,
          samples: mobile ? 180 : 300,
          dpr: renderScale(mobile),
          mobile,
          bloom: !mobile,
        });
      } catch {
        engine = null;
      }
    }
    setMode(engine ? "gl" : "poster");

    const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    const go = (y: number, duration = 1.6) => (lenis ? lenis.scrollTo(y, { duration }) : scrollTo({ top: y }));

    // Anchors: the scroll position where each chapter sits centred on screen.
    let anchors: number[] = [];
    const measure = () => {
      anchors = sections.map((s) => s.offsetTop + s.offsetHeight / 2 - innerHeight / 2);
      anchors[0] = 0;
      engine?.resize(innerWidth, innerHeight);
    };
    measure();

    const chapterAt = (y: number) => {
      for (let k = 0; k < anchors.length - 1; k++) {
        if (y < anchors[k + 1]) {
          const u = Math.max(0, (y - anchors[k]) / (anchors[k + 1] - anchors[k]));
          // Hold each formation while its copy is on screen, morph in between.
          const s = Math.min(1, Math.max(0, (u - 0.28) / 0.44));
          return k + s * s * (3 - 2 * s);
        }
      }
      return anchors.length - 1;
    };

    // Chapter ticks and in-page links.
    const onRail = (e: Event) => go(Math.max(0, anchors[railItems.indexOf(e.currentTarget as HTMLElement)] ?? 0));
    railItems.forEach((r) => r.addEventListener("click", onRail));
    const onJump = (e: Event) => {
      const t = (e.target as Element).closest<HTMLElement>("[data-jump]");
      if (!t) return;
      e.preventDefault();
      const i = Number(t.dataset.jump);
      go(i < 0 ? 0 : Math.max(0, anchors[i] ?? 0), i < 0 ? 2.2 : 1.6);
    };
    el.addEventListener("click", onJump);

    // Magnetic buttons: lean a few pixels toward the pointer.
    const magnets = reduced ? [] : [...el.querySelectorAll<HTMLElement>("[data-magnet]")];
    const onMagnet = (e: PointerEvent) => {
      const m = e.currentTarget as HTMLElement;
      const r = m.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
      m.style.transform = `translate3d(${Math.max(-10, Math.min(10, dx))}px, ${Math.max(-8, Math.min(8, dy))}px, 0)`;
    };
    const offMagnet = (e: PointerEvent) => {
      (e.currentTarget as HTMLElement).style.transform = "";
    };
    magnets.forEach((m) => {
      m.addEventListener("pointermove", onMagnet);
      m.addEventListener("pointerleave", offMagnet);
    });

    // Cursor: a dot that sticks to the pointer and a ring that trails it.
    const useCursor = fine && !reduced && !!dot && !!ring;
    if (useCursor) el.dataset.cursor = "";
    const cur = { x: -100, y: -100, rx: -100, ry: -100 };
    const cursorState = (t: EventTarget | null) => {
      if (!(t instanceof Element)) return "drag";
      if (t.closest("input, textarea")) return "text";
      if (t.closest("a, button")) return "link";
      if (t.closest("[data-no-drag], p, h1, h2, li")) return "plain";
      return engine ? "drag" : "plain";
    };

    const onPointer = (e: PointerEvent) => {
      engine?.setPointer(e.clientX, e.clientY);
      cur.x = e.clientX;
      cur.y = e.clientY;
      if (useCursor) el.dataset.cursorState = cursorState(e.target);
    };
    const onLeave = () => {
      engine?.clearPointer();
      if (useCursor) el.dataset.cursorState = "out";
    };
    let down: { x: number; moved: boolean } | null = null;
    const interactive = (t: EventTarget | null) => t instanceof Element && !!t.closest("a, button, input, [data-no-drag]");
    const onDown = (e: PointerEvent) => {
      if (interactive(e.target) || e.button !== 0) return;
      down = { x: e.clientX, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (Math.abs(e.clientX - down.x) > 4) {
        down.moved = true;
        el.dataset.dragging = "";
      }
      if (down.moved && e.pointerType === "mouse") {
        engine?.drag(e.movementX);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.moved) {
        engine?.pluck(e.clientX, e.clientY);
      }
      down = null;
      delete el.dataset.dragging;
    };
    addEventListener("pointermove", onPointer, { passive: true });
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);
    addEventListener("resize", measure);

    let raf = 0;
    let visible = true;
    const onVis = () => {
      visible = !document.hidden;
      if (visible) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVis);

    let shown = -1;
    const tick = (t: number) => {
      lenis?.raf(t);
      const y = lenis ? lenis.scroll : scrollY;
      const vh = innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      bar.style.transform = `scaleX(${Math.min(1, y / max)})`;
      for (const s of sections) {
        const d = (s.offsetTop + s.offsetHeight / 2 - y - vh / 2) / vh;
        s.style.setProperty("--v", String(Math.max(0, Math.min(1, 1.35 - Math.abs(d) * 1.7))));
        s.style.setProperty("--k", String(Math.max(0, Math.min(1, 1 - d * 1.4))));
      }
      if (foot) foot.style.setProperty("--f", String(Math.max(0, Math.min(1, (y + vh - foot.offsetTop) / foot.offsetHeight))));
      const c = chapterAt(y);
      const active = Math.round(c);
      if (active !== shown) {
        shown = active;
        railItems.forEach((r, i) => r.toggleAttribute("data-active", i === active));
        if (chNum) chNum.textContent = pad(active + 1);
        if (chName) chName.textContent = RAIL[active];
      }
      if (useCursor) {
        cur.rx += (cur.x - cur.rx) * 0.2;
        cur.ry += (cur.y - cur.ry) * 0.2;
        dot!.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
        ring!.style.transform = `translate3d(${cur.rx}px, ${cur.ry}px, 0)`;
      }
      if (engine) {
        engine.setChapter(c);
        engine.render((y / vh) * 0.35, false);
      }
      if (visible) raf = requestAnimationFrame(tick);
    };

    let cancelled = false;
    (async () => {
      setLoaded(0.3);
      await document.fonts?.ready;
      if (cancelled) return;
      setLoaded(0.6);
      engine?.warm();
      if (cancelled) return;
      setLoaded(0.85);
      raf = requestAnimationFrame((t) => {
        tick(t);
        setLoaded(1);
      });
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      railItems.forEach((r) => r.removeEventListener("click", onRail));
      el.removeEventListener("click", onJump);
      magnets.forEach((m) => {
        m.removeEventListener("pointermove", onMagnet);
        m.removeEventListener("pointerleave", offMagnet);
      });
      removeEventListener("pointermove", onPointer);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVis);
      lenis?.destroy();
      engine?.dispose();
    };
  }, []);

  const start = "/enter";

  return (
    <div ref={root} data-ready={ready ? "" : undefined} className="splash grain relative overflow-x-clip bg-bg text-fg">
      <canvas ref={canvas} aria-hidden className={`fixed inset-0 h-dvh w-full transition-opacity duration-[1800ms] ${mode === "gl" && ready ? "opacity-100" : "opacity-0"}`} />
      {mode === "poster" && <Poster />}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(110%_75%_at_12%_85%,rgb(12_12_10/0.86),transparent_58%)] max-md:bg-[linear-gradient(to_bottom,rgb(12_12_10/0.1),rgb(12_12_10/0.72))]" />

      <Loader progress={loaded} onDone={() => setReady(true)} />

      <div aria-hidden className="cursor-dot" data-cursor-dot />
      <div aria-hidden className="cursor-ring" data-cursor-ring>
        <span>Drag</span>
      </div>

      <header className="fixed inset-x-0 top-0 z-30">
        <div className="h-px w-full origin-left bg-thread" data-progress style={{ transform: "scaleX(0)" }} />
        <nav className="mx-auto grid h-16 max-w-[1400px] grid-cols-[1fr_auto] items-center bg-gradient-to-b from-bg via-bg/70 to-transparent px-5 sm:h-[76px] sm:px-10 md:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-medium tracking-[-0.03em]" aria-label="Trace home">
            <Mark className="text-thread" /> trace
          </Link>
          <p className="mono hidden items-center gap-3 text-[11px] tracking-[0.08em] text-fg-3 uppercase md:flex" aria-live="polite">
            <span>
              <span data-ch-num className="text-fg">
                01
              </span>{" "}
              / {pad(RAIL.length)}
            </span>
            <span className="h-px w-8 bg-line-2" />
            <span data-ch-name className="w-24">
              Intro
            </span>
          </p>
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <a href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer" className="hidden px-3 py-2 text-[13px] text-fg-2 transition-colors duration-300 hover:text-fg sm:block">
              Source
            </a>
            <Link href={start} className="px-3 py-2 text-[13px] text-fg-2 transition-colors duration-300 hover:text-fg">
              Sign in
            </Link>
            <DemoButton as="student" variant="pill">
              Live demo
            </DemoButton>
          </div>
        </nav>
      </header>

      <nav aria-label="Chapters" className="fixed top-1/2 right-6 z-30 hidden -translate-y-1/2 flex-col items-end lg:flex">
        {RAIL.map((r, i) => (
          <button key={r} data-rail-item aria-label={`${pad(i + 1)} ${r}`} className="group flex items-center gap-3 py-[7px]">
            <span className="mono text-[10px] text-fg-3 uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100">{r}</span>
            <span className="h-px w-3 bg-fg-3 transition-all duration-500 ease-[var(--ease)] group-hover:bg-fg group-data-[active]:w-8 group-data-[active]:bg-thread" />
          </button>
        ))}
      </nav>

      <main className="relative z-10">
        {/* Intro: the tangle */}
        <section data-chapter className="chapter min-h-dvh">
          <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col justify-between px-5 pt-24 pb-8 sm:px-10 sm:pt-28 sm:pb-10">
            <div className="hero-in mono grid grid-cols-2 gap-4 text-[11px] tracking-[0.08em] text-fg-3 uppercase md:grid-cols-3" style={{ animationDelay: "0.5s" }}>
              <span>(Trace) <span className="max-sm:hidden">Traceability workspace</span></span>
              <span className="hidden md:block">For student software teams and their mentors</span>
              <span className="text-right">Edition 02 / 2026</span>
            </div>

            <div>
              <h1 className="hero-title display text-[clamp(56px,10.6vw,190px)] leading-[0.86]">
                <span className="line">
                  <span style={{ animationDelay: "0.05s" }}>Every requirement,</span>
                </span>
                <span className="line">
                  <span style={{ animationDelay: "0.17s" }}>
                    <em className="pr-[0.06em] text-thread">traced.</em>
                  </span>
                </span>
              </h1>

              <div className="mt-10 grid items-end gap-8 border-t border-line pt-6 md:grid-cols-[1fr_minmax(0,420px)_auto] md:gap-10">
                <button data-jump="1" className="hero-in mono hidden items-center gap-3 self-center text-[11px] tracking-[0.08em] text-fg-3 uppercase transition-colors hover:text-fg md:flex" style={{ animationDelay: "0.8s" }}>
                  <span className="scroll-cue" /> Scroll to untangle
                </button>
                <p className="hero-in copy text-[17px] leading-relaxed text-fg-2" style={{ animationDelay: "0.55s" }}>
                  Trace ties your team&apos;s stories, commits and decisions to the people behind them, so the viva never starts with &ldquo;who built this?&rdquo;
                </p>
                <div className="hero-in flex flex-wrap items-center gap-3" style={{ animationDelay: "0.65s" }}>
                  <DemoButton as="student" variant="primary">
                    Try the demo
                  </DemoButton>
                  <Link href={start} data-magnet className="magnet rounded-full border border-line-2 px-6 py-3 text-[15px] font-medium hover:border-fg-3">
                    Create a workspace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The problem: a wilder tangle. Pinned while the sentence reads itself in. */}
        <section data-chapter className="chapter min-h-[190dvh]">
          <div className="sticky top-0 flex min-h-dvh items-center">
            <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
              <Eyebrow n={2}>The problem</Eyebrow>
              <p className="copy display mt-8 max-w-[17ch] text-[clamp(40px,5.8vw,96px)] leading-[0.98]">
                {PROBLEM.map((x, i) => (
                  <span key={i} className={x.em ? "text-thread italic" : undefined} style={{ opacity: `clamp(0.1, calc(var(--k) * ${PROBLEM.length * 1.2} - ${i}), 1)` }}>
                    {x.w}{" "}
                  </span>
                ))}
              </p>
              <ol className="mt-12 grid max-w-[1100px] border-t border-line md:grid-cols-3">
                {["Who actually built the claim flow?", "Why did we switch to email alerts?", "Is “report a lost item” really done?"].map((q, i) => (
                  <li
                    key={q}
                    className="flex gap-4 border-b border-line py-4 text-[15px] text-fg-2 md:border-r md:border-b-0 md:px-5 md:first:pl-0 md:last:border-r-0"
                    style={{ opacity: `clamp(0, calc((var(--k) - 0.72) * 14 - ${i}), 1)` }}
                  >
                    <span className="mono pt-[3px] text-[11px] text-thread">{pad(i + 1)}</span> {q}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Trace: the loom */}
        <section data-chapter className="chapter flex min-h-[140dvh] items-center">
          <div className="mx-auto grid w-full max-w-[1400px] gap-12 px-5 sm:px-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)] xl:items-center xl:gap-16">
            <div className="copy">
              <Eyebrow n={3}>Trace</Eyebrow>
              <Heading lines={["Commits find", <em key="e">their requirement.</em>]} />
              <p className="reveal mt-7 max-w-[46ch] text-[17px] leading-relaxed text-fg-2">
                Write <span className="mono text-[14px] text-fg">LF-12</span> in a commit message and it links itself. Anything else gets a suggested match, and a teammate confirms it. Try it.
              </p>
            </div>
            <TraceDemo />
          </div>
        </section>

        {/* Receipts: the ropes */}
        <section data-chapter className="chapter flex min-h-[140dvh] items-center">
          <div className="mx-auto grid w-full max-w-[1400px] items-center gap-14 px-5 sm:px-10 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="copy">
              <Eyebrow n={4}>Receipts</Eyebrow>
              <Heading lines={["A receipt for", <em key="e">every person.</em>]} />
              <p className="reveal mt-7 max-w-[44ch] text-[17px] leading-relaxed text-fg-2">
                Each line is a commit, task or decision you can open. A teammate can dispute any line, and the receipt keeps both sides.
              </p>
              <dl className="reveal mono mt-10 grid max-w-[460px] grid-cols-3 border-t border-line pt-5 text-[11px] tracking-[0.06em] text-fg-3 uppercase">
                {[
                  ["Lines", "14"],
                  ["Disputed", "1"],
                  ["Share", "28%"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className="figure mt-2 text-[40px] tracking-normal text-fg normal-case">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="receipt-print" data-no-drag>
              <div className="receipt-paper px-6 pt-8 pb-10 font-mono text-[#1c1a15]">
                <p className="text-center text-[10.5px] tracking-[0.3em]">TRACE CONTRIBUTION RECEIPT</p>
                <p className="mt-3 text-center font-serif text-[30px] leading-none">Meera Iyer</p>
                <p className="mt-1 text-center text-[10.5px] opacity-60">Campus Lost &amp; Found</p>
                <div className="receipt-rule" />
                {RECEIPT.map((l, i) => (
                  <div key={l.kind} className="mb-3 text-[11.5px]" style={{ opacity: `calc(var(--k) * 6 - ${i + 0.5})` }}>
                    <div className="flex items-start gap-2">
                      <span className="flex-1 leading-snug">
                        <span className="block text-[9.5px] opacity-55">{l.kind}</span>
                        {l.title}
                      </span>
                      <span className="text-[10.5px]">{l.detail}</span>
                    </div>
                    {l.disputed && <p className="mt-1.5 border-l-2 border-[#c22a17] pl-2 text-[10.5px] leading-snug">DISPUTED. {l.disputed}</p>}
                  </div>
                ))}
                <div className="receipt-rule" />
                <div className="flex items-baseline justify-between text-[12px] font-semibold" style={{ opacity: "calc(var(--k) * 6 - 5)" }}>
                  <span>SHARE OF TEAM WORK</span>
                  <span className="font-serif text-[30px] font-normal">28%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Viva: the helix */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 text-center sm:px-10">
            <div className="copy mx-auto max-w-[960px]">
              <Eyebrow n={5} center>
                Viva
              </Eyebrow>
              <Heading lines={["Practise the parts", <em key="e">you didn&apos;t build.</em>]} />
              <p className="reveal mx-auto mt-7 max-w-[52ch] text-[17px] leading-relaxed text-fg-2">
                Questions come from your teammates&apos; code, the team&apos;s decisions and the requirements you never touched. Answers come from your own record.
              </p>
            </div>
            <div className="viva-card reveal mx-auto mt-14 max-w-[540px] text-left" data-no-drag>
              <div className="viva-inner relative h-[290px]">
                <div className="viva-face absolute inset-0 flex flex-col justify-between rounded-[18px] border border-line bg-bg-2 p-7">
                  <p className="mono flex justify-between text-[11px] tracking-[0.06em] text-fg-3 uppercase">
                    <span>Decision D-7</span>
                    <span>Made by Aarav</span>
                  </p>
                  <p className="display text-[clamp(26px,3vw,34px)] leading-[1.08]">The team chose email only for match alerts. Why, and what did you give up?</p>
                  <p className="mono text-[11px] tracking-[0.06em] text-fg-3 uppercase">Say it out loud, then scroll to flip</p>
                </div>
                <div className="viva-face viva-back absolute inset-0 flex flex-col justify-between rounded-[18px] bg-[#ece8de] p-7 text-[#171612]">
                  <p className="mono text-[11px] tracking-[0.06em] text-[#8f8a7d] uppercase">From the record</p>
                  <p className="text-[15.5px] leading-relaxed">
                    Push notifications need a service worker and Firebase Cloud Messaging setup we don&apos;t have time for before the demo. Email alerts for matches are enough for v1.
                  </p>
                  <p className="text-[12.5px] text-[#5e5a50]">Considered instead: push notifications (Kabir&apos;s plan)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mentors: the field of knots */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="copy max-w-[820px]">
              <Eyebrow n={6}>Mentors</Eyebrow>
              <Heading lines={["Every team", <em key="e">on one page.</em>]} />
              <p className="reveal mt-7 max-w-[50ch] text-[17px] leading-relaxed text-fg-2">
                Mentors see how much each team has traced, who is carrying the work, who went quiet and which decisions contradict each other.
              </p>
            </div>
            <div className="reveal copy mt-14 border-t border-line" data-no-drag>
              <div className="mono hidden grid-cols-[minmax(0,1.3fr)_220px_110px_minmax(0,1.3fr)] gap-6 py-3 text-[10.5px] tracking-[0.08em] text-fg-3 uppercase md:grid">
                <span>Team</span>
                <span>Traced</span>
                <span>Balance</span>
                <span>Needs attention</span>
              </div>
              {TEAMS.map((t, i) => (
                <div
                  key={t.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-t border-line py-4 md:grid-cols-[minmax(0,1.3fr)_220px_110px_minmax(0,1.3fr)]"
                  style={{ opacity: `calc(var(--k) * 6 - ${i})` }}
                >
                  <span className="flex items-center gap-3 text-[15px]">
                    <span className="mono w-7 text-[10.5px] text-fg-3">{t.key}</span>
                    {t.name}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="figure w-14 text-[30px]">{t.traced}%</span>
                    <span className="hidden h-px w-28 bg-line-2 md:block">
                      <span className="block h-px bg-thread" style={{ width: `calc(${t.traced}% * min(1, var(--k) * 1.4))` }} />
                    </span>
                  </span>
                  <span className="mono hidden text-[13px] text-fg-2 md:block">{t.balance}%</span>
                  <span className={`col-span-2 pl-10 text-[13.5px] md:col-span-1 md:pl-0 ${t.flag.includes("not linked") ? "text-fg-2" : "text-warn"}`}>{t.flag}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Start: one line */}
        <section data-chapter className="chapter flex min-h-dvh flex-col items-center justify-center text-center">
          <div className="copy px-5">
            <Eyebrow n={7} center>
              Start
            </Eyebrow>
            <h2 className="reveal-lines display mt-6 text-[clamp(52px,8.6vw,150px)] leading-[0.9]">
              <span className="line" style={{ ["--i" as string]: 0 }}>
                <span>Set up your team</span>
              </span>
              <span className="line" style={{ ["--i" as string]: 1 }}>
                <span>
                  <em className="pr-[0.05em] text-thread">in two minutes.</em>
                </span>
              </span>
            </h2>
            <p className="reveal mx-auto mt-8 max-w-[44ch] text-[17px] leading-relaxed text-fg-2">Create a workspace, connect a public GitHub repo, then invite your team and your mentor. Free for student teams.</p>
            <div className="reveal mt-10 flex flex-wrap justify-center gap-3">
              <Link href={start} data-magnet className="magnet group flex items-center gap-2 rounded-full bg-thread px-7 py-3.5 text-[15px] font-medium text-white">
                Create a workspace
                <Icon name="arrow" size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <DemoButton as="mentor">See the mentor demo</DemoButton>
            </div>
          </div>
        </section>
      </main>

      <footer data-foot className="relative z-10 overflow-hidden border-t border-line bg-bg px-5 pt-14 pb-6 sm:px-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto]">
            <p className="max-w-[34ch] text-[15px] leading-relaxed text-fg-2">
              Trace is a traceability workspace for student software teams and their mentors. Stories, commits, decisions and people, on one thread.
            </p>
            <ul className="mono grid grid-cols-2 gap-x-12 gap-y-2 text-[12px] tracking-[0.04em] text-fg-2 uppercase">
              <li>
                <DemoButton as="student" variant="text">
                  Student demo
                </DemoButton>
              </li>
              <li>
                <a className="transition-colors hover:text-fg" href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer">
                  Source
                </a>
              </li>
              <li>
                <DemoButton as="mentor" variant="text">
                  Mentor demo
                </DemoButton>
              </li>
              <li>
                <Link className="transition-colors hover:text-fg" href={start}>
                  Sign in
                </Link>
              </li>
              <li>
                <button data-jump="-1" className="uppercase transition-colors hover:text-fg">
                  Back to top ↑
                </button>
              </li>
            </ul>
          </div>
          <div aria-hidden className="relative mt-12 select-none">
            <p className="display text-[clamp(120px,33vw,540px)] leading-[0.74] text-transparent [-webkit-text-stroke:1px_rgb(236_232_222/0.2)]">trace.</p>
            <p className="display absolute inset-0 text-[clamp(120px,33vw,540px)] leading-[0.74] [clip-path:inset(calc((1-var(--f,0))*100%)_0_0_0)]">
              trace<span className="text-thread">.</span>
            </p>
          </div>
          <div className="mono mt-8 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-[11px] tracking-[0.06em] text-fg-3 uppercase">
            <span>&copy; 2026 Trace</span>
            <span>Designed and built by Dhruv Sonar</span>
            <span>NMIMS Hyderabad</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ n, center = false, children }: { n: number; center?: boolean; children: ReactNode }) {
  return (
    <p className={`reveal eyebrow flex items-center gap-3 ${center ? "justify-center" : ""}`}>
      <span className="text-thread">({pad(n)})</span>
      <span className="h-px w-10 bg-line-2" />
      <span>{children}</span>
    </p>
  );
}

function Heading({ lines }: { lines: ReactNode[] }) {
  return (
    <h2 className="reveal-lines display mt-6 text-[clamp(46px,6.6vw,112px)] leading-[0.92] [&_em]:pr-[0.05em]">
      {lines.map((l, i) => (
        <span key={i} className="line" style={{ ["--i" as string]: i }}>
          <span>{l}</span>
        </span>
      ))}
    </h2>
  );
}

/** The real linker running on the demo grid: type a commit message and watch it find its story. */
function TraceDemo() {
  const [msg, setMsg] = useState(TRY[0]);
  const { hits, note } = useMemo(() => {
    if (!msg.trim()) return { hits: [] as string[], note: { tone: "idle", text: "Type a commit message, or pick one below." } };
    const named = refs(msg, "LF").map((n) => `LF-${n}`);
    if (named.length) {
      const known = named.filter((id) => GRID.some((g) => g.id === id));
      return {
        hits: known,
        note: { tone: "link", text: `Names ${named.join(", ")}. Linked and confirmed, no one has to check it.` },
      };
    }
    const s = suggest({ message: msg, files: [] }, STORIES, []);
    if (s?.story_id) {
      return {
        hits: [s.story_id],
        note: { tone: "suggest", text: `Suggests ${s.story_id}: shares “${s.shared.join("”, “")}”. A teammate confirms or rejects it.` },
      };
    }
    return { hits: [], note: { tone: "none", text: "No confident match. It waits in Commits until someone links it." } };
  }, [msg]);

  return (
    <div className="reveal copy" data-no-drag>
      <label className="block rounded-[18px] border border-line-2 bg-bg-2 p-5 transition-colors focus-within:border-thread sm:p-6">
        <span className="eyebrow block">Commit message</span>
        <span className="mono mt-3 flex items-baseline gap-2 text-[14px]">
          <span className="shrink-0 text-fg-3">$ git commit -m</span>
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            spellCheck={false}
            maxLength={90}
            className="min-w-0 flex-1 bg-transparent text-fg caret-thread outline-none"
            aria-label="Commit message"
          />
        </span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {TRY.map((t) => (
          <button
            key={t}
            onClick={() => setMsg(t)}
            className={`mono rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-300 ${msg === t ? "border-fg-3 text-fg" : "border-line text-fg-3 hover:border-line-2 hover:text-fg-2"}`}
          >
            {t.length > 30 ? t.slice(0, 29) + "…" : t}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-5 flex min-h-[44px] gap-3 text-[14px] leading-snug text-fg-2">
        <span
          className={`mt-[5px] size-2 shrink-0 rounded-full ${note.tone === "link" ? "bg-thread" : note.tone === "suggest" ? "border border-thread" : "border border-fg-3"}`}
        />
        {note.text}
      </p>
      <div className="mt-4 border-t border-line">
        {GRID.map((r) => {
          const hit = hits.includes(r.id);
          return (
            <div
              key={r.id}
              className={`grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-3 text-[13.5px] transition-colors duration-500 sm:grid-cols-[56px_minmax(0,1fr)_48px_80px] ${hit ? "bg-thread-soft" : ""}`}
            >
              <span className={`mono pl-2 text-[11.5px] transition-colors duration-500 ${hit ? "text-thread-ink" : "text-fg-3"}`}>{r.id}</span>
              <span className="truncate">{r.title}</span>
              <span className="mono hidden text-[12px] text-fg-3 sm:block">{r.tasks}</span>
              <span className={`mono pr-2 text-right text-[11px] tracking-[0.04em] uppercase ${STATE_STYLE[r.state]}`}>{hit ? "← commit" : r.state}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DemoButton({ as, variant = "ghost", children }: { as: "student" | "mentor"; variant?: "primary" | "ghost" | "pill" | "text"; children: ReactNode }) {
  const cls = {
    primary: "magnet group flex items-center gap-2 rounded-full bg-fg px-6 py-3 text-[15px] font-medium text-bg",
    ghost: "magnet rounded-full border border-line-2 px-7 py-3.5 text-[15px] font-medium hover:border-fg-3",
    pill: "flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-bg transition-transform duration-300 hover:scale-[1.03]",
    text: "uppercase transition-colors hover:text-fg",
  }[variant];
  return (
    <form action="/auth/demo" method="post" className="contents">
      <input type="hidden" name="as" value={as} />
      <button data-magnet={variant === "primary" || variant === "ghost" ? "" : undefined} className={cls}>
        {variant === "pill" && <span className="size-1.5 animate-pulse rounded-full bg-thread" />}
        {children}
        {variant === "primary" && <Icon name="arrow" size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />}
      </button>
    </form>
  );
}

/** Counts to 100 no faster than a beat, draws the thread across, then wipes up and away. */
function Loader({ progress, onDone }: { progress: number; onDone: () => void }) {
  const [n, setN] = useState(0);
  const [exit, setExit] = useState(false);
  const target = useRef(0);
  const done = useRef(onDone);
  useEffect(() => {
    target.current = progress * 100;
  }, [progress]);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    let raf = 0;
    let v = 0;
    let timer = 0;
    const step = () => {
      v = Math.min(target.current, v + Math.max(0.25, (target.current - v) * 0.06));
      setN(v);
      if (v >= 100) {
        timer = window.setTimeout(() => {
          setExit(true);
          done.current();
        }, 220);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-hidden className={`loader fixed inset-0 z-50 flex flex-col justify-between bg-bg px-5 py-6 sm:px-10 sm:py-8 ${exit ? "loader-out" : ""}`}>
      <div className="mono flex justify-between text-[11px] tracking-[0.08em] text-fg-3 uppercase">
        <span className="flex items-center gap-2 text-fg">
          <Mark className="text-thread" /> trace
        </span>
        <span>Untangling the work</span>
      </div>
      <div className="relative h-px w-full bg-line">
        <div className="absolute inset-0 origin-left bg-thread" style={{ transform: `scaleX(${n / 100})` }} />
      </div>
      <div className="flex items-end justify-between">
        <span className="mono text-[11px] tracking-[0.08em] text-fg-3 uppercase">Every requirement, traced</span>
        <span className="figure text-[clamp(72px,13vw,200px)] leading-[0.8] text-fg">{pad(Math.floor(n))}</span>
      </div>
    </div>
  );
}

/** Without WebGL2 or with reduced motion: a still drawing of the tangle. */
function Poster() {
  return (
    <svg aria-hidden className="fixed inset-0 h-dvh w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * 180;
        const r = 250 + (i % 7) * 16;
        return <ellipse key={i} cx={1120} cy={380} rx={r} ry={r * (0.32 + (i % 5) * 0.13)} transform={`rotate(${a} 1120 380)`} stroke="rgb(236 232 222 / 0.08)" fill="none" />;
      })}
      <ellipse cx={1120} cy={380} rx={290} ry={150} transform="rotate(-24 1120 380)" stroke="#ee3524" strokeWidth={2} fill="none" />
    </svg>
  );
}
