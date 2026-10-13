import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/icons";
import { MessageRow } from "@/components/message";
import { Rings } from "@/components/rings";
import { StoryDiscussion } from "@/components/story-discussion";
import { StoryForm } from "@/components/story-form";
import { TaskList } from "@/components/task-list";
import { Avatar, personColor, PriorityTag, StateLabel } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { ago, day, firstName, plural, requestTime } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { memberName, ref, traceStories } from "@/lib/trace";
import type { Message } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/w/[id]/stories/[n]">) {
  const { id, n } = await props.params;
  const v = await loadWorkspace(id);
  const s = v.stories.find((x) => x.number === Number(n));
  return { title: s ? `${ref(v.key, s.number)} ${s.title}` : "Story" };
}

/** One step of the trace, on a line that runs down the page. */
function Step({ n, title, done, children, right, last = false, i }: { n: number; title: string; done: boolean; children: ReactNode; right?: ReactNode; last?: boolean; i: number }) {
  return (
    <section className="rise relative pl-11" style={{ "--i": i } as CSSProperties}>
      {!last && <span className={`absolute top-8 bottom-[-28px] left-[13px] w-[2px] rounded-full ${done ? "bg-[linear-gradient(var(--r1a),var(--r1b))]" : "bg-line-2"}`} aria-hidden />}
      <span
        className={`num absolute top-0 left-0 grid size-7 place-items-center rounded-full text-[12px] font-[650] ${done ? "bg-[linear-gradient(135deg,var(--r1a),var(--r1b))] text-white shadow-[0_6px_16px_-6px_var(--r1b)]" : "bg-surface text-ink-2 shadow-[var(--shadow-sm),0_0_0_1px_var(--line-2)]"}`}
        aria-hidden
      >
        {done ? <Icon name="check" size={14} bold /> : n}
      </span>
      <div className="mb-3 flex min-h-7 items-center justify-between gap-3">
        <h2 className="t-headline">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default async function StoryPage(props: PageProps<"/w/[id]/stories/[n]">) {
  await connection();
  const { id, n } = await props.params;
  const v = await loadWorkspace(id);
  const t = traceStories(v).find((x) => x.story.number === Number(n));
  if (!t) notFound();
  const sb = await supabaseServer();
  const { data: msgs } = await sb
    .from("messages")
    .select("id, user_id, story_id, body, created_at")
    .eq("workspace_id", id)
    .eq("story_id", t.story.id)
    .order("created_at")
    .limit(200);
  const messages = (msgs ?? []) as Message[];
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const base = `/w/${id}`;
  const now = requestTime();
  const canWrite = v.me.role !== "mentor";
  const criteria = t.story.acceptance.split("\n").filter(Boolean);
  const links = v.links.filter((l) => l.status === "confirmed");
  const done = t.tasks.filter((k) => k.status === "done").length;
  const allDone = t.tasks.length > 0 && done === t.tasks.length;

  return (
    <article>
      <Link href={`${base}/trace`} className="press mb-6 inline-flex items-center gap-1.5 text-[14px] text-ink-3 transition-colors hover:text-ink">
        <Icon name="back" size={15} /> Trace
      </Link>

      <header className="mb-12 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="ref rounded-[8px] bg-surface px-2 py-1 text-[12.5px] shadow-[0_0_0_1px_var(--line)]">{ref(v.key, t.story.number)}</span>
            <StateLabel state={t.state} />
            <PriorityTag priority={t.story.priority} />
          </div>
            <h1 className="t-title max-w-[22ch]">{t.story.title}</h1>
          {t.story.narrative && <p className="mt-5 max-w-[60ch] text-[18px] leading-relaxed tracking-[-0.01em] text-ink-2">{t.story.narrative}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
            Written by {t.story.created_by ? firstName(memberName(v.members, t.story.created_by)) : "someone"} on {day(t.story.created_at)}
            {canWrite && <StoryForm workspaceId={id} story={t.story} trigger="edit" />}
          </div>
        </div>
        <div className="glass flex items-center gap-5 rounded-[28px] p-5">
          <Rings values={[t.state === "traced" ? 1 : 0, t.tasks.length ? done / t.tasks.length : 0, t.commits.length ? 1 : 0]} size={104} width={0.13} glow />
          <dl className="space-y-2 text-[13px]">
            {[
              ["Tasks", `${done} of ${t.tasks.length}`, "--r2b"],
              ["Commits", String(t.commits.length), "--r3b"],
              ["Decisions", String(t.decisions.length), "--r1b"],
            ].map(([k, val, c]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: `var(${c})` }} />
                <dt className="w-[70px] text-ink-3">{k}</dt>
                <dd className="num font-[620]">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-12">
          <Step n={1} i={1} title="What done means" done={criteria.length > 0 && t.state === "traced"}>
            {criteria.length ? (
              <ol className="pane divide overflow-hidden">
                {criteria.map((c, i) => (
                  <li key={i} className="flex gap-3.5 px-5 py-3.5 text-[14.5px] leading-relaxed">
                    <span className="num mt-0.5 text-[12px] font-[620] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[14px] text-ink-3">No acceptance criteria yet. Add some so everyone knows what “done” means.</p>
            )}
          </Step>

          <Step n={2} i={2} title="Tasks" done={allDone} right={<span className="num text-[13px] text-ink-3">{t.tasks.length ? `${done} of ${t.tasks.length} done` : ""}</span>}>
            <TaskList workspaceId={id} storyId={t.story.id} tasks={t.tasks} members={v.members} keyPrefix={v.key} canWrite={canWrite} />
          </Step>

          <Step n={3} i={3} title="Commits behind it" done={t.commits.length > 0} last right={<span className="text-[13px] text-ink-3">{plural(t.commits.length, "commit")}</span>}>
            {t.commits.length ? (
              <ul className="pane divide overflow-hidden">
                {t.commits.map((c) => {
                  const via = links.find((l) => l.commit_id === c.id);
                  const task = via?.task_id ? v.tasks.find((k) => k.id === via.task_id) : null;
                  const who = c.user_id ? profile.get(c.user_id) : null;
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                      <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: personColor(who?.hue, 0.66, 0.15) }} />
                      <Avatar profile={who} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.message.split("\n")[0]}</span>
                        <span className="flex items-center gap-2 text-[12px] text-ink-3">
                          <span className="ref">{c.sha.slice(0, 7)}</span>
                          {task && <span className="ref">via {ref(v.key, task.number)}</span>}
                          <span className="num hidden sm:inline">
                            +{c.additions} −{c.deletions}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-3">{ago(c.committed_at, now)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-3">
                No commits yet. Put <span className="ref text-ink-2">{ref(v.key, t.tasks[0]?.number ?? t.story.number)}</span> in a commit message and sync, and it lands here.
              </p>
            )}
          </Step>

          <section className="rise" style={{ "--i": 4 } as CSSProperties}>
            <h2 className="t-headline mb-2">Discussion</h2>
            <div className="mb-5">
              {messages.map((m, i) => (
                <MessageRow
                  key={m.id}
                  author={m.user_id ? (profile.get(m.user_id) ?? null) : null}
                  body={m.body}
                  time={ago(m.created_at, now)}
                  keyPrefix={v.key}
                  base={base}
                  mine={m.user_id === v.me.id}
                  compact={i > 0 && messages[i - 1].user_id === m.user_id && Date.parse(m.created_at) - Date.parse(messages[i - 1].created_at) < 600_000}
                  decision={v.decisions.find((x) => x.message_id === m.id)?.number}
                />
              ))}
              {messages.length === 0 && <p className="text-[14px] text-ink-3">No discussion on this story yet.</p>}
            </div>
            <StoryDiscussion workspaceId={id} userId={v.me.id} storyId={t.story.id} stories={v.stories} keyPrefix={v.key} />
          </section>
        </div>

        <aside className="space-y-8 lg:sticky lg:top-[calc(var(--bar-h)+24px)] lg:self-start">
          <section>
            <h2 className="t-section mb-3 px-1">People</h2>
            <ul className="pane divide overflow-hidden">
              {t.people.map((p) => (
                <li key={p}>
                  <Link href={`${base}/receipts/${p}`} className="row flex items-center gap-3 px-4 py-3 text-[14px] font-[540]">
                    <Avatar profile={profile.get(p)} size={30} />
                    <span className="min-w-0 flex-1 truncate">{memberName(v.members, p)}</span>
                    <Icon name="right" size={14} className="text-ink-3" />
                  </Link>
                </li>
              ))}
              {t.people.length === 0 && <li className="px-4 py-4 text-[13.5px] text-ink-3">Nobody has worked on this yet.</li>}
            </ul>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="t-section">Decisions</h2>
              {canWrite && (
                <Link href={`${base}/decisions?story=${t.story.number}`} className="text-[13px] text-ink-3 transition-colors hover:text-ink">
                  Log one
                </Link>
              )}
            </div>
            <ul className="pane divide overflow-hidden">
              {t.decisions.map((x) => (
                <li key={x.id}>
                  <Link href={`${base}/decisions#d-${x.number}`} className="row flex gap-3 px-4 py-3 text-[14px] leading-snug">
                    <span className="ref shrink-0 pt-0.5 text-[var(--r2)]">D-{x.number}</span>
                    {x.title}
                  </Link>
                </li>
              ))}
              {t.decisions.length === 0 && <li className="px-4 py-4 text-[13.5px] text-ink-3">No decisions tied to this story.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </article>
  );
}
