import Link from "next/link";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { ConflictActions, DecisionForm } from "@/components/decisions";
import { Icon } from "@/components/icons";
import { Avatar, Empty, PageTitle } from "@/components/ui";
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
      <PageTitle title="Decisions" sub="The team's choices and the reasons behind them, in order. Start a chat message with /decide to log one without leaving the conversation.">
        {canWrite && (
          <DecisionForm
            workspaceId={id}
            stories={v.stories.map((s) => ({ id: s.id, label: `${ref(v.key, s.number)} ${s.title}` }))}
            decisions={v.decisions.map((x) => ({ id: x.id, label: `D-${x.number} ${x.title}` }))}
            presetStory={presetStory}
          />
        )}
      </PageTitle>

      {clashes.length > 0 && (
        <section className="mb-10 space-y-3" aria-label="Possible conflicts">
          {clashes.map((c) => (
            <div key={`${c.earlier.id}:${c.later.id}`} className="glass rise rounded-[24px] p-5">
              <p className="mb-4 flex items-center gap-2.5 text-[14px] font-[620] text-warn">
                <span className="grid size-7 place-items-center rounded-[9px] bg-warn-soft">
                  <Icon name="warn" size={15} bold />
                </span>
                These two may disagree. Both talk about {c.shared.slice(0, 3).map((w) => `“${w}”`).join(", ")}.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[c.later, c.earlier].map((x) => (
                  <a key={x.id} href={`#d-${x.number}`} className="row rounded-[16px] bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--line)]">
                    <span className="ref text-[var(--r2)]">D-{x.number}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-snug font-[560]">{x.title}</span>
                  </a>
                ))}
              </div>
              {canWrite && (
                <div className="mt-4">
                  <ConflictActions workspaceId={id} earlier={{ id: c.earlier.id, number: c.earlier.number }} later={{ id: c.later.id, number: c.later.number }} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {v.decisions.length === 0 ? (
        <Empty title="No decisions logged yet">Log the first big choice: the stack, the database, what&apos;s out of scope. Future you, and your viva, will thank you.</Empty>
      ) : (
        <ol className="relative">
          <span className="absolute top-3 bottom-3 left-[23px] w-[2px] rounded-full bg-line-2" aria-hidden />
          {[...v.decisions].reverse().map((x, i) => {
            const replaced = replacedBy.get(x.id);
            const story = v.stories.find((s) => s.id === x.story_id);
            const supersedes = v.decisions.find((d) => d.id === x.supersedes);
            return (
              <li key={x.id} id={`d-${x.number}`} className="rise relative scroll-mt-28 pb-5 pl-16" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
                <span
                  className={`num absolute top-3 left-0 grid h-[30px] min-w-[48px] place-items-center rounded-full px-2 text-[12px] font-[650] ${
                    replaced ? "bg-surface-3 text-ink-3" : "bg-[linear-gradient(135deg,var(--r2a),var(--r2b))] text-white shadow-[0_6px_16px_-6px_var(--r2b)]"
                  }`}
                >
                  D-{x.number}
                </span>
                <article className={`pane p-5 transition-shadow duration-500 target:shadow-[0_0_0_2px_var(--r2),var(--shadow)] sm:p-6 ${replaced ? "opacity-60" : ""}`}>
                  <h2 className={`text-[18px] leading-snug font-[620] tracking-[-0.02em] ${replaced ? "line-through decoration-ink-3" : ""}`}>{x.title}</h2>
                  {x.rationale && <p className="mt-2.5 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{x.rationale}</p>}
                  {x.alternatives && (
                    <p className="mt-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-ink-2">
                      <span className="font-[600] text-ink">Considered instead:</span> {x.alternatives}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                    <Avatar profile={x.decided_by ? profile.get(x.decided_by) : null} size={22} />
                    <span className="font-[560] text-ink-2">{x.decided_by ? memberName(v.members, x.decided_by) : "Someone"}</span>
                    <span title={day(x.created_at)}>· {ago(x.created_at, now)}</span>
                    {story && (
                      <Link href={`${base}/stories/${story.number}`} className="chip mono transition-colors hover:text-ink">
                        {ref(v.key, story.number)}
                      </Link>
                    )}
                    {x.message_id && (
                      <Link href={`${base}/chat#m-${x.message_id}`} className="chip transition-colors hover:text-ink">
                        <Icon name="chat" size={12} /> from chat
                      </Link>
                    )}
                    {supersedes && (
                      <a href={`#d-${supersedes.number}`} className="chip transition-colors hover:text-ink">
                        replaces D-{supersedes.number}
                      </a>
                    )}
                    {replaced && (
                      <a href={`#d-${replaced.number}`} className="chip chip-warn">
                        replaced by D-{replaced.number}
                      </a>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
