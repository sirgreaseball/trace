import { PageTitle, personColor, TeamBar } from "@/components/ui";
import { Wallet } from "@/components/wallet";
import { loadWorkspace } from "@/lib/data";
import { firstName, plural } from "@/lib/format";
import { balance, buildReceipt, contributions } from "@/lib/trace";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage(props: PageProps<"/w/[id]/receipts">) {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  const team = contributions(v);
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const passes = team.map((t) => {
    const r = buildReceipt(t.user_id, v);
    return {
      uid: t.user_id,
      name: profile.get(t.user_id)?.name ?? "Unknown",
      hue: profile.get(t.user_id)?.hue ?? 30,
      share: t.weight,
      even: team.length ? 1 / team.length : 0,
      stats: { commits: t.commits, lines: t.lines, tasks: t.tasks, decisions: t.decisions },
      serial: `${v.key}-${t.user_id.slice(0, 4).toUpperCase()}`,
      disputes: r.openDisputes,
    };
  });
  const bal = balance(team.map((t) => t.weight));

  return (
    <>
      <PageTitle title="Receipts" sub="One pass per person. Every line on a receipt is a commit, task or decision you can open, and anyone on the team can dispute a line." />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,520px)_1fr]">
        <Wallet passes={passes} base={`/w/${id}`} />
        <aside className="space-y-8 lg:pt-2">
          <section className="pane p-6">
            <p className="t-section">Balance of work</p>
            <p className="t-figure mt-3 text-[56px]">
              {Math.round(bal * 100)}
              <span className="text-[0.5em] text-ink-3">%</span>
            </p>
            <p className="mt-2 text-[14px] text-ink-2">100% would mean everyone did exactly the same share.</p>
            <div className="mt-5">
              <TeamBar parts={team.map((t) => ({ label: profile.get(t.user_id)?.name ?? "", value: t.weight, hue: profile.get(t.user_id)?.hue }))} height={12} />
              <ul className="mt-4 space-y-2 text-[13.5px]">
                {team.map((t) => (
                  <li key={t.user_id} className="flex items-center gap-2.5">
                    <span className="size-2.5 rounded-full" style={{ background: personColor(profile.get(t.user_id)?.hue) }} />
                    <span className="flex-1">{firstName(profile.get(t.user_id)?.name ?? "")}</span>
                    <span className="num text-ink-3">{plural(t.commits, "commit")}</span>
                    <span className="num w-12 text-right font-[620]">{Math.round(t.weight * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="px-1 text-[14px] leading-relaxed text-ink-2">
            <p className="t-headline mb-2 text-ink">How a share is counted</p>
            <p>Commits weigh 40%, changed lines 30% (capped per commit, so a lockfile can&apos;t take over) and finished tasks 30%. It comes from the record, never from anyone&apos;s opinion, and no line is written by AI.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
