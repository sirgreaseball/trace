import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { ReceiptLines, PrintButton } from "@/components/receipt";
import { loadWorkspace } from "@/lib/data";
import { pct } from "@/lib/format";
import { buildReceipt, memberName } from "@/lib/trace";

export async function generateMetadata(props: PageProps<"/w/[id]/receipts/[user]">) {
  const { id, user } = await props.params;
  const v = await loadWorkspace(id);
  return { title: `${memberName(v.members, user)}'s receipt` };
}

export default async function ReceiptPage(props: PageProps<"/w/[id]/receipts/[user]">) {
  await connection();
  const { id, user } = await props.params;
  const v = await loadWorkspace(id);
  const member = v.members.find((m) => m.user_id === user && m.role !== "mentor");
  if (!member) notFound();
  const r = buildReceipt(user, v);
  const now = new Date();
  const serial = `${v.key}-${user.slice(0, 4).toUpperCase()}-${now.toISOString().slice(2, 10).replace(/-/g, "")}`;
  const raisers = new Map(v.members.map((m) => [m.user_id, m.profile.name]));

  return (
    <div>
      <Link href={`/w/${id}/receipts`} className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg print:hidden">
        <Icon name="back" size={14} /> All receipts
      </Link>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,460px)_1fr]">
        <article className="receipt mx-auto w-full max-w-[460px]" aria-label={`Contribution receipt for ${member.profile.name}`}>
          <div className="receipt-paper px-6 pt-8 pb-10 sm:px-8">
            <header className="text-center">
              <p className="mono text-[11px] tracking-[0.3em]">TRACE · CONTRIBUTION RECEIPT</p>
              <p className="mt-3 text-[22px] font-semibold tracking-tight">{member.profile.name}</p>
              <p className="mono mt-1 text-[11px] opacity-70">
                {v.ws.name} · {v.ws.course || v.key}
              </p>
              <p className="mono mt-1 text-[11px] opacity-70">
                No. {serial} · {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
              </p>
            </header>
            <div className="receipt-rule" />
            <ReceiptLines workspaceId={id} subject={user} lines={r.lines} raisers={Object.fromEntries(raisers)} canDispute={v.me.id !== user} canResolve={v.me.role === "owner"} me={v.me.id} />
            <div className="receipt-rule" />
            <dl className="mono space-y-1 text-[12px]">
              {[
                ["COMMITS", r.totals.commits],
                ["LINES ADDED", `+${r.totals.additions.toLocaleString("en-IN")}`],
                ["LINES REMOVED", `−${r.totals.deletions.toLocaleString("en-IN")}`],
                ["TASKS DONE", r.totals.tasks],
                ["DECISIONS", r.totals.decisions],
                ["STORIES WRITTEN", r.totals.stories],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between">
                  <dt>{k}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
            <div className="receipt-rule" />
            <div className="mono flex items-baseline justify-between text-[13px] font-semibold">
              <span>SHARE OF TEAM WORK</span>
              <span className="text-[22px]">{pct(r.weight)}</span>
            </div>
            <p className="mono mt-1 text-[10.5px] opacity-70">
              Team of {r.teamSize}. An even split would be {pct(r.teamSize ? 1 / r.teamSize : 0)}.
            </p>
            {r.openDisputes > 0 && <p className="mono mt-3 text-[11px] font-semibold">! {r.openDisputes} LINE(S) UNDER DISPUTE</p>}
            <svg className="mx-auto mt-6 block h-10 w-56" viewBox="0 0 224 40" aria-hidden>
              {Array.from(serial).flatMap((ch, i) => {
                const c = ch.charCodeAt(0);
                return [0, 1, 2].map((k) => <rect key={`${i}-${k}`} x={i * 11 + k * 3.4} y={0} width={(c >> k) & 1 ? 2.2 : 1} height={40} fill="currentColor" />);
              })}
            </svg>
            <p className="mono mt-2 text-center text-[10px] tracking-[0.25em] opacity-70">EVERY LINE IS EVIDENCE</p>
          </div>
        </article>

        <aside className="space-y-5 print:hidden">
          <div>
            <p className="label-sm mb-2">How to read this</p>
            <ul className="space-y-2 text-[13.5px] leading-relaxed text-fg-2">
              <li>Each line is real evidence: a commit, a finished task, a decision or a story this person wrote. Click one to open it.</li>
              <li>Disagree with a line? Dispute it. Say what really happened; the team lead resolves it, and the receipt shows both.</li>
              <li>No line here is written by AI. Shares come from the record, not from anyone&apos;s opinion.</li>
            </ul>
          </div>
          <PrintButton />
        </aside>
      </div>
    </div>
  );
}
