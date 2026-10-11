"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { day } from "@/lib/format";

type Hit = { kind: string; id: string; ref: string | null; title: string; snippet: string; created_at: string };
type Result = { answer: string | null; hits: Hit[]; provider?: string; ai: boolean; unavailable?: boolean };

const KIND: Record<string, string> = { decision: "Decision", story: "Story", message: "Chat", commit: "Commit", task: "Task" };

function hrefFor(base: string, h: Hit) {
  if (h.kind === "decision") return `${base}/decisions#${h.ref?.toLowerCase()}`;
  if (h.kind === "story") return `${base}/stories/${h.ref?.split("-")[1]}`;
  if (h.kind === "message") return `${base}/chat#m-${h.id}`;
  if (h.kind === "commit") return `${base}/commits#c-${h.ref}`;
  return `${base}/board`;
}

/** "<<word>>" markers from Postgres become highlighted text. */
function Snippet({ text }: { text: string }) {
  return (
    <>
      {text.split(/(<<.*?>>)/g).map((p, i) =>
        p.startsWith("<<") ? (
          <mark key={i} className="rounded bg-thread-soft px-0.5 text-fg">
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
          <Link key={i} href={hrefFor(base, h)} className="mono mx-0.5 rounded bg-thread-soft px-1 align-[1px] text-[11px] text-thread-ink hover:bg-thread hover:text-white">
            {m![1]}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

export function Ask({ workspaceId, suggestions, ai }: { workspaceId: string; suggestions: string[]; ai: boolean }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/w/${workspaceId}`;

  async function ask(question: string) {
    if (question.trim().length < 3) return;
    setQ(question);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/w/${workspaceId}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: question }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setRes(body);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-2xl border border-line-2 bg-bg-2 p-2 focus-within:border-thread focus-within:shadow-[0_0_0_3px_var(--thread-soft)]"
      >
        <Icon name="ask" className="ml-2 shrink-0 text-thread" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder="Why did we switch to email alerts?"
          aria-label="Your question"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
          autoFocus
        />
        <button disabled={busy || q.trim().length < 3} className="btn btn-primary h-10">
          {busy ? "Looking…" : "Ask"}
        </button>
      </form>
      {!res && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="btn btn-sm">
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 text-warn">
          {error}
        </p>
      )}

      {busy && (
        <div className="mt-8 space-y-2" aria-hidden>
          {[0.9, 0.75, 0.6].map((w, i) => (
            <div key={i} className="relative h-3.5 overflow-hidden rounded bg-bg-3" style={{ width: `${w * 100}%` }}>
              <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-line-2 to-transparent" />
            </div>
          ))}
        </div>
      )}

      {res && !busy && (
        <div className="anim-rise mt-8">
          {res.answer ? (
            <section className="mb-8">
              <p className="eyebrow mb-2">Answer</p>
              <p className="serif text-[22px] leading-snug sm:text-[24px]">
                <Cited text={res.answer} hits={res.hits} base={base} />
              </p>
              {res.provider && <p className="mt-3 text-[11.5px] text-fg-3">Written by AI ({res.provider}) from the sources below. Check the sources before you quote it.</p>}
            </section>
          ) : res.hits.length ? (
            <p className="mb-6 text-[13px] text-fg-2">
              {res.unavailable ? "The AI services are busy, so here's the evidence itself." : ai ? "" : "Here's what the record says, best match first."}
            </p>
          ) : (
            <p className="text-fg-2">Nothing in the record matches that. Try other words, or log the decision so the next person can find it.</p>
          )}
          {res.hits.length > 0 && (
            <section>
              <p className="eyebrow mb-3">Sources</p>
              <ol className="space-y-2">
                {res.hits.map((h, i) => (
                  <li key={h.id}>
                    <Link href={hrefFor(base, h)} className="row-hover flex gap-3 rounded-xl border border-line px-4 py-3">
                      <span className="mono w-5 shrink-0 pt-0.5 text-[11px] text-fg-3">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                          <span className={`chip ${h.kind === "decision" ? "chip-thread" : ""}`}>{KIND[h.kind] ?? h.kind}</span>
                          {h.ref && <span className="mono">{h.ref}</span>}
                          <span>{h.kind === "message" ? `${h.title} · ` : ""}{day(h.created_at)}</span>
                        </span>
                        {h.kind !== "message" && <span className="mt-1 block font-medium">{h.title}</span>}
                        <span className="mt-1 block text-[13px] leading-relaxed text-fg-2">
                          <Snippet text={h.snippet} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
