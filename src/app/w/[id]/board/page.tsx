import { Board } from "@/components/board";
import { PageTitle } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";

export const metadata = { title: "Board" };

export default async function BoardPage(props: PageProps<"/w/[id]/board">) {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  return (
    <>
      <PageTitle title="Board" sub="Drag a task across when its state changes. Finishing one counts on its owner's receipt." />
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
