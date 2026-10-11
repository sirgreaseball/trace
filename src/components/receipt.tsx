"use client";

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

  if (lines.length === 0) return <p className="mono py-6 text-center text-[12px] opacity-70">NO EVIDENCE YET</p>;

  async function dispute(l: ReceiptLine) {
    if (!note.trim()) return;
    const ok = await run(() => sb.from("disputes").insert({ workspace_id: workspaceId, kind: l.kind, item_id: l.id, subject, raised_by: me, note: note.trim() }), "Dispute raised");
    if (ok) {
      setOpen(null);
      setNote("");
    }
  }

  return (
    <ul className="space-y-2.5">
      {lines.map((l) => (
        <li key={`${l.kind}:${l.id}`} className="group text-[12.5px]">
          <div className="flex items-start gap-2">
            <Link href={href(base, l)} className="mono min-w-0 flex-1 leading-snug hover:underline">
              <span className="block text-[10.5px] opacity-60">
                {KIND[l.kind]} {l.ref}
                {l.stories.length > 0 && ` → ${l.stories.join(", ")}`}
              </span>
              <span className="block">{l.title}</span>
            </Link>
            <span className="mono shrink-0 text-right text-[11px] whitespace-nowrap">{l.detail}</span>
          </div>
          {l.disputes.map((d) => (
            <div key={d.id} className={`mono mt-1.5 border-l-2 pl-2 text-[11px] leading-snug ${d.status === "open" ? "border-[#c2410c]" : "border-current opacity-60"}`}>
              <span className="font-semibold">{d.status === "open" ? "DISPUTED" : "RESOLVED"}</span> by {raisers[d.raised_by ?? ""] ?? "someone"}: {d.note}
              {d.resolution && <span className="block">→ {d.resolution}</span>}
              {d.status === "open" && (canResolve || d.raised_by === me) && resolving !== d.id && (
                <button className="ml-1 underline print:hidden" onClick={() => setResolving(d.id)}>
                  resolve
                </button>
              )}
              {resolving === d.id && (
                <form
                  className="mt-1.5 flex gap-1.5 print:hidden"
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
          {canDispute && open !== `${l.kind}:${l.id}` && (
            <button className="mono mt-0.5 text-[10.5px] underline opacity-0 transition-opacity group-hover:opacity-60 focus:opacity-100 print:hidden" onClick={() => setOpen(`${l.kind}:${l.id}`)}>
              dispute this line
            </button>
          )}
          {open === `${l.kind}:${l.id}` && (
            <form
              className="mt-2 space-y-1.5 print:hidden"
              onSubmit={(e) => {
                e.preventDefault();
                dispute(l);
              }}
            >
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="What really happened? e.g. we paired on this, I wrote the copy."
                className="mono w-full resize-none rounded border border-current/30 bg-transparent p-2 text-[11.5px] outline-none"
              />
              <div className="flex gap-3 text-[11px]">
                <button disabled={busy || !note.trim()} className="mono font-semibold underline">
                  RAISE DISPUTE
                </button>
                <button type="button" className="mono underline opacity-70" onClick={() => setOpen(null)}>
                  cancel
                </button>
              </div>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()}>
      <Icon name="print" size={14} /> Print or save as PDF
    </button>
  );
}
