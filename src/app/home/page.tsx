import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Wordmark } from "@/components/brand";
import { CreateWorkspace } from "@/components/create-workspace";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/shell";
import { Avatar, ShareBar } from "@/components/ui";
import { loadWorkspace, myProfile, myWorkspaces } from "@/lib/data";
import { ago, firstName, pct, requestTime } from "@/lib/format";
import { health, memberName } from "@/lib/trace";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  await connection();
  const [{ profile }, mine] = await Promise.all([myProfile(), myWorkspaces()]);
  const now = requestTime();
  const views = await Promise.all(mine.map((w) => loadWorkspace(w.ws.id)));
  const rows = views.map((v) => ({ v, h: health(v, now), role: mine.find((w) => w.ws.id === v.ws.id)!.role }));
  const mentoring = rows.filter((r) => r.role === "mentor").sort((a, b) => b.h.flags.filter((f) => f.level === "warn").length - a.h.flags.filter((f) => f.level === "warn").length);
  const building = rows.filter((r) => r.role !== "mentor");

  return (
    <div className="min-h-dvh">
      <div className="thread-line" />
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-5 sm:px-8">
        <Wordmark href="/home" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost btn-sm">
              <Icon name="logout" size={14} /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pt-6 pb-24 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">{mentoring.length ? "Mentor view" : "Your workspaces"}</p>
            <h1 className="text-[30px] leading-tight font-semibold sm:text-[40px]">
              Hi, {firstName(profile.name)}.
              {mentoring.length > 0 && <span className="serif font-normal text-fg-2"> {mentoring.length} teams, thirty seconds each.</span>}
            </h1>
          </div>
          <CreateWorkspace />
        </div>

        {!profile.github && building.length > 0 && (
          <Link href={`/w/${building[0].v.ws.id}/settings#profile`} className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-line-2 px-4 py-3 text-[13px] text-fg-2 hover:text-fg">
            <Icon name="commits" size={15} /> Add your GitHub username so your commits land on your receipt.
            <Icon name="arrow" size={14} className="ml-auto" />
          </Link>
        )}

        {mentoring.length > 0 && (
          <section className="mt-10">
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11.5px] text-fg-3">
                    <th className="py-3 pr-3 pl-5 font-medium">Team</th>
                    <th className="w-40 py-3 pr-4 font-medium">Traced</th>
                    <th className="w-48 py-3 pr-4 font-medium">Who&apos;s doing the work</th>
                    <th className="py-3 pr-4 font-medium">Needs a look</th>
                    <th className="w-28 py-3 pr-5 text-right font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {mentoring.map(({ v, h }) => {
                    const profileOf = new Map(v.members.map((m) => [m.user_id, m.profile]));
                    return (
                      <tr key={v.ws.id} className="row-hover border-b border-line align-top last:border-0">
                        <td className="py-4 pr-3 pl-5">
                          <Link href={`/w/${v.ws.id}`} className="group block">
                            <span className="flex items-center gap-2">
                              <span className="mono rounded bg-bg-3 px-1.5 py-0.5 text-[10.5px] text-fg-2">{v.ws.key}</span>
                              <span className="font-semibold group-hover:underline">{v.ws.name}</span>
                            </span>
                            <span className="mt-1.5 flex items-center gap-1">
                              {v.members
                                .filter((m) => m.role !== "mentor")
                                .map((m) => (
                                  <Avatar key={m.user_id} profile={m.profile} size={18} />
                                ))}
                            </span>
                          </Link>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="serif text-[28px] leading-none num">{h.coverage.pct}%</span>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-3">
                            <div className="h-full rounded-full bg-thread" style={{ width: `${h.coverage.pct}%` }} />
                          </div>
                          <span className="mt-1 block text-[11px] text-fg-3">
                            {h.coverage.traced}/{h.coverage.total} stories
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <ShareBar parts={h.team.map((t) => ({ label: memberName(v.members, t.user_id), value: t.weight, hue: profileOf.get(t.user_id)?.hue }))} height={6} />
                          <span className="mt-2 block text-[11.5px] text-fg-3">
                            {h.team
                              .slice(0, 4)
                              .map((t) => `${firstName(memberName(v.members, t.user_id))} ${pct(t.weight)}`)
                              .join(" · ")}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-fg-3">Balance {pct(h.balance)}</span>
                        </td>
                        <td className="py-4 pr-4">
                          {h.flags.length ? (
                            <ul className="space-y-1">
                              {h.flags.slice(0, 3).map((f) => (
                                <li key={f.text} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${f.level === "warn" ? "bg-warn" : "bg-fg-3"}`} />
                                  {f.text}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-[12.5px] text-fg-3">Looks healthy</span>
                          )}
                        </td>
                        <td className="py-4 pr-5 text-right text-[12px] text-fg-3">{h.last ? ago(h.last, now) : "never"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-fg-3">Teams with the most warnings come first. Open a team for its loom, trace grid and receipts.</p>
          </section>
        )}

        {building.length > 0 && (
          <section className="mt-10">
            {mentoring.length > 0 && <h2 className="mb-3 text-[13px] font-semibold text-fg-2">Your own workspaces</h2>}
            <ul className="grid gap-3 md:grid-cols-2">
              {building.map(({ v, h, role }) => (
                <li key={v.ws.id}>
                  <Link href={`/w/${v.ws.id}`} className="panel row-hover flex items-center gap-4 p-5">
                    <span className="mono grid size-11 shrink-0 place-items-center rounded-xl bg-inv text-[12px] font-semibold text-bg">{v.ws.key}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{v.ws.name}</span>
                      <span className="block truncate text-[12.5px] text-fg-3">
                        {role === "owner" ? "Team lead" : "Member"} · {v.members.length} people · {h.last ? `active ${ago(h.last, now)}` : "no activity yet"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="serif block text-[30px] leading-none num">{h.coverage.pct}%</span>
                      <span className="text-[11px] text-fg-3">traced</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rows.length === 0 && (
          <section className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="panel p-6">
              <p className="font-semibold">Start a workspace</p>
              <p className="mt-1.5 text-[13.5px] text-fg-2">For your team&apos;s project. You become the team lead and can invite teammates and your mentor with a link.</p>
            </div>
            <div className="panel p-6">
              <p className="font-semibold">Got an invite?</p>
              <p className="mt-1.5 text-[13.5px] text-fg-2">Open the link your team lead sent you. It looks like trace…/join/… and adds you straight to the team.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
