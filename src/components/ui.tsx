import type { ReactNode } from "react";
import type { StoryState } from "@/lib/trace";
import type { Profile } from "@/lib/types";
import { initials } from "@/lib/format";

export function Avatar({ profile, size = 22, ring = false }: { profile: Pick<Profile, "name" | "hue"> | null | undefined; size?: number; ring?: boolean }) {
  const hue = profile?.hue ?? 0;
  return (
    <span
      title={profile?.name ?? "Unknown"}
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none ${ring ? "ring-2 ring-bg-2" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.4),
        background: profile ? `oklch(0.62 0.13 ${hue})` : "var(--fg-3)",
      }}
    >
      {profile ? initials(profile.name) : "?"}
    </span>
  );
}

export function Avatars({ people, size = 20, max = 4 }: { people: Pick<Profile, "name" | "hue">[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -size * 0.3 : 0 }}>
          <Avatar profile={p} size={size} ring />
        </span>
      ))}
      {people.length > max && <span className="ml-1 text-xs text-fg-3">+{people.length - max}</span>}
    </span>
  );
}

const STATE: Record<StoryState, { label: string; cls: string; dot: string }> = {
  traced: { label: "Traced", cls: "chip-thread", dot: "bg-thread" },
  building: { label: "Building", cls: "", dot: "bg-fg-2" },
  planned: { label: "Planned", cls: "", dot: "border border-fg-3" },
  untraced: { label: "Untraced", cls: "chip-warn", dot: "border border-dashed border-warn" },
};

export function StateChip({ state }: { state: StoryState }) {
  const s = STATE[state];
  return (
    <span className={`chip ${s.cls}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: "must" | "should" | "could" }) {
  return <span className={`chip ${priority === "must" ? "text-fg" : ""}`}>{priority === "must" ? "Must" : priority === "should" ? "Should" : "Could"}</span>;
}

export function PageHeader({ eyebrow, title, accent, children, sub }: { eyebrow?: string; title: string; accent?: string; children?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[26px] leading-tight font-semibold sm:text-[30px]">
          {title}
          {accent && <span className="serif font-normal text-fg-2"> {accent}</span>}
        </h1>
        {sub && <div className="mt-1.5 max-w-2xl text-fg-2">{sub}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-2 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-fg-2">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold tracking-normal text-fg-2">{children}</h2>
      {right}
    </div>
  );
}

/** A thin stacked bar, e.g. each member's share of the work. */
export function ShareBar({ parts, height = 6 }: { parts: { value: number; hue?: number; color?: string; label: string }[]; height?: number }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }} role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
      {parts
        .filter((p) => p.value > 0)
        .map((p, i) => (
          <span
            key={i}
            title={`${p.label} · ${Math.round((p.value / total) * 100)}%`}
            style={{ flexGrow: p.value, background: p.color ?? `oklch(0.62 0.13 ${p.hue ?? 0})` }}
          />
        ))}
    </div>
  );
}
