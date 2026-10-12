import Link from "next/link";
import { Viva } from "@/components/viva";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { loadWorkspace } from "@/lib/data";
import { firstName, pct } from "@/lib/format";
import { buildViva, vivaModules } from "@/lib/trace";

export const metadata = { title: "Viva practice" };

export default async function VivaPage(props: PageProps<"/w/[id]/viva">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const v = await loadWorkspace(id);
  const builders = v.members.filter((m) => m.role !== "mentor");
  const target = builders.find((m) => m.user_id === sp.for) ?? builders.find((m) => m.user_id === v.me.id) ?? builders[0];
  if (!target) return <PageHeader title="Viva practice" sub="Add team members to practise." />;
  const questions = buildViva(target.user_id, v);
  const mods = vivaModules(target.user_id, v).slice(0, 8);
  const self = target.user_id === v.me.id;

  return (
    <>
      <PageHeader
        title="Viva"
        sub={`Questions on the code, decisions and requirements ${self ? "you" : firstName(target.profile.name)} didn't work on, answered from the team's own record. Practice only: nothing here is graded or shown to anyone.`}
      >
        {builders.length > 1 && (
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Practise as">
            {builders.map((m) => (
              <Link key={m.user_id} role="tab" aria-selected={m.user_id === target.user_id} href={`/w/${id}/viva?for=${m.user_id}`} className={`btn btn-sm ${m.user_id === target.user_id ? "" : "btn-ghost"}`}>
                {m.user_id === v.me.id ? "Me" : firstName(m.profile.name)}
              </Link>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Viva key={target.user_id} workspaceId={id} questions={questions} ai={aiEnabled()} />
        <aside>
          <p className="label-sm mb-3">Who built what</p>
          {mods.length ? (
            <ul className="space-y-2.5">
              {mods.map((m) => (
                <li key={m.module}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="mono truncate">{m.module}</span>
                    <span className={`num ${m.share < 0.3 ? "text-thread-ink" : "text-fg-3"}`}>{pct(m.share)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-3">
                    <div className="h-full rounded-full bg-fg-2" style={{ width: `${Math.max(2, m.share * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-3">No commit history with file changes yet.</p>
          )}
          <p className="mt-3 text-[12px] text-fg-3">{self ? "Your" : `${firstName(target.profile.name)}'s`} share of changed lines per part of the code. Red parts are where questions come from.</p>
        </aside>
      </div>
    </>
  );
}
