import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser, supabaseServer } from "./supabase/server";
import type {
  Commit,
  Decision,
  Dispute,
  Link,
  Member,
  Message,
  Role,
  Story,
  Task,
  TraceData,
  Workspace,
} from "./types";

export type WorkspaceView = TraceData & { ws: Workspace; me: { id: string; role: Role; name: string }; syncedAt: string | null };

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Everything about one workspace the signed-in user can see. RLS decides what that is. */
export const loadWorkspace = cache(async (id: string): Promise<WorkspaceView> => {
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const sb = await supabaseServer();
  const [ws, members, stories, tasks, commits, links, decisions, disputes, sync, notes] = await Promise.all([
    sb.from("workspaces").select("id, name, key, course, repo, demo, created_at").eq("id", id).maybeSingle(),
    sb.from("members").select("user_id, role, joined_at, profile:profiles(id, name, github, hue)").eq("workspace_id", id),
    sb.from("stories").select("id, number, title, narrative, acceptance, priority, created_by, created_at").eq("workspace_id", id).order("number"),
    sb.from("tasks").select("id, number, story_id, title, status, assignee, created_by, created_at, done_at").eq("workspace_id", id).order("number"),
    sb
      .from("commits")
      .select("id, sha, message, author_login, author_name, user_id, additions, deletions, files, detailed, url, committed_at")
      .eq("workspace_id", id)
      .order("committed_at", { ascending: false })
      .limit(1000),
    sb.from("links").select("id, commit_id, story_id, task_id, source, status, score, reason").eq("workspace_id", id).limit(1000),
    sb.from("decisions").select("id, number, title, rationale, alternatives, story_id, message_id, supersedes, decided_by, created_at").eq("workspace_id", id).order("number"),
    sb.from("disputes").select("id, kind, item_id, subject, raised_by, note, status, resolution, created_at, resolved_at").eq("workspace_id", id).order("created_at", { ascending: false }),
    sb.from("sync_state").select("synced_at").eq("workspace_id", id).maybeSingle(),
    sb.from("ai_cache").select("key").eq("workspace_id", id).like("key", "conflict-ok:%"),
  ]);
  if (!ws.data) notFound();
  const mems = ((members.data ?? []) as unknown as Member[]).filter((m) => m.profile);
  const mine = mems.find((m) => m.user_id === user.id);
  if (!mine) notFound();
  return {
    ws: ws.data as Workspace,
    key: ws.data.key,
    me: { id: user.id, role: mine.role, name: mine.profile.name },
    members: mems.sort((a, b) => a.profile.name.localeCompare(b.profile.name)),
    stories: (stories.data ?? []) as Story[],
    tasks: (tasks.data ?? []) as Task[],
    commits: (commits.data ?? []) as Commit[],
    links: (links.data ?? []) as Link[],
    decisions: (decisions.data ?? []) as Decision[],
    disputes: (disputes.data ?? []) as Dispute[],
    syncedAt: sync.data?.synced_at ?? null,
    dismissed: (notes.data ?? []).map((n) => n.key.slice("conflict-ok:".length)),
  };
});

export async function loadMessages(id: string, limit = 200): Promise<Message[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("messages")
    .select("id, user_id, story_id, body, created_at")
    .eq("workspace_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Message[]).reverse();
}

/** The workspaces the signed-in user belongs to, with their role in each. */
export async function myWorkspaces() {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data } = await sb
    .from("members")
    .select("role, workspace:workspaces(id, name, key, course, repo, demo, created_at)")
    .eq("user_id", user.id);
  const rows = ((data ?? []) as unknown as { role: Role; workspace: Workspace | null }[]).filter((r) => r.workspace);
  return rows
    .map((r) => ({ role: r.role, ws: r.workspace! }))
    .sort((a, b) => a.ws.name.localeCompare(b.ws.name));
}

export async function myProfile() {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("id, name, github, hue").eq("id", user.id).maybeSingle();
  return { user, profile: data ?? { id: user.id, name: user.email ?? "You", github: null, hue: 20 } };
}
