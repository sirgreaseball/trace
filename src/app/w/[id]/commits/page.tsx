import Link from "next/link";
import { connection } from "next/server";
import { CommitList } from "@/components/commit-list";
import { Icon } from "@/components/icons";
import { Segmented } from "@/components/rings";
import { SyncButton } from "@/components/sync-button";
import { PageTitle } from "@/components/ui";
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
      <PageTitle
        title="Commits"
        sub={
          <>
            A commit that names an item like <span className="ref text-ink">{v.key}-12</span> links itself. For the rest, Trace suggests a match and a person says yes or no.
          </>
        }
      >
        {v.ws.repo && v.me.role !== "mentor" && <SyncButton workspaceId={id} />}
      </PageTitle>

      {unclaimed.length > 0 && (
        <div className="glass mb-6 flex items-center gap-3.5 rounded-[20px] px-4 py-3.5 text-[14px] text-ink-2">
          <Icon name="info" size={20} className="shrink-0 text-ink-3" />
          <p>
            Commits by <span className="font-[600] text-ink">{unclaimed.slice(0, 4).join(", ")}</span>
            {unclaimed.length > 4 ? ` and ${unclaimed.length - 4} more` : ""} aren&apos;t on anyone&apos;s receipt yet. Each member adds their GitHub username in{" "}
            <Link className="link" href={`${base}/settings#profile`}>
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mb-6">
        <Segmented
          id="commit-filter"
          label="Filter commits"
          value={show}
          items={tabs.map((t) => ({ key: t.key, label: t.label, count: t.n, href: t.key === "all" ? `${base}/commits` : `${base}/commits?show=${t.key}` }))}
        />
      </div>

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
