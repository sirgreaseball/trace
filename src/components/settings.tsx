"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { toast } from "./toast";
import { Avatar } from "./ui";
import { useRun } from "./use-run";
import { ago, parseRepo } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Role } from "@/lib/types";

function Block({ id, title, sub, children }: { id?: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 border-t border-line py-8 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-fg-2">{sub}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const ROLE: Record<Role, string> = { owner: "Team lead", member: "Member", mentor: "Mentor" };

export function Settings({
  ws,
  me,
  profile,
  members,
  invites,
  lastError,
  now,
}: {
  ws: { id: string; name: string; key: string; course: string; repo: string | null; demo: boolean };
  me: { id: string; role: Role };
  profile: { name: string; github: string | null };
  members: Member[];
  invites: { token: string; role: Role; created_at: string; expires_at: string }[];
  lastError: string | null;
  now: number;
}) {
  const router = useRouter();
  const { run, busy } = useRun();
  const sb = supabaseBrowser();
  const owner = me.role === "owner";
  const [confirm, setConfirm] = useState("");

  async function saveWorkspace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rawRepo = String(f.get("repo")).trim();
    const repo = rawRepo ? parseRepo(rawRepo) : null;
    if (rawRepo && !repo) return toast("That doesn't look like a GitHub repository. Use owner/name or paste its URL.", "error");
    await run(() => sb.from("workspaces").update({ name: String(f.get("name")).trim(), course: String(f.get("course")).trim(), repo }).eq("id", ws.id), "Workspace saved");
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const github = String(f.get("github")).trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    if (github && !/^[A-Za-z0-9-]{1,39}$/.test(github)) return toast("GitHub usernames use letters, numbers and dashes only.", "error");
    const ok = await run(() => sb.from("profiles").update({ name: String(f.get("name")).trim(), github: github || null }).eq("id", me.id), "Profile saved");
    // Claim earlier commits made under that username.
    if (ok && github) await sb.from("commits").update({ user_id: me.id }).is("user_id", null).ilike("author_login", github);
  }

  async function invite(role: Role) {
    const { data, error } = await sb.from("invites").insert({ workspace_id: ws.id, role }).select("token").single();
    if (error) return toast(error.message, "error");
    const url = `${location.origin}/join/${data.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`${role === "mentor" ? "Mentor" : "Member"} invite link copied`);
    } catch {
      toast("Invite link created");
    }
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <Block title="Workspace" sub={owner ? "The repository is read from GitHub's public API." : "Only the team lead can change these."}>
        <form onSubmit={saveWorkspace} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_96px]">
            <div>
              <label className="label" htmlFor="ws-name">
                Name
              </label>
              <input id="ws-name" name="name" required maxLength={80} defaultValue={ws.name} disabled={!owner || ws.demo} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="ws-key">
                Key
              </label>
              <input id="ws-key" value={ws.key} disabled className="field mono" title="The key prefixes every ID, so it can't change." readOnly />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ws-course">
              Course
            </label>
            <input id="ws-course" name="course" maxLength={80} defaultValue={ws.course} disabled={!owner || ws.demo} className="field" placeholder="SE Lab, Sem V" />
          </div>
          <div>
            <label className="label" htmlFor="ws-repo">
              GitHub repository
            </label>
            <input id="ws-repo" name="repo" defaultValue={ws.repo ?? ""} disabled={!owner || ws.demo} className="field mono" placeholder="owner/repo or https://github.com/owner/repo" />
            {lastError && <p className="mt-1.5 text-[12.5px] text-warn">Last sync: {lastError}</p>}
          </div>
          {owner && !ws.demo && (
            <button disabled={busy} className="btn btn-primary">
              Save
            </button>
          )}
        </form>
      </Block>

      <Block id="profile" title="You" sub="Your GitHub username is how your commits land on your receipt.">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="p-name">
                Name
              </label>
              <input id="p-name" name="name" required maxLength={80} defaultValue={profile.name} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="p-gh">
                GitHub username
              </label>
              <input id="p-gh" name="github" maxLength={60} defaultValue={profile.github ?? ""} className="field mono" placeholder="octocat" autoCapitalize="off" spellCheck={false} />
            </div>
          </div>
          <button disabled={busy} className="btn btn-primary">
            Save
          </button>
        </form>
      </Block>

      <Block title="People" sub="Members do the work. Mentors can read everything, comment and raise disputes, but can't change the record.">
        <ul className="divide-y divide-line rounded-xl border border-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <Avatar profile={m.profile} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">
                  {m.profile.name} {m.user_id === me.id && <span className="font-normal text-fg-3">(you)</span>}
                </span>
                <span className="mono block text-[11.5px] text-fg-3">{m.profile.github ? `@${m.profile.github}` : "no GitHub username"}</span>
              </span>
              {owner && m.user_id !== me.id && !ws.demo ? (
                <>
                  <select
                    aria-label={`Role for ${m.profile.name}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => run(() => sb.from("members").update({ role: e.target.value }).eq("workspace_id", ws.id).eq("user_id", m.user_id), "Role changed")}
                    className="field h-8 min-h-0 w-32 py-0 text-[12.5px]"
                  >
                    {(["owner", "member", "mentor"] as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => confirmRemove(m.profile.name) && run(() => sb.from("members").delete().eq("workspace_id", ws.id).eq("user_id", m.user_id), `${m.profile.name} removed`)}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="chip">{ROLE[m.role]}</span>
              )}
            </li>
          ))}
        </ul>
      </Block>

      {owner && !ws.demo && (
        <Block title="Invite" sub="Links work for 14 days. Anyone with the link can join, so share it only with your team or mentor.">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => invite("member")}>
              <Icon name="link" size={14} /> Copy member invite
            </button>
            <button className="btn" onClick={() => invite("mentor")}>
              <Icon name="mentor" size={14} /> Copy mentor invite
            </button>
          </div>
          {invites.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {invites.map((i) => {
                const expired = Date.parse(i.expires_at) < now;
                return (
                  <li key={i.token} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
                    <span className="chip">{ROLE[i.role]}</span>
                    <span className="mono min-w-0 flex-1 truncate text-[12px] text-fg-2">
                      /join/{i.token}
                    </span>
                    <span className={`text-[12px] ${expired ? "text-warn" : "text-fg-3"}`}>{expired ? "expired" : `made ${ago(i.created_at, now)}`}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`${location.origin}/join/${i.token}`).catch(() => {});
                        toast("Copied");
                      }}
                    >
                      <Icon name="copy" size={13} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => run(() => sb.from("invites").delete().eq("token", i.token), "Invite revoked")}>
                      Revoke
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Block>
      )}

      {!ws.demo && (
        <Block title={owner ? "Danger zone" : "Leave"} sub={owner ? "Deleting removes every story, task, commit link, decision and message. It can't be undone." : "You can rejoin with a new invite."}>
          {owner ? (
            <div className="space-y-3">
              <label className="label" htmlFor="confirm">
                Type <span className="mono text-fg">{ws.name}</span> to confirm
              </label>
              <input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field max-w-sm" />
              <button
                disabled={busy || confirm !== ws.name}
                className="btn border-warn text-warn"
                onClick={async () => {
                  const { error } = await sb.from("workspaces").delete().eq("id", ws.id);
                  if (error) return toast(error.message, "error");
                  router.replace("/home");
                }}
              >
                Delete workspace
              </button>
            </div>
          ) : (
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Leave this workspace?")) return;
                const { error } = await sb.from("members").delete().eq("workspace_id", ws.id).eq("user_id", me.id);
                if (error) return toast(error.message, "error");
                router.replace("/home");
              }}
            >
              Leave workspace
            </button>
          )}
        </Block>
      )}
    </div>
  );
}

function confirmRemove(name: string) {
  return window.confirm(`Remove ${name} from the workspace? Their work stays on the record.`);
}
