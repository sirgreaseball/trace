import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { MessageRow } from "@/components/message";
import { StoryDiscussion } from "@/components/story-discussion";
import { StoryForm } from "@/components/story-form";
import { TaskList } from "@/components/task-list";
import { Avatar, PriorityChip, SectionTitle, StateChip } from "@/components/ui";
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

  return (
    <article>
      <Link href={`${base}/stories`} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg">
        <Icon name="back" size={14} /> Stories
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0">
          <p className="mono mb-2 text-[12px] text-fg-3">{ref(v.key, t.story.number)}</p>
          <h1 className="display text-[clamp(36px,4.2vw,52px)] text-balance">{t.story.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StateChip state={t.state} />
            <PriorityChip priority={t.story.priority} />
            <span className="text-[12.5px] text-fg-3">
              Written by {t.story.created_by ? firstName(memberName(v.members, t.story.created_by)) : "someone"} · {day(t.story.created_at)}
            </span>
          </div>
        </div>
        {canWrite && <StoryForm workspaceId={id} story={t.story} trigger="edit" />}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-9">
          {t.story.narrative && <p className="max-w-[62ch] border-l-2 border-thread pl-4 text-[17px] leading-relaxed text-fg">{t.story.narrative}</p>}

          <section>
            <SectionTitle>Acceptance criteria</SectionTitle>
            {criteria.length ? (
              <ol className="space-y-2">
                {criteria.map((c, i) => (
                  <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
                    <span className="mono mt-0.5 text-[11.5px] text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-fg-3">None yet. Add criteria so everyone knows what “done” means.</p>
            )}
          </section>

          <section>
            <SectionTitle>Tasks</SectionTitle>
            <TaskList workspaceId={id} storyId={t.story.id} tasks={t.tasks} members={v.members} keyPrefix={v.key} canWrite={canWrite} />
          </section>

          <section>
            <SectionTitle right={<span className="text-[12px] text-fg-3">{plural(t.commits.length, "commit")}</span>}>Commits behind it</SectionTitle>
            {t.commits.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {t.commits.map((c) => {
                  const via = links.find((l) => l.commit_id === c.id);
                  const task = via?.task_id ? v.tasks.find((k) => k.id === via.task_id) : null;
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                      <Avatar profile={c.user_id ? profile.get(c.user_id) : null} size={20} />
                      <span className="mono text-[11.5px] text-fg-3">{c.sha.slice(0, 7)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.message.split("\n")[0]}</span>
                      {task && <span className="chip mono hidden text-[10.5px] sm:inline-flex">{ref(v.key, task.number)}</span>}
                      <span className="num hidden text-[11.5px] text-fg-3 sm:inline">
                        +{c.additions} −{c.deletions}
                      </span>
                      <span className="w-20 text-right text-[11.5px] text-fg-3">{ago(c.committed_at, now)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-fg-3">
                No commits yet. Put <span className="mono text-fg-2">{ref(v.key, t.tasks[0]?.number ?? t.story.number)}</span> in a commit message and sync, and it lands here.
              </p>
            )}
          </section>

          <section>
            <SectionTitle>Discussion</SectionTitle>
            <div className="mb-3">
              {messages.map((m, i) => (
                <MessageRow
                  key={m.id}
                  author={m.user_id ? (profile.get(m.user_id) ?? null) : null}
                  body={m.body}
                  time={ago(m.created_at, now)}
                  keyPrefix={v.key}
                  base={base}
                  compact={i > 0 && messages[i - 1].user_id === m.user_id && Date.parse(m.created_at) - Date.parse(messages[i - 1].created_at) < 600_000}
                  decision={v.decisions.find((x) => x.message_id === m.id)?.number}
                />
              ))}
              {messages.length === 0 && <p className="text-fg-3">No discussion on this story yet.</p>}
            </div>
            <StoryDiscussion workspaceId={id} userId={v.me.id} storyId={t.story.id} stories={v.stories} keyPrefix={v.key} />
          </section>
        </div>

        <aside className="space-y-8 lg:sticky lg:top-8 lg:self-start">
          <section>
            <SectionTitle>People</SectionTitle>
            {t.people.length ? (
              <ul className="space-y-2">
                {t.people.map((p) => (
                  <li key={p}>
                    <Link href={`${base}/receipts/${p}`} className="flex items-center gap-2.5 text-[13px] hover:underline">
                      <Avatar profile={profile.get(p)} size={22} />
                      {memberName(v.members, p)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-fg-3">Nobody has worked on this yet.</p>
            )}
          </section>
          <section>
            <SectionTitle right={canWrite && <Link href={`${base}/decisions?story=${t.story.number}`} className="text-[12px] text-fg-3 hover:text-fg">Log one</Link>}>Decisions</SectionTitle>
            {t.decisions.length ? (
              <ul className="space-y-2.5">
                {t.decisions.map((x) => (
                  <li key={x.id}>
                    <Link href={`${base}/decisions#d-${x.number}`} className="block text-[13px] leading-snug hover:underline">
                      <span className="mono mr-1.5 text-[11px] text-thread-ink">D-{x.number}</span>
                      {x.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-fg-3">No decisions tied to this story.</p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}
