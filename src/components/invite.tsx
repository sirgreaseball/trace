"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { toast } from "./island";
import { Modal } from "./modal";
import { humanize, useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast(text);
  }
};

/** The team's two codes. Read one out in the lab and people join with it. */
export function TeamCodes({ workspaceId }: { workspaceId: string }) {
  const [codes, setCodes] = useState<Partial<Record<"mentor" | "member", string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    for (const role of ["mentor", "member"] as const) {
      sb.rpc("team_code", { p_workspace: workspaceId, p_role: role }).then((r: { data: unknown }) => {
        if (typeof r.data === "string") setCodes((c) => ({ ...c, [role]: r.data as string }));
      });
    }
  }, [workspaceId]);

  async function fresh(role: "mentor" | "member") {
    setBusy(role);
    const { data, error } = await supabaseBrowser().rpc("team_code", { p_workspace: workspaceId, p_role: role, p_fresh: true });
    setBusy(null);
    if (error) return toast(humanize(error.message), "error");
    setCodes((c) => ({ ...c, [role]: data as string }));
    toast("New code made. The old one no longer works.");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(
        [
          ["mentor", "Mentor code", "For your mentor or faculty: read everything, comment, raise disputes."],
          ["member", "Teammate code", "For people building the project with you."],
        ] as const
      ).map(([role, label, hint]) => (
        <div key={role} className="rounded-[18px] bg-surface-2 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
          <p className="text-[13px] font-[600] text-ink-2">{label}</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={codes[role] ?? "…"}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              className="mono mt-1.5 text-[24px] font-[600] tracking-[0.04em]"
            >
              {codes[role] ?? "······"}
            </motion.p>
          </AnimatePresence>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-3">{hint}</p>
          <div className="mt-3 flex gap-1.5">
            <button className="btn btn-sm" disabled={!codes[role]} onClick={() => copy(codes[role]!, label)}>
              <Icon name="copy" size={13} /> Copy
            </button>
            <button className="btn btn-ghost btn-sm" disabled={busy === role} onClick={() => fresh(role)}>
              <Icon name="sync" size={13} /> New code
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Add someone by email: straight in if they have an account, waiting for them if not. */
export function AddByEmail({ workspaceId, pending }: { workspaceId: string; pending: { email: string; role: Role }[] }) {
  const { run, busy } = useRun();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"mentor" | "member">("mentor");
  const sb = supabaseBrowser();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    let outcome = "";
    const ok = await run(async () => {
      const r = await sb.rpc("add_by_email", { p_workspace: workspaceId, p_email: address, p_role: role });
      outcome = (r.data as string) ?? "";
      return r;
    });
    if (!ok) return;
    setEmail("");
    toast(outcome === "added" ? `${address} is on the team now` : `Saved. ${address} joins as soon as they sign in with that email`);
  }

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mentor@college.edu" aria-label="Email address" className="field min-w-0 flex-1 basis-56" autoComplete="off" />
        <select value={role} onChange={(e) => setRole(e.target.value as "mentor" | "member")} aria-label="Role" className="field w-36">
          <option value="mentor">Mentor</option>
          <option value="member">Teammate</option>
        </select>
        <button disabled={busy || !email.trim()} className="btn btn-primary h-[42px]">
          <Icon name="plus" size={14} bold /> Add
        </button>
      </form>
      {pending.length > 0 && (
        <ul className="divide mt-3 overflow-hidden rounded-[16px] bg-surface-2">
          {pending.map((p) => (
            <li key={p.email} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-[13.5px]">
              <span className="chip">{p.role === "mentor" ? "Mentor" : "Teammate"}</span>
              <span className="min-w-0 flex-1 truncate">{p.email}</span>
              <span className="text-[12px] text-ink-3">waiting to sign in</span>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => sb.from("email_invites").delete().eq("workspace_id", workspaceId).eq("email", p.email), "Invite removed")}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Join a team by typing its code. Shows which team it is before you commit. */
export function JoinWithCode({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<{ workspace_name: string; course: string; role: Role } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = code.trim();
    if (c.length < 7) return;
    const t = setTimeout(async () => {
      const { data } = await supabaseBrowser().rpc("code_info", { p_code: c });
      const row = (data as { workspace_name: string; course: string; role: Role }[] | null)?.[0] ?? null;
      setInfo(row);
      setError(row ? null : "No team has that code. Check it with your team lead.");
    }, 250);
    return () => clearTimeout(t);
  }, [code]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("join_with_code", { p_code: code.trim() });
    if (error) {
      setBusy(false);
      return setError(humanize(error.message));
    }
    router.push(`/w/${data}`);
  }

  return (
    <>
      <button className={`btn ${className}`} onClick={() => setOpen(true)}>
        <Icon name="link" size={15} /> Join with a code
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Join a team">
        <form onSubmit={join} className="space-y-4">
          <div>
            <label className="label" htmlFor="team-code">
              Team code
            </label>
            <input
              id="team-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
                setInfo(null);
                setError(null);
              }}
              maxLength={14}
              placeholder="LF-7KQ2XM"
              className="field mono text-center text-[22px] tracking-[0.08em] uppercase"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-2 text-[12.5px] text-ink-3">Your team lead finds it in their workspace settings.</p>
          </div>
          <AnimatePresence mode="popLayout">
            {info && (
              <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[16px] bg-surface-2 px-4 py-3">
                <p className="text-[15px] font-[620]">{info.workspace_name}</p>
                <p className="text-[13px] text-ink-2">
                  {info.course ? `${info.course} · ` : ""}you join as {info.role === "mentor" ? "a mentor" : "a teammate"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {error && (
            <p role="alert" className="text-[13.5px] text-danger">
              {error}
            </p>
          )}
          <button disabled={!info || busy} className="btn btn-primary btn-lg w-full">
            {busy ? "Joining…" : info ? `Join ${info.workspace_name}` : "Join"}
          </button>
        </form>
      </Modal>
    </>
  );
}
