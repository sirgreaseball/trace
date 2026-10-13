import Link from "next/link";
import type { CSSProperties } from "react";
import { CsvButton } from "@/components/csv-button";
import { Icon } from "@/components/icons";
import { Segmented } from "@/components/rings";
import { StoryForm } from "@/components/story-form";
import { Avatars, Empty, PageTitle, personColor, PriorityTag, StateMark, STATE_HINT, STATE_LABEL } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { firstName, plural } from "@/lib/format";
import { coverage, orphanCommits, ref, traceStories, type StoryState, type StoryTrace } from "@/lib/trace";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Trace" };

const STATES: ("all" | StoryState)[] = ["all", "building", "planned", "untraced", "traced"];

export default async function TracePage(props: PageProps<"/w/[id]/trace">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const view = sp.view === "people" ? "people" : "evidence";
  const v = await loadWorkspace(id);
  const all = traceStories(v);
  const cov = coverage(all);
  const filter = STATES.find((s) => s === sp.state) ?? "all";
  const list = filter === "all" ? all : all.filter((t) => t.state === filter);
  const orphans = orphanCommits(v);
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const builders = v.members.filter((m) => m.role !== "mentor");
  const base = `/w/${id}`;
  const q = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { state: filter === "all" ? null : filter, view: view === "people" ? "people" : null, ...patch };
    for (const [k, val] of Object.entries(next)) if (val) p.set(k, val);
    const s = p.toString();
    return s ? `${base}/trace?${s}` : `${base}/trace`;
  };

  const csv = [
    ["ID", "Story", "Priority", "State", "Tasks done", "Tasks total", "Commits", "Decisions", "People", "Acceptance criteria"],
    ...all.map((t) => [
      ref(v.key, t.story.number),
      t.story.title,
      t.story.priority,
      t.state,
      String(t.tasks.filter((k) => k.status === "done").length),
      String(t.tasks.length),
      t.commits.map((c) => c.sha.slice(0, 7)).join(" "),
      t.decisions.map((x) => `D-${x.number}`).join(" "),
      t.people.map((p) => profile.get(p)?.name ?? "").join("; "),
      t.story.acceptance.replace(/\n/g, " | "),
    ]),
  ];

  // Per story, per person: commits plus finished tasks.
  const share = (t: StoryTrace, uid: string) => t.commits.filter((c) => c.user_id === uid).length + t.tasks.filter((k) => k.assignee === uid && k.status === "done").length;
  const maxShare = Math.max(1, ...all.flatMap((t) => builders.map((m) => share(t, m.user_id))));

  return (
    <>
      <PageTitle
        title="Trace"
        sub={`Every story and what stands behind it: tasks, commits, decisions and people. ${cov.traced} of ${plural(cov.total, "story", "stories")} traced end to end.`}
      >
        <CsvButton rows={csv} filename={`${v.key}-traceability-matrix.csv`} />
        {v.me.role !== "mentor" && <StoryForm workspaceId={id} />}
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          id="trace-state"
          label="Filter by state"
          value={filter}
          items={STATES.map((s) => ({ key: s, label: s === "all" ? "All" : STATE_LABEL[s], href: q({ state: s === "all" ? null : s }), count: s === "all" ? all.length : all.filter((t) => t.state === s).length }))}
        />
        <Segmented
          id="trace-view"
          label="View"
          value={view}
          items={[
            { key: "evidence", label: "Evidence", href: q({ view: null }) },
            { key: "people", label: "People", href: q({ view: "people" }) },
          ]}
        />
      </div>

      {all.length === 0 ? (
        <Empty title="No stories yet" action={v.me.role !== "mentor" ? <StoryForm workspaceId={id} /> : undefined}>
          Start with the one thing your project must do. Write it as “As a …, I want …, so that …”.
        </Empty>
      ) : list.length === 0 ? (
        <Empty title={`No ${STATE_LABEL[filter as StoryState].toLowerCase()} stories`}>{STATE_HINT[filter as StoryState]}. Try another filter.</Empty>
      ) : view === "evidence" ? (
        <ul className="pane divide overflow-hidden">
          {list.map((t, i) => (
            <li key={t.story.id} className="rise" style={{ "--i": Math.min(i, 10) } as CSSProperties}>
              <StoryRow t={t} keyPrefix={v.key} href={`${base}/stories/${t.story.number}`} profile={profile} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="pane overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="text-[12px] text-ink-3">
                <th className="py-3.5 pr-3 pl-5 font-[560]">Story</th>
                {builders.map((m) => (
                  <th key={m.user_id} className="w-24 px-2 py-3.5 text-center font-[560]">
                    <span className="inline-flex flex-col items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: personColor(m.profile.hue) }} />
                      {firstName(m.profile.name)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.story.id} className="row border-t border-line">
                  <td className="py-3 pr-3 pl-5">
                    <Link href={`${base}/stories/${t.story.number}`} className="flex items-center gap-3">
                      <StateMark state={t.state} />
                      <span className="ref w-11 shrink-0">{ref(v.key, t.story.number)}</span>
                      <span className="truncate text-[14px] font-[540]">{t.story.title}</span>
                    </Link>
                  </td>
                  {builders.map((m) => {
                    const n = share(t, m.user_id);
                    const size = n ? 12 + Math.sqrt(n / maxShare) * 22 : 0;
                    return (
                      <td key={m.user_id} className="px-2 py-2 text-center">
                        {n ? (
                          <span
                            className="num inline-grid place-items-center rounded-full text-[11px] font-semibold text-white"
                            style={{ width: size, height: size, background: personColor(m.profile.hue, 0.64, 0.16), boxShadow: `0 4px 14px -4px ${personColor(m.profile.hue, 0.6, 0.18)}` }}
                            title={`${m.profile.name}: ${plural(n, "piece")} of work`}
                          >
                            {size > 20 ? n : ""}
                          </span>
                        ) : (
                          <span className="inline-block size-1 rounded-full bg-line-3" aria-label="none" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="t-caption border-t border-line px-5 py-3">Each circle is that person&apos;s commits and finished tasks on the story. Bigger means more.</p>
        </div>
      )}

      {orphans.length > 0 && (
        <div className="glass mt-6 flex flex-wrap items-center gap-4 rounded-[22px] px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-accent-soft text-accent-ink">
            <Icon name="link" size={19} bold />
          </span>
          <p className="min-w-0 flex-1 text-[14px] text-ink-2">
            <span className="font-[600] text-ink">{plural(orphans.length, "commit")} aren&apos;t tied to a story yet</span>, so they don&apos;t count towards the trace.
          </p>
          <Link href={`${base}/commits?show=loose`} className="btn btn-sm">
            Tie them up <Icon name="arrow" size={13} />
          </Link>
        </div>
      )}
    </>
  );
}

function StoryRow({ t, keyPrefix, href, profile }: { t: StoryTrace; keyPrefix: string; href: string; profile: Map<string, Pick<Profile, "name" | "hue">> }) {
  const done = t.tasks.filter((k) => k.status === "done").length;
  const traced = t.state === "traced";
  return (
    <Link href={href} className="row group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,300px)_auto]">
      <StateMark state={t.state} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="ref shrink-0">{ref(keyPrefix, t.story.number)}</span>
            <span className="truncate text-[15px] font-[580] tracking-[-0.01em]">{t.story.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-3">{t.story.narrative || "No narrative yet"}</span>
      </span>

      {/* The chain: tasks, then commits by colour of whoever made them, then decisions. */}
      <span className="col-span-3 flex min-w-0 items-center gap-2.5 md:col-span-1" aria-label={`${done} of ${t.tasks.length} tasks done, ${t.commits.length} commits, ${t.decisions.length} decisions`}>
        <span className="flex shrink-0 items-center gap-1">
          {t.tasks.slice(0, 8).map((k) => (
            <span key={k.id} className={`mark size-[9px] ${k.status === "done" ? "bg-ink" : k.status === "doing" ? "mark-building size-[9px]" : "mark-planned size-[9px]"}`} />
          ))}
          {t.tasks.length === 0 && <span className="text-[12px] text-ink-3">no tasks</span>}
        </span>
        <span className={`h-[2px] min-w-4 flex-1 rounded-full ${traced ? "bg-[linear-gradient(90deg,var(--r1a),var(--r1b))]" : "bg-line-2"}`} />
        <span className="flex shrink-0 items-center gap-[3px]">
          {t.commits.slice(0, 10).map((c) => (
            <span key={c.id} className="h-3.5 w-[5px] rounded-full" style={{ background: personColor(profile.get(c.user_id ?? "")?.hue, 0.66, 0.15) }} title={c.message.split("\n")[0]} />
          ))}
          {t.commits.length > 10 && <span className="num text-[11px] text-ink-3">+{t.commits.length - 10}</span>}
          {t.commits.length === 0 && <span className="text-[12px] text-ink-3">no commits</span>}
        </span>
        {t.decisions.length > 0 && (
          <>
            <span className="h-[2px] w-3 shrink-0 rounded-full bg-line-2" />
            <span className="flex shrink-0 items-center gap-1">
              {t.decisions.slice(0, 3).map((x) => (
                <span key={x.id} className="size-2 rotate-45 rounded-[2px] bg-[var(--r2)]" title={`D-${x.number}: ${x.title}`} />
              ))}
            </span>
          </>
        )}
      </span>

      <span className="flex items-center gap-3">
        <span className="hidden lg:block">
          <PriorityTag priority={t.story.priority} />
        </span>
        <span className="hidden w-[76px] justify-end sm:flex">{t.people.length > 0 && <Avatars people={t.people.map((p) => profile.get(p)!).filter(Boolean)} size={24} max={3} />}</span>
        <Icon name="right" size={14} className="text-ink-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
