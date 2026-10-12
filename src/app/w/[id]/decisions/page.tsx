import Link from "next/link";
import { connection } from "next/server";
import { ConflictActions, DecisionForm } from "@/components/decisions";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { ago, day, requestTime } from "@/lib/format";
import { conflicts, memberName, ref } from "@/lib/trace";

export const metadata = { title: "Decisions" };

export default async function DecisionsPage(props: PageProps<"/w/[id]/decisions">) {
  await connection();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const v = await loadWorkspace(id);
  const now = requestTime();
  const base = `/w/${id}`;
  const clashes = conflicts(v.decisions, new Set(v.dismissed));
  const replacedBy = new Map(v.decisions.filter((x) => x.supersedes).map((x) => [x.supersedes!, x]));
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const canWrite = v.me.role !== "mentor";
  const presetStory = v.stories.find((s) => s.number === Number(sp.story))?.id;

  return (
    <>
      <PageHeader title="Decisions" sub="The team's choices and the reasons behind them. Type /decide in chat to log one without leaving the conversation.">
        {canWrite && (
          <DecisionForm
            workspaceId={id}
            stories={v.stories.map((s) => ({ id: s.id, label: `${ref(v.key, s.number)} ${s.title}` }))}
            decisions={v.decisions.map((x) => ({ id: x.id, label: `D-${x.number} ${x.title}` }))}
            presetStory={presetStory}
          />
        )}
      </PageHeader>

      {clashes.length > 0 && (
        <section className="mb-8 space-y-2" aria-label="Possible conflicts">
          {clashes.map((c) => (
            <div key={`${c.earlier.id}:${c.later.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3">
              <span className="text-[13px]">
                <span className="font-medium text-warn">These may contradict each other.</span>{" "}
                <a href={`#d-${c.later.number}`} className="mono text-[12px] underline-offset-2 hover:underline">
                  D-{c.later.number}
                </a>{" "}
                “{c.later.title}” and{" "}
                <a href={`#d-${c.earlier.number}`} className="mono text-[12px] underline-offset-2 hover:underline">
                  D-{c.earlier.number}
                </a>{" "}
                “{c.earlier.title}” both talk about {c.shared.slice(0, 3).map((w) => `“${w}”`).join(", ")}.
              </span>
              {canWrite && <ConflictActions workspaceId={id} earlier={{ id: c.earlier.id, number: c.earlier.number }} later={{ id: c.later.id, number: c.later.number }} />}
            </div>
          ))}
        </section>
      )}

      {v.decisions.length === 0 ? (
        <Empty title="No decisions logged yet.">Log the first big choice: the stack, the database, what&apos;s out of scope. Future you, and your viva, will thank you.</Empty>
      ) : (
        <ol className="relative space-y-3">
          {[...v.decisions].reverse().map((x) => {
            const replaced = replacedBy.get(x.id);
            const story = v.stories.find((s) => s.id === x.story_id);
            const supersedes = v.decisions.find((d) => d.id === x.supersedes);
            return (
              <li key={x.id} id={`d-${x.number}`} className={`panel scroll-mt-20 p-5 target:border-thread target:shadow-[0_0_0_3px_var(--thread-soft)] ${replaced ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <span className="mono mt-0.5 text-[12px] text-thread-ink">D-{x.number}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className={`text-[16px] leading-snug font-semibold ${replaced ? "line-through decoration-fg-3" : ""}`}>{x.title}</h2>
                    {x.rationale && <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-fg-2">{x.rationale}</p>}
                    {x.alternatives && (
                      <p className="mt-2 text-[13px] text-fg-3">
                        <span className="text-fg-2">Considered instead:</span> {x.alternatives}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                      <Avatar profile={x.decided_by ? profile.get(x.decided_by) : null} size={18} />
                      <span>{x.decided_by ? memberName(v.members, x.decided_by) : "Someone"}</span>
                      <span title={day(x.created_at)}>· {ago(x.created_at, now)}</span>
                      {story && (
                        <Link href={`${base}/stories/${story.number}`} className="chip mono text-[10.5px] hover:text-fg">
                          {ref(v.key, story.number)}
                        </Link>
                      )}
                      {x.message_id && (
                        <Link href={`${base}/chat#m-${x.message_id}`} className="chip hover:text-fg">
                          from chat
                        </Link>
                      )}
                      {supersedes && (
                        <a href={`#d-${supersedes.number}`} className="chip hover:text-fg">
                          replaces D-{supersedes.number}
                        </a>
                      )}
                      {replaced && (
                        <a href={`#d-${replaced.number}`} className="chip chip-warn">
                          replaced by D-{replaced.number}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
