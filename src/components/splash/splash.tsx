"use client";

import Lenis from "lenis";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Mark, Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { isDark, subscribeTheme, ThemeToggle } from "@/components/shell";
import { refs, suggest } from "@/lib/trace";
import type { Story } from "@/lib/types";
import { canRunGL, RopeEngine, type Chapter } from "./rope";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round = (x: number) => Math.round(x * 1000) / 1000;

// One rope formation per chapter, in page order. Places are [x, y, scale, rx, ry, rz] in view units.
const CHAPTERS: Chapter[] = [
  { form: "knot", desk: [0.36, 0.04, 1, 0.25, -0.35, 0], phone: [0, 0.45, 0.44, 0.25, -0.35, 0] },
  { form: "tangle", desk: [0.5, 0, 0.78, 0, 0, 0], phone: [0, 0.55, 0.48, 0, 0, 0] },
  { form: "lanes", desk: [0, 0, 1, 0, 0, 0], phone: [0, 0.56, 1, 0, 0, 0] },
  { form: "weave", desk: [0.56, 0, 0.75, -0.9, 0, 0.35], phone: [0, 0.55, 0.55, -0.9, 0, 0.35] },
  { form: "rings", desk: [0.33, 0, 0.82, 0.4, 0.3, 0], phone: [0, 0.55, 0.5, 0.4, 0.3, 0] },
  { form: "bundle", desk: [0, -0.72, 1, 0, 0, 0], phone: [0, 0.55, 1, 0, 0, 0] },
  { form: "knot", desk: [0, 0.47, 0.46, 0.2, 0.3, 0], phone: [0, 0.45, 0.44, 0.2, 0.3, 0] },
];
const TITLES = ["Trace", "The problem", "Link", "Receipts", "Viva", "Mentors", "Start"];

const GRID = [
  { id: "LF-1", title: "Sign in with college email", state: "Traced" },
  { id: "LF-4", title: "Report a lost item", state: "Traced" },
  { id: "LF-11", title: "Search and filter items", state: "Building" },
  { id: "LF-16", title: "Claim an item with a secret question", state: "Building" },
  { id: "LF-23", title: "Moderation queue for the security office", state: "Planned" },
  { id: "LF-26", title: "Map of drop-off points", state: "Untraced" },
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

const PROBLEM = "Four people, one repo, eight weeks. By the viva, nobody can say *who built what,* or *why it changed.*";
const WORDS = (() => {
  let em = false;
  return PROBLEM.split(" ").map((w) => {
    if (w.startsWith("*")) em = true;
    const out = { w: w.replace(/\*/g, ""), em };
    if (w.endsWith("*")) em = false;
    return out;
  });
})();

type Note = { tone: "link" | "suggest" | "none"; text: string };

// The same linker the app runs on real commits: named IDs link outright, anything else gets a suggestion.
function link(msg: string): { hits: string[]; note: Note } {
  const named = refs(msg, "LF").map((n) => `LF-${n}`);
  if (named.length) {
    const known = named.filter((id) => GRID.some((g) => g.id === id));
    return { hits: known, note: { tone: "link", text: `Names ${named.join(", ")}. Linked and confirmed, no one has to check it.` } };
  }
  const s = suggest({ message: msg, files: [] }, STORIES, []);
  if (s?.story_id) return { hits: [s.story_id], note: { tone: "suggest", text: `Suggests ${s.story_id}: shares “${s.shared.join("”, “")}”. A teammate confirms or rejects it.` } };
  return { hits: [], note: { tone: "none", text: "No confident match. It waits in Commits until someone links it." } };
}

// Where each story's rope lane sits, as a percentage of the viewport height (see the lanes formation in rope.ts).
const HH = 10 * Math.tan(Math.PI / 12);
function laneTop(i: number, phone: boolean) {
  const K = phone ? 10 : 14,
    k = Math.round(1 + (i * (K - 3)) / 5),
    gap = phone ? 0.2 : 0.24;
  const y = ((K - 1) / 2 - k) * gap + CHAPTERS[2][phone ? "phone" : "desk"][1] * HH;
  return round(50 - (y / (2 * HH)) * 100);
}

function DemoButton({ as, className, children }: { as: "student" | "mentor"; className: string; children: ReactNode }) {
  return (
    <form action="/auth/demo" method="post" className="contents">
      <input type="hidden" name="as" value={as} />
      <button className={className}>{children}</button>
    </form>
  );
}

function Ids({ text }: { text: string }) {
  return <>{text.split(/(LF-\d+)/).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;
}

export function Splash() {
  const root = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const ind = useRef<HTMLDivElement>(null);
  const engine = useRef<RopeEngine | null>(null);
  const lit = useRef<string[]>([]);

  useEffect(() => {
    const el = root.current!,
      canvas = cv.current!,
      chip = ind.current!;
    const [num, name] = chip.children as HTMLCollectionOf<HTMLElement>;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let e: RopeEngine | null = null;
    try {
      if (canRunGL())
        e = new RopeEngine(canvas, {
          chapters: CHAPTERS,
          mobile: innerWidth < 768,
          intro: !reduce && scrollY < 50,
          onReady: () => el.setAttribute("data-ready", ""),
        });
    } catch {
      e = null;
    }
    engine.current = e;
    if (!e) {
      el.dataset.gl = "off";
      el.setAttribute("data-ready", "");
    }
    e?.setTheme(isDark());
    const unTheme = subscribeTheme(() => e?.setTheme(isDark()));
    const lenis = reduce ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: true, autoRaf: false });

    const sections = [...el.querySelectorAll<HTMLElement>("[data-chapter]")];
    const scrubs = [...el.querySelectorAll<HTMLElement>("[data-scrub]")].map((n) => {
      const [a = 1, b = 0.2] = (n.dataset.scrub ?? "").split(" ").filter(Boolean).map(Number);
      return { n, a, b, top: 0, e: -1 };
    });
    let anchors: number[] = [],
      vh = 1,
      docH = 1,
      last = -1,
      shown = -1,
      raf = 0,
      alive = true;
    const docTop = (n: HTMLElement) => n.getBoundingClientRect().top + scrollY;

    // Each chapter has a scroll anchor: the hero at the top, the others centred (phone: their top edge).
    const measure = () => {
      if (!alive) return;
      vh = innerHeight;
      docH = document.documentElement.scrollHeight;
      const max = docH - vh,
        phone = innerWidth < 768;
      anchors = sections.map((s, k) => (k === 0 ? 0 : Math.min(max, phone ? docTop(s) : docTop(s) + s.offsetHeight / 2 - vh / 2)));
      for (const s of scrubs) s.top = docTop(s.n);
      e?.resize(canvas.clientWidth, canvas.clientHeight);
      last = -1;
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      lenis?.raf(t);
      const y = scrollY;
      if (y === last) return;
      last = y;

      // The rope holds each formation near its anchor and morphs through the middle of the scroll between two.
      let k = 0;
      while (k < anchors.length - 2 && y >= anchors[k + 1]) k++;
      const u = (y - anchors[k]) / (anchors[k + 1] - anchors[k] || 1);
      const stage = Math.min(anchors.length - 1, k + clamp01((u - 0.28) / 0.44));
      e?.setStage(stage);
      // Past the last chapter the knot leaves with the page instead of hanging over the footer.
      canvas.style.transform = `translate3d(0,${-Math.max(0, y - anchors[anchors.length - 1])}px,0)`;
      el.style.setProperty("--lv", String(round(clamp01(1 - Math.abs(stage - 2) * 4))));

      for (const s of scrubs) {
        const x = round(clamp01((s.a * vh - (s.top - y)) / ((s.a - s.b) * vh)));
        if (x !== s.e) {
          s.e = x;
          s.n.style.setProperty("--e", String(x));
        }
      }

      const c = Math.round(stage);
      chip.toggleAttribute("data-on", c > 0 && y < anchors[anchors.length - 1] + 0.3 * vh);
      if (c !== shown) {
        shown = c;
        num.textContent = `0${c} / 06`;
        name.textContent = TITLES[c];
      }
      chip.style.setProperty("--p", String(round(y / Math.max(1, docH - vh))));
      el.toggleAttribute("data-scrolled", y > 40);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    measure();
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      lenis?.destroy();
      ro.disconnect();
      removeEventListener("resize", measure);
      unTheme();
      e?.dispose();
      engine.current = null;
    };
  }, []);

  // Light the lanes of the stories a commit message links to, and send a pulse down each new one.
  const onHits = useCallback((ids: string[]) => {
    const e = engine.current;
    if (!e) return;
    const idx = ids.map((id) => GRID.findIndex((g) => g.id === id)).filter((i) => i >= 0);
    e.highlight(idx.map((i) => e.lane(i)));
    for (const i of idx) if (!lit.current.includes(GRID[i].id)) e.pulse(e.lane(i), 0.45);
    lit.current = idx.map((i) => GRID[i].id);
  }, []);

  return (
    <div ref={root} className="splash">
      <canvas ref={cv} className="splash-canvas" aria-hidden />
      <Mark className="splash-poster" />

      <header className="s-head">
        <Wordmark />
        <nav className="hidden items-center gap-1 md:flex">
          <a href="#trace" className="s-link">
            How it works
          </a>
          <a href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer" className="s-link inline-flex items-center gap-1.5">
            Source
            <Icon name="external" size={12} />
          </a>
        </nav>
        <div className="flex items-center gap-1.5 justify-self-end">
          <Link href="/enter" className="s-link hidden md:inline-flex">
            Sign in
          </Link>
          <ThemeToggle />
          <DemoButton as="student" className="btn btn-primary">
            Try the demo
          </DemoButton>
        </div>
      </header>

      <div ref={ind} className="ch-ind" aria-hidden>
        <span />
        <span className="text-fg" />
        <span className="ch-bar">
          <i />
        </span>
      </div>

      <main>
        <section data-chapter className="hero">
          <p className="eyebrow hero-in">Trace / for student software teams</p>
          <h1 className="display hero-title">
            {["Untangle", "the group", "project."].map((t, i) => (
              <span key={t} className="ln">
                <span style={v({ "--i": i })}>{t}</span>
              </span>
            ))}
          </h1>
          <div className="hero-in mt-9 grid items-end gap-6 md:grid-cols-[minmax(0,34ch)_1fr_auto] md:gap-10">
            <p className="text-[15px] leading-relaxed text-pretty text-fg-2 md:text-[16px]">
              Trace ties your team’s stories, commits and decisions to the people behind them, so the viva never starts with “who built this?”
            </p>
            <div className="flex flex-wrap gap-2">
              <DemoButton as="student" className="btn btn-thread btn-lg">
                Demo as a student
              </DemoButton>
              <DemoButton as="mentor" className="btn btn-lg">
                Demo as a mentor
              </DemoButton>
            </div>
            <div className="hidden text-right md:block">
              <p className="eyebrow">Drag the knot · click a strand</p>
              <a href="#trace" className="link mt-2 inline-flex items-center gap-1.5 text-[13px]">
                See how it links
                <Icon name="arrow" size={13} />
              </a>
            </div>
          </div>
        </section>

        <section data-chapter className="ch">
          <div className="chapter-gap" />
          <div className="sheet">
            <div data-scrub="0.95 0.35">
              <p className="eyebrow">01 · The problem</p>
              <h2 className="words mt-6 max-w-[13em] text-balance" style={v({ "--n": WORDS.length })}>
                {WORDS.map((w, i) => (
                  <span key={i} style={v({ "--i": i })} data-em={w.em || undefined}>
                    {w.w}{" "}
                  </span>
                ))}
              </h2>
              <p className="ch-lede rv" style={v({ "--from": 0.7 })}>
                Trace keeps the thread while you build, so the answer is already written down.
              </p>
            </div>
          </div>
        </section>

        <TraceChapter onHits={onHits} />

        <section data-chapter className="ch">
          <div className="chapter-gap" />
          <div className="sheet grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_22rem_minmax(0,1.1fr)]">
            <div data-scrub="0.9 0.4">
              <p className="eyebrow">03 · Receipts</p>
              <h2 className="display ch-title mt-5 text-balance">
                A receipt for <em>every person.</em>
              </h2>
              <p className="ch-lede rv" style={v({ "--from": 0.3 })}>
                Each line is a commit, task or decision you can open. A teammate can dispute any line, and the receipt keeps both sides.
              </p>
            </div>
            <div data-scrub="0.95 0.3" data-solid>
              <div className="slot-mouth" />
              <div className="slot-clip">
                <div className="slot-paper">
                  <div className="receipt">
                    <div className="receipt-paper mono px-5 pt-7 pb-8 text-[11.5px] leading-snug">
                      <p className="text-center font-medium tracking-[0.12em]">TRACE CONTRIBUTION RECEIPT</p>
                      <p className="mt-1 text-center opacity-70">Meera Iyer · Campus Lost &amp; Found</p>
                      <div className="receipt-rule" />
                      <ul className="space-y-3">
                        {RECEIPT.map((l) => (
                          <li key={l.kind}>
                            <p className="opacity-60">{l.kind}</p>
                            <p className="flex gap-3">
                              <span className="min-w-0 flex-1">{l.title}</span>
                              <span>{l.detail}</span>
                            </p>
                            {l.disputed && <p className="mt-1.5 border-l-2 border-warn pl-2 text-warn">DISPUTED · {l.disputed}</p>}
                          </li>
                        ))}
                      </ul>
                      <div className="receipt-rule" />
                      <dl className="grid grid-cols-[1fr_auto] gap-y-1">
                        <dt>COMMITS</dt>
                        <dd>4</dd>
                        <dt>TASKS</dt>
                        <dd>1</dd>
                        <dt>LINES</dt>
                        <dd>+298 −14</dd>
                        <dt>DISPUTED</dt>
                        <dd>1 line</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div aria-hidden className="hidden md:block" />
          </div>
        </section>

        <section data-chapter className="ch">
          <div className="chapter-gap" />
          <div className="sheet">
            <div className="max-w-[30rem]">
              <div data-scrub="0.9 0.4">
                <p className="eyebrow">04 · Viva</p>
                <h2 className="display ch-title mt-5 text-balance">
                  Practise the parts you <em>didn’t build.</em>
                </h2>
                <p className="ch-lede rv" style={v({ "--from": 0.3 })}>
                  Questions come from your teammates’ code, the team’s decisions and the requirements you never touched. Answers come from your own record.
                </p>
              </div>
              <div className="flip mt-10" data-scrub="0.3 0" data-solid>
                <div className="flip-inner">
                  <div className="flip-face">
                    <p className="eyebrow">Question 3 of 8 · from a decision</p>
                    <p className="mt-auto pt-10 text-[21px] leading-snug font-medium text-balance">
                      The team chose email only for match alerts. Why, and what did you give up?
                    </p>
                    <p className="mono mt-6 text-[11px] text-fg-3">Keep scrolling for the answer</p>
                  </div>
                  <div className="flip-face flip-back">
                    <p className="eyebrow !text-current opacity-60">Answer · from decision D-4</p>
                    <p className="mt-auto pt-10 text-[16px] leading-relaxed text-pretty">
                      Push notifications need a service worker and Firebase Cloud Messaging setup we don’t have time for before the demo. Email alerts for matches are enough for v1.
                    </p>
                    <p className="mono mt-6 text-[11px] opacity-60">Considered instead: push notifications (Kabir’s plan)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section data-chapter className="ch">
          <div className="chapter-gap" />
          <div className="sheet">
            <div className="max-w-[34rem]" data-scrub="0.9 0.4">
              <p className="eyebrow">05 · Mentors</p>
              <h2 className="display ch-title mt-5 text-balance">
                Every team on <em>one page.</em>
              </h2>
              <p className="ch-lede rv" style={v({ "--from": 0.3 })}>
                Mentors see how much each team has traced, who is carrying the work, who went quiet and which decisions contradict each other.
              </p>
            </div>
            <div className="panel mt-10 max-w-[60rem] overflow-hidden" data-scrub="0.9 0.45" data-solid>
              <div className="label-sm hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] gap-6 border-b border-line px-5 py-3 md:grid">
                <span>Team</span>
                <span>Traced</span>
                <span>Balance</span>
                <span>Needs a look</span>
              </div>
              {TEAMS.map((t) => (
                <div
                  key={t.key}
                  className="grid grid-cols-2 items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4 last:border-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)]"
                >
                  <p className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                    <span className="chip mono">{t.key}</span>
                    <span className="truncate text-[14px] font-medium">{t.name}</span>
                  </p>
                  <Meter label="Traced" value={t.traced} />
                  <Meter label="Balance" value={t.balance} low={t.balance < 40} />
                  <p className="col-span-2 flex items-center gap-2 text-[13px] text-fg-2 md:col-span-1">
                    <Icon name="warn" size={14} className="shrink-0 text-warn" />
                    {t.flag}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-chapter className="ch">
          <div className="chapter-gap" />
          <div className="sheet text-center">
            <div className="md:mt-[34vh]" data-scrub="0.9 0.4">
              <h2 className="display text-[clamp(44px,7vw,112px)] text-balance">
                Every requirement, <em>traced.</em>
              </h2>
              <p className="ch-lede rv mx-auto" style={v({ "--from": 0.3 })}>
                Create a workspace, connect a public GitHub repo, then invite your team and your mentor. Free for student teams.
              </p>
              <div className="rv mt-9 flex flex-wrap justify-center gap-2" style={v({ "--from": 0.45 })}>
                <Link href="/enter" className="btn btn-primary btn-lg">
                  Set up your team
                </Link>
                <DemoButton as="mentor" className="btn btn-lg">
                  See the mentor demo
                </DemoButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="s-foot" data-scrub="1 0.4">
        <div className="grid gap-8 px-(--gutter) pt-14 md:grid-cols-[minmax(0,1fr)_auto]">
          <p className="max-w-[44ch] text-[14px] leading-relaxed text-fg-2">
            Trace is a traceability workspace for student software teams and their mentors. Stories, commits, decisions and people, on one thread.
          </p>
          <nav className="-mx-3 flex flex-wrap content-start gap-1 md:justify-end">
            <DemoButton as="student" className="s-link">
              Student demo
            </DemoButton>
            <DemoButton as="mentor" className="s-link">
              Mentor demo
            </DemoButton>
            <a href="https://github.com/sirgreaseball/trace" target="_blank" rel="noreferrer" className="s-link">
              Source
            </a>
            <Link href="/enter" className="s-link">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="mt-12 flex flex-wrap justify-between gap-2 px-(--gutter) text-[12px] text-fg-3">
          <span>© 2026 Trace</span>
          <span>Designed and built by Dhruv Sonar</span>
        </div>
        <p className="foot-word mt-6 px-(--gutter) text-fg" aria-hidden>
          trace
        </p>
      </footer>
    </div>
  );
}

function TraceChapter({ onHits }: { onHits: (ids: string[]) => void }) {
  const [msg, setMsg] = useState("");
  const res = useMemo(() => (msg.trim() ? link(msg) : null), [msg]);
  const hits = new Set(res?.hits);
  const set = (m: string) => {
    setMsg(m);
    onHits(m.trim() ? link(m).hits : []);
  };

  return (
    <section data-chapter id="trace" className="ch">
      <div className="lanes" aria-hidden>
        {GRID.map((g, i) => (
          <div key={g.id} className="lane" data-hit={hits.has(g.id) || undefined} style={v({ "--yd": `${laneTop(i, false)}%`, "--yp": `${laneTop(i, true)}%` })}>
            <span className="lane-id">{g.id}</span>
            <span className="lane-title">{g.title}</span>
            <span className="lane-state">{g.state}</span>
          </div>
        ))}
      </div>
      <div className="chapter-gap" />
      <div className="sheet">
        <div className="max-w-[32rem]" data-scrub="0.9 0.4">
          <p className="eyebrow">02 · Link</p>
          <h2 className="display ch-title mt-5 text-balance">
            Commits find their <em>requirement.</em>
          </h2>
          <p className="ch-lede">
            Write LF-12 in a commit message and it links itself. Anything else gets a suggested match, and a teammate confirms it. Try it.
          </p>
          <div className="term mt-8" data-solid>
            <div className="term-bar">
              <i />
              <i />
              <i />
              <span className="ml-2">~/lost-and-found</span>
            </div>
            <label className="term-line">
              <span>{'$ git commit -m "'}</span>
              <input
                value={msg}
                onChange={(ev) => set(ev.target.value)}
                maxLength={90}
                placeholder="type a message"
                aria-label="Commit message"
                spellCheck={false}
                autoComplete="off"
              />
              <span>{'"'}</span>
            </label>
            <p className="term-note" data-tone={res?.note.tone} aria-live="polite">
              {res ? <Ids text={res.note.text} /> : "Type a commit message, or pick one below."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" data-solid>
            {TRY.map((t) => (
              <button key={t} type="button" title={t} className="try-chip" onClick={() => set(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Meter({ label, value, low }: { label: string; value: number; low?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 flex text-[11px] text-fg-3">
        <span className="md:hidden">{label}</span>
        <span className="mono ml-auto">{value}%</span>
      </p>
      <div className="bar" data-low={low || undefined}>
        <i style={v({ "--v": value / 100 })} />
      </div>
    </div>
  );
}
