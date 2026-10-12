import Link from "next/link";

// Three strands of one knot, each passing under the next: the ropes on the splash, drawn flat.
const STRANDS = [
  "M19.39 11.25C20 10.71 20.51 10.08 20.87 9.47C21.23 8.85 21.46 8.18 21.56 7.56C21.65 6.94 21.59 6.3 21.41 5.76C21.23 5.21 20.91 4.69 20.49 4.29C20.07 3.9 19.51 3.56 18.9 3.37C18.29 3.18 17.56 3.08 16.84 3.13C16.11 3.18 15.3 3.35 14.54 3.65C13.77 3.94 12.96 4.38 12.24 4.91C11.52 5.44 10.8 6.11 10.2 6.83C9.6 7.55 9.04 8.39 8.62 9.24",
  "M7.53 16.3C7.69 17.1 7.98 17.85 8.33 18.48C8.68 19.1 9.15 19.64 9.64 20.03C10.13 20.42 10.71 20.69 11.28 20.81C11.84 20.92 12.45 20.9 13.01 20.74C13.56 20.57 14.13 20.25 14.6 19.82C15.07 19.39 15.52 18.81 15.84 18.15C16.16 17.5 16.42 16.71 16.54 15.9C16.67 15.09 16.69 14.17 16.59 13.28C16.5 12.39 16.27 11.44 15.95 10.55C15.63 9.67 15.17 8.77 14.65 7.97",
  "M9.07 3.51C8.31 3.25 7.51 3.12 6.8 3.12C6.08 3.11 5.38 3.25 4.8 3.48C4.22 3.71 3.69 4.08 3.31 4.51C2.93 4.93 2.64 5.48 2.51 6.04C2.37 6.6 2.37 7.25 2.5 7.88C2.64 8.5 2.92 9.18 3.33 9.78C3.73 10.39 4.29 11 4.93 11.52C5.57 12.03 6.35 12.51 7.17 12.87C7.99 13.23 8.93 13.52 9.85 13.68C10.78 13.84 11.79 13.9 12.74 13.84",
];

/** The mark: a trefoil knot, three strands over and under. */
export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      {STRANDS.map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 font-semibold tracking-[-0.03em] ${className}`} aria-label="Trace home">
      <Mark className="text-thread" />
      <span className="wide text-[17px] leading-none">trace</span>
    </Link>
  );
}
