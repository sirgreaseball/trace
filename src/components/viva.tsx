"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { Rings } from "./rings";
import type { VivaQuestion } from "@/lib/trace";

type Mark = "knew" | "shaky" | "missed";

const KIND_LABEL = { commit: "Code", decision: "Decision", story: "Requirement" } as const;
const MARK_COLOR: Record<Mark, string> = { knew: "var(--r3)", shaky: "var(--warn)", missed: "var(--r1)" };

function EvidenceLink({ base, e }: { base: string; e: VivaQuestion["evidence"][number] }) {
  const href = e.kind === "commit" ? `${base}/commits#c-${e.ref}` : e.kind === "decision" ? `${base}/decisions#d-${e.ref.slice(2)}` : `${base}/stories/${e.ref.split("-")[1]}`;
  return (
    <Link href={href} className="chip mono transition-colors hover:text-ink">
      {e.ref}
    </Link>
  );
}

/** Flashcards: say the answer out loud, flip the card, be honest about how it went. */
export function Viva({ workspaceId, questions, ai }: { workspaceId: string; questions: VivaQuestion[]; ai: boolean }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [follow, setFollow] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const base = `/w/${workspaceId}`;
  const q = questions[i];
  const done = i >= questions.length;

  function mark(m: Mark) {
    if (!q) return;
    setMarks((x) => ({ ...x, [q.id]: m }));
    setShown(false);
    setI((n) => n + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setShown((s) => !s);
      }
      if (shown && e.key === "1") mark("knew");
      if (shown && e.key === "2") mark("shaky");
      if (shown && e.key === "3") mark("missed");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function harder() {
    if (!q) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/w/${workspaceId}/viva`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: q.prompt, answer: q.answer }) });
      const body = await r.json();
      setFollow((x) => ({ ...x, [q.id]: r.ok ? body.followUp : null }));
    } finally {
      setBusy(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="pane px-6 py-14 text-center">
        <Icon name="viva" size={34} className="mx-auto text-ink-3" />
        <p className="t-headline mt-3">Nothing to practise yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-ink-2">Questions come from teammates&apos; commits, the team&apos;s decisions and stories with acceptance criteria. Once those exist, they show up here.</p>
      </div>
    );
  }

  if (done) {
    const count = (m: Mark) => Object.values(marks).filter((x) => x === m).length;
    const weak = questions.filter((x) => marks[x.id] !== "knew");
    return (
      <motion.div initial={{ opacity: 0, y: 16, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}>
        <div className="glass flex flex-wrap items-center gap-8 rounded-[32px] p-7 sm:p-9">
          <Rings values={[count("knew") / questions.length, (count("knew") + count("shaky")) / questions.length, 1]} size={150} glow />
          <div>
            <p className="t-section">Round done</p>
            <p className="t-figure mt-2 text-[56px]">
              {count("knew")} <span className="text-[0.5em] text-ink-3">of {questions.length}</span>
            </p>
            <p className="mt-1 text-[15px] text-ink-2">
              answered without looking. {count("shaky")} shaky, {count("missed")} missed.
            </p>
          </div>
        </div>
        {weak.length > 0 && (
          <>
            <p className="t-section mt-8 mb-3 px-1">Read the evidence for these before the real thing</p>
            <ul className="pane divide overflow-hidden">
              {weak.map((x) => (
                <li key={x.id} className="flex items-start gap-3.5 px-5 py-4 text-[14.5px]">
                  <span className="mt-2 size-2 shrink-0 rounded-full" style={{ background: MARK_COLOR[marks[x.id] ?? "missed"] }} />
                  <span className="flex-1 leading-relaxed">{x.prompt}</span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    {x.evidence.map((e) => (
                      <EvidenceLink key={e.id} base={base} e={e} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          className="btn btn-primary btn-lg mt-6"
          onClick={() => {
            setI(0);
            setMarks({});
            setShown(false);
          }}
        >
          Go again
        </button>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 text-[13px] text-ink-3">
        <span className="num w-12 font-[560]">
          {i + 1} / {questions.length}
        </span>
        <div className="flex flex-1 gap-1.5">
          {questions.map((x, k) => (
            <span
              key={x.id}
              className="h-1.5 flex-1 rounded-full transition-[background-color] duration-500"
              style={{ background: k < i ? MARK_COLOR[marks[x.id] ?? "missed"] : k === i ? "var(--ink)" : "var(--line-2)" }}
            />
          ))}
        </div>
      </div>

      <div className="[perspective:1600px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 80, rotate: 3, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, rotate: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -90, rotate: -4, filter: "blur(6px)" }}
            transition={{ type: "spring", bounce: 0.16, duration: 0.7 }}
            className="relative"
          >
            <motion.div
              className="relative grid [transform-style:preserve-3d]"
              animate={{ rotateY: shown ? 180 : 0 }}
              transition={{ type: "spring", bounce: 0.18, duration: 0.85 }}
              onClick={() => setShown((s) => !s)}
              role="button"
              tabIndex={-1}
              aria-label={shown ? "Hide the answer" : "Show the answer"}
            >
              <div className="glass-strong col-start-1 row-start-1 flex min-h-[340px] cursor-pointer flex-col rounded-[32px] p-7 [backface-visibility:hidden] sm:p-10">
                <p className="mb-6 flex items-center gap-2 text-[13px] text-ink-3">
                  <span className={`chip ${q.kind === "decision" ? "chip-accent" : ""}`}>{KIND_LABEL[q.kind]}</span>
                  <span className="ref">{q.topic}</span>
                </p>
                <p className="text-[24px] leading-snug font-[560] tracking-[-0.025em] sm:text-[28px]">{q.prompt}</p>
                {follow[q.id] && (
                  <p className="mt-6 rounded-[16px] bg-accent-soft px-4 py-3 text-[15px] text-ink">
                    <span className="font-[620] text-accent-ink">Follow-up:</span> {follow[q.id]}
                  </p>
                )}
                <p className="mt-auto pt-8 text-[13px] text-ink-3">Say your answer out loud, then flip the card.</p>
              </div>
              <div className="pane col-start-1 row-start-1 flex min-h-[340px] cursor-pointer flex-col rounded-[32px] p-7 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-10">
                <p className="t-section mb-4">From the record</p>
                <ul className="space-y-2.5 text-[16px] leading-relaxed">
                  {q.answer.map((a, k) => (
                    <li key={k} className="flex gap-3">
                      <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-ink-3" />
                      {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-6" onClick={(e) => e.stopPropagation()}>
                  {q.evidence.map((e) => (
                    <EvidenceLink key={e.id} base={base} e={e} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!shown ? (
          <button className="btn btn-primary btn-lg" onClick={() => setShown(true)}>
            Flip the card <span className="kbd ml-1 bg-white/15 text-inv shadow-none">space</span>
          </button>
        ) : (
          <>
            <span className="mr-1 text-[14px] text-ink-2">How did you do?</span>
            {(
              [
                ["knew", "Knew it", "1"],
                ["shaky", "Shaky", "2"],
                ["missed", "Missed", "3"],
              ] as const
            ).map(([m, label, k]) => (
              <button key={m} className="btn btn-lg" onClick={() => mark(m)}>
                <span className="size-2 rounded-full" style={{ background: MARK_COLOR[m] }} />
                {label} <span className="kbd">{k}</span>
              </button>
            ))}
          </>
        )}
        {ai && !follow[q.id] && (
          <button className="btn btn-ghost ml-auto" disabled={busy} onClick={harder}>
            <Icon name="ask" size={15} /> {busy ? "Thinking…" : "Ask me a follow-up"}
          </button>
        )}
      </div>
    </div>
  );
}
