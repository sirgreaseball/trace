"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Icon } from "./icons";
import { day } from "@/lib/format";

export type Hit = { kind: string; id: string; ref: string | null; title: string; snippet: string; created_at: string };
export type AskResult = { q: string; answer: string | null; hits: Hit[]; provider?: string; ai: boolean; unavailable?: boolean };

const KIND: Record<string, string> = { decision: "Decision", story: "Story", message: "Chat", commit: "Commit", task: "Task" };

export function hrefFor(base: string, h: Pick<Hit, "kind" | "id" | "ref">) {
  if (h.kind === "decision") return `${base}/decisions#${h.ref?.toLowerCase()}`;
  if (h.kind === "story") return `${base}/stories/${h.ref?.split("-")[1]}`;
  if (h.kind === "message") return `${base}/chat#m-${h.id}`;
  if (h.kind === "commit") return `${base}/commits#c-${h.ref}`;
  return `${base}/board`;
}

/** Asks the team's record a question. Shared by the Ask page and Spotlight. */
export function useAsk(workspaceId: string) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/w/${workspaceId}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setRes({ ...body, q });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return { ask, busy, res, error, reset: () => setRes(null) };
}

/** "<<word>>" markers from Postgres become highlighted text. */
function Snippet({ text }: { text: string }) {
  return (
    <>
      {text.split(/(<<.*?>>)/g).map((p, i) =>
        p.startsWith("<<") ? (
          <mark key={i} className="rounded-[4px] bg-accent-soft px-0.5 text-ink">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** "[2]" in the model's answer becomes a link to that piece of evidence. */
function Cited({ text, hits, base }: { text: string; hits: Hit[]; base: string }) {
  return (
    <>
      {text.split(/(\[\d+\])/g).map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        const h = m ? hits[Number(m[1]) - 1] : null;
        return h ? (
          <Link key={i} href={hrefFor(base, h)} className="num mx-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-soft px-1 align-[2px] text-[11px] font-semibold text-accent-ink transition-colors hover:bg-accent hover:text-white">
            {m![1]}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

export function AskAnswer({ res, base, compact = false, onPick }: { res: AskResult; base: string; compact?: boolean; onPick?: () => void }) {
  return (
    <div>
      {res.answer ? (
        <section className={compact ? "mb-4" : "mb-8"}>
          <p className={`${compact ? "text-[15px]" : "text-[19px] tracking-[-0.015em]"} max-w-[64ch] leading-relaxed`}>
            <Cited text={res.answer} hits={res.hits} base={base} />
          </p>
          {res.provider && <p className="t-caption mt-3">Written by AI ({res.provider}) from the sources below. Check them before you quote it.</p>}
        </section>
      ) : res.hits.length ? (
        <p className={`text-[13.5px] text-ink-2 ${compact ? "mb-3" : "mb-5"}`}>
          {res.unavailable ? "The AI services are busy, so here is the evidence itself, best match first." : "Here's what the record says, best match first."}
        </p>
      ) : (
        <p className="text-[14px] text-ink-2">Nothing in the record matches that. Try other words, or log the decision so the next person can find it.</p>
      )}
      {res.hits.length > 0 && (
        <ol className={compact ? "space-y-1" : "space-y-2"}>
          {res.hits.slice(0, compact ? 5 : 10).map((h, i) => (
            <motion.li key={h.id} initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.05 * i, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}>
              <Link href={hrefFor(base, h)} onClick={onPick} className={`row flex gap-3 rounded-[16px] ${compact ? "px-3 py-2.5" : "pane px-4 py-3.5"}`}>
                <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-2">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                    <span className={`chip h-5 ${h.kind === "decision" ? "chip-accent" : ""}`}>{KIND[h.kind] ?? h.kind}</span>
                    {h.ref && <span className="ref">{h.ref}</span>}
                    <span>
                      {h.kind === "message" ? `${h.title} · ` : ""}
                      {day(h.created_at)}
                    </span>
                  </span>
                  {h.kind !== "message" && <span className="mt-1 block text-[14px] font-[560]">{h.title}</span>}
                  <span className={`mt-0.5 block text-[13px] leading-relaxed text-ink-2 ${compact ? "line-clamp-2" : ""}`}>
                    <Snippet text={h.snippet} />
                  </span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Ask({ workspaceId, suggestions }: { workspaceId: string; suggestions: string[] }) {
  const [q, setQ] = useState("");
  const { ask, busy, res, error } = useAsk(workspaceId);
  const base = `/w/${workspaceId}`;
  const go = (text: string) => {
    setQ(text);
    ask(text);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="glass-strong flex items-center gap-2 rounded-[26px] p-2 pl-5 transition-shadow duration-300 focus-within:shadow-[0_0_0_4px_var(--accent-soft),var(--shadow-lg)]"
      >
        <Icon name="search" size={20} className="shrink-0 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder="Why did we switch to email alerts?"
          aria-label="Your question"
          className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink-3"
          autoFocus
        />
        <button disabled={busy || q.trim().length < 3} className="btn btn-primary h-11 px-5">
          {busy ? "Looking…" : "Ask"}
        </button>
      </form>

      <AnimatePresence>
        {!res && !busy && (
          <motion.div exit={{ opacity: 0, filter: "blur(4px)" }} className="mt-5 flex flex-wrap justify-center gap-2">
            {suggestions.map((s, i) => (
              <button key={s} onClick={() => go(s)} className="btn btn-sm rise" style={{ "--i": i + 2 } as CSSProperties}>
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="mt-6 text-center text-danger">
          {error}
        </p>
      )}

      {busy && (
        <div className="mt-10 space-y-3" aria-hidden>
          {[0.92, 0.78, 0.6].map((w, i) => (
            <div key={i} className="skeleton h-4" style={{ width: `${w * 100}%` }} />
          ))}
        </div>
      )}

      {res && !busy && (
        <motion.div key={res.q} className="mt-10" initial={{ opacity: 0, y: 12, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}>
          <AskAnswer res={res} base={base} />
        </motion.div>
      )}
    </div>
  );
}
