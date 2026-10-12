import { Board } from "@/components/board";
import { PageHeader } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";

export const metadata = { title: "Board" };

export default async function BoardPage(props: PageProps<"/w/[id]/board">) {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  return (
    <>
      <PageHeader title="Board" sub="Drag tasks across, or use the menu on each card. Finishing a task counts on its owner's receipt." />
      <Board
        workspaceId={id}
        keyPrefix={v.key}
        tasks={v.tasks}
        stories={v.stories.map((s) => ({ id: s.id, number: s.number, title: s.title }))}
        members={v.members}
        me={v.me.id}
        canWrite={v.me.role !== "mentor"}
      />
    </>
  );
}
