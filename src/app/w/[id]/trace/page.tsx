import Link from "next/link";
import { CsvButton } from "@/components/csv-button";
import { Avatars, PageHeader, PriorityChip, StateChip } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { firstName } from "@/lib/format";
import { coverage, orphanCommits, ref, traceStories } from "@/lib/trace";

export const metadata = { title: "Trace grid" };

export default async function TracePage(props: PageProps<"/w/[id]/trace">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const view = sp.view === "people" ? "people" : "evidence";
  const v = await loadWorkspace(id);
  const traces = traceStories(v);
  const cov = coverage(traces);
  const orphans = orphanCommits(v);
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const builders = v.members.filter((m) => m.role !== "mentor");
  const base = `/w/${id}`;

  // Per story, per person: commits + finished tasks.
  const share = (storyIdx: number, userId: string) => {
    const t = traces[storyIdx];
    return t.commits.filter((c) => c.user_id === userId).length + t.tasks.filter((k) => k.assignee === userId && k.status === "done").length;
  };
  const maxShare = Math.max(1, ...traces.flatMap((_, i) => builders.map((m) => share(i, m.user_id))));

  const csv = [
    ["ID", "Story", "Priority", "State", "Tasks done", "Tasks total", "Commits", "Decisions", "People", "Acceptance criteria"],
    ...traces.map((t) => [
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

  return (
    <>
      <PageHeader
        eyebrow="Requirements traceability"
        title="Trace"
        accent="grid"
        sub={`${cov.traced} of ${cov.total} stories traced end to end. Every row shows what stands behind a requirement.`}
      >
        <div className="flex rounded-lg border border-line-2 p-0.5" role="tablist" aria-label="View">
          <Link role="tab" aria-selected={view === "evidence"} href={`${base}/trace`} className={`btn btn-sm border-0 ${view === "evidence" ? "bg-bg-3" : "btn-ghost"}`}>
            By evidence
          </Link>
          <Link role="tab" aria-selected={view === "people"} href={`${base}/trace?view=people`} className={`btn btn-sm border-0 ${view === "people" ? "bg-bg-3" : "btn-ghost"}`}>
            By person
          </Link>
        </div>
        <CsvButton rows={csv} filename={`${v.key}-traceability-matrix.csv`} />
      </PageHeader>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11.5px] text-fg-3">
              <th className="w-16 py-2.5 pr-2 pl-4 font-medium">ID</th>
              <th className="py-2.5 pr-3 font-medium">Story</th>
              <th className="w-20 py-2.5 pr-3 font-medium">Priority</th>
              <th className="w-28 py-2.5 pr-3 font-medium">State</th>
              {view === "evidence" ? (
                <>
                  <th className="w-32 py-2.5 pr-3 font-medium">Tasks</th>
                  <th className="w-20 py-2.5 pr-3 text-right font-medium">Commits</th>
                  <th className="w-24 py-2.5 pr-3 font-medium">Decisions</th>
                  <th className="w-28 py-2.5 pr-4 font-medium">People</th>
                </>
              ) : (
                builders.map((m) => (
                  <th key={m.user_id} className="w-20 py-2.5 pr-3 text-center font-medium">
                    {firstName(m.profile.name)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {traces.map((t, i) => (
              <tr key={t.story.id} className="row-hover border-b border-line last:border-0">
                <td className="mono py-2.5 pr-2 pl-4 text-[11.5px] text-fg-3">{ref(v.key, t.story.number)}</td>
                <td className="py-2.5 pr-3">
                  <Link href={`${base}/stories/${t.story.number}`} className="font-medium hover:underline">
                    {t.story.title}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <PriorityChip priority={t.story.priority} />
                </td>
                <td className="py-2.5 pr-3">
                  <StateChip state={t.state} />
                </td>
                {view === "evidence" ? (
                  <>
                    <td className="py-2.5 pr-3">
                      {t.tasks.length ? (
                        <span className="inline-flex items-center gap-1" title={`${t.tasks.filter((k) => k.status === "done").length} of ${t.tasks.length} done`}>
                          {t.tasks.map((k) => (
                            <span
                              key={k.id}
                              className={`size-2 rounded-full ${k.status === "done" ? "bg-thread" : k.status === "doing" ? "border border-thread bg-thread-soft" : "border border-fg-3"}`}
                            />
                          ))}
                          <span className="ml-1 text-[11.5px] text-fg-3 num">
                            {t.tasks.filter((k) => k.status === "done").length}/{t.tasks.length}
                          </span>
                        </span>
                      ) : (
                        <span className="text-fg-3">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right num">{t.commits.length || <span className="text-fg-3">—</span>}</td>
                    <td className="py-2.5 pr-3">
                      {t.decisions.length ? (
                        <span className="flex flex-wrap gap-1">
                          {t.decisions.map((x) => (
                            <Link key={x.id} href={`${base}/decisions#d-${x.number}`} className="chip mono text-[10.5px] hover:text-fg">
                              D-{x.number}
                            </Link>
                          ))}
                        </span>
                      ) : (
                        <span className="text-fg-3">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {t.people.length ? <Avatars people={t.people.map((p) => profile.get(p)!).filter(Boolean)} /> : <span className="text-fg-3">—</span>}
                    </td>
                  </>
                ) : (
                  builders.map((m) => {
                    const n = share(i, m.user_id);
                    return (
                      <td key={m.user_id} className="py-2 pr-3 text-center">
                        {n ? (
                          <span
                            className="inline-grid h-6 min-w-8 place-items-center rounded-md px-1.5 text-[12px] font-medium num"
                            style={{
                              background: `color-mix(in oklab, oklch(0.62 0.13 ${m.profile.hue}) ${Math.round(18 + (n / maxShare) * 62)}%, transparent)`,
                              color: n / maxShare > 0.5 ? "#fff" : "var(--fg)",
                            }}
                          >
                            {n}
                          </span>
                        ) : (
                          <span className="text-fg-3">·</span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {traces.length === 0 && <p className="px-4 py-10 text-center text-fg-2">No stories yet. Add stories to start the grid.</p>}
      </div>
      {view === "people" && <p className="mt-3 text-[12px] text-fg-3">Each cell counts that person&apos;s commits and finished tasks on the story.</p>}

      {orphans.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line-2 px-4 py-3">
          <p className="text-[13px] text-fg-2">
            <span className="font-medium text-fg">{orphans.length} commits</span> aren&apos;t tied to any story yet, so they don&apos;t count towards the trace.
          </p>
          <Link href={`${base}/commits?show=loose`} className="btn btn-sm">
            Tie them up
          </Link>
        </div>
      )}
    </>
  );
}
