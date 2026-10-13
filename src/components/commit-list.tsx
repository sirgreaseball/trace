"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { Avatar, personColor } from "./ui";
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
  links: initial,
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
  const [links, setLinks] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setLinks(initial);
  }
  const sb = supabaseBrowser();
  const profile = new Map(members.map((m) => [m.user_id, m.profile]));
  const label = (l: { story_id: string | null; task_id: string | null }) => {
    const item = l.task_id ? tasks.find((t) => t.id === l.task_id) : stories.find((s) => s.id === l.story_id);
    return item ? { ref: `${keyPrefix}-${item.number}`, title: item.title, story: l.task_id ? (tasks.find((t) => t.id === l.task_id)?.story_id ?? null) : l.story_id } : null;
  };
  const storyNumber = (id: string | null) => stories.find((s) => s.id === id)?.number;

  if (commits.length === 0) {
    return (
      <div className="pane px-6 py-14 text-center">
        <Icon name="commits" size={30} className="mx-auto text-ink-3" />
        <p className="mt-3 text-[15px] text-ink-2">{empty}</p>
      </div>
    );
  }

  const shown = commits.slice(0, limit);
  const days: { day: string; items: Commit[] }[] = [];
  for (const c of shown) {
    const d = day(c.committed_at);
    if (days.at(-1)?.day !== d) days.push({ day: d, items: [] });
    days.at(-1)!.items.push(c);
  }

  async function decide(l: LinkRow, status: "confirmed" | "rejected") {
    const prev = links;
    setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, status } : x)));
    const ok = await run(() => sb.from("links").update({ status }).eq("id", l.id), status === "confirmed" ? "Link confirmed" : "Suggestion dismissed");
    if (!ok) setLinks(prev);
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
    <div className="space-y-8">
      {days.map((g) => (
        <section key={g.day}>
          <h2 className="t-section mb-3 flex items-center gap-2 px-1">
            {g.day}
            <span className="num font-normal text-ink-3">{g.items.length}</span>
          </h2>
          <ul className="pane divide overflow-hidden">
            {g.items.map((c) => {
              const mine = links.filter((l) => l.commit_id === c.id);
              const confirmed = mine.filter((l) => l.status === "confirmed");
              const suggested = mine.filter((l) => l.status === "suggested");
              const who = c.user_id ? profile.get(c.user_id) : null;
              return (
                <li key={c.id} id={`c-${c.sha.slice(0, 7)}`} className="scroll-mt-28 px-4 py-3.5 target:bg-accent-soft sm:px-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-8 w-[3px] shrink-0 rounded-full" style={{ background: who ? personColor(who.hue, 0.66, 0.15) : "var(--line-2)" }} />
                    <Avatar profile={who ?? null} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] leading-snug font-[520] break-words">{c.message.split("\n")[0]}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-3">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="ref transition-colors hover:text-ink">
                            {c.sha.slice(0, 7)}
                          </a>
                        ) : (
                          <span className="ref">{c.sha.slice(0, 7)}</span>
                        )}
                        <span>{who?.name ?? c.author_name ?? c.author_login}</span>
                        {c.detailed && (
                          <span className="num">
                            <span className="text-[light-dark(#13865c,#4ad49a)]">+{c.additions}</span> <span className="text-[light-dark(#c4383e,#ff7a7f)]">−{c.deletions}</span> · {c.files.length} {c.files.length === 1 ? "file" : "files"}
                          </span>
                        )}
                        <span>{ago(c.committed_at, now)}</span>
                      </p>
                    </div>
                    <div className="flex max-w-[45%] flex-wrap justify-end gap-1.5">
                      <AnimatePresence initial={false}>
                        {confirmed.map((l) => {
                          const it = label(l);
                          return it ? (
                            <motion.span key={l.id} layout initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}>
                              <Link
                                href={it.story ? `/w/${workspaceId}/stories/${storyNumber(it.story)}` : `/w/${workspaceId}/board`}
                                className="chip chip-accent mono h-6 px-2.5 text-[11.5px]"
                                title={`${it.title} · ${l.reason ?? l.source}`}
                              >
                                <Icon name="link" size={11} bold />
                                {it.ref}
                              </Link>
                            </motion.span>
                          ) : null;
                        })}
                      </AnimatePresence>
                      {canWrite && confirmed.length === 0 && suggested.length === 0 && (
                        <button className="btn btn-sm" onClick={() => setPicking(picking === c.id ? null : c.id)} aria-expanded={picking === c.id}>
                          <Icon name="link" size={13} /> Link
                        </button>
                      )}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {suggested.map((l) => {
                      const it = label(l);
                      if (!it) return null;
                      return (
                        <motion.div
                          key={l.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0, filter: "blur(4px)" }}
                          transition={{ type: "spring", bounce: 0, duration: 0.45 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 ml-[45px] flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-accent-soft px-3.5 py-2.5 text-[13px]">
                            <span className="font-[600] text-accent-ink">Looks like</span>
                            <span className="ref text-ink">{it.ref}</span>
                            <span className="min-w-0 flex-1 truncate font-[520]">{it.title}</span>
                            {l.reason && <span className="hidden text-ink-3 md:inline">{l.reason}</span>}
                            {canWrite && (
                              <span className="flex gap-1.5">
                                <button disabled={busy} className="btn btn-primary btn-sm" onClick={() => decide(l, "confirmed")}>
                                  <Icon name="check" size={13} bold /> Confirm
                                </button>
                                <button disabled={busy} className="btn btn-ghost btn-sm" onClick={() => decide(l, "rejected")}>
                                  Not this
                                </button>
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {picking === c.id && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 ml-[45px]">
                      <select autoFocus defaultValue="" onChange={(e) => e.target.value && link(c.id, e.target.value)} className="field field-sm h-9 max-w-md" aria-label="Link this commit to">
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
                    </motion.div>
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
