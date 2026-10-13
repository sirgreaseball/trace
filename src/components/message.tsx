import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "./ui";
import type { Profile } from "@/lib/types";

/** Renders text with "#LF-3" story mentions turned into links. */
export function Rich({ text, keyPrefix, base, mine = false }: { text: string; keyPrefix: string; base: string; mine?: boolean }) {
  const parts = text.split(new RegExp(`(#${keyPrefix}-\\d+\\b)`, "gi"));
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(new RegExp(`^#${keyPrefix}-(\\d+)$`, "i"));
        return m ? (
          <Link
            key={i}
            href={`${base}/stories/${m[1]}`}
            className={`mono rounded-[6px] px-1 py-px text-[0.9em] font-medium ${mine ? "bg-white/18 text-inv" : "bg-accent-soft text-accent-ink"}`}
          >
            {p.slice(1).toUpperCase()}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

/**
 * One message, as a bubble. Mine sit on the right in ink; everyone else's sit
 * on the left with their face on the first of a run.
 */
export function MessageRow({
  author,
  body,
  time,
  keyPrefix,
  base,
  compact = false,
  decision,
  action,
  mine = false,
}: {
  author: Pick<Profile, "name" | "hue"> | null;
  body: string;
  time: string;
  keyPrefix: string;
  base: string;
  compact?: boolean;
  decision?: number | null;
  action?: ReactNode;
  mine?: boolean;
}) {
  return (
    <div className={`group flex items-end gap-2.5 ${mine ? "flex-row-reverse" : ""} ${compact ? "mt-1" : "mt-4"}`}>
      {!mine && <div className="w-8 shrink-0">{!compact && <Avatar profile={author} size={32} />}</div>}
      <div className={`flex max-w-[min(78%,560px)] min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
        {!compact && (
          <p className={`mb-1 flex items-baseline gap-2 px-1 text-[12px] ${mine ? "flex-row-reverse" : ""}`}>
            {!mine && <span className="font-[600] text-ink-2">{author?.name ?? "Someone"}</span>}
            <span className="text-ink-3">{time}</span>
          </p>
        )}
        <div
          className={`rounded-[20px] px-3.5 py-2 text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap ${
            mine ? "rounded-br-[7px] bg-ink text-inv" : "rounded-bl-[7px] bg-surface shadow-[var(--shadow-sm),0_0_0_1px_var(--line)]"
          }`}
        >
          <Rich text={body} keyPrefix={keyPrefix} base={base} mine={mine} />
        </div>
        {decision && (
          <Link href={`${base}/decisions#d-${decision}`} className="chip chip-accent mt-1.5">
            <span className="size-1.5 rotate-45 rounded-[1px] bg-current" /> Logged as D-{decision}
          </Link>
        )}
      </div>
      {action && <div className="mb-1 shrink-0 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">{action}</div>}
    </div>
  );
}
