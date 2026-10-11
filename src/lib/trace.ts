// The trace engine. Pure functions over one workspace's rows, shared by the
// server, the browser and the demo seeder, so every number on screen has one
// definition.
import type { Commit, Decision, Dispute, Link, Member, Story, Task, TraceData } from "./types";

// ---------------------------------------------------------------------------
// Words

const STOP = new Set(
  (
    "the and for with from into via this that these those are was were been its our your you they them " +
    "add adds added adding update updates updated fix fixes fixed fixing wip use uses used using make makes " +
    "made new old small minor more less show shows set sets get gets when then than also just some all any " +
    "can not now one two per out off over under after before only main merge branch commit pull request " +
    "should must could will would want so as of to in on at by is be it we i a an or " +
    "src lib app test tests spec index page component components util utils tsx jsx"
  ).split(" "),
);

function stem(w: string) {
  for (const s of ["ing", "ed", "es", "s"]) {
    if (w.length > s.length + 3 && w.endsWith(s)) return w.slice(0, -s.length);
  }
  return w;
}

/** Significant, lightly stemmed words. Shared by the linker and the conflict check. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

export const ref = (key: string, n: number) => `${key}-${n}`;

/** Item numbers a commit message points at, e.g. "LF-12: photo upload" -> [12]. */
export function refs(message: string, key: string): number[] {
  const re = new RegExp(`(?<![A-Za-z0-9])${key}-(\\d+)(?![0-9A-Za-z])`, "gi");
  return [...new Set([...message.matchAll(re)].map((m) => Number(m[1])))];
}

// ---------------------------------------------------------------------------
// Linking commits to the work they belong to

export type NewLink = Omit<Link, "id">;

const linkKey = (l: { commit_id: string; story_id: string | null; task_id: string | null }) =>
  `${l.commit_id}:${l.story_id ?? ""}:${l.task_id ?? ""}`;

function fileWords(files: string[]) {
  return files.flatMap((f) => words(f.replace(/\.[a-z0-9]+$/i, "")));
}

/**
 * Best story or task for a commit that names none. Score is shared words over
 * the geometric mean of both sides' sizes; ties prefer tasks (more specific).
 */
export function suggest(
  commit: Pick<Commit, "message" | "files">,
  stories: Story[],
  tasks: Task[],
): { story_id: string | null; task_id: string | null; score: number; shared: string[] } | null {
  const c = new Set([...words(commit.message), ...fileWords(commit.files)]);
  if (c.size === 0) return null;
  const storyById = new Map(stories.map((s) => [s.id, s]));
  const candidates = [
    ...tasks.map((t) => ({
      story_id: null as string | null,
      task_id: t.id as string | null,
      text: `${t.title} ${t.story_id ? (storyById.get(t.story_id)?.title ?? "") : ""}`,
      bias: 0.01,
    })),
    ...stories.map((s) => ({ story_id: s.id as string | null, task_id: null as string | null, text: s.title, bias: 0 })),
  ];
  let best: ReturnType<typeof suggest> = null;
  for (const cand of candidates) {
    const w = new Set(words(cand.text));
    if (w.size === 0) continue;
    const shared = [...w].filter((x) => c.has(x));
    if (shared.length < 2) continue;
    const score = shared.length / Math.sqrt(c.size * w.size) + cand.bias;
    if (score >= 0.3 && (!best || score > best.score)) {
      best = { story_id: cand.story_id, task_id: cand.task_id, score: Math.round(score * 100) / 100, shared };
    }
  }
  return best;
}

/**
 * Links to add for these commits. A commit that names an item ("LF-12") is
 * linked and confirmed. A commit that names nothing and has no live link gets
 * at most one suggestion, which a person confirms or rejects. Rejected pairs
 * are never suggested again.
 */
export function linkCommits(d: Pick<TraceData, "key" | "commits" | "stories" | "tasks" | "links">): NewLink[] {
  const byNumber = new Map<number, { story_id: string | null; task_id: string | null }>();
  for (const s of d.stories) byNumber.set(s.number, { story_id: s.id, task_id: null });
  for (const t of d.tasks) byNumber.set(t.number, { story_id: null, task_id: t.id });

  const seen = new Set(d.links.map(linkKey));
  const live = new Set(d.links.filter((l) => l.status !== "rejected").map((l) => l.commit_id));
  const out: NewLink[] = [];
  const add = (l: NewLink) => {
    const k = linkKey(l);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(l);
  };

  for (const c of d.commits) {
    let named = false;
    for (const n of refs(c.message, d.key)) {
      const target = byNumber.get(n);
      if (!target) continue;
      named = true;
      add({ commit_id: c.id, ...target, source: "id", status: "confirmed", score: 1, reason: `names ${ref(d.key, n)}` });
    }
    if (named || live.has(c.id)) continue;
    const s = suggest(c, d.stories, d.tasks);
    if (s) {
      add({
        commit_id: c.id,
        story_id: s.story_id,
        task_id: s.task_id,
        source: "suggested",
        status: "suggested",
        score: s.score,
        reason: `shares ${s.shared.slice(0, 3).map((w) => `“${w}”`).join(", ")}`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The trace: which commits, tasks, decisions and people sit behind each story

/** Story ids each commit is confirmed against, directly or through a task. */
export function commitStories(d: Pick<TraceData, "links" | "tasks">): Map<string, Set<string>> {
  const taskStory = new Map(d.tasks.map((t) => [t.id, t.story_id]));
  const out = new Map<string, Set<string>>();
  for (const l of d.links) {
    if (l.status !== "confirmed") continue;
    const story = l.story_id ?? (l.task_id ? taskStory.get(l.task_id) : null);
    if (!out.has(l.commit_id)) out.set(l.commit_id, new Set());
    if (story) out.get(l.commit_id)!.add(story);
  }
  return out;
}

export type StoryState = "untraced" | "planned" | "building" | "traced";

export type StoryTrace = {
  story: Story;
  tasks: Task[];
  commits: Commit[];
  decisions: Decision[];
  people: string[];
  state: StoryState;
};

export function traceStories(d: TraceData): StoryTrace[] {
  const cs = commitStories(d);
  const commitsByStory = new Map<string, Commit[]>();
  for (const c of d.commits) {
    for (const s of cs.get(c.id) ?? []) {
      if (!commitsByStory.has(s)) commitsByStory.set(s, []);
      commitsByStory.get(s)!.push(c);
    }
  }
  return [...d.stories]
    .sort((a, b) => a.number - b.number)
    .map((story) => {
      const tasks = d.tasks.filter((t) => t.story_id === story.id).sort((a, b) => a.number - b.number);
      const commits = (commitsByStory.get(story.id) ?? []).sort((a, b) => b.committed_at.localeCompare(a.committed_at));
      const decisions = d.decisions.filter((x) => x.story_id === story.id);
      const people = [
        ...new Set([
          ...commits.map((c) => c.user_id),
          ...tasks.filter((t) => t.status === "done").map((t) => t.assignee),
        ]),
      ].filter((x): x is string => !!x);
      const state: StoryState =
        tasks.length === 0 && commits.length === 0
          ? "untraced"
          : commits.length === 0
            ? "planned"
            : tasks.some((t) => t.status !== "done")
              ? "building"
              : "traced";
      return { story, tasks, commits, decisions, people, state };
    });
}

export function coverage(traces: StoryTrace[]) {
  const count = (s: StoryState) => traces.filter((t) => t.state === s).length;
  const total = traces.length;
  const traced = count("traced");
  return {
    total,
    traced,
    building: count("building"),
    planned: count("planned"),
    untraced: count("untraced"),
    pct: total ? Math.round((traced / total) * 100) : 0,
  };
}

/** Commits with no confirmed link to any story or task. */
export function orphanCommits(d: Pick<TraceData, "commits" | "links">): Commit[] {
  const linked = new Set(d.links.filter((l) => l.status === "confirmed").map((l) => l.commit_id));
  return d.commits.filter((c) => !linked.has(c.id));
}

// ---------------------------------------------------------------------------
// Contribution

// ponytail: one commit counts for at most 1500 changed lines, so a vendored
// file or lockfile can't swamp the shares. Upgrade path: ignore-globs per repo.
const LINE_CAP = 1500;
const lines = (c: Commit) => Math.min(c.additions + c.deletions, LINE_CAP);

export type Contribution = {
  user_id: string;
  commits: number;
  lines: number;
  tasks: number;
  decisions: number;
  stories: number;
  /** Weighted share of the team's work, 0..1. Members' weights sum to 1. */
  weight: number;
};

export function contributions(d: TraceData): Contribution[] {
  const builders = d.members.filter((m) => m.role !== "mentor");
  const rows = builders.map((m) => {
    const mine = d.commits.filter((c) => c.user_id === m.user_id);
    return {
      user_id: m.user_id,
      commits: mine.length,
      lines: mine.reduce((n, c) => n + lines(c), 0),
      tasks: d.tasks.filter((t) => t.assignee === m.user_id && t.status === "done").length,
      decisions: d.decisions.filter((x) => x.decided_by === m.user_id).length,
      stories: d.stories.filter((s) => s.created_by === m.user_id).length,
      weight: 0,
    };
  });
  const sum = (k: "commits" | "lines" | "tasks") => rows.reduce((n, r) => n + r[k], 0);
  const totals = { commits: sum("commits"), lines: sum("lines"), tasks: sum("tasks") };
  const share = (v: number, t: number) => (t ? v / t : 0);
  const parts = [
    ["commits", 0.4],
    ["lines", 0.3],
    ["tasks", 0.3],
  ] as const;
  const used = parts.filter(([k]) => totals[k] > 0);
  const wsum = used.reduce((n, [, w]) => n + w, 0);
  for (const r of rows) {
    r.weight = wsum ? used.reduce((n, [k, w]) => n + (w / wsum) * share(r[k], totals[k]), 0) : 0;
  }
  return rows.sort((a, b) => b.weight - a.weight);
}

/** 1 means perfectly even, 0 means one person did everything. (1 - Gini, scaled.) */
export function balance(weights: number[]): number {
  const n = weights.length;
  if (n < 2) return 1;
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 1;
  let diff = 0;
  for (const a of weights) for (const b of weights) diff += Math.abs(a - b);
  const gini = diff / (2 * n * total);
  return Math.max(0, 1 - gini / ((n - 1) / n));
}

// ---------------------------------------------------------------------------
// Receipts

export type ReceiptLine = {
  kind: "commit" | "task" | "decision" | "story";
  id: string;
  ref: string;
  title: string;
  detail: string;
  at: string;
  stories: string[];
  disputes: Dispute[];
};

export function buildReceipt(userId: string, d: TraceData) {
  const cs = commitStories(d);
  const storyRef = new Map(d.stories.map((s) => [s.id, ref(d.key, s.number)]));
  const disputesFor = (kind: ReceiptLine["kind"], id: string) =>
    d.disputes.filter((x) => x.kind === kind && x.item_id === id && (x.subject === userId || x.subject === null));
  const taskStory = (t: Task) => (t.story_id ? [storyRef.get(t.story_id)!].filter(Boolean) : []);

  const commits = d.commits.filter((c) => c.user_id === userId);
  const tasks = d.tasks.filter((t) => t.assignee === userId && t.status === "done");
  const decisions = d.decisions.filter((x) => x.decided_by === userId);
  const stories = d.stories.filter((s) => s.created_by === userId);

  const lines: ReceiptLine[] = [
    ...commits.map((c) => ({
      kind: "commit" as const,
      id: c.id,
      ref: c.sha.slice(0, 7),
      title: c.message.split("\n")[0],
      detail: c.detailed || c.additions || c.deletions ? `+${c.additions} −${c.deletions}` : "",
      at: c.committed_at,
      stories: [...(cs.get(c.id) ?? [])].map((s) => storyRef.get(s)!).filter(Boolean),
      disputes: disputesFor("commit", c.id),
    })),
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      ref: ref(d.key, t.number),
      title: t.title,
      detail: "done",
      at: t.done_at ?? t.created_at,
      stories: taskStory(t),
      disputes: disputesFor("task", t.id),
    })),
    ...decisions.map((x) => ({
      kind: "decision" as const,
      id: x.id,
      ref: `D-${x.number}`,
      title: x.title,
      detail: "decided",
      at: x.created_at,
      stories: x.story_id ? [storyRef.get(x.story_id)!].filter(Boolean) : [],
      disputes: disputesFor("decision", x.id),
    })),
    ...stories.map((s) => ({
      kind: "story" as const,
      id: s.id,
      ref: ref(d.key, s.number),
      title: s.title,
      detail: "wrote",
      at: s.created_at,
      stories: [],
      disputes: disputesFor("story", s.id),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const team = contributions(d);
  const me = team.find((c) => c.user_id === userId);
  return {
    lines,
    totals: {
      commits: commits.length,
      additions: commits.reduce((n, c) => n + c.additions, 0),
      deletions: commits.reduce((n, c) => n + c.deletions, 0),
      tasks: tasks.length,
      decisions: decisions.length,
      stories: stories.length,
    },
    weight: me?.weight ?? 0,
    teamSize: team.length,
    openDisputes: lines.reduce((n, l) => n + l.disputes.filter((x) => x.status === "open").length, 0),
  };
}

// ---------------------------------------------------------------------------
// Viva practice: questions about the parts of the project you didn't build

export function moduleOf(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const deep = ["src", "app", "lib", "packages", "server", "client", "api"].includes(parts[0]) && parts.length > 2;
  return deep ? `${parts[0]}/${parts[1]}` : parts[0];
}

export type VivaQuestion = {
  id: string;
  kind: "commit" | "decision" | "story";
  topic: string;
  prompt: string;
  answer: string[];
  evidence: { kind: "commit" | "decision" | "story"; id: string; ref: string }[];
};

export function vivaModules(userId: string, d: TraceData) {
  const mods = new Map<string, { total: number; mine: number }>();
  for (const c of d.commits) {
    const touched = new Set(c.files.map(moduleOf).filter((m): m is string => !!m));
    if (touched.size === 0) continue;
    const each = lines(c) / touched.size;
    for (const m of touched) {
      const row = mods.get(m) ?? { total: 0, mine: 0 };
      row.total += each;
      if (c.user_id === userId) row.mine += each;
      mods.set(m, row);
    }
  }
  return [...mods.entries()]
    .map(([module, r]) => ({ module, share: r.total ? r.mine / r.total : 0, total: r.total }))
    .sort((a, b) => b.total - a.total);
}

export function buildViva(userId: string, d: TraceData, limit = 12): VivaQuestion[] {
  const name = new Map(d.members.map((m) => [m.user_id, m.profile.name.split(" ")[0] || m.profile.name]));
  const cs = commitStories(d);
  const storyById = new Map(d.stories.map((s) => [s.id, s]));
  const superseded = new Set(d.decisions.map((x) => x.supersedes).filter(Boolean));
  const firstLine = (s: string) => s.split("\n")[0];
  const criteria = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const foreign = vivaModules(userId, d).filter((m) => m.share < 0.3).slice(0, 5);
  const commitQs: VivaQuestion[] = [];
  for (const m of foreign) {
    const picks = d.commits
      .filter((c) => c.user_id !== userId && c.files.some((f) => moduleOf(f) === m.module))
      .sort((a, b) => lines(b) - lines(a))
      .slice(0, 2);
    for (const c of picks) {
      const story = [...(cs.get(c.id) ?? [])].map((s) => storyById.get(s)).find(Boolean);
      const who = (c.user_id && name.get(c.user_id)) || c.author_name || "A teammate";
      const files = c.files.filter((f) => moduleOf(f) === m.module).slice(0, 2).map((f) => f.split("/").pop());
      commitQs.push({
        id: `c:${c.id}`,
        kind: "commit",
        topic: m.module,
        prompt: story
          ? `${who} changed ${files.join(" and ")} in “${firstLine(c.message)}”. What does this do for ${ref(d.key, story.number)}, “${story.title}”?`
          : `${who} changed ${files.join(" and ")} in “${firstLine(c.message)}”. What does it change, and why was it needed?`,
        answer: [
          `Commit ${c.sha.slice(0, 7)}: ${firstLine(c.message)} (+${c.additions} −${c.deletions}).`,
          ...(story ? [`It serves ${ref(d.key, story.number)}: ${story.narrative || story.title}`] : []),
          ...(story ? criteria(story.acceptance).slice(0, 2) : []),
        ],
        evidence: [
          { kind: "commit", id: c.id, ref: c.sha.slice(0, 7) },
          ...(story ? [{ kind: "story" as const, id: story.id, ref: ref(d.key, story.number) }] : []),
        ],
      });
    }
  }

  const decisionQs: VivaQuestion[] = d.decisions
    .filter((x) => x.decided_by !== userId && !superseded.has(x.id) && x.rationale)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4)
    .map((x) => ({
      id: `d:${x.id}`,
      kind: "decision",
      topic: `D-${x.number}`,
      prompt: `The team decided: “${x.title}”. Why, and what did you give up?`,
      answer: [x.rationale, ...(x.alternatives ? [`Considered instead: ${x.alternatives}`] : [])],
      evidence: [{ kind: "decision", id: x.id, ref: `D-${x.number}` }],
    }));

  const mineStories = new Set(
    [
      ...d.commits.filter((c) => c.user_id === userId).flatMap((c) => [...(cs.get(c.id) ?? [])]),
      ...d.tasks.filter((t) => t.assignee === userId).map((t) => t.story_id),
    ].filter(Boolean),
  );
  const storyQs: VivaQuestion[] = d.stories
    .filter((s) => !mineStories.has(s.id) && criteria(s.acceptance).length > 0)
    .sort((a, b) => ({ must: 0, should: 1, could: 2 })[a.priority] - ({ must: 0, should: 1, could: 2 })[b.priority])
    .slice(0, 3)
    .map((s) => ({
      id: `s:${s.id}`,
      kind: "story",
      topic: ref(d.key, s.number),
      prompt: `Demo ${ref(d.key, s.number)}, “${s.title}”. What has to be true for it to pass?`,
      answer: criteria(s.acceptance),
      evidence: [{ kind: "story", id: s.id, ref: ref(d.key, s.number) }],
    }));

  // Interleave so a session mixes code, decisions and requirements.
  const out: VivaQuestion[] = [];
  const queues = [commitQs, decisionQs, storyQs];
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && out.length < limit) out.push(q.shift()!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decisions that may contradict each other

export function conflicts(decisions: Decision[], dismissed: Set<string> = new Set()) {
  const superseded = new Set(decisions.map((x) => x.supersedes).filter(Boolean));
  const active = decisions.filter((x) => !superseded.has(x.id)).sort((a, b) => a.number - b.number);
  const bag = (x: Decision) => new Set(words(`${x.title} ${x.rationale.slice(0, 300)}`));
  const out: { earlier: Decision; later: Decision; shared: string[] }[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const [a, b] = [active[i], active[j]];
      if (b.supersedes === a.id || dismissed.has(`${a.id}:${b.id}`)) continue;
      const wa = bag(a);
      const wb = bag(b);
      const shared = [...wa].filter((w) => wb.has(w));
      const jaccard = shared.length / (wa.size + wb.size - shared.length || 1);
      if (shared.length >= 3 && jaccard >= 0.12) out.push({ earlier: a, later: b, shared });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Team health, for the mentor view

export type Flag = { level: "warn" | "info"; text: string };

export function health(d: TraceData, now: number) {
  const traces = traceStories(d);
  const cov = coverage(traces);
  const team = contributions(d);
  const bal = balance(team.map((t) => t.weight));
  const name = new Map(d.members.map((m) => [m.user_id, m.profile.name]));
  const orphans = orphanCommits(d).length;
  const open = d.disputes.filter((x) => x.status === "open").length;
  const times = [
    ...d.commits.map((c) => c.committed_at),
    ...d.tasks.map((t) => t.done_at ?? t.created_at),
    ...d.decisions.map((x) => x.created_at),
  ].sort();
  const last = times.length ? times[times.length - 1] : null;
  const idleDays = last ? Math.floor((now - Date.parse(last)) / 86_400_000) : null;

  const flags: Flag[] = [];
  const fair = team.length ? 1 / team.length : 0;
  for (const t of team) {
    if (team.length >= 3 && t.weight > fair * 2) {
      flags.push({ level: "warn", text: `${name.get(t.user_id)} is carrying ${Math.round(t.weight * 100)}% of the work` });
    } else if (team.length >= 2 && t.weight < fair * 0.4) {
      flags.push({ level: "warn", text: `${name.get(t.user_id)} has ${Math.round(t.weight * 100)}% of the work` });
    }
  }
  if (cov.total && cov.pct < 40) flags.push({ level: "warn", text: `Only ${cov.pct}% of stories traced to working code` });
  if (orphans >= 5) flags.push({ level: "info", text: `${orphans} commits not linked to any story` });
  if (open) flags.push({ level: "warn", text: `${open} open ${open === 1 ? "dispute" : "disputes"}` });
  const clash = conflicts(d.decisions, new Set(d.dismissed ?? [])).length;
  if (clash) flags.push({ level: "info", text: `${clash} decision ${clash === 1 ? "pair" : "pairs"} may conflict` });
  if (idleDays !== null && idleDays >= 5) flags.push({ level: "warn", text: `No activity for ${idleDays} days` });

  return { coverage: cov, team, balance: bal, orphans, openDisputes: open, last, flags };
}

export function memberName(members: Member[], id: string | null | undefined) {
  return members.find((m) => m.user_id === id)?.profile.name ?? "Unknown";
}
