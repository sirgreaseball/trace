export type Role = "owner" | "member" | "mentor";
export type Priority = "must" | "should" | "could";
export type TaskStatus = "todo" | "doing" | "done";

export type Profile = { id: string; name: string; github: string | null; hue: number };

export type Member = { user_id: string; role: Role; joined_at: string; profile: Profile };

export type Workspace = {
  id: string;
  name: string;
  key: string;
  course: string;
  repo: string | null;
  demo: boolean;
  created_at: string;
};

export type Story = {
  id: string;
  number: number;
  title: string;
  narrative: string;
  acceptance: string;
  priority: Priority;
  created_by: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  number: number;
  story_id: string | null;
  title: string;
  status: TaskStatus;
  assignee: string | null;
  created_by: string | null;
  created_at: string;
  done_at: string | null;
};

export type Commit = {
  id: string;
  sha: string;
  message: string;
  author_login: string | null;
  author_name: string;
  user_id: string | null;
  additions: number;
  deletions: number;
  files: string[];
  detailed: boolean;
  url: string | null;
  committed_at: string;
};

export type Link = {
  id: string;
  commit_id: string;
  story_id: string | null;
  task_id: string | null;
  source: "id" | "suggested" | "manual" | "ai";
  status: "confirmed" | "suggested" | "rejected";
  score: number | null;
  reason: string | null;
};

export type Decision = {
  id: string;
  number: number;
  title: string;
  rationale: string;
  alternatives: string;
  story_id: string | null;
  message_id: string | null;
  supersedes: string | null;
  decided_by: string | null;
  created_at: string;
};

export type Dispute = {
  id: string;
  kind: "commit" | "task" | "decision" | "story";
  item_id: string;
  subject: string | null;
  raised_by: string | null;
  note: string;
  status: "open" | "resolved";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type Message = {
  id: string;
  user_id: string | null;
  story_id: string | null;
  body: string;
  created_at: string;
};

/** Everything the trace engine needs to reason about one workspace. */
export type TraceData = {
  key: string;
  members: Member[];
  stories: Story[];
  tasks: Task[];
  commits: Commit[];
  links: Link[];
  decisions: Decision[];
  disputes: Dispute[];
};
