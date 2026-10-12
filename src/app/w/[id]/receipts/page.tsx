import Link from "next/link";
import { Avatar, PageHeader, ShareBar } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { pct, plural } from "@/lib/format";
import { balance, contributions, memberName } from "@/lib/trace";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage(props: PageProps<"/w/[id]/receipts">) {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  const team = contributions(v);
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const open = (uid: string) => v.disputes.filter((x) => x.status === "open" && x.subject === uid).length;

  return (
    <>
      <PageHeader
        title="Receipts"
        sub="One receipt per person. Every line is a commit, task or decision you can open, and anyone on the team can dispute a line."
      />
      <div className="mb-8 max-w-xl">
        <ShareBar parts={team.map((t) => ({ label: memberName(v.members, t.user_id), value: t.weight, hue: profile.get(t.user_id)?.hue }))} height={8} />
        <p className="mt-2 text-[12px] text-fg-3">
          Balance {pct(balance(team.map((t) => t.weight)))}. Shares weigh commits 40%, changed lines 30% and finished tasks 30%.
        </p>
      </div>
      <ul className="panel divide-y divide-line">
        {team.map((t) => (
          <li key={t.user_id}>
            <Link href={`/w/${id}/receipts/${t.user_id}`} className="row-hover flex flex-wrap items-center gap-4 px-4 py-4">
              <Avatar profile={profile.get(t.user_id)} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{memberName(v.members, t.user_id)}</span>
                <span className="block text-[12.5px] text-fg-3">
                  {plural(t.commits, "commit")}, {t.lines.toLocaleString("en-IN")} lines, {plural(t.tasks, "task")} done, {plural(t.decisions, "decision")}
                </span>
              </span>
              {open(t.user_id) > 0 && <span className="chip chip-warn">{plural(open(t.user_id), "open dispute")}</span>}
              <span className="figure w-16 text-right text-[28px]">{pct(t.weight)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
