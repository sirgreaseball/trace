"use client";

import Lenis from "lenis";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mark } from "../brand";
import { Icon } from "../icons";
import { ThreadEngine, canRunGL, renderScale } from "./engine";

// Each chapter of the page maps to one thread formation, in order:
// tangle, wild tangle, loom, ropes, helix, field of knots, line.
const RAIL = ["Intro", "The problem", "Trace", "Receipts", "Viva", "Mentors", "Start"];

// Everything below is the live demo data (scripts/seed-demo.ts prints it).
const GRID = [
  { id: "LF-1", title: "Sign in with college email", state: "Traced", tasks: "2/2", commits: 4 },
  { id: "LF-4", title: "Report a lost item", state: "Traced", tasks: "3/3", commits: 4 },
  { id: "LF-11", title: "Search and filter items", state: "Building", tasks: "1/2", commits: 5 },
  { id: "LF-16", title: "Claim an item with a secret question", state: "Building", tasks: "1/2", commits: 2 },
  { id: "LF-23", title: "Moderation queue for the security office", state: "Planned", tasks: "0/2", commits: 0 },
  { id: "LF-26", title: "Map of drop-off points", state: "Untraced", tasks: "-", commits: 0 },
] as const;

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
  Traced: "bg-[#ff5233]/12 text-[#ff7a5e]",
  Building: "bg-white/[0.07] text-[#d4d4d6]",
  Planned: "bg-white/[0.04] text-[#a1a1a4]",
  Untraced: "bg-[#f2b544]/10 text-[#f2b544]",
};

export function Splash() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "gl" | "poster">("loading");
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    const el = root.current!;
    const sections = [...el.querySelectorAll<HTMLElement>("[data-chapter]")];
    const bar = el.querySelector<HTMLElement>("[data-progress]")!;
    const marker = el.querySelector<HTMLElement>("[data-rail-marker]");
    const railBox = marker?.parentElement ?? null;
    const railItems = [...el.querySelectorAll<HTMLElement>("[data-rail-item]")];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    // Chapter rail: jump to a chapter.
    const onRail = (e: Event) => {
      const i = railItems.indexOf(e.currentTarget as HTMLElement);
      const y = Math.max(0, anchors[i] ?? 0);
      if (lenis) lenis.scrollTo(y, { duration: 1.6 });
      else scrollTo({ top: y });
    };
    railItems.forEach((r) => r.addEventListener("click", onRail));

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

    const onPointer = (e: PointerEvent) => engine?.setPointer(e.clientX, e.clientY);
    const onLeave = () => engine?.clearPointer();
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

    // The underline slides between chapter tabs in step with the formations.
    const placeMarker = (c: number) => {
      if (!marker || !railBox || railItems.length === 0 || railBox.offsetParent === null) return;
      const i = Math.min(Math.floor(c), railItems.length - 1);
      const j = Math.min(i + 1, railItems.length - 1);
      const f = c - i;
      const a = railItems[i];
      const b = railItems[j];
      const left = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f;
      const width = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f;
      marker.style.transform = `translate3d(${left}px, 0, 0) scaleX(${width})`;
    };
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
      const c = chapterAt(y);
      placeMarker(c);
      const active = Math.round(c);
      railItems.forEach((r, i) => r.toggleAttribute("data-active", i === active));
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
    <div ref={root} className="splash relative overflow-x-clip bg-[#0b0b0c] text-[#ededeb] selection:bg-[#ff5233] selection:text-white">
      <canvas ref={canvas} aria-hidden className={`fixed inset-0 h-dvh w-full transition-opacity duration-[1400ms] ${mode === "gl" && loaded === 1 ? "opacity-100" : "opacity-0"}`} />
      {mode === "poster" && <Poster />}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(110%_75%_at_12%_85%,rgb(11_11_12/0.86),transparent_58%)] max-md:bg-[linear-gradient(to_bottom,rgb(11_11_12/0.1),rgb(11_11_12/0.72))]" />

      <Loader progress={loaded} done={loaded === 1} />

      <header className="fixed inset-x-0 top-0 z-30">
        <div className="h-px w-full origin-left bg-[#ff5233]" data-progress style={{ transform: "scaleX(0)" }} />
        <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between bg-gradient-to-b from-[#0b0b0c] via-[#0b0b0c]/75 to-transparent px-5 sm:h-[72px] sm:px-10">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.03em]" aria-label="Trace home">
            <Mark className="text-[#ff5233]" /> trace
          </Link>
          <ul aria-label="Chapters" className="rail relative hidden items-center lg:flex">
            {RAIL.map((r) => (
              <li key={r}>
                <button data-rail-item className="rail-item px-3 py-2 text-[13px] text-[#6b6b70] transition-colors duration-300 hover:text-[#ededeb]">
                  {r}
                </button>
              </li>
            ))}
            <span data-rail-marker aria-hidden className="absolute bottom-0.5 left-0 h-px w-px origin-left bg-[#ff5233]" />
          </ul>
          <div className="flex items-center gap-1 sm:gap-2">
            <a
              href="https://github.com/sirgreaseball/trace"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full px-3 py-2 text-[13px] text-[#a1a1a4] transition-colors duration-200 hover:text-[#ededeb] sm:block"
            >
              Source
            </a>
            <Link href={start} className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium transition-colors duration-200 hover:border-white/40">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Intro: the tangle */}
        <section data-chapter className="chapter min-h-dvh">
          <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col justify-end px-5 pt-24 pb-10 sm:px-10 sm:pb-14">
            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
              <h1 className="hero-title text-[clamp(44px,6.6vw,112px)] leading-[0.92] font-semibold tracking-[-0.05em]">
                <span className="line">
                  <span style={{ animationDelay: "0.1s" }}>Every requirement,</span>
                </span>
                <span className="line">
                  <span className="text-[#ff5233]" style={{ animationDelay: "0.22s" }}>
                    traced.
                  </span>
                </span>
              </h1>
              <div className="hero-in copy lg:pb-4" style={{ animationDelay: "0.45s" }}>
                <p className="max-w-[36ch] text-[17px] leading-relaxed text-[#a1a1a4]">Trace links your team&apos;s stories, commits and decisions to the people behind them.</p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <DemoButton as="student" primary>
                    Try the demo
                  </DemoButton>
                  <Link href={start} data-magnet className="magnet rounded-full border border-white/15 px-6 py-3 text-[15px] font-medium hover:border-white/40">
                    Create a workspace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The problem: a wilder tangle */}
        <section data-chapter className="chapter flex min-h-[120dvh] items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="copy max-w-[820px]">
              <h2 className="reveal-lines text-[clamp(44px,6.8vw,104px)] leading-[0.95] font-semibold tracking-[-0.045em]">
                <span className="line" style={{ ["--i" as string]: 0 }}>
                  <span>Group projects</span>
                </span>
                <span className="line" style={{ ["--i" as string]: 1 }}>
                  <span className="text-[#6b6b70]">get tangled.</span>
                </span>
              </h2>
              <div className="reveal mt-8 max-w-[44ch]">
                <p className="text-[17px] leading-relaxed text-[#a1a1a4]">Four people, one repo, eight weeks. By the viva, nobody can say who built what, or why it changed.</p>
                <ul className="mt-8 space-y-3 text-[15px] text-[#d4d4d6]">
                  {["Who actually built the claim flow?", "Why did we switch to email alerts?", "Is “report a lost item” really done?"].map((q, i) => (
                    <li key={q} className="flex items-center gap-4" style={{ opacity: `calc(var(--k) * 3 - ${i})` }}>
                      <span className="h-px w-8 bg-[#ff5233]" /> {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Trace: the loom */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="copy max-w-[760px]">
              <h2 className="reveal-lines text-[clamp(40px,5.6vw,88px)] leading-[0.95] font-semibold tracking-[-0.045em]">
                <span className="line" style={{ ["--i" as string]: 0 }}>
                  <span>Commits find</span>
                </span>
                <span className="line" style={{ ["--i" as string]: 1 }}>
                  <span>their requirement.</span>
                </span>
              </h2>
              <p className="reveal mt-7 max-w-[50ch] text-[17px] leading-relaxed text-[#a1a1a4]">
                Write <span className="font-mono text-[15px] text-[#ededeb]">LF-12</span> in a commit message and it links itself. For everything else, Trace suggests a match and a teammate confirms it.
              </p>
            </div>
            <div className="reveal mt-12 max-w-[760px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113]" data-no-drag>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 text-[12px] text-[#6b6b70]">
                <span className="font-medium text-[#d4d4d6]">Trace grid</span>
                <span>Campus Lost &amp; Found, 4 of 10 stories traced</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="text-[11.5px] text-[#6b6b70]">
                      <th className="py-2.5 pr-3 pl-5 font-medium">ID</th>
                      <th className="py-2.5 pr-3 font-medium">Story</th>
                      <th className="py-2.5 pr-3 font-medium">Tasks</th>
                      <th className="py-2.5 pr-3 text-right font-medium">Commits</th>
                      <th className="py-2.5 pr-5 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRID.map((r, i) => (
                      <tr key={r.id} className="border-t border-white/[0.05]" style={{ opacity: `calc(var(--k) * 7 - ${i})` }}>
                        <td className="py-2.5 pr-3 pl-5 font-mono text-[11.5px] text-[#6b6b70]">{r.id}</td>
                        <td className="max-w-[260px] truncate py-2.5 pr-3">{r.title}</td>
                        <td className="py-2.5 pr-3 text-[#a1a1a4] tabular-nums">{r.tasks}</td>
                        <td className="py-2.5 pr-3 text-right text-[#a1a1a4] tabular-nums">{r.commits || "-"}</td>
                        <td className="py-2.5 pr-5">
                          <span className={`inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-medium ${STATE_STYLE[r.state]}`}>{r.state}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Receipts: the ropes */}
        <section data-chapter className="chapter flex min-h-[140dvh] items-center">
          <div className="mx-auto grid w-full max-w-[1400px] items-center gap-14 px-5 sm:px-10 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="copy">
              <h2 className="reveal-lines text-[clamp(40px,5.6vw,88px)] leading-[0.95] font-semibold tracking-[-0.045em]">
                <span className="line" style={{ ["--i" as string]: 0 }}>
                  <span>A receipt for</span>
                </span>
                <span className="line" style={{ ["--i" as string]: 1 }}>
                  <span>every person.</span>
                </span>
              </h2>
              <p className="reveal mt-7 max-w-[46ch] text-[17px] leading-relaxed text-[#a1a1a4]">
                Each line is a commit, task or decision you can open. A teammate can dispute any line, and the receipt keeps both sides.
              </p>
            </div>
            <div className="receipt-print" data-no-drag>
              <div className="receipt-paper px-6 pt-8 pb-10 font-mono text-[#1c1a15]">
                <p className="text-center text-[10.5px] tracking-[0.3em]">TRACE CONTRIBUTION RECEIPT</p>
                <p className="mt-3 text-center font-sans text-[21px] font-semibold tracking-[-0.02em]">Meera Iyer</p>
                <p className="text-center text-[10.5px] opacity-60">Campus Lost &amp; Found</p>
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
                    {l.disputed && <p className="mt-1.5 border-l-2 border-[#c2410c] pl-2 text-[10.5px] leading-snug">DISPUTED. {l.disputed}</p>}
                  </div>
                ))}
                <div className="receipt-rule" />
                <div className="flex items-baseline justify-between text-[12px] font-semibold" style={{ opacity: "calc(var(--k) * 6 - 5)" }}>
                  <span>SHARE OF TEAM WORK</span>
                  <span className="text-[21px]">28%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Viva: the helix */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 text-center sm:px-10">
            <div className="copy mx-auto max-w-[900px]">
              <h2 className="reveal-lines text-[clamp(40px,5.6vw,88px)] leading-[0.95] font-semibold tracking-[-0.045em]">
                <span className="line" style={{ ["--i" as string]: 0 }}>
                  <span>Practise the parts</span>
                </span>
                <span className="line" style={{ ["--i" as string]: 1 }}>
                  <span>you didn&apos;t build.</span>
                </span>
              </h2>
              <p className="reveal mx-auto mt-7 max-w-[52ch] text-[17px] leading-relaxed text-[#a1a1a4]">
                Questions come from your teammates&apos; code, the team&apos;s decisions and the requirements you never touched. Answers come from your own record.
              </p>
            </div>
            <div className="viva-card reveal mx-auto mt-12 max-w-[520px] text-left" data-no-drag>
              <div className="viva-inner relative h-[260px]">
                <div className="viva-face absolute inset-0 flex flex-col justify-between rounded-[14px] border border-white/[0.08] bg-[#111113] p-7">
                  <p className="text-[12px] text-[#6b6b70]">Decision D-7, made by Aarav</p>
                  <p className="text-[24px] leading-snug font-medium tracking-[-0.02em]">The team decided on email only for match alerts. Why, and what did you give up?</p>
                  <p className="text-[12px] text-[#6b6b70]">Say it out loud, then flip the card.</p>
                </div>
                <div className="viva-face viva-back absolute inset-0 flex flex-col justify-between rounded-[14px] bg-[#ededeb] p-7 text-[#141414]">
                  <p className="text-[12px] text-[#85858a]">From the record</p>
                  <p className="text-[15px] leading-relaxed">
                    Push notifications need a service worker and Firebase Cloud Messaging setup we don&apos;t have time for before the demo. Email alerts for matches are enough for v1.
                  </p>
                  <p className="text-[12px] text-[#56565a]">Considered instead: push notifications (Kabir&apos;s plan)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mentors: the field of knots */}
        <section data-chapter className="chapter flex min-h-[130dvh] items-center">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-10">
            <div className="copy max-w-[760px]">
              <h2 className="reveal-lines text-[clamp(40px,5.6vw,88px)] leading-[0.95] font-semibold tracking-[-0.045em]">
                <span className="line" style={{ ["--i" as string]: 0 }}>
                  <span>Every team</span>
                </span>
                <span className="line" style={{ ["--i" as string]: 1 }}>
                  <span>on one page.</span>
                </span>
              </h2>
              <p className="reveal mt-7 max-w-[50ch] text-[17px] leading-relaxed text-[#a1a1a4]">
                Mentors see how much each team has traced, who is carrying the work, who went quiet and which decisions contradict each other.
              </p>
            </div>
            <div className="reveal mt-12 overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#111113]" data-no-drag>
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="text-[11.5px] text-[#6b6b70]">
                    <th className="py-3 pr-4 pl-6 font-medium">Team</th>
                    <th className="py-3 pr-4 font-medium">Traced</th>
                    <th className="py-3 pr-4 font-medium">Balance</th>
                    <th className="py-3 pr-6 font-medium">Needs attention</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAMS.map((t, i) => (
                    <tr key={t.key} className="border-t border-white/[0.05]" style={{ opacity: `calc(var(--k) * 6 - ${i})` }}>
                      <td className="py-3.5 pr-4 pl-6">
                        <span className="mr-3 inline-block w-8 rounded bg-white/[0.06] py-0.5 text-center font-mono text-[10.5px] text-[#a1a1a4]">{t.key}</span>
                        <span className="font-medium">{t.name}</span>
                      </td>
                      <td className="w-44 py-3.5 pr-4">
                        <span className="flex items-center gap-3">
                          <span className="w-9 font-semibold tabular-nums">{t.traced}%</span>
                          <span className="block h-[3px] w-24 overflow-hidden rounded-full bg-white/10">
                            <span className="block h-full rounded-full bg-[#ff5233]" style={{ width: `calc(${t.traced}% * min(1, var(--k) * 1.4))` }} />
                          </span>
                        </span>
                      </td>
                      <td className="w-28 py-3.5 pr-4 text-[#a1a1a4] tabular-nums">{t.balance}%</td>
                      <td className={`py-3.5 pr-6 ${t.flag.includes("not linked") ? "text-[#a1a1a4]" : "text-[#f2b544]"}`}>{t.flag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Start: one line */}
        <section data-chapter className="chapter flex min-h-dvh flex-col items-center justify-center text-center">
          <div className="copy px-5">
            <h2 className="reveal-lines text-[clamp(48px,8vw,128px)] leading-[0.92] font-semibold tracking-[-0.05em]">
              <span className="line" style={{ ["--i" as string]: 0 }}>
                <span>Set up your team</span>
              </span>
              <span className="line" style={{ ["--i" as string]: 1 }}>
                <span className="text-[#ff5233]">in two minutes.</span>
              </span>
            </h2>
            <p className="reveal mx-auto mt-8 max-w-[44ch] text-[17px] leading-relaxed text-[#a1a1a4]">Create a workspace, connect a public GitHub repo, then invite your team and your mentor. Free for student teams.</p>
            <div className="reveal mt-10 flex flex-wrap justify-center gap-3">
              <Link href={start} data-magnet className="magnet rounded-full bg-[#ff5233] px-7 py-3.5 text-[15px] font-semibold text-white">
                Create a workspace
              </Link>
              <DemoButton as="mentor">See the mentor demo</DemoButton>
            </div>
          </div>
          <footer className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12px] text-[#6b6b70] sm:px-10">
            <span>Designed and built by Dhruv Sonar</span>
            <a className="transition-colors hover:text-[#ededeb]" href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
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
        data-magnet
        className={
          primary
            ? "magnet group flex items-center gap-2 rounded-full bg-[#ededeb] px-6 py-3 text-[15px] font-semibold text-[#0b0b0c]"
            : "magnet rounded-full border border-white/15 px-7 py-3.5 text-[15px] font-medium hover:border-white/40"
        }
      >
        {children}
        {primary && <Icon name="arrow" size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />}
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

/** Without WebGL2 or with reduced motion: a still drawing of the tangle. */
function Poster() {
  return (
    <svg aria-hidden className="fixed inset-0 h-dvh w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * 180;
        const r = 250 + (i % 7) * 16;
        return <ellipse key={i} cx={1120} cy={380} rx={r} ry={r * (0.32 + (i % 5) * 0.13)} transform={`rotate(${a} 1120 380)`} stroke="rgb(237 237 235 / 0.08)" fill="none" />;
      })}
      <ellipse cx={1120} cy={380} rx={290} ry={150} transform="rotate(-24 1120 380)" stroke="#ff5233" strokeWidth={2} fill="none" />
    </svg>
  );
}
