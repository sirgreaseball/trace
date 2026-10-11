import Link from "next/link";
import { connection } from "next/server";
import { CommitList } from "@/components/commit-list";
import { SyncButton } from "@/components/sync-button";
import { PageHeader } from "@/components/ui";
import { requestTime } from "@/lib/format";
import { loadWorkspace } from "@/lib/data";
import { orphanCommits } from "@/lib/trace";

export const metadata = { title: "Commits" };

export default async function CommitsPage(props: PageProps<"/w/[id]/commits">) {
  await connection();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const v = await loadWorkspace(id);
  const show = sp.show === "suggested" || sp.show === "loose" ? sp.show : "all";
  const suggested = new Set(v.links.filter((l) => l.status === "suggested").map((l) => l.commit_id));
  const loose = new Set(orphanCommits(v).map((c) => c.id));
  const list = v.commits.filter((c) => (show === "suggested" ? suggested.has(c.id) : show === "loose" ? loose.has(c.id) : true));
  const logins = new Set(v.members.map((m) => m.profile.github?.toLowerCase()).filter(Boolean));
  const unclaimed = [...new Set(v.commits.filter((c) => !c.user_id && c.author_login && !logins.has(c.author_login.toLowerCase())).map((c) => c.author_login!))];
  const base = `/w/${id}`;
  const tabs = [
    { key: "all", label: "All", n: v.commits.length },
    { key: "suggested", label: "Suggested links", n: suggested.size },
    { key: "loose", label: "Not linked", n: loose.size },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Commits"
        sub={
          <>
            Commits that name an item like <span className="mono text-fg">{v.key}-12</span> link themselves. For the rest, Trace suggests a match and a person confirms it.
          </>
        }
      >
        {v.ws.repo && v.me.role !== "mentor" && <SyncButton workspaceId={id} />}
      </PageHeader>

      {unclaimed.length > 0 && (
        <div className="mb-5 rounded-xl border border-dashed border-line-2 px-4 py-3 text-[13px] text-fg-2">
          Commits by <span className="font-medium text-fg">{unclaimed.slice(0, 4).join(", ")}</span>
          {unclaimed.length > 4 ? ` and ${unclaimed.length - 4} more` : ""} aren&apos;t on anyone&apos;s receipt yet. Each member adds their GitHub username in{" "}
          <Link className="link" href={`${base}/settings#profile`}>
            Settings
          </Link>
          .
        </div>
      )}

      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter commits">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? `${base}/commits` : `${base}/commits?show=${t.key}`}
            aria-current={show === t.key ? "page" : undefined}
            className={`btn btn-sm ${show === t.key ? "" : "btn-ghost"}`}
          >
            {t.label} <span className="text-fg-3 num">{t.n}</span>
          </Link>
        ))}
      </nav>

      <CommitList
        workspaceId={id}
        keyPrefix={v.key}
        commits={list}
        links={v.links}
        stories={v.stories.map((s) => ({ id: s.id, number: s.number, title: s.title }))}
        tasks={v.tasks.map((t) => ({ id: t.id, number: t.number, title: t.title, story_id: t.story_id }))}
        members={v.members}
        canWrite={v.me.role !== "mentor"}
        now={requestTime()}
        empty={
          show === "all"
            ? v.ws.repo
              ? "No commits yet. Press Sync GitHub to pull them in."
              : "Connect a GitHub repository in Settings, then sync."
            : show === "suggested"
              ? "No suggestions waiting. Everything is confirmed or rejected."
              : "Every commit is tied to a story or task."
        }
      />
    </>
  );
}
