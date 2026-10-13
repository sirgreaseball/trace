import Link from "next/link";
import { connection } from "next/server";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SyncButton } from "@/components/sync-button";
import { Pulse } from "@/components/today";
import { Avatar, Avatars, PageTitle, Section, StateMark, STATE_LABEL } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { ago, firstName, plural, requestTime } from "@/lib/format";
import { health, memberName, ref, traceStories, type StoryState } from "@/lib/trace";
import type { TraceData } from "@/lib/types";

export const metadata = { title: "Today" };

const ORDER: Record<StoryState, number> = { building: 0, planned: 1, untraced: 2, traced: 3 };

export default async function Today(props: PageProps<"/w/[id]">) {
  await connection();
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  const now = requestTime();
  const h = health(v, now);
  const traces = traceStories(v);
  const base = `/w/${id}`;
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const storyOf = new Map(v.stories.map((s) => [s.id, s]));
  const mentor = v.me.role === "mentor";

  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greet = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  const times = [...v.stories.map((s) => Date.parse(s.created_at)), ...v.commits.map((c) => Date.parse(c.committed_at)), ...v.tasks.map((t) => Date.parse(t.created_at))];
  const start = (times.length ? Math.min(...times) : now - 21 * 86_400_000) - 86_400_000;

  // The client only needs what the numbers are made of, not the prose.
  const slim: TraceData = {
    key: v.key,
    members: v.members,
    stories: v.stories.map((s) => ({ ...s, narrative: "", acceptance: "" })),
    tasks: v.tasks.map((t) => ({ ...t, title: "" })),
    commits: v.commits.map((c) => ({ ...c, message: "", files: [], url: null })),
    links: v.links.map((l) => ({ ...l, reason: null })),
    decisions: v.decisions.map((x) => ({ ...x, title: "", rationale: "", alternatives: "" })),
    disputes: [],
  };

  const suggestions = v.links.filter((l) => l.status === "suggested").length;
  const mine = v.tasks.filter((t) => t.assignee === v.me.id && t.status !== "done").sort((a, b) => (a.status === b.status ? a.number - b.number : a.status === "doing" ? -1 : 1));
  const disputesOnMe = v.disputes.filter((x) => x.status === "open" && x.subject === v.me.id).length;

  const sub = [
    `${h.coverage.traced} of ${plural(h.coverage.total, "story", "stories")} traced end to end.`,
    !mentor && mine.length ? `You have ${plural(mine.length, "open task")}.` : "",
    suggestions ? `${plural(suggestions, "suggested link")} ${suggestions === 1 ? "waits" : "wait"} for a yes or no.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stories = [...traces].sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.story.number - b.story.number).slice(0, 6);

  const activity = [
    ...v.commits.slice(0, 10).map((c) => ({ at: c.committed_at, who: c.user_id, fallback: c.author_name, text: c.message.split("\n")[0], tag: c.sha.slice(0, 7), href: `${base}/commits#c-${c.sha.slice(0, 7)}`, icon: "commits" as IconName })),
    ...v.tasks.filter((t) => t.done_at).map((t) => ({ at: t.done_at!, who: t.assignee, fallback: "", text: `finished ${t.title}`, tag: ref(v.key, t.number), href: t.story_id ? `${base}/stories/${storyOf.get(t.story_id)?.number}` : `${base}/board`, icon: "check" as IconName })),
    ...v.decisions.map((x) => ({ at: x.created_at, who: x.decided_by, fallback: "", text: `decided: ${x.title}`, tag: `D-${x.number}`, href: `${base}/decisions#d-${x.number}`, icon: "decisions" as IconName })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7);

  const attention: { icon: IconName; text: ReactNode; href?: string; tone: "warn" | "info" | "accent" }[] = [
    ...(suggestions ? [{ icon: "link" as IconName, text: `${plural(suggestions, "suggested link")} to confirm`, href: `${base}/commits?show=suggested`, tone: "accent" as const }] : []),
    ...(disputesOnMe ? [{ icon: "receipts" as IconName, text: `${plural(disputesOnMe, "line")} on your receipt disputed`, href: `${base}/receipts/${v.me.id}`, tone: "warn" as const }] : []),
    ...h.flags.map((f) => ({ icon: (f.level === "warn" ? "warn" : "info") as IconName, text: f.text, tone: f.level })),
  ];

  return (
    <>
      <PageTitle
        kicker={today}
        title={
          <>
            {greet}, {firstName(v.me.name)}.
          </>
        }
        sub={sub}
      >
        {v.ws.repo && !mentor && <SyncButton workspaceId={id} />}
      </PageTitle>

      <div className="rise" style={{ "--i": 1 } as CSSProperties}>
        <Pulse data={slim} now={now} start={start} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          {!mentor && (
            <Section title="For you" className="rise" style={{ "--i": 3 } as CSSProperties}>
              <ul className="pane divide overflow-hidden">
                {mine.slice(0, 5).map((t) => {
                  const s = t.story_id ? storyOf.get(t.story_id) : null;
                  return (
                    <li key={t.id}>
                      <Link href={s ? `${base}/stories/${s.number}` : `${base}/board`} className="row flex items-center gap-3.5 px-5 py-3.5">
                        <span className={`grid size-5 shrink-0 place-items-center rounded-full ${t.status === "doing" ? "bg-[conic-gradient(var(--ink)_0_50%,transparent_0)] shadow-[inset_0_0_0_1.5px_var(--ink)]" : "shadow-[inset_0_0_0_1.5px_var(--ink-3)]"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-[540]">{t.title}</span>
                          <span className="block truncate text-[12.5px] text-ink-3">
                            {t.status === "doing" ? "In progress" : "To do"}
                            {s ? ` · ${s.title}` : ""}
                          </span>
                        </span>
                        <span className="ref">{ref(v.key, t.number)}</span>
                        <Icon name="right" size={14} className="text-ink-3" />
                      </Link>
                    </li>
                  );
                })}
                {mine.length === 0 && (
                  <li className="flex items-center gap-3 px-5 py-5 text-[14px] text-ink-2">
                    <Icon name="checkCircle" size={20} weight="fill" className="text-[var(--r1)]" /> Nothing assigned to you is open. Pick something up on the{" "}
                    <Link className="link -ml-1.5" href={`${base}/board`}>
                      board
                    </Link>
                  </li>
                )}
              </ul>
              {mine.length > 5 && (
                <Link href={`${base}/board`} className="mt-2 inline-flex px-1 text-[13px] text-ink-3 hover:text-ink">
                  {mine.length - 5} more on the board
                </Link>
              )}
            </Section>
          )}

          <Section
            title="Stories"
            className="rise"
            style={{ "--i": 4 } as CSSProperties}
            right={
              <Link href={`${base}/trace`} className="text-[13px] text-ink-3 transition-colors hover:text-ink">
                All {traces.length} in Trace
              </Link>
            }
          >
            <ul className="pane divide overflow-hidden">
              {stories.map((t) => {
                const done = t.tasks.filter((k) => k.status === "done").length;
                return (
                  <li key={t.story.id}>
                    <Link href={`${base}/stories/${t.story.number}`} className="row flex items-center gap-3.5 px-5 py-3.5">
                      <StateMark state={t.state} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-[540]">{t.story.title}</span>
                        <span className="block text-[12.5px] text-ink-3">
                          {STATE_LABEL[t.state]} · {t.tasks.length ? `${done} of ${plural(t.tasks.length, "task")}` : "no tasks"} · {plural(t.commits.length, "commit")}
                        </span>
                      </span>
                      <span className="hidden sm:block">{t.people.length > 0 && <Avatars people={t.people.map((p) => profile.get(p)!).filter(Boolean)} size={22} />}</span>
                      <span className="ref w-11 text-right">{ref(v.key, t.story.number)}</span>
                    </Link>
                  </li>
                );
              })}
              {stories.length === 0 && (
                <li className="px-5 py-6 text-[14px] text-ink-2">
                  No stories yet.{" "}
                  <Link className="link" href={`${base}/trace`}>
                    Write the first one
                  </Link>
                  .
                </li>
              )}
            </ul>
          </Section>
        </div>

        <div className="space-y-10">
          <Section title="Needs attention" className="rise" style={{ "--i": 3 } as CSSProperties}>
            <ul className="pane divide overflow-hidden">
              {attention.map((a, i) => {
                const inner = (
                  <>
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${a.tone === "warn" ? "bg-warn-soft text-warn" : a.tone === "accent" ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-ink-2"}`}
                    >
                      <Icon name={a.icon} size={16} weight="bold" />
                    </span>
                    <span className="min-w-0 flex-1 text-[14px] leading-snug">{a.text}</span>
                    {a.href && <Icon name="right" size={14} className="text-ink-3" />}
                  </>
                );
                return (
                  <li key={i}>
                    {a.href ? (
                      <Link href={a.href} className="row flex items-center gap-3 px-4 py-3">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
              {attention.length === 0 && (
                <li className="flex items-center gap-3 px-4 py-4 text-[14px] text-ink-2">
                  <Icon name="checkCircle" size={20} weight="fill" className="text-[var(--r3)]" /> All clear. Nothing needs a decision right now.
                </li>
              )}
            </ul>
          </Section>

          <Section
            title="Team"
            className="rise"
            style={{ "--i": 4 } as CSSProperties}
            right={
              <Link href={`${base}/receipts`} className="text-[13px] text-ink-3 transition-colors hover:text-ink">
                Receipts
              </Link>
            }
          >
            <ul className="pane divide overflow-hidden">
              {v.members.map((m) => {
                const t = h.team.find((x) => x.user_id === m.user_id);
                return (
                  <li key={m.user_id}>
                    <Link href={m.role === "mentor" ? `${base}/settings` : `${base}/receipts/${m.user_id}`} className="row flex items-center gap-3 px-4 py-3">
                      <Avatar profile={m.profile} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-[560]">
                          {m.profile.name}
                          {m.user_id === v.me.id && <span className="font-normal text-ink-3"> (you)</span>}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-3">
                          {m.role === "mentor" ? "Mentor" : t ? `${plural(t.commits, "commit")} · ${plural(t.tasks, "task")} · ${plural(t.decisions, "decision")}` : "No work yet"}
                        </span>
                      </span>
                      {t && (
                        <span className="w-16 text-right">
                          <span className="num block text-[15px] font-[620] tracking-[-0.02em]">{Math.round(t.weight * 100)}%</span>
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-3">
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(4, t.weight * 100)}%`, background: `oklch(0.66 0.16 ${m.profile.hue})` }} />
                          </span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Latest" className="rise" style={{ "--i": 5 } as CSSProperties}>
            <ol className="pane divide overflow-hidden">
              {activity.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="row flex items-center gap-3 px-4 py-3">
                    <Avatar profile={a.who ? profile.get(a.who) : null} size={26} />
                    <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                      <span className="font-[600]">{a.who ? firstName(memberName(v.members, a.who)) : a.fallback || "Someone"}</span> <span className="text-ink-2">{a.text}</span>
                    </span>
                    <span className="shrink-0 text-right text-[12px] text-ink-3">{ago(a.at, now)}</span>
                  </Link>
                </li>
              ))}
              {activity.length === 0 && <li className="px-4 py-5 text-[14px] text-ink-2">Nothing has happened yet.</li>}
            </ol>
          </Section>
        </div>
      </div>
    </>
  );
}
