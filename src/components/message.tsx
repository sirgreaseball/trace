import Link from "next/link";
import { Avatar } from "./ui";
import type { Profile } from "@/lib/types";

/** Renders text with "#LF-3" story mentions turned into links. */
export function Rich({ text, keyPrefix, base }: { text: string; keyPrefix: string; base: string }) {
  const parts = text.split(new RegExp(`(#${keyPrefix}-\\d+\\b)`, "gi"));
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(new RegExp(`^#${keyPrefix}-(\\d+)$`, "i"));
        return m ? (
          <Link key={i} href={`${base}/stories/${m[1]}`} className="mono rounded bg-thread-soft px-1 text-[0.92em] text-thread-ink">
            {p.slice(1).toUpperCase()}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

export function MessageRow({
  author,
  body,
  time,
  keyPrefix,
  base,
  compact = false,
  decision,
  action,
}: {
  author: Pick<Profile, "name" | "hue"> | null;
  body: string;
  time: string;
  keyPrefix: string;
  base: string;
  compact?: boolean;
  decision?: number | null;
  action?: React.ReactNode;
}) {
  return (
    <div className={`group flex gap-3 ${compact ? "pt-0.5" : "pt-3"}`}>
      <div className="w-7 shrink-0">{!compact && <Avatar profile={author} size={28} />}</div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <p className="flex items-baseline gap-2 text-[13px]">
            <span className="font-semibold">{author?.name ?? "Someone"}</span>
            <span className="text-[11.5px] text-fg-3">{time}</span>
          </p>
        )}
        <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap text-fg">
          <Rich text={body} keyPrefix={keyPrefix} base={base} />
        </p>
        {decision && (
          <Link href={`${base}/decisions#d-${decision}`} className="chip chip-thread mt-1">
            <span className="size-1.5 rotate-45 border border-current" /> Logged as D-{decision}
          </Link>
        )}
      </div>
      {action && <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">{action}</div>}
    </div>
  );
}
