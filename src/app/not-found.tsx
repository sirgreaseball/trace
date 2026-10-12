import Link from "next/link";
import { Mark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Mark size={40} className="mx-auto text-thread" />
        <p className="eyebrow mt-6">Error 404</p>
        <h1 className="display mt-3 text-[clamp(48px,8vw,96px)]">
          Lost the <em>thread.</em>
        </h1>
        <p className="mt-4 text-fg-2">It doesn&apos;t exist, or you aren&apos;t a member of this workspace.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/home" className="btn btn-primary">
            Your workspaces
          </Link>
          <Link href="/" className="btn">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
