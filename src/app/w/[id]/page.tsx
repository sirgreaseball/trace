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
        label: `${c.sha.slice(0, 7)} · ${c.message.split("\n")[0]} — ${c.user_id ? memberName(v.members, c.user_id) : c.author_name}`,
        kind: "commit" as const,
      })),
      ...t.tasks
        .filter((k) => k.done_at)
        .map((k) => ({ t: Date.parse(k.done_at!), hue: 0, label: `${ref(v.key, k.number)} done · ${k.title}`, kind: "task" as const })),
      ...t.decisions.map((x) => ({ t: Date.parse(x.created_at), hue: 0, label: `D-${x.number} · ${x.title}`, kind: "decision" as const })),
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
        eyebrow={v.ws.course || "Workspace"}
        title={v.ws.name}
        sub={
          v.ws.repo ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="commits" size={14} />
              <a className="link" href={`https://github.com/${v.ws.repo}`} target="_blank" rel="noreferrer">
                {v.ws.repo}
              </a>
              {v.syncedAt && <span className="text-fg-3"> · synced {ago(v.syncedAt, now)}</span>}
            </span>
          ) : v.ws.demo ? (
            "A fictional team, so the commits live here rather than on GitHub."
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

      <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
        <div className="bg-bg-2 p-5 sm:p-6">
          <p className="eyebrow">Traced</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="serif text-[64px] leading-[0.85] num">{h.coverage.pct}%</span>
          </p>
          <p className="mt-2 text-[13px] text-fg-2">
            {h.coverage.traced} of {plural(h.coverage.total, "story", "stories")} done and backed by commits.
          </p>
          <div className="mt-4">
            <ShareBar parts={seg} height={5} />
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
              {seg.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label} {s.value}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-bg-2 p-5 sm:p-6">
          <p className="eyebrow">Balance</p>
          <p className="mt-3 serif text-[64px] leading-[0.85] num">{pct(h.balance)}</p>
          <p className="mt-2 text-[13px] text-fg-2">How evenly the work is spread. 100% means everyone did an equal share.</p>
          <div className="mt-4">
            <ShareBar parts={h.team.map((t) => ({ label: memberName(v.members, t.user_id), value: t.weight, hue: profile.get(t.user_id)?.hue }))} height={5} />
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
              {h.team.map((t) => (
                <Link key={t.user_id} href={`${base}/receipts/${t.user_id}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                  <span className="size-1.5 rounded-full" style={{ background: `oklch(0.62 0.13 ${profile.get(t.user_id)?.hue ?? 0})` }} />
                  {firstName(memberName(v.members, t.user_id))} {pct(t.weight)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-bg-2 p-5 sm:p-6">
          <p className="eyebrow">Needs a look</p>
          <ul className="mt-3 space-y-2 text-[13px]">
            {suggestions > 0 && (
              <li>
                <Link href={`${base}/commits?show=suggested`} className="flex items-start gap-2 hover:text-fg">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-thread" />
                  <span>{plural(suggestions, "suggested link")} to confirm</span>
                </Link>
              </li>
            )}
            {h.flags.map((f) => (
              <li key={f.text} className="flex items-start gap-2 text-fg-2">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${f.level === "warn" ? "bg-warn" : "bg-fg-3"}`} />
                <span>{f.text}</span>
              </li>
            ))}
            {suggestions === 0 && h.flags.length === 0 && <li className="text-fg-2">Nothing. The thread is tidy.</li>}
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
          The loom · every story over time
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
                            ? `${plural(t.commits, "commit")} · ${plural(t.tasks, "task")} · ${plural(t.decisions, "decision")}`
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
