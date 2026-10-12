import Link from "next/link";
import { Mark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Mark size={40} className="mx-auto text-thread" />
        <h1 className="mt-6 text-[28px] font-semibold">Page not found</h1>
        <p className="mt-2 text-fg-2">It doesn&apos;t exist, or you aren&apos;t a member of this workspace.</p>
        <div className="mt-6 flex justify-center gap-2">
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
