import Link from "next/link";

// Placeholder while the new splash is built.
export function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <Link href="/enter" className="btn btn-primary">
        Enter
      </Link>
    </main>
  );
}
