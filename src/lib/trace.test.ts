// Run with: npm test  (node --test, no framework)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balance,
  buildReceipt,
  buildViva,
  conflicts,
  contributions,
  coverage,
  linkCommits,
  moduleOf,
  refs,
  traceStories,
} from "./trace.ts";
import type { Commit, Decision, Link, Member, Story, Task, TraceData } from "./types.ts";

const at = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
const member = (id: string, name: string, role: Member["role"] = "member"): Member => ({
  user_id: id,
  role,
  joined_at: at(1),
  profile: { id, name, github: id, hue: 0 },
});
const story = (id: string, number: number, title: string, acceptance = ""): Story => ({
  id, number, title, narrative: "", acceptance, priority: "must", created_by: "a", created_at: at(1),
});
const task = (id: string, number: number, story_id: string, title: string, status: Task["status"], assignee: string): Task => ({
  id, number, story_id, title, status, assignee, created_by: "a", created_at: at(2), done_at: status === "done" ? at(5) : null,
});
const commit = (id: string, message: string, user_id: string, files: string[], add = 10): Commit => ({
  id, sha: id.padEnd(7, "0"), message, author_login: user_id, author_name: user_id, user_id,
  additions: add, deletions: 2, files, detailed: true, url: null, committed_at: at(6),
});
const decision = (id: string, number: number, title: string, rationale: string, by: string, supersedes: string | null = null): Decision => ({
  id, number, title, rationale, alternatives: "", story_id: null, message_id: null, supersedes, decided_by: by, created_at: at(number),
});

function fixture(links: Link[] = []): TraceData {
  return {
    key: "LF",
    members: [member("a", "Aarav Mehta", "owner"), member("b", "Isha Kulkarni"), member("m", "Prof Nair", "mentor")],
    stories: [story("s1", 1, "Report a lost item", "Given a photo\nThen it is saved"), story("s2", 2, "Search items")],
    tasks: [
      task("t3", 3, "s1", "Photo upload with compression", "done", "a"),
      task("t4", 4, "s2", "Search box with filters", "doing", "b"),
    ],
    commits: [
      commit("c1aaaaa", "LF-3: upload form", "a", ["src/items/upload.tsx"], 120),
      commit("c2bbbbb", "compress photo upload before saving", "a", ["src/items/compress.ts"]),
      commit("c3ccccc", "lf-4 search box", "b", ["src/search/box.tsx"]),
      commit("c4ddddd", "tidy readme", "b", ["README.md"]),
    ],
    links,
    decisions: [],
    disputes: [],
  };
}

test("refs finds item numbers case-insensitively and only for this key", () => {
  assert.deepEqual(refs("LF-3: x, lf-12 and LF-3 again", "LF"), [3, 12]);
  assert.deepEqual(refs("XLF-3 LF-31a ALF-2", "LF"), []);
});

test("linker confirms named items, suggests the rest, never re-suggests a rejection", () => {
  const d = fixture();
  const out = linkCommits(d);
  const c1 = out.find((l) => l.commit_id === "c1aaaaa")!;
  assert.equal(c1.task_id, "t3");
  assert.equal(c1.status, "confirmed");
  assert.equal(out.find((l) => l.commit_id === "c3ccccc")!.task_id, "t4");
  const c2 = out.find((l) => l.commit_id === "c2bbbbb")!;
  assert.equal(c2.status, "suggested");
  assert.equal(c2.task_id, "t3");
  assert.equal(out.some((l) => l.commit_id === "c4ddddd"), false);

  const rejected: Link = { id: "x", ...c2, status: "rejected" };
  assert.equal(linkCommits({ ...d, links: [rejected] }).some((l) => l.commit_id === "c2bbbbb" && l.task_id === "t3"), false);
  // Running again over its own output adds nothing.
  const all = out.map((l, i) => ({ id: String(i), ...l }));
  assert.deepEqual(linkCommits({ ...d, links: all }), []);
});

test("story states and coverage", () => {
  const d = fixture();
  const links = linkCommits(d).filter((l) => l.status === "confirmed").map((l, i) => ({ id: String(i), ...l }));
  const traces = traceStories({ ...d, links });
  assert.equal(traces[0].state, "traced");
  assert.equal(traces[1].state, "building");
  assert.deepEqual(coverage(traces), { total: 2, traced: 1, building: 1, planned: 0, untraced: 0, pct: 50 });
});

test("contribution weights sum to one and mentors are left out", () => {
  const team = contributions(fixture());
  assert.equal(team.length, 2);
  assert.ok(Math.abs(team.reduce((n, t) => n + t.weight, 0) - 1) < 1e-9);
  assert.equal(team[0].user_id, "a");
  assert.equal(balance([0.5, 0.5]), 1);
  assert.equal(balance([1, 0, 0]), 0);
});

test("receipt lists only the member's own evidence", () => {
  const d = fixture();
  const r = buildReceipt("a", d);
  assert.equal(r.totals.commits, 2);
  assert.equal(r.totals.tasks, 1);
  assert.ok(r.lines.every((l) => l.kind !== "commit" || ["c1aaaaa", "c2bbbbb"].includes(l.id)));
});

test("viva asks about modules and stories the member didn't build", () => {
  const d = fixture();
  const links = linkCommits(d).map((l, i) => ({ id: String(i), ...l, status: "confirmed" as const }));
  const qs = buildViva("b", { ...d, links });
  assert.ok(qs.some((q) => q.kind === "commit" && q.topic === "src/items"));
  assert.ok(qs.some((q) => q.kind === "story" && q.topic === "LF-1"));
  assert.ok(!qs.some((q) => q.topic === "src/search"));
  assert.equal(moduleOf("src/items/a.ts"), "src/items");
  assert.equal(moduleOf("db/migrations/1.sql"), "db");
  assert.equal(moduleOf("README.md"), null);
});

test("conflicting decisions are flagged until one supersedes the other", () => {
  const a = decision("d1", 1, "Send push notifications for matches", "Students check phones, push notifications reach them fastest", "a");
  const b = decision("d2", 2, "Email only for match alerts in v1", "Push notifications need a service worker; email alerts for matches are enough", "b");
  assert.equal(conflicts([a, b]).length, 1);
  assert.equal(conflicts([a, { ...b, supersedes: "d1" }]).length, 0);
  assert.equal(conflicts([a, b], new Set(["d1:d2"])).length, 0);
});
