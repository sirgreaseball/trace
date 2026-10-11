import Link from "next/link";

/** The mark: one thread that ties a single knot. */
export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M1.5 16.5H7.2c2.9 0 5.3-2.3 5.3-5.2 0-2.3-1.6-4-3.5-4-1.8 0-3.1 1.5-3.1 3.2 0 3.4 4.4 6 9.1 6h7.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 font-semibold tracking-[-0.03em] ${className}`} aria-label="Trace home">
      <Mark className="text-thread" />
      <span className="text-[17px] leading-none">trace</span>
    </Link>
  );
}
