import { NextResponse } from "next/server";
import { aiEnabled, complete, parseJson } from "@/lib/ai";
import { commitDetail, GitHubError, listCommits } from "@/lib/github";
import { supabaseServer } from "@/lib/supabase/server";
import { linkCommits, orphanCommits, ref } from "@/lib/trace";
import type { Commit, Link, Story, Task } from "@/lib/types";

export const maxDuration = 60;

// Pulls new commits from GitHub, fills in changed files, maps authors to
// members, then links commits to stories and tasks. Runs as the signed-in
// member, so row-level security still applies to every write.
export async function POST(_req: Request, ctx: RouteContext<"/api/w/[id]/sync">) {
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [{ data: ws }, { data: me }, { data: state }] = await Promise.all([
    sb.from("workspaces").select("id, key, repo").eq("id", id).maybeSingle(),
    sb.from("members").select("role").eq("workspace_id", id).eq("user_id", auth.user.id).maybeSingle(),
    sb.from("sync_state").select("etag").eq("workspace_id", id).maybeSingle(),
  ]);
  if (!ws || !me) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  if (me.role === "mentor") return NextResponse.json({ error: "Mentors can't sync." }, { status: 403 });
  if (!ws.repo) return NextResponse.json({ error: "Connect a GitHub repository in Settings first." }, { status: 400 });

  const result = { added: 0, detailed: 0, linked: 0, suggested: 0 };
  let etag = state?.etag ?? null;
  try {
    const listed = await listCommits(ws.repo, state?.etag ?? null);
    const { data: members } = await sb.from("members").select("user_id, profile:profiles(github)").eq("workspace_id", id);
    const byLogin = new Map(
      ((members ?? []) as unknown as { user_id: string; profile: { github: string | null } | null }[])
        .filter((m) => m.profile?.github)
        .map((m) => [m.profile!.github!.toLowerCase(), m.user_id]),
    );

    if (listed) {
      etag = listed.etag;
      const rows = listed.commits.map((c) => ({
        workspace_id: id,
        sha: c.sha,
        message: c.commit.message.slice(0, 8000),
        author_login: c.author?.login ?? null,
        author_name: c.commit.author?.name ?? c.author?.login ?? "",
        user_id: (c.author?.login && byLogin.get(c.author.login.toLowerCase())) || null,
        url: c.html_url,
        committed_at: c.commit.author?.date ?? c.commit.committer?.date ?? new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { data, error } = await sb.from("commits").upsert(rows.slice(i, i + 100), { onConflict: "workspace_id,sha", ignoreDuplicates: true }).select("id");
        if (error) throw new Error(error.message);
        result.added += data?.length ?? 0;
      }
    }

    // Members may have added their GitHub username since the commit arrived.
    for (const [login, userId] of byLogin) {
      await sb.from("commits").update({ user_id: userId }).eq("workspace_id", id).is("user_id", null).ilike("author_login", login);
    }

    // Changed files and line counts, newest first, within the rate budget.
    const budget = process.env.GITHUB_TOKEN ? 80 : 15;
    const { data: bare } = await sb.from("commits").select("id, sha").eq("workspace_id", id).eq("detailed", false).order("committed_at", { ascending: false }).limit(budget);
    for (const c of bare ?? []) {
      const d = await commitDetail(ws.repo, c.sha);
      await sb.from("commits").update({ ...d, detailed: true }).eq("id", c.id);
      result.detailed++;
    }
  } catch (e) {
    const message = e instanceof GitHubError ? e.message : "Sync failed. Try again in a moment.";
    await sb.from("sync_state").upsert({ workspace_id: id, last_error: message });
    if (!(e instanceof GitHubError)) console.error("sync", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Link, using the same engine the rest of the app reads with.
  const [stories, tasks, commits, links] = await Promise.all([
    sb.from("stories").select("id, number, title, narrative, acceptance, priority, created_by, created_at").eq("workspace_id", id),
    sb.from("tasks").select("id, number, story_id, title, status, assignee, created_by, created_at, done_at").eq("workspace_id", id),
    sb.from("commits").select("id, sha, message, author_login, author_name, user_id, additions, deletions, files, detailed, url, committed_at").eq("workspace_id", id).limit(1000),
    sb.from("links").select("id, commit_id, story_id, task_id, source, status, score, reason").eq("workspace_id", id).limit(1000),
  ]);
  const d = {
    key: ws.key,
    stories: (stories.data ?? []) as Story[],
    tasks: (tasks.data ?? []) as Task[],
    commits: (commits.data ?? []) as Commit[],
    links: (links.data ?? []) as Link[],
  };
  const fresh = linkCommits(d);
  if (fresh.length) {
    await sb.from("links").upsert(
      fresh.map((l) => ({ ...l, workspace_id: id })),
      { onConflict: "commit_id,story_id,task_id", ignoreDuplicates: true },
    );
  }
  result.linked = fresh.filter((l) => l.status === "confirmed").length;
  result.suggested = fresh.filter((l) => l.status === "suggested").length;

  // Optional AI pass: suggest homes for commits the word-matcher couldn't place.
  if (aiEnabled() && (d.stories.length || d.tasks.length)) {
    const placed = new Set([...d.links, ...fresh].filter((l) => l.status !== "rejected").map((l) => l.commit_id));
    const loose = orphanCommits({ commits: d.commits, links: [...d.links, ...fresh.map((l, i) => ({ ...l, id: `n${i}` }))] })
      .filter((c) => !placed.has(c.id) && !/^merge /i.test(c.message))
      .slice(0, 25);
    if (loose.length) {
      const items = [
        ...d.stories.map((s) => `${ref(d.key, s.number)} story: ${s.title}`),
        ...d.tasks.map((t) => `${ref(d.key, t.number)} task: ${t.title}`),
      ].join("\n");
      const ai = await complete(
        [
          {
            role: "system",
            content:
              'You match git commits to the task or story they implement. Reply with JSON {"links":[{"sha":"<7 chars>","ref":"<item ref or null>","why":"<6 words max>"}]}. Use null when no item clearly fits. Never invent refs.',
          },
          { role: "user", content: `Items:\n${items}\n\nCommits:\n${loose.map((c) => `${c.sha.slice(0, 7)} ${c.message.split("\n")[0]} [${c.files.slice(0, 4).join(", ")}]`).join("\n")}` },
        ],
        { json: true, maxTokens: 1200 },
      );
      const parsed = ai && parseJson<{ links?: { sha?: string; ref?: string | null; why?: string }[] }>(ai.text);
      const byRef = new Map<string, { story_id: string | null; task_id: string | null }>([
        ...d.stories.map((s) => [ref(d.key, s.number).toLowerCase(), { story_id: s.id, task_id: null }] as const),
        ...d.tasks.map((t) => [ref(d.key, t.number).toLowerCase(), { story_id: null, task_id: t.id }] as const),
      ]);
      const rows = (parsed?.links ?? [])
        .map((l) => {
          const c = loose.find((x) => l.sha && x.sha.startsWith(l.sha.toLowerCase()));
          const target = l.ref ? byRef.get(l.ref.toLowerCase()) : undefined;
          return c && target
            ? { workspace_id: id, commit_id: c.id, ...target, source: "ai", status: "suggested", score: 0.5, reason: `AI: ${(l.why ?? "looks related").slice(0, 80)}` }
            : null;
        })
        .filter((x) => x !== null);
      if (rows.length) {
        await sb.from("links").upsert(rows, { onConflict: "commit_id,story_id,task_id", ignoreDuplicates: true });
        result.suggested += rows.length;
      }
    }
  }

  await sb.from("sync_state").upsert({ workspace_id: id, etag, synced_at: new Date().toISOString(), last_error: null });
  return NextResponse.json(result);
}
