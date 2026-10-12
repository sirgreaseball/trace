import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { safeNext } from "@/lib/format";
import { currentUser } from "@/lib/supabase/server";
import { ThreadCanvas } from "@/components/splash/thread-canvas";
import { EnterForm } from "./enter-form";

export const metadata: Metadata = { title: "Enter" };

export default async function EnterPage(props: PageProps<"/enter">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await currentUser()) redirect(next);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b0b0c] text-[#ededeb] lg:block">
        <ThreadCanvas formation={2} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none relative flex h-full flex-col justify-between p-12 [&_a]:pointer-events-auto">
          <Wordmark className="text-[#ededeb]" />
          <div className="max-w-md pb-[22vh]">
            <p className="text-[52px] leading-[0.95] font-semibold tracking-[-0.045em]">
              Every requirement,
              <br />
              <span className="text-[#ff5233]">traced.</span>
            </p>
            <p className="mt-6 text-[15px] leading-relaxed text-[#a1a1a4]">
              Stories, tasks, commits and decisions, linked to the people who did the work.
            </p>
          </div>
          <p className="text-xs text-[#6b6b70]">For student software teams and their mentors.</p>
        </div>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold">Welcome to Trace</h1>
          <p className="mt-1.5 text-fg-2">Sign in, or try a demo team first.</p>

          <div className="mt-7 grid grid-cols-2 gap-2">
            <form action="/auth/demo" method="post">
              <input type="hidden" name="as" value="student" />
              <button className="btn btn-thread h-10 w-full">Demo as a student</button>
            </form>
            <form action="/auth/demo" method="post">
              <input type="hidden" name="as" value="mentor" />
              <button className="btn h-10 w-full">Demo as a mentor</button>
            </form>
          </div>
          <p className="mt-2 text-xs text-fg-3">Fictional teams. Changes reset every six hours.</p>

          <div className="my-7 flex items-center gap-3 text-xs text-fg-3">
            <span className="rule flex-1" />
            or use your account
            <span className="rule flex-1" />
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">
              {error}
            </p>
          )}
          <EnterForm next={next} github={process.env.NEXT_PUBLIC_GITHUB_AUTH === "1"} />
        </div>
      </section>
    </main>
  );
}
