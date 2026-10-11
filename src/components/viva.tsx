"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import type { VivaQuestion } from "@/lib/trace";

type Mark = "knew" | "shaky" | "missed";

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
      if ((e.target as HTMLElement).tagName === "INPUT" || done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setShown(true);
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
      const r = await fetch(`/api/w/${workspaceId}/viva`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q.prompt, answer: q.answer }),
      });
      const body = await r.json();
      setFollow((x) => ({ ...x, [q.id]: r.ok ? body.followUp : null }));
    } finally {
      setBusy(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center">
        <p className="font-medium">Nothing to practise yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-fg-2">Questions come from teammates&apos; commits, the team&apos;s decisions and stories with acceptance criteria. Once those exist, they show up here.</p>
      </div>
    );
  }

  if (done) {
    const count = (m: Mark) => Object.values(marks).filter((x) => x === m).length;
    const weak = questions.filter((x) => marks[x.id] !== "knew");
    return (
      <div className="anim-rise">
        <p className="eyebrow mb-3">Round done</p>
        <p className="serif text-[44px] leading-none">
          {count("knew")} of {questions.length} <span className="text-fg-3">known cold</span>
        </p>
        <p className="mt-3 text-fg-2">
          {count("shaky")} shaky, {count("missed")} missed. Read the evidence for these before the real thing:
        </p>
        <ul className="mt-5 space-y-2">
          {weak.map((x) => (
            <li key={x.id} className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-[13.5px]">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${marks[x.id] === "missed" ? "bg-thread" : "bg-warn"}`} />
              <span className="flex-1">{x.prompt}</span>
              <span className="flex shrink-0 gap-1">
                {x.evidence.map((e) => (
                  <EvidenceLink key={e.id} base={base} e={e} />
                ))}
              </span>
            </li>
          ))}
        </ul>
        <button
          className="btn btn-primary mt-6"
          onClick={() => {
            setI(0);
            setMarks({});
            setShown(false);
          }}
        >
          Go again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-[12px] text-fg-3">
        <span className="num">
          {i + 1} / {questions.length}
        </span>
        <div className="flex flex-1 gap-1">
          {questions.map((x, k) => (
            <span
              key={x.id}
              className={`h-1 flex-1 rounded-full ${k < i ? (marks[x.id] === "knew" ? "bg-fg-2" : marks[x.id] === "shaky" ? "bg-warn" : "bg-thread") : k === i ? "bg-fg" : "bg-bg-3"}`}
            />
          ))}
        </div>
      </div>

      <div key={q.id} className="anim-rise panel overflow-hidden">
        <div className="p-6 sm:p-8">
          <p className="mb-4 flex items-center gap-2 text-[12px] text-fg-3">
            <span className={`chip ${q.kind === "decision" ? "chip-thread" : ""}`}>{q.kind === "commit" ? "Code" : q.kind === "decision" ? "Decision" : "Requirement"}</span>
            <span className="mono">{q.topic}</span>
          </p>
          <p className="serif text-[26px] leading-snug sm:text-[30px]">{q.prompt}</p>
          {follow[q.id] && (
            <p className="mt-4 border-l-2 border-thread pl-3 text-[14.5px] text-fg-2">
              <span className="font-medium text-fg">Follow-up:</span> {follow[q.id]}
            </p>
          )}
        </div>
        {shown ? (
          <div className="anim-fade border-t border-line bg-bg px-6 py-5 sm:px-8">
            <p className="eyebrow mb-2">From the record</p>
            <ul className="space-y-1.5 text-[14px] leading-relaxed">
              {q.answer.map((a, k) => (
                <li key={k}>{a}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {q.evidence.map((e) => (
                <EvidenceLink key={e.id} base={base} e={e} />
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4 sm:px-8">
          {!shown ? (
            <>
              <button className="btn btn-primary" onClick={() => setShown(true)}>
                Show the answer <span className="kbd ml-1 border-transparent bg-transparent text-current opacity-60">space</span>
              </button>
              <span className="text-[12px] text-fg-3">Say your answer out loud first.</span>
            </>
          ) : (
            <>
              <span className="mr-1 text-[12.5px] text-fg-2">How did you do?</span>
              <button className="btn" onClick={() => mark("knew")}>
                Knew it <span className="kbd">1</span>
              </button>
              <button className="btn" onClick={() => mark("shaky")}>
                Shaky <span className="kbd">2</span>
              </button>
              <button className="btn" onClick={() => mark("missed")}>
                Missed <span className="kbd">3</span>
              </button>
            </>
          )}
          {ai && !follow[q.id] && (
            <button className="btn btn-ghost ml-auto" disabled={busy} onClick={harder}>
              <Icon name="ask" size={14} /> {busy ? "Thinking…" : "Ask me a follow-up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceLink({ base, e }: { base: string; e: VivaQuestion["evidence"][number] }) {
  const href = e.kind === "commit" ? `${base}/commits#c-${e.ref}` : e.kind === "decision" ? `${base}/decisions#d-${e.ref.slice(2)}` : `${base}/stories/${e.ref.split("-")[1]}`;
  return (
    <Link href={href} className="chip mono text-[10.5px] hover:text-fg">
      {e.ref}
    </Link>
  );
}
