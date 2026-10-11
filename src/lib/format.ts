const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "just now". Pass `now` from the caller so server and client agree. */
export function ago(iso: string, now: number = Date.now()) {
  // Anything "in the future" is clock skew or a message newer than `now`.
  const s = Math.min(0, (Date.parse(iso) - now) / 1000);
  const abs = Math.abs(s);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31557600],
    ["month", 2629800],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) if (abs >= size) return rtf.format(Math.round(s / size), unit);
  return "just now";
}

export function day(iso: string) {
  // Fixed zone so the server (UTC) and an Indian browser group by the same day.
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function initials(name: string) {
  const parts = name.replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const firstName = (name: string) => name.replace(/^(prof|dr)\.?\s+/i, "").split(" ")[0] || name;

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Only same-site paths, so a redirect parameter can't bounce people to another site. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/home";
}

/** "owner/repo" from a pasted GitHub URL or name, or null. */
export function parseRepo(input: string): string | null {
  const s = input.trim().replace(/\/+$/, "");
  const m =
    s.match(/github\.com[/:]([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[/?#]|$)/) ??
    s.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The time a server render runs at. A function so render code stays free of direct clock reads. */
export const requestTime = () => Date.now();
