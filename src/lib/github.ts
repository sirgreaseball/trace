import "server-only";

// Reads public commit history from the GitHub REST API. An optional
// GITHUB_TOKEN raises the limit from 60 to 5,000 requests an hour.

const API = "https://api.github.com";

function headers(etag?: string | null): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "trace-app",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    ...(etag ? { "If-None-Match": etag } : {}),
  };
}

export class GitHubError extends Error {}

function explain(res: Response, repo: string) {
  if (res.status === 404) return `GitHub can't find ${repo}. Check the name, or make the repository public.`;
  if (res.status === 409) return `${repo} has no commits yet.`;
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const mins = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
    return `GitHub's rate limit is used up${mins ? `; try again in ${mins} min` : ""}.`;
  }
  return `GitHub answered ${res.status}. Try again shortly.`;
}

export type GhCommit = {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: { message: string; author: { name: string; date: string } | null; committer: { date: string } | null };
};

/** Newest commits on the default branch, up to `pages` pages of 100. Null means unchanged since `etag`. */
export async function listCommits(repo: string, etag: string | null, pages = 3) {
  const out: GhCommit[] = [];
  let newEtag: string | null = null;
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(`${API}/repos/${repo}/commits?per_page=100&page=${page}`, {
      headers: headers(page === 1 ? etag : null),
      cache: "no-store",
    });
    if (page === 1 && res.status === 304) return null;
    if (!res.ok) throw new GitHubError(explain(res, repo));
    if (page === 1) newEtag = res.headers.get("etag");
    const batch = (await res.json()) as GhCommit[];
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return { commits: out, etag: newEtag };
}

/** Changed files and line counts for one commit. */
export async function commitDetail(repo: string, sha: string) {
  const res = await fetch(`${API}/repos/${repo}/commits/${sha}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new GitHubError(explain(res, repo));
  const c = (await res.json()) as { stats?: { additions: number; deletions: number }; files?: { filename: string }[] };
  return {
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    files: (c.files ?? []).slice(0, 100).map((f) => f.filename),
  };
}

