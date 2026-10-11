"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import { useRun } from "./use-run";
import { ago, day } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Commit, Link as LinkRow, Member } from "@/lib/types";

type S = { id: string; number: number; title: string };
type T = S & { story_id: string | null };

export function CommitList({
  workspaceId,
  keyPrefix,
  commits,
  links,
  stories,
  tasks,
  members,
  canWrite,
  empty,
  now,
}: {
  workspaceId: string;
  keyPrefix: string;
  commits: Commit[];
  links: LinkRow[];
  stories: S[];
  tasks: T[];
  members: Member[];
  canWrite: boolean;
  empty: string;
  now: number;
}) {
  const { run, busy } = useRun();
  const [picking, setPicking] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  const sb = supabaseBrowser();
  const profile = new Map(members.map((m) => [m.user_id, m.profile]));
  const label = (l: { story_id: string | null; task_id: string | null }) => {
    const item = l.task_id ? tasks.find((t) => t.id === l.task_id) : stories.find((s) => s.id === l.story_id);
    return item ? { ref: `${keyPrefix}-${item.number}`, title: item.title, story: l.task_id ? (tasks.find((t) => t.id === l.task_id)?.story_id ?? null) : l.story_id } : null;
  };
  const storyNumber = (id: string | null) => stories.find((s) => s.id === id)?.number;

  if (commits.length === 0) return <p className="rounded-xl border border-dashed border-line-2 px-6 py-10 text-center text-fg-2">{empty}</p>;

  const shown = commits.slice(0, limit);
  const days: { day: string; items: Commit[] }[] = [];
  for (const c of shown) {
    const d = day(c.committed_at);
    if (days.at(-1)?.day !== d) days.push({ day: d, items: [] });
    days.at(-1)!.items.push(c);
  }

  async function link(commitId: string, value: string) {
    const [kind, id] = value.split(":");
    setPicking(null);
    await run(
      () =>
        sb.from("links").upsert(
          { workspace_id: workspaceId, commit_id: commitId, story_id: kind === "s" ? id : null, task_id: kind === "t" ? id : null, source: "manual", status: "confirmed", reason: "linked by hand" },
          { onConflict: "commit_id,story_id,task_id" },
        ),
      "Linked",
    );
  }

  return (
    <div className="space-y-6">
      {days.map((g) => (
        <section key={g.day}>
          <h2 className="eyebrow mb-2">{g.day}</h2>
          <ul className="panel divide-y divide-line">
            {g.items.map((c) => {
              const mine = links.filter((l) => l.commit_id === c.id);
              const confirmed = mine.filter((l) => l.status === "confirmed");
              const suggested = mine.filter((l) => l.status === "suggested");
              const who = c.user_id ? profile.get(c.user_id) : null;
              return (
                <li key={c.id} id={`c-${c.sha.slice(0, 7)}`} className="scroll-mt-20 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar profile={who ?? null} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-snug break-words">{c.message.split("\n")[0]}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-3">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="mono hover:text-fg">
                            {c.sha.slice(0, 7)}
                          </a>
                        ) : (
                          <span className="mono">{c.sha.slice(0, 7)}</span>
                        )}
                        <span>{who?.name ?? c.author_name ?? c.author_login}</span>
                        {c.detailed && (
                          <span className="num">
                            +{c.additions} −{c.deletions} · {c.files.length} {c.files.length === 1 ? "file" : "files"}
                          </span>
                        )}
                        <span>{ago(c.committed_at, now)}</span>
                      </p>
                    </div>
                    <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
                      {confirmed.map((l) => {
                        const it = label(l);
                        return it ? (
                          <Link key={l.id} href={it.story ? `/w/${workspaceId}/stories/${storyNumber(it.story)}` : `/w/${workspaceId}/board`} className="chip chip-thread mono text-[10.5px]" title={`${it.title} · ${l.reason ?? l.source}`}>
                            {it.ref}
                          </Link>
                        ) : null;
                      })}
                      {canWrite && confirmed.length === 0 && suggested.length === 0 && (
                        <button className="btn btn-sm" onClick={() => setPicking(picking === c.id ? null : c.id)} aria-expanded={picking === c.id}>
                          <Icon name="link" size={13} /> Link
                        </button>
                      )}
                    </div>
                  </div>

                  {suggested.map((l) => {
                    const it = label(l);
                    if (!it) return null;
                    return (
                      <div key={l.id} className="mt-2.5 ml-9 flex flex-wrap items-center gap-2 rounded-lg bg-thread-soft px-3 py-2 text-[12.5px]">
                        <span className="text-thread-ink">Suggested</span>
                        <span className="mono text-[11.5px]">{it.ref}</span>
                        <span className="min-w-0 flex-1 truncate">{it.title}</span>
                        <span className="text-fg-3">{l.reason}</span>
                        {canWrite && (
                          <span className="flex gap-1">
                            <button disabled={busy} className="btn btn-sm" onClick={() => run(() => sb.from("links").update({ status: "confirmed" }).eq("id", l.id), "Link confirmed")}>
                              <Icon name="check" size={13} /> Confirm
                            </button>
                            <button disabled={busy} className="btn btn-sm btn-ghost" onClick={() => run(() => sb.from("links").update({ status: "rejected" }).eq("id", l.id), "Suggestion rejected")}>
                              <Icon name="x" size={13} /> Not this
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {picking === c.id && (
                    <div className="mt-2.5 ml-9">
                      <select autoFocus defaultValue="" onChange={(e) => e.target.value && link(c.id, e.target.value)} className="field h-9 max-w-md text-[13px]" aria-label="Link this commit to">
                        <option value="" disabled>
                          Link this commit to…
                        </option>
                        <optgroup label="Tasks">
                          {tasks.map((t) => (
                            <option key={t.id} value={`t:${t.id}`}>
                              {keyPrefix}-{t.number} {t.title}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Stories">
                          {stories.map((s) => (
                            <option key={s.id} value={`s:${s.id}`}>
                              {keyPrefix}-{s.number} {s.title}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {commits.length > limit && (
        <button className="btn w-full" onClick={() => setLimit(limit + 100)}>
          Show more ({commits.length - limit} left)
        </button>
      )}
    </div>
  );
}
