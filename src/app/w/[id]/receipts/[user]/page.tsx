import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ViewTransition } from "react";
import { Icon } from "@/components/icons";
import { Barcode, Pass } from "@/components/pass";
import { PrintButton, ReceiptLines } from "@/components/receipt";
import { loadWorkspace } from "@/lib/data";
import { firstName, pct } from "@/lib/format";
import { buildReceipt, contributions, memberName } from "@/lib/trace";

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
  const mine = contributions(v).find((c) => c.user_id === user);
  const now = new Date();
  const serial = `${v.key}-${user.slice(0, 4).toUpperCase()}-${now.toISOString().slice(2, 10).replace(/-/g, "")}`;
  const raisers = Object.fromEntries(v.members.map((m) => [m.user_id, m.profile.name]));
  const self = v.me.id === user;

  return (
    <div>
      <Link href={`/w/${id}/receipts`} className="press print-hide mb-6 inline-flex items-center gap-1.5 text-[14px] text-ink-3 transition-colors hover:text-ink">
        <Icon name="back" size={15} /> Receipts
      </Link>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,500px)_1fr]">
        <div className="mx-auto w-full max-w-[500px]">
          <div className="print-hide relative z-10">
            <ViewTransition name={`pass-${user}`} share="morph">
              <div>
                <Pass
                  p={{
                    name: member.profile.name,
                    hue: member.profile.hue,
                    share: r.weight,
                    even: r.teamSize ? 1 / r.teamSize : 0,
                    stats: { commits: r.totals.commits, lines: mine?.lines ?? 0, tasks: r.totals.tasks, decisions: r.totals.decisions },
                    serial: `${v.key}-${user.slice(0, 4).toUpperCase()}`,
                    disputes: r.openDisputes,
                  }}
                  style={{ height: 236 }}
                />
              </div>
            </ViewTransition>
          </div>

          <article className="slip relative -mt-4 mx-3 px-6 pt-10 pb-12 sm:px-8" aria-label={`Contribution receipt for ${member.profile.name}`}>
            <header className="text-center">
              <p className="text-[11px] tracking-[0.3em]">TRACE · CONTRIBUTION RECEIPT</p>
              <p className="mt-3 font-sans text-[28px] font-[650] tracking-[-0.035em]">{member.profile.name}</p>
              <p className="mt-1 text-[11.5px] text-[var(--paper-2)]">
                {v.ws.name} · {v.ws.course || v.key}
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--paper-2)]">
                No. {serial} · {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
              </p>
            </header>
            <div className="slip-rule" />
            <ReceiptLines workspaceId={id} subject={user} lines={r.lines} raisers={raisers} canDispute={!self} canResolve={v.me.role === "owner"} me={v.me.id} />
            <div className="slip-rule" />
            <dl className="space-y-1.5 text-[12.5px]">
              {[
                ["COMMITS", r.totals.commits],
                ["LINES ADDED", `+${r.totals.additions.toLocaleString("en-IN")}`],
                ["LINES REMOVED", `−${r.totals.deletions.toLocaleString("en-IN")}`],
                ["TASKS DONE", r.totals.tasks],
                ["DECISIONS", r.totals.decisions],
                ["STORIES WRITTEN", r.totals.stories],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt>{k}</dt>
                  <dd className="num">{val}</dd>
                </div>
              ))}
            </dl>
            <div className="slip-rule" />
            <div className="flex items-baseline justify-between text-[13px] font-semibold">
              <span>SHARE OF TEAM WORK</span>
              <span className="num text-[24px]">{pct(r.weight)}</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--paper-2)]">
              Team of {r.teamSize}. An even split would be {pct(r.teamSize ? 1 / r.teamSize : 0)}.
            </p>
            {r.openDisputes > 0 && <p className="mt-3 text-[11.5px] font-semibold">! {r.openDisputes} LINE(S) UNDER DISPUTE</p>}
            <Barcode serial={serial} className="mx-auto mt-7 h-11 w-60" />
            <p className="mt-2 text-center text-[10.5px] tracking-[0.25em] text-[var(--paper-2)]">EVERY LINE IS EVIDENCE</p>
          </article>
        </div>

        <aside className="print-hide space-y-6 lg:pt-4">
          <section className="pane p-6 text-[14.5px] leading-relaxed text-ink-2">
            <p className="t-headline mb-3 text-ink">How to read this</p>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <Icon name="checkCircle" size={19} weight="fill" className="mt-0.5 shrink-0 text-[var(--r3)]" />
                Each line is real evidence: a commit, a finished task, a decision or a story {self ? "you" : firstName(member.profile.name)} wrote. Open one to see it.
              </li>
              <li className="flex gap-3">
                <Icon name="warn" size={19} weight="fill" className="mt-0.5 shrink-0 text-warn" />
                Disagree with a line? Dispute it and say what really happened. The team lead resolves it, and the receipt keeps both sides.
              </li>
              <li className="flex gap-3">
                <Icon name="info" size={19} weight="fill" className="mt-0.5 shrink-0 text-ink-3" />
                No line is written by AI. The share comes from the record, not from anyone&apos;s opinion.
              </li>
            </ul>
          </section>
          <PrintButton />
        </aside>
      </div>
    </div>
  );
}
