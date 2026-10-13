import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import type { SpotItem } from "@/components/spotlight";
import { loadWorkspace, myWorkspaces } from "@/lib/data";
import { conflicts, contributions, ref } from "@/lib/trace";

export async function generateMetadata(props: LayoutProps<"/w/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  return { title: { default: v.ws.name, template: `%s · ${v.ws.name}` } };
}

export default async function WorkspaceLayout(props: LayoutProps<"/w/[id]">) {
  const { id } = await props.params;
  const [v, mine] = await Promise.all([loadWorkspace(id), myWorkspaces()]);
  const me = v.members.find((m) => m.user_id === v.me.id)!;
  const base = `/w/${id}`;
  const storyNo = new Map(v.stories.map((s) => [s.id, s.number]));
  const spot: SpotItem[] = [
    ...v.stories.map((s) => ({ label: s.title, hint: ref(v.key, s.number), href: `${base}/stories/${s.number}`, group: "Story" })),
    ...v.tasks.map((t) => ({
      label: t.title,
      hint: ref(v.key, t.number),
      href: t.story_id ? `${base}/stories/${storyNo.get(t.story_id)}` : `${base}/board`,
      group: "Task",
    })),
    ...v.decisions.map((x) => ({ label: x.title, hint: `D-${x.number}`, href: `${base}/decisions#d-${x.number}`, group: "Decision" })),
    ...v.members
      .filter((m) => m.role !== "mentor")
      .map((m) => ({ label: m.profile.name, hint: "receipt", href: `${base}/receipts/${m.user_id}`, group: "Person" })),
  ];
  const hue = new Map(v.members.map((m) => [m.user_id, m.profile.hue]));
  const light = contributions(v).map((c) => ({ hue: hue.get(c.user_id) ?? 30, weight: c.weight }));

  return (
    <Shell
      ws={{ id: v.ws.id, name: v.ws.name, key: v.ws.key, course: v.ws.course, demo: v.ws.demo }}
      me={{ role: v.me.role, profile: me.profile }}
      workspaces={mine.map((w) => ({ id: w.ws.id, name: w.ws.name, key: w.ws.key, role: w.role }))}
      badges={{
        commits: v.links.filter((l) => l.status === "suggested").length,
        receipts: v.disputes.filter((x) => x.status === "open").length,
        decisions: conflicts(v.decisions, new Set(v.dismissed)).length,
      }}
      spot={spot}
      light={light}
    >
      {props.children}
    </Shell>
  );
}
