import { Segmented } from "@/components/rings";
import { PageTitle } from "@/components/ui";
import { Viva } from "@/components/viva";
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
  if (!target) return <PageTitle title="Viva" sub="Add team members to practise." />;
  const questions = buildViva(target.user_id, v);
  const mods = vivaModules(target.user_id, v).slice(0, 8);
  const self = target.user_id === v.me.id;

  return (
    <>
      <PageTitle
        title="Viva"
        sub={`Questions on the code, decisions and requirements ${self ? "you" : firstName(target.profile.name)} didn't work on, answered from the team's own record. Practice only: nothing is graded or shown to anyone.`}
      >
        {builders.length > 1 && (
          <Segmented
            id="viva-for"
            label="Practise as"
            value={target.user_id}
            items={builders.map((m) => ({ key: m.user_id, label: m.user_id === v.me.id ? "Me" : firstName(m.profile.name), href: `/w/${id}/viva?for=${m.user_id}` }))}
          />
        )}
      </PageTitle>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Viva key={target.user_id} workspaceId={id} questions={questions} ai={aiEnabled()} />
        <aside>
          <p className="t-section mb-3 px-1">Who built what</p>
          <div className="pane p-5">
            {mods.length ? (
              <ul className="space-y-3.5">
                {mods.map((m) => (
                  <li key={m.module}>
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="ref truncate text-ink-2">{m.module}</span>
                      <span className={`num font-[600] ${m.share < 0.3 ? "text-[var(--r1)]" : "text-ink-3"}`}>{pct(m.share)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, m.share * 100)}%`, background: m.share < 0.3 ? "linear-gradient(90deg,var(--r1a),var(--r1b))" : "var(--ink-3)" }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-ink-3">No commit history with file changes yet.</p>
            )}
          </div>
          <p className="t-caption mt-3 px-1">
            {self ? "Your" : `${firstName(target.profile.name)}'s`} share of the changed lines in each part of the code. The coloured ones are where the questions come from.
          </p>
        </aside>
      </div>
    </>
  );
}
