import Link from "next/link";
import { StoryForm } from "@/components/story-form";
import { Avatars, Empty, PageHeader, PriorityChip, StateChip } from "@/components/ui";
import { loadWorkspace } from "@/lib/data";
import { ref, traceStories, type StoryState } from "@/lib/trace";

export const metadata = { title: "Stories" };

const FILTERS: { key: "all" | StoryState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "untraced", label: "Untraced" },
  { key: "planned", label: "Planned" },
  { key: "building", label: "Building" },
  { key: "traced", label: "Traced" },
];

export default async function StoriesPage(props: PageProps<"/w/[id]/stories">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const v = await loadWorkspace(id);
  const all = traceStories(v);
  const filter = FILTERS.find((f) => f.key === sp.state)?.key ?? "all";
  const list = filter === "all" ? all : all.filter((t) => t.state === filter);
  const profile = new Map(v.members.map((m) => [m.user_id, m.profile]));
  const base = `/w/${id}`;

  return (
    <>
      <PageHeader title="Stories" sub="What the project must do, written from the user's side, each with acceptance criteria you can demo.">
        {v.me.role !== "mentor" && <StoryForm workspaceId={id} />}
      </PageHeader>

      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter stories">
        {FILTERS.map((f) => {
          const n = f.key === "all" ? all.length : all.filter((t) => t.state === f.key).length;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? `${base}/stories` : `${base}/stories?state=${f.key}`}
              aria-current={filter === f.key ? "page" : undefined}
              className={`btn btn-sm ${filter === f.key ? "" : "btn-ghost"}`}
            >
              {f.label} <span className="text-fg-3 num">{n}</span>
            </Link>
          );
        })}
      </nav>

      {list.length === 0 ? (
        <Empty title={all.length ? "No stories in this state." : "No stories yet."}>
          {all.length ? "Try another filter." : "Start with the one thing your project must do. Write it as “As a …, I want …, so that …”."}
        </Empty>
      ) : (
        <ul className="panel divide-y divide-line">
          {list.map((t) => {
            const done = t.tasks.filter((k) => k.status === "done").length;
            return (
              <li key={t.story.id}>
                <Link href={`${base}/stories/${t.story.number}`} className="row-hover flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <span className="mono w-12 shrink-0 text-[11.5px] text-fg-3">{ref(v.key, t.story.number)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.story.title}</span>
                    <span className="block truncate text-[12.5px] text-fg-3">{t.story.narrative || "No narrative yet"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <PriorityChip priority={t.story.priority} />
                    <span className="w-14 text-right text-[12px] text-fg-3 num">{t.tasks.length ? `${done}/${t.tasks.length} tasks` : "no tasks"}</span>
                    <span className="hidden w-20 sm:block">{t.people.length > 0 && <Avatars people={t.people.map((p) => profile.get(p)!).filter(Boolean)} size={18} />}</span>
                    <StateChip state={t.state} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
