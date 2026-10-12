import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { safeNext } from "@/lib/format";
import { currentUser } from "@/lib/supabase/server";
import { RopeCanvas } from "@/components/splash/rope-canvas";
import { EnterForm } from "./enter-form";

export const metadata: Metadata = { title: "Enter" };

export default async function EnterPage(props: PageProps<"/enter">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await currentUser()) redirect(next);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-bg-2 lg:block">
        <RopeCanvas className="absolute inset-0" />
        <div className="pointer-events-none relative flex h-full flex-col justify-between p-12 [&_a]:pointer-events-auto">
          <Wordmark />
          <div className="max-w-md">
            <p className="eyebrow mb-5">For student software teams and their mentors</p>
            <p className="display text-[clamp(48px,5vw,76px)]">
              Every requirement,
              <br />
              <em>traced.</em>
            </p>
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-fg-2">
              Stories, tasks, commits and decisions, linked to the people who did the work.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <p className="eyebrow">Sign in</p>
          <h1 className="display mt-3 text-[48px]">Welcome to <em>Trace</em></h1>
          <p className="mt-3 text-fg-2">Sign in, or try a demo team first.</p>

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
