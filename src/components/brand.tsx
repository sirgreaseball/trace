import Link from "next/link";

/** The mark: two rings still closing. The outer one is the requirement, the inner one the work behind it. */
export function Mark({ size = 22, className = "", ink = "currentColor" }: { size?: number; className?: string; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9.2" pathLength={100} stroke="var(--accent)" strokeWidth="2.7" strokeLinecap="round" strokeDasharray="78 100" transform="rotate(-90 12 12)" />
      <circle cx="12" cy="12" r="4.6" pathLength={100} stroke={ink} strokeWidth="2.7" strokeLinecap="round" strokeDasharray="58 100" transform="rotate(60 12 12)" />
    </svg>
  );
}

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`press inline-flex items-center gap-2 ${className}`} aria-label="Trace home">
      <Mark />
      <span className="text-[19px] leading-none font-[680] tracking-[-0.05em]">trace</span>
    </Link>
  );
}
