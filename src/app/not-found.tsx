import Link from "next/link";
import { Rings } from "@/components/rings";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Rings values={[0.18, 0.12, 0.06]} size={120} delay={300} className="mx-auto" />
        <p className="mt-8 text-[13px] font-[560] text-ink-3">Error 404</p>
        <h1 className="t-display mt-3 text-[clamp(44px,7vw,84px)]">Nothing traced here.</h1>
        <p className="mx-auto mt-4 max-w-md text-[16px] text-ink-2">It doesn&apos;t exist, or you aren&apos;t a member of this workspace.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/home" className="btn btn-primary btn-lg">
            Your workspaces
          </Link>
          <Link href="/" className="btn btn-lg">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
