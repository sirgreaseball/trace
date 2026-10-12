"use client";

import Lenis from "lenis";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mark } from "../brand";
import { ThreadEngine, canRunGL } from "./engine";

// Each chapter of the page maps to one thread formation, in order:
// tangle, wild tangle, loom, ropes, helix, field of knots, line.

const GRID = [
  ["LF-1", "Sign in with college email", 0.12],
  ["LF-4", "Report a lost item", 0.3],
  ["LF-11", "Search and filter items", 0.5],
  ["LF-16", "Claim with a secret question", 0.68],
  ["LF-26", "Map of drop-off points", 2],
] as const;

const RECEIPT = [
  ["COMMIT 3c1e9a0 → LF-4", "photo upload to storage bucket", "+131 −4"],
  ["TASK LF-7", "Photo upload with compression", "done"],
  ["DECISION D-3", "Compress photos to WebP at 1280 px", "decided"],
  ["COMMIT 8d2f71b → LF-14", "item detail page", "+163 −0"],
  ["COMMIT b04c3e2 → LF-19", "match alert email template", "+96 −0"],
] as const;

const TEAMS = [
  ["LF", "Campus Lost & Found", 64, "1 open dispute"],
  ["MB", "Hostel Mess Feedback", 33, "Rohan is carrying 80% of the work"],
  ["LB", "Lab Slot Booking", 17, "No activity for 7 days"],
  ["CB", "Campus Carpool", 83, "Looks healthy"],
] as const;

export function Splash({ signedIn }: { signedIn: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "gl" | "poster">("loading");
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    const el = root.current!;
    const sections = [...el.querySelectorAll<HTMLElement>("[data-chapter]")];
    const bar = el.querySelector<HTMLElement>("[data-progress]")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nogl = new URLSearchParams(location.search).has("nogl");
    const mobile = innerWidth < 768;
    const gl = !reduced && !nogl && canRunGL();

    let engine: ThreadEngine | null = null;
    if (gl && canvas.current) {
      try {
        engine = new ThreadEngine(canvas.current, {
          threads: mobile ? 170 : 380,
          samples: mobile ? 130 : 180,
          dpr: Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75),
          mobile,
        });
      } catch {
        engine = null;
      }
    }
    setMode(engine ? "gl" : "poster");

    const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });

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

    const onPointer = (e: PointerEvent) => engine?.setPointer(e.clientX, e.clientY, innerWidth, innerHeight);
    const onLeave = () => engine?.clearPointer();
    let down: { x: number; y: number; moved: boolean } | null = null;
    const interactive = (t: EventTarget | null) => t instanceof Element && !!t.closest("a, button, input, [data-no-drag]");
    const onDown = (e: PointerEvent) => {
      if (interactive(e.target) || e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 4) down.moved = true;
      if (down.moved && e.pointerType === "mouse") engine?.drag(e.movementX);
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.moved) engine?.pluck(e.clientX, e.clientY, innerWidth, innerHeight);
      down = null;
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
      if (engine) {
        engine.setChapter(chapterAt(y));
        engine.render(y / vh * 0.35, false);
      }
      if (visible) raf = requestAnimationFrame(tick);
    };

    let cancelled = false;
    (async () => {
      setLoaded(0.25);
      await document.fonts?.ready;
      if (cancelled) return;
      setLoaded(0.55);
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

  return (
    <div ref={root} className="splash relative overflow-x-clip bg-[#0b0b0c] text-[#ece9e2] selection:bg-[#ff5233]">
      <canvas ref={canvas} aria-hidden className={`fixed inset-0 h-dvh w-full transition-opacity duration-[1200ms] ${mode === "gl" && loaded === 1 ? "opacity-100" : "opacity-0"}`} />
      {mode === "poster" && <Poster />}
      <div aria-hidden className="splash-grain pointer-events-none fixed inset-0" />
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_80%_at_20%_50%,rgb(11_11_12/0.82),transparent_60%)] max-md:bg-[linear-gradient(to_bottom,rgb(11_11_12/0.2),rgb(11_11_12/0.7))]" />

      <Loader progress={loaded} done={loaded === 1} />

      <header className="fixed inset-x-0 top-0 z-30">
        <div className="h-px w-full origin-left bg-[#ff5233]" data-progress style={{ transform: "scaleX(0)" }} />
        <nav className="mx-auto flex max-w-[1400px] items-center justify-between bg-gradient-to-b from-[#0b0b0c] via-[#0b0b0c]/70 to-transparent px-5 py-4 sm:px-10 sm:py-6">
          <Link href="/" className="flex items-center gap-1.5 text-[17px] font-semibold tracking-[-0.03em]" aria-label="Trace">
            <Mark className="text-[#ff5233]" /> trace
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-full px-3 py-1.5 text-[13px] text-[#a3a097] transition-colors hover:text-[#ece9e2] sm:block">
              How it works
            </a>
            <a href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-1.5 text-[13px] text-[#a3a097] transition-colors hover:text-[#ece9e2] sm:block">
              GitHub
            </a>
            <Link href={signedIn ? "/home" : "/enter"} className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] font-medium backdrop-blur transition-colors hover:border-white/40">
              {signedIn ? "Open Trace" : "Sign in"}
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* 0. Hero: the tangle */}
        <section data-chapter className="chapter flex min-h-dvh items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="max-w-[780px]">
              <p className="hero-in mono mb-6 text-[11px] tracking-[0.28em] text-[#a3a097] uppercase" style={{ animationDelay: "0.15s" }}>
                For student software teams
              </p>
              <h1 className="hero-in text-[clamp(52px,9.2vw,150px)] leading-[0.88] font-semibold tracking-[-0.045em]" style={{ animationDelay: "0.25s" }}>
                Every requirement,
                <br />
                <span className="serif font-normal tracking-[-0.02em] text-[#ff5233]">traced.</span>
              </h1>
              <p className="hero-in mt-8 max-w-[520px] text-[17px] leading-relaxed text-[#a3a097] sm:text-[19px]" style={{ animationDelay: "0.4s" }}>
                Stories, tasks, commits and decisions, tied to the people behind them. So your whole team knows who built what, and why, long before the viva.
              </p>
              <div className="hero-in mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.55s" }}>
                <DemoButton as="student" primary>
                  Try the live demo
                </DemoButton>
                <Link href={signedIn ? "/home" : "/enter"} className="rounded-full border border-white/15 px-6 py-3 text-[15px] font-medium transition-colors hover:border-white/40">
                  Start your team
                </Link>
              </div>
            </div>
          </div>
          <div className="hero-in pointer-events-none absolute inset-x-0 bottom-6 mx-auto flex max-w-[1400px] items-end justify-between px-5 text-[11px] text-[#6d6a63] sm:px-10" style={{ animationDelay: "0.9s" }}>
            <span className="mono tracking-[0.2em] uppercase">Scroll to untangle</span>
            <span className="mono hidden tracking-[0.2em] uppercase md:block">Drag to turn · click to pluck</span>
          </div>
        </section>

        {/* 1. The problem: a wilder tangle */}
        <section id="how" data-chapter className="chapter flex min-h-[120dvh] items-center">
          <div className="reveal copy mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <p className="mono mb-5 text-[11px] tracking-[0.28em] text-[#ff5233] uppercase">01 — The problem</p>
            <h2 className="max-w-[900px] text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.04em]">
              Group projects are a <span className="serif font-normal">tangle.</span>
            </h2>
            <p className="mt-8 max-w-[560px] text-[17px] leading-relaxed text-[#a3a097]">
              Four people, one repo, eight weeks. By the viva nobody can say who built search, why the database changed, or which requirement that commit was for. Your mentor can&apos;t either.
            </p>
            <ul className="mono mt-10 space-y-3 text-[14px] text-[#ece9e2]/80">
              {["Who actually built the claim flow?", "Why did we switch to email alerts?", "Is “report a lost item” really done?"].map((q, i) => (
                <li key={q} className="flex items-center gap-3" style={{ opacity: `calc(var(--k) * 3 - ${i})` }}>
                  <span className="h-px w-6 bg-[#ff5233]" /> {q}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 2. Trace: the loom */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="reveal mx-auto grid w-full max-w-[1400px] gap-12 px-5 sm:px-10 lg:grid-cols-[1fr_440px]">
            <div className="copy">
              <p className="mono mb-5 text-[11px] tracking-[0.28em] text-[#ff5233] uppercase">02 — Trace</p>
              <h2 className="max-w-[760px] text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.04em]">
                Pull every thread <span className="serif font-normal">straight.</span>
              </h2>
              <p className="mt-8 max-w-[540px] text-[17px] leading-relaxed text-[#a3a097]">
                Name a story in a commit, like <span className="mono text-[#ece9e2]">LF-12</span>, and it ties itself in. Everything else gets a suggested match that a person confirms. What you get is a live traceability matrix, the one your faculty already knows how to read.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111113]/80 p-2 backdrop-blur-md" data-no-drag>
              <p className="mono flex justify-between px-3 pt-2 pb-3 text-[10.5px] tracking-[0.2em] text-[#6d6a63] uppercase">
                <span>Trace grid</span>
                <span>Campus Lost &amp; Found</span>
              </p>
              {GRID.map(([id, title, at]) => (
                <div key={id} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-t border-white/[0.06] px-3 py-2.5 text-[13px]">
                  <span className="mono text-[11px] text-[#6d6a63]">{id}</span>
                  <span className="truncate">{title}</span>
                  <span className="grid-state relative h-5 w-[78px] overflow-hidden rounded-md text-[11px]" style={{ ["--at" as string]: at }}>
                    <span className="absolute inset-0 grid place-items-center rounded-md bg-[#2a2313] text-[#f2b544]">Untraced</span>
                    <span className="traced absolute inset-0 grid place-items-center rounded-md bg-[#33160f] text-[#ff7357]">● Traced</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Receipts: the ropes */}
        <section data-chapter className="chapter flex min-h-[140dvh] items-center">
          <div className="reveal mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 sm:px-10 lg:grid-cols-[1fr_420px]">
            <div className="copy">
              <p className="mono mb-5 text-[11px] tracking-[0.28em] text-[#ff5233] uppercase">03 — Receipts</p>
              <h2 className="max-w-[760px] text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.04em]">
                Who did what, <span className="serif font-normal">with receipts.</span>
              </h2>
              <p className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-[#a3a097]">
                One receipt per person, and every line is a commit, task or decision you can open. Think a line is wrong? Dispute it, and the receipt shows both sides. No AI writes a single word of it.
              </p>
            </div>
            <div className="receipt-print relative" data-no-drag>
              <div className="receipt-paper px-6 pt-7 pb-9 font-[family-name:var(--font-geist-mono)] text-[#1c1a15]">
                <p className="text-center text-[10.5px] tracking-[0.3em]">TRACE · CONTRIBUTION RECEIPT</p>
                <p className="mt-2 text-center font-sans text-[20px] font-semibold tracking-tight">Meera Iyer</p>
                <p className="text-center text-[10.5px] opacity-60">Campus Lost &amp; Found · SE Lab</p>
                <div className="receipt-rule" />
                {RECEIPT.map(([kind, title, detail], i) => (
                  <div key={i} className="mb-2.5 flex items-start gap-2 text-[11.5px]" style={{ opacity: `calc(var(--k) * 6 - ${i + 1})` }}>
                    <span className="flex-1 leading-snug">
                      <span className="block text-[9.5px] opacity-55">{kind}</span>
                      {title}
                    </span>
                    <span className="text-[10.5px]">{detail}</span>
                  </div>
                ))}
                <div className="receipt-rule" />
                <div className="flex items-baseline justify-between text-[12px] font-semibold" style={{ opacity: "calc(var(--k) * 6 - 5)" }}>
                  <span>SHARE OF TEAM WORK</span>
                  <span className="text-[20px]">28%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Viva: the helix */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="reveal mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 sm:px-10 lg:grid-cols-[440px_1fr]">
            <div className="viva-card order-2 lg:order-1" data-no-drag>
              <div className="viva-inner relative h-[300px]">
                <div className="viva-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111113]/85 p-7 backdrop-blur-md">
                  <p className="mono text-[10.5px] tracking-[0.2em] text-[#6d6a63] uppercase">Decision · D-7</p>
                  <p className="serif text-[28px] leading-snug">The team decided: email only for match alerts. Why, and what did you give up?</p>
                  <p className="text-[12px] text-[#6d6a63]">Kabir wrote the push plan. Aarav changed it. Can you explain both?</p>
                </div>
                <div className="viva-face viva-back absolute inset-0 flex flex-col justify-between rounded-2xl bg-[#ece9e2] p-7 text-[#17150f]">
                  <p className="mono text-[10.5px] tracking-[0.2em] text-[#8b867b] uppercase">From the record</p>
                  <p className="text-[16px] leading-relaxed">Push needs a service worker and Firebase Cloud Messaging set up before the demo. Email via Supabase is enough for v1.</p>
                  <p className="mono text-[11px] text-[#b92e0f]">D-7 · replaces D-6 · LF-19</p>
                </div>
              </div>
            </div>
            <div className="copy order-1 lg:order-2 lg:pl-10">
              <p className="mono mb-5 text-[11px] tracking-[0.28em] text-[#ff5233] uppercase">04 — Viva practice</p>
              <h2 className="max-w-[760px] text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.04em]">
                Know the parts <span className="serif font-normal">you didn&apos;t build.</span>
              </h2>
              <p className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-[#a3a097]">
                Trace asks you about your teammates&apos; code, the team&apos;s decisions and the requirements you never touched, then shows the answer from your own record. Practice only. Nothing is graded, nothing is shared.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Mentors: the field of knots */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="reveal mx-auto grid w-full max-w-[1400px] items-center gap-12 px-5 sm:px-10 lg:grid-cols-[1fr_520px]">
            <div className="copy">
              <p className="mono mb-5 text-[11px] tracking-[0.28em] text-[#ff5233] uppercase">05 — Mentors</p>
              <h2 className="max-w-[760px] text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.04em]">
                Forty teams. <span className="serif font-normal">Thirty seconds each.</span>
              </h2>
              <p className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-[#a3a097]">
                One table for every team you mentor: how much is traced, whether one person is carrying the rest, who went quiet, and which decisions contradict each other. Then open any team&apos;s full record.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111113]/80 p-2 backdrop-blur-md" data-no-drag>
              {TEAMS.map(([key, name, cov, flag], i) => (
                <div key={key} className="grid grid-cols-[36px_1fr_64px] items-center gap-3 border-b border-white/[0.06] px-3 py-3 last:border-0" style={{ opacity: `calc(var(--k) * 5 - ${i})` }}>
                  <span className="mono rounded bg-white/[0.06] py-0.5 text-center text-[10.5px] text-[#a3a097]">{key}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{name}</span>
                    <span className={`block truncate text-[11.5px] ${flag === "Looks healthy" ? "text-[#6d6a63]" : "text-[#f2b544]"}`}>{flag}</span>
                  </span>
                  <span className="text-right">
                    <span className="serif block text-[24px] leading-none">{cov}%</span>
                    <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-[#ff5233]" style={{ width: `calc(${cov}% * min(1, var(--k) * 1.4))` }} />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Enter: one line */}
        <section data-chapter className="chapter relative flex min-h-dvh flex-col items-center justify-center text-center">
          <div className="reveal copy px-5">
            <h2 className="text-[clamp(52px,10vw,170px)] leading-[0.86] font-semibold tracking-[-0.05em]">
              Pick up
              <br />
              <span className="serif font-normal text-[#ff5233]">the thread.</span>
            </h2>
            <p className="mx-auto mt-8 max-w-[460px] text-[17px] leading-relaxed text-[#a3a097]">Free for student teams. Make a workspace, connect your repo, invite your team and your mentor.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href={signedIn ? "/home" : "/enter"} className="rounded-full bg-[#ff5233] px-7 py-3.5 text-[15px] font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]">
                {signedIn ? "Open Trace" : "Start your team"}
              </Link>
              <DemoButton as="mentor">See the mentor view</DemoButton>
            </div>
          </div>
          <footer className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12px] text-[#6d6a63] sm:px-10">
            <span>Designed and built by Dhruv Sonar</span>
            <span className="flex gap-4">
              <a className="hover:text-[#ece9e2]" href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer">
                Source on GitHub
              </a>
              <Link className="hover:text-[#ece9e2]" href="/enter">
                Sign in
              </Link>
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function DemoButton({ as, primary = false, children }: { as: "student" | "mentor"; primary?: boolean; children: React.ReactNode }) {
  return (
    <form action="/auth/demo" method="post" className="contents">
      <input type="hidden" name="as" value={as} />
      <button
        className={
          primary
            ? "group flex items-center gap-2 rounded-full bg-[#ece9e2] px-6 py-3 text-[15px] font-semibold text-[#0b0b0c] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            : "rounded-full border border-white/15 px-7 py-3.5 text-[15px] font-medium transition-colors hover:border-white/40"
        }
      >
        {children}
        {primary && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </form>
  );
}

function Loader({ progress, done }: { progress: number; done: boolean }) {
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[#0b0b0c] transition-opacity duration-700 ${done ? "opacity-0" : "opacity-100"}`}>
      <svg width="120" height="40" viewBox="0 0 120 40" fill="none">
        <path
          d="M2 28H38c9 0 16-7 16-15 0-6-5-11-10.5-11S34 6.5 34 11.5C34 22 47 30 61 30h57"
          stroke="#ff5233"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="200"
          style={{ strokeDashoffset: 200 * (1 - progress), transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
    </div>
  );
}

/** Without WebGL2 or with reduced motion: a still drawing of the threads. */
function Poster() {
  return (
    <svg aria-hidden className="fixed inset-0 h-dvh w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const r = 260 + (i % 7) * 18;
        const cx = 1080;
        const cy = 500;
        return (
          <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * (0.35 + (i % 5) * 0.13)} transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`} stroke="rgb(236 233 226 / 0.09)" fill="none" />
        );
      })}
      <ellipse cx={1080} cy={500} rx={300} ry={160} transform="rotate(-24 1080 500)" stroke="#ff5233" strokeWidth={2} fill="none" />
    </svg>
  );
}

