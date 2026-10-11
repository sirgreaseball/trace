import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <Link href="/enter" className="btn btn-thread">
        Enter Trace
      </Link>
    </main>
  );
}
