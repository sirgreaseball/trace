import type { Metadata } from "next";
import { Shell, type PaletteItem } from "@/components/shell";
import { loadWorkspace, myWorkspaces } from "@/lib/data";
import { conflicts, ref } from "@/lib/trace";

export async function generateMetadata(props: LayoutProps<"/w/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  return { title: { default: v.ws.name, template: `%s | ${v.ws.name}` } };
}

export default async function WorkspaceLayout(props: LayoutProps<"/w/[id]">) {
  const { id } = await props.params;
  const [v, mine] = await Promise.all([loadWorkspace(id), myWorkspaces()]);
  const me = v.members.find((m) => m.user_id === v.me.id)!;
  const base = `/w/${id}`;
  const palette: PaletteItem[] = [
    ...v.stories.map((s) => ({ label: s.title, hint: ref(v.key, s.number), href: `${base}/stories/${s.number}`, group: "Story" })),
    ...v.tasks.map((t) => ({
      label: t.title,
      hint: ref(v.key, t.number),
      href: t.story_id ? `${base}/stories/${v.stories.find((s) => s.id === t.story_id)?.number}` : `${base}/board`,
      group: "Task",
    })),
    ...v.decisions.map((x) => ({ label: x.title, hint: `D-${x.number}`, href: `${base}/decisions#d-${x.number}`, group: "Decision" })),
    ...v.members
      .filter((m) => m.role !== "mentor")
      .map((m) => ({ label: `${m.profile.name}'s receipt`, href: `${base}/receipts/${m.user_id}`, group: "Receipt" })),
  ];
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
      palette={palette}
    >
      {props.children}
    </Shell>
  );
}
