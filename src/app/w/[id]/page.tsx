import Link from "next/link";
import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { Loom, type LoomRow } from "@/components/loom";
import { SyncButton } from "@/components/sync-button";
import { Avatar, PageHeader, SectionTitle, ShareBar } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { ago, firstName, pct, plural, requestTime } from "@/lib/format";
import { health, memberName, ref, traceStories } from "@/lib/trace";

export const metadata = { title: "Overview" };

export default async function Overview(props: PageProps<"/w/[id]">) {
  await connection();
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  const now = requestTime();
  const h = health(v, now);
  const traces = traceStories(v);
  const base = `/w/${id}`;
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const suggestions = v.links.filter((l) => l.status === "suggested").length;

  const times = [...v.stories.map((s) => Date.parse(s.created_at)), ...v.commits.map((c) => Date.parse(c.committed_at))];
  const from = times.length ? Math.min(...times) : now - 14 * 86_400_000;
  const rows: LoomRow[] = traces.map((t) => ({
    id: t.story.id,
    ref: ref(v.key, t.story.number),
    title: t.story.title,
    href: `${base}/stories/${t.story.number}`,
    state: t.state,
    start: Date.parse(t.story.created_at),
    knots: [
      ...t.commits.map((c) => ({
        t: Date.parse(c.committed_at),
        hue: profile.get(c.user_id ?? "")?.hue ?? 0,
        label: `${c.message.split("\n")[0]} (${c.sha.slice(0, 7)}, ${c.user_id ? firstName(memberName(v.members, c.user_id)) : c.author_name})`,
        kind: "commit" as const,
      })),
      ...t.tasks
        .filter((k) => k.done_at)
        .map((k) => ({ t: Date.parse(k.done_at!), hue: 0, label: `${ref(v.key, k.number)} done: ${k.title}`, kind: "task" as const })),
      ...t.decisions.map((x) => ({ t: Date.parse(x.created_at), hue: 0, label: `D-${x.number}: ${x.title}`, kind: "decision" as const })),
    ],
  }));

  const activity = [
    ...v.commits.slice(0, 12).map((c) => ({
      at: c.committed_at,
      who: c.user_id,
      fallback: c.author_name,
      text: c.message.split("\n")[0],
      tag: c.sha.slice(0, 7),
      href: `${base}/commits#c-${c.sha.slice(0, 7)}`,
    })),
    ...v.tasks
      .filter((t) => t.done_at)
      .map((t) => ({ at: t.done_at!, who: t.assignee, fallback: "", text: `finished ${t.title}`, tag: ref(v.key, t.number), href: `${base}/board` })),
    ...v.decisions.map((x) => ({ at: x.created_at, who: x.decided_by, fallback: "", text: `decided: ${x.title}`, tag: `D-${x.number}`, href: `${base}/decisions#d-${x.number}` })),
    ...v.disputes.map((x) => ({ at: x.created_at, who: x.raised_by, fallback: "", text: `raised a dispute`, tag: x.status, href: `${base}/receipts/${x.subject}` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  const seg = [
    { label: "Traced", value: h.coverage.traced, color: "var(--thread)" },
    { label: "Building", value: h.coverage.building, color: "var(--fg-2)" },
    { label: "Planned", value: h.coverage.planned, color: "var(--fg-3)" },
    { label: "Untraced", value: h.coverage.untraced, color: "var(--warn)" },
  ];

  return (
    <>
      <PageHeader
        title={v.ws.name}
        sub={
          v.ws.repo ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="commits" size={14} />
              <a className="link" href={`https://github.com/${v.ws.repo}`} target="_blank" rel="noreferrer">
                {v.ws.repo}
              </a>
              {v.syncedAt && <span className="text-fg-3">, synced {ago(v.syncedAt, now)}</span>}
            </span>
          ) : v.ws.demo ? (
            `${v.ws.course ? `${v.ws.course}. ` : ""}A fictional demo team: its commits live in Trace, not on GitHub.`
          ) : (
            <span>
              No repository yet.{" "}
              <Link className="link" href={`${base}/settings`}>
                Connect GitHub
              </Link>{" "}
              to trace commits.
            </span>
          )
        }
      >
        {v.ws.repo && v.me.role !== "mentor" && <SyncButton workspaceId={id} />}
      </PageHeader>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-line">
          <div className="sm:pr-8">
            <p className="label-sm">Traced end to end</p>
            <p className="figure mt-3 text-[60px]">{h.coverage.pct}%</p>
            <p className="mt-2 text-[13px] text-fg-2">
              {h.coverage.traced} of {plural(h.coverage.total, "story", "stories")} done and backed by commits.
            </p>
            <div className="mt-5">
              <ShareBar parts={seg} height={4} />
              <dl className="mt-3 grid grid-cols-4 gap-2 text-[11.5px]">
                {seg.map((s) => (
                  <div key={s.label}>
                    <dt className="text-fg-3">{s.label}</dt>
                    <dd className="num mt-0.5 font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="sm:pl-8">
            <p className="label-sm">Balance of work</p>
            <p className="figure mt-3 text-[60px]">{pct(h.balance)}</p>
            <p className="mt-2 text-[13px] text-fg-2">100% would mean everyone did an equal share.</p>
            <div className="mt-5">
              <ShareBar parts={h.team.map((t) => ({ label: memberName(v.members, t.user_id), value: t.weight, hue: profile.get(t.user_id)?.hue }))} height={4} />
              <dl className="mt-3 grid grid-cols-4 gap-2 text-[11.5px]">
                {h.team.slice(0, 4).map((t) => (
                  <div key={t.user_id}>
                    <dt className="truncate text-fg-3">
                      <Link href={`${base}/receipts/${t.user_id}`} className="hover:text-fg">
                        {firstName(memberName(v.members, t.user_id))}
                      </Link>
                    </dt>
                    <dd className="num mt-0.5 font-medium">{pct(t.weight)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-bg-2 p-4">
          <p className="label-sm px-1">Needs attention</p>
          <ul className="mt-2 text-[13px]">
            {suggestions > 0 && (
              <li>
                <Link href={`${base}/commits?show=suggested`} className="row-hover flex items-start gap-2.5 rounded-lg px-1 py-1.5">
                  <Icon name="link" size={15} className="mt-px shrink-0 text-thread" />
                  <span>{plural(suggestions, "suggested link")} to confirm</span>
                </Link>
              </li>
            )}
            {h.flags.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5 px-1 py-1.5 text-fg-2">
                <Icon name={f.level === "warn" ? "warn" : "info"} size={15} className={`mt-px shrink-0 ${f.level === "warn" ? "text-warn" : "text-fg-3"}`} />
                <span>{f.text}</span>
              </li>
            ))}
            {suggestions === 0 && h.flags.length === 0 && <li className="px-1 py-1.5 text-fg-2">Nothing right now.</li>}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle
          right={
            <span className="hidden items-center gap-3 text-[11.5px] text-fg-3 sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-fg-3" /> commit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-px bg-fg" /> task done
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rotate-45 border border-thread" /> decision
              </span>
            </span>
          }
        >
          Stories over time
        </SectionTitle>
        <div className="panel overflow-x-auto p-4 sm:p-5">
          {rows.length ? (
            <div className="min-w-[640px]">
              <Loom rows={rows} from={from} to={now} />
            </div>
          ) : (
            <p className="py-6 text-center text-fg-2">
              No stories yet.{" "}
              <Link className="link" href={`${base}/stories`}>
                Write the first one
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionTitle>Latest</SectionTitle>
          <ol className="relative">
            {activity.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="row-hover -mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
                  <Avatar profile={a.who ? profile.get(a.who) : null} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    <span className="font-medium">{a.who ? firstName(memberName(v.members, a.who)) : a.fallback || "Someone"}</span>{" "}
                    <span className="text-fg-2">{a.text}</span>
                  </span>
                  <span className="mono hidden text-[11px] text-fg-3 sm:inline">{a.tag}</span>
                  <span className="w-20 shrink-0 text-right text-[12px] text-fg-3">{ago(a.at, now)}</span>
                </Link>
              </li>
            ))}
            {activity.length === 0 && <li className="text-fg-2">Nothing has happened yet.</li>}
          </ol>
        </div>
        <div>
          <SectionTitle right={<Link href={`${base}/receipts`} className="text-[12px] text-fg-3 hover:text-fg">All receipts</Link>}>People</SectionTitle>
          <ul className="space-y-1">
            {v.members.map((m) => {
              const t = h.team.find((x) => x.user_id === m.user_id);
              return (
                <li key={m.user_id}>
                  <Link href={m.role === "mentor" ? `${base}/settings` : `${base}/receipts/${m.user_id}`} className="row-hover -mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
                    <Avatar profile={m.profile} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{m.profile.name}</span>
                      <span className="block text-[12px] text-fg-3">
                        {m.role === "mentor"
                          ? "Mentor"
                          : t
                            ? `${plural(t.commits, "commit")}, ${plural(t.tasks, "task")}, ${plural(t.decisions, "decision")}`
                            : "No work yet"}
                      </span>
                    </span>
                    {t && <span className="num text-[13px] text-fg-2">{pct(t.weight)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
