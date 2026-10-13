"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ReceiptLine } from "@/lib/trace";

const KIND = { commit: "COMMIT", task: "TASK", decision: "DECISION", story: "STORY" } as const;

function href(base: string, l: ReceiptLine) {
  if (l.kind === "commit") return `${base}/commits#c-${l.ref}`;
  if (l.kind === "decision") return `${base}/decisions#d-${l.ref.slice(2)}`;
  if (l.kind === "story") return `${base}/stories/${l.ref.split("-")[1]}`;
  return `${base}/board`;
}

/** The lines of a receipt, printed on paper. Anyone else can dispute a line; the lead resolves it. */
export function ReceiptLines({
  workspaceId,
  subject,
  lines,
  raisers,
  canDispute,
  canResolve,
  me,
}: {
  workspaceId: string;
  subject: string;
  lines: ReceiptLine[];
  raisers: Record<string, string>;
  canDispute: boolean;
  canResolve: boolean;
  me: string;
}) {
  const { run, busy } = useRun();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const base = `/w/${workspaceId}`;
  const sb = supabaseBrowser();

  if (lines.length === 0) return <p className="py-6 text-center text-[12px] text-[var(--paper-2)]">NO EVIDENCE YET</p>;

  async function dispute(l: ReceiptLine) {
    if (!note.trim()) return;
    const ok = await run(() => sb.from("disputes").insert({ workspace_id: workspaceId, kind: l.kind, item_id: l.id, subject, raised_by: me, note: note.trim() }), "Dispute raised");
    if (ok) {
      setOpen(null);
      setNote("");
    }
  }

  return (
    <ul className="space-y-3">
      {lines.map((l) => {
        const key = `${l.kind}:${l.id}`;
        return (
          <li key={key} className="group text-[12.5px]">
            <div className="flex items-start gap-3">
              <Link href={href(base, l)} className="min-w-0 flex-1 leading-snug decoration-[var(--paper-rule)] underline-offset-2 hover:underline">
                <span className="block text-[10.5px] text-[var(--paper-2)]">
                  {KIND[l.kind]} {l.ref}
                  {l.stories.length > 0 && ` → ${l.stories.join(", ")}`}
                </span>
                <span className="block">{l.title}</span>
              </Link>
              <span className="num shrink-0 text-right text-[11.5px] whitespace-nowrap">{l.detail}</span>
            </div>
            {l.disputes.map((d) => (
              <div key={d.id} className={`mt-1.5 border-l-2 pl-2.5 text-[11.5px] leading-snug ${d.status === "open" ? "border-[#d0562c]" : "border-[var(--paper-rule)] text-[var(--paper-2)]"}`}>
                <span className="font-semibold">{d.status === "open" ? "DISPUTED" : "RESOLVED"}</span> by {raisers[d.raised_by ?? ""] ?? "someone"}: {d.note}
                {d.resolution && <span className="block">→ {d.resolution}</span>}
                {d.status === "open" && (canResolve || d.raised_by === me) && resolving !== d.id && (
                  <button className="print-hide ml-1.5 underline" onClick={() => setResolving(d.id)}>
                    resolve
                  </button>
                )}
                {resolving === d.id && (
                  <form
                    className="print-hide mt-1.5 flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await run(
                        () => sb.from("disputes").update({ status: "resolved", resolution: resolution.trim() || "Resolved.", resolved_at: new Date().toISOString() }).eq("id", d.id),
                        "Dispute resolved",
                      );
                      if (ok) setResolving(null);
                    }}
                  >
                    <input autoFocus value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={1000} placeholder="What was agreed?" className="min-w-0 flex-1 border-b border-current bg-transparent outline-none" />
                    <button disabled={busy} className="font-semibold underline">
                      save
                    </button>
                  </form>
                )}
              </div>
            ))}
            {canDispute && open !== key && (
              <button className="print-hide mt-0.5 text-[10.5px] text-[var(--paper-2)] underline opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100" onClick={() => setOpen(key)}>
                dispute this line
              </button>
            )}
            <AnimatePresence>
              {open === key && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  className="print-hide overflow-hidden"
                  onSubmit={(e) => {
                    e.preventDefault();
                    dispute(l);
                  }}
                >
                  <div className="mt-2 space-y-2">
                    <textarea
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="What really happened? e.g. we paired on this, I wrote the copy."
                      className="w-full resize-none rounded-[8px] border border-[var(--paper-rule)] bg-transparent p-2 text-[12px] outline-none focus:border-[var(--paper-ink)]"
                    />
                    <div className="flex items-center gap-3 text-[11.5px]">
                      <button disabled={busy || !note.trim()} className="inline-flex items-center gap-1 font-semibold underline disabled:opacity-40">
                        <Icon name="warn" size={12} /> RAISE DISPUTE
                      </button>
                      <button type="button" className="text-[var(--paper-2)] underline" onClick={() => setOpen(null)}>
                        cancel
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

export function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()}>
      <Icon name="print" size={15} /> Print or save as PDF
    </button>
  );
}
