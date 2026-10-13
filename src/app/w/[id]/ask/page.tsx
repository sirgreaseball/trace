import { Ask } from "@/components/ask";
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
      <header className="mx-auto mb-10 max-w-3xl pt-4 text-center sm:pt-10">
        <h1 className="t-title">Ask the record</h1>
        <p className="mx-auto mt-3 max-w-[54ch] text-[15px] text-ink-2">Answers come only from your team&apos;s stories, decisions, chat and commits, and every claim points at its source.</p>
      </header>
      <Ask workspaceId={id} suggestions={suggestions.slice(0, 4)} />
    </>
  );
}
