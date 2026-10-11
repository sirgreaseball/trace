import { Ask } from "@/components/ask";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { loadWorkspace } from "@/lib/data";

export const metadata = { title: "Ask" };

export default async function AskPage(props: PageProps<"/w/[id]/ask">) {
  const { id } = await props.params;
  const v = await loadWorkspace(id);
  const suggestions = [
    ...v.decisions.slice(-2).map((x) => `Why did we ${x.title.charAt(0).toLowerCase()}${x.title.slice(1)}?`),
    v.stories[0] ? `What does ${v.stories[0].title.toLowerCase()} need to pass?` : null,
    "Who worked on search?",
  ].filter((s): s is string => !!s);
  return (
    <>
      <PageHeader
        eyebrow="Why did we…"
        title="Ask"
        accent="the record"
        sub="Answers come only from your team's stories, decisions, chat and commits, and every claim points at its source."
      />
      <Ask workspaceId={id} suggestions={suggestions.slice(0, 4)} ai={aiEnabled()} />
    </>
  );
}
