import type { CSSProperties, ReactNode } from "react";
import type { StoryState } from "@/lib/trace";
import type { Profile } from "@/lib/types";
import { initials } from "@/lib/format";

/** A person's colour, from the hue on their profile. */
export const personColor = (hue: number | undefined, l = 0.64, c = 0.16) => `oklch(${l} ${c} ${hue ?? 260})`;

export function Avatar({ profile, size = 24, ring = false, className = "" }: { profile: Pick<Profile, "name" | "hue"> | null | undefined; size?: number; ring?: boolean; className?: string }) {
  const hue = profile?.hue;
  return (
    <span
      title={profile?.name ?? "Unknown"}
      className={`relative inline-grid shrink-0 place-items-center rounded-full font-[620] text-white select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        letterSpacing: "-0.02em",
        background: profile ? `linear-gradient(160deg, ${personColor(hue, 0.7, 0.15)}, ${personColor(hue, 0.56, 0.17)})` : "var(--ink-3)",
        boxShadow: ring ? "0 0 0 2px var(--surface)" : "inset 0 1px 0 rgb(255 255 255 / 0.25)",
      }}
    >
      {profile ? initials(profile.name) : "?"}
    </span>
  );
}

export function Avatars({ people, size = 22, max = 4 }: { people: Pick<Profile, "name" | "hue">[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -size * 0.28 : 0, zIndex: shown.length - i }}>
          <Avatar profile={p} size={size} ring />
        </span>
      ))}
      {people.length > max && <span className="ml-1.5 text-[12px] text-ink-3">+{people.length - max}</span>}
    </span>
  );
}

export const STATE_LABEL: Record<StoryState, string> = {
  traced: "Traced",
  building: "Building",
  planned: "Planned",
  untraced: "Untraced",
};

export const STATE_HINT: Record<StoryState, string> = {
  traced: "Every task done and backed by a commit",
  building: "Commits landing, tasks still open",
  planned: "Tasks written, no commits yet",
  untraced: "Nothing behind it yet",
};

export function StateMark({ state, className = "" }: { state: StoryState; className?: string }) {
  return <span className={`mark mark-${state} ${className}`} aria-hidden />;
}

export function StateLabel({ state }: { state: StoryState }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-[540] text-ink-2" title={STATE_HINT[state]}>
      <StateMark state={state} />
      {STATE_LABEL[state]}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: "must" | "should" | "could" }) {
  return (
    <span className={`chip ${priority === "must" ? "bg-ink text-inv" : ""}`}>{priority === "must" ? "Must" : priority === "should" ? "Should" : "Could"}</span>
  );
}

/** The big title at the top of a page, with its actions. */
export function PageTitle({ title, sub, children, kicker }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; kicker?: ReactNode }) {
  return (
    <header className="relative mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-10">
      <div className="min-w-0">
        {kicker && <div className="mb-3 text-[13px] font-[560] text-ink-3">{kicker}</div>}
        <h1 className="t-title">{title}</h1>
        {sub && <div className="mt-3 max-w-[60ch] text-[15px] text-ink-2">{sub}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Section({ title, right, children, className = "", style }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={className} style={style}>
      {(title || right) && (
        <div className="mb-3 flex min-h-7 items-center justify-between gap-3 px-1">
          {title && <h2 className="t-section">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="pane flex flex-col items-center px-6 py-14 text-center">
      <span className="relative mb-5 grid size-14 place-items-center">
        <span className="absolute inset-0 rounded-full border-[3px] border-dashed border-line-3" />
        <span className="size-3 rounded-full bg-line-3" />
      </span>
      <p className="t-headline">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-[14px] text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Who did how much, as one bar split by person. */
export function TeamBar({ parts, height = 8, gap = 3 }: { parts: { value: number; hue?: number; color?: string; label: string }[]; height?: number; gap?: number }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height, gap, borderRadius: height }}
      role="img"
      aria-label={shown.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}
    >
      {shown.map((p, i) => (
        <span
          key={i}
          title={`${p.label} · ${Math.round((p.value / total) * 100)}%`}
          style={{ flexGrow: p.value, borderRadius: height, background: p.color ?? `linear-gradient(90deg, ${personColor(p.hue, 0.72, 0.14)}, ${personColor(p.hue, 0.6, 0.17)})` }}
        />
      ))}
      {shown.length === 0 && <span className="flex-1 rounded-full bg-surface-3" />}
    </div>
  );
}
