import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { Wordmark } from "@/components/brand";
import { CreateWorkspace } from "@/components/create-workspace";
import { Icon } from "@/components/icons";
import { JoinWithCode } from "@/components/invite";
import { TeamLight } from "@/components/light";
import { Rings } from "@/components/rings";
import { ThemeToggle } from "@/components/theme";
import { Avatars } from "@/components/ui";
import { loadWorkspace, myProfile, myWorkspaces, type WorkspaceView } from "@/lib/data";
import { ago, firstName, plural, requestTime } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { health } from "@/lib/trace";
import type { Role } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

type Row = { v: WorkspaceView; h: ReturnType<typeof health>; role: Role };

function TeamCard({ r, now, i }: { r: Row; now: number; i: number }) {
  const { v, h, role } = r;
  const hue = new Map(v.members.map((m) => [m.user_id, m.profile.hue]));
  const done = v.tasks.filter((t) => t.status === "done").length;
  const linked = new Set(v.links.filter((l) => l.status === "confirmed").map((l) => l.commit_id)).size;
  const warns = h.flags.filter((f) => f.level === "warn");
  const builders = v.members.filter((m) => m.role !== "mentor");
  return (
    <li className="rise" style={{ "--i": i + 2 } as CSSProperties}>
      <Link href={`/w/${v.ws.id}`} className="press group pane relative flex h-full flex-col overflow-hidden transition-shadow duration-500 hover:shadow-[var(--shadow-lg),0_0_0_1px_var(--line)]">
        <div className="relative h-36 overflow-hidden">
          <TeamLight still sources={h.team.map((t) => ({ hue: hue.get(t.user_id) ?? 30, weight: t.weight }))} className="absolute inset-0 scale-110 transition-transform duration-[1200ms] ease-[var(--ease-out)] group-hover:scale-125" />
          <div className="relative flex h-full items-end justify-between p-5">
            <span className="min-w-0">
              <span className="mono mb-1.5 inline-block rounded-[7px] bg-[light-dark(rgb(255_255_255/0.75),rgb(0_0_0/0.35))] px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">{v.ws.key}</span>
                <span className="block truncate text-[20px] font-[650] tracking-[-0.03em]">{v.ws.name}</span>
            </span>
            <Rings values={[h.coverage.total ? h.coverage.traced / h.coverage.total : 0, v.tasks.length ? done / v.tasks.length : 0, v.commits.length ? linked / v.commits.length : 0]} size={74} width={0.13} delay={300 + i * 90} />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5 pt-4">
          <dl className="grid grid-cols-3 gap-3">
            {[
              ["Traced", `${h.coverage.pct}%`],
              ["Balance", `${Math.round(h.balance * 100)}%`],
              ["Active", h.last ? ago(h.last, now).replace(" ago", "") : "never"],
            ].map(([k, val]) => (
              <div key={k}>
                <dt className="text-[12px] text-ink-3">{k}</dt>
                <dd className="num mt-0.5 text-[18px] font-[640] tracking-[-0.03em]">{val}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Avatars people={builders.map((m) => m.profile)} size={26} max={5} />
            <span className="text-[12.5px] text-ink-3">{role === "mentor" ? "Mentoring" : role === "owner" ? "Team lead" : "Member"}</span>
          </div>
          {(role === "mentor" || warns.length > 0) && (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
              {h.flags.slice(0, 3).map((f) => (
                <li key={f.text} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                  <Icon name={f.level === "warn" ? "warn" : "info"} size={15} weight="fill" className={`mt-px shrink-0 ${f.level === "warn" ? "text-warn" : "text-ink-3"}`} />
                  {f.text}
                </li>
              ))}
              {h.flags.length === 0 && (
                <li className="flex items-center gap-2 text-[13px] text-ink-2">
                  <Icon name="checkCircle" size={15} weight="fill" className="text-[var(--r3)]" /> Looks healthy
                </li>
              )}
            </ul>
          )}
        </div>
      </Link>
    </li>
  );
}

export default async function HomePage() {
  await connection();
  // Teams that added this person by email before they had an account.
  await (await supabaseServer()).rpc("claim_invites");
  const [{ profile }, mine] = await Promise.all([myProfile(), myWorkspaces()]);
  const now = requestTime();
  const views = await Promise.all(mine.map((w) => loadWorkspace(w.ws.id)));
  const rows: Row[] = views.map((v) => ({ v, h: health(v, now), role: mine.find((w) => w.ws.id === v.ws.id)!.role }));
  const warn = (r: Row) => r.h.flags.filter((f) => f.level === "warn").length;
  const mentoring = rows.filter((r) => r.role === "mentor").sort((a, b) => warn(b) - warn(a));
  const building = rows.filter((r) => r.role !== "mentor");
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greet = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = firstName(profile.name).replace(/^(prof|dr)\.?$/i, "") || profile.name;

  return (
    <div className="relative min-h-dvh">
      <TeamLight
        sources={[
          { hue: 24, weight: 0.3 },
          { hue: 300, weight: 0.2 },
          { hue: 205, weight: 0.3 },
          { hue: 150, weight: 0.2 },
        ]}
        className="team-glow absolute inset-x-0 top-0 h-[480px]"
      />
      <header className="page relative flex h-[var(--bar-h)] items-center justify-between">
        <Wordmark href="/home" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost btn-sm">
              <Icon name="logout" size={15} /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="page relative pt-10 pb-24 sm:pt-16">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="rise">
            <p className="mb-3 text-[13px] font-[560] text-ink-3">{new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</p>
            <h1 className="t-display text-[clamp(44px,6vw,80px)]">
              {greet}, {name}.
            </h1>
            <p className="mt-4 max-w-[56ch] text-[16px] text-ink-2">
              {mentoring.length > 0
                ? `You mentor ${plural(mentoring.length, "team")}. The ones that need you most come first.`
                : building.length
                  ? `You're in ${plural(building.length, "workspace")}.`
                  : "Start a workspace for your team, or open the invite link your team lead sent you."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <JoinWithCode />
            <CreateWorkspace />
          </div>
        </div>

        {!profile.github && building.length > 0 && (
          <Link href={`/w/${building[0].v.ws.id}/settings#profile`} className="glass row mb-10 flex items-center gap-3.5 rounded-[20px] px-5 py-4 text-[14px] text-ink-2">
            <Icon name="commits" size={20} className="shrink-0 text-ink" />
            <span className="flex-1">Add your GitHub username so your commits land on your receipt.</span>
            <Icon name="arrow" size={15} />
          </Link>
        )}

        {mentoring.length > 0 && (
          <section className="mb-14">
            <h2 className="t-section mb-4 px-1">Teams you mentor</h2>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {mentoring.map((r, i) => (
                <TeamCard key={r.v.ws.id} r={r} now={now} i={i} />
              ))}
            </ul>
          </section>
        )}

        {building.length > 0 && (
          <section>
            {mentoring.length > 0 && <h2 className="t-section mb-4 px-1">Your own workspaces</h2>}
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {building.map((r, i) => (
                <TeamCard key={r.v.ws.id} r={r} now={now} i={i} />
              ))}
            </ul>
          </section>
        )}

        {rows.length === 0 && (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="pane p-7">
              <Icon name="plus" size={26} className="text-ink-3" />
              <p className="t-headline mt-4">Start a workspace</p>
              <p className="mt-1.5 text-[14px] text-ink-2">For your team&apos;s project. You become the team lead and can invite teammates and your mentor with a link.</p>
            </div>
            <div className="pane p-7">
              <Icon name="link" size={26} className="text-ink-3" />
              <p className="t-headline mt-4">Joining a team, or mentoring one?</p>
              <p className="mt-1.5 text-[14px] text-ink-2">Ask the team lead for their team code and press Join with a code, or open the invite link they sent you. Mentors can join as many teams as they guide.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
