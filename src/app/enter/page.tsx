import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { safeNext } from "@/lib/format";
import { currentUser } from "@/lib/supabase/server";
import { EnterForm } from "./enter-form";

export const metadata: Metadata = { title: "Enter" };

export default async function EnterPage(props: PageProps<"/enter">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await currentUser()) redirect(next);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b0b0c] text-[#ece9e2] lg:block">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {Array.from({ length: 34 }, (_, i) => {
            const y = 120 + i * 20;
            const k = (i % 7) - 3;
            return (
              <path
                key={i}
                d={`M-20 ${y} C 200 ${y - 60 + k * 18}, 380 ${y + 70 - k * 12}, 560 ${y + k * 6} S 760 ${y - 30}, 840 ${y + 10}`}
                stroke="rgb(236 233 226 / 0.09)"
                strokeWidth="1"
                fill="none"
              />
            );
          })}
          <path
            d="M-20 520 C 200 470, 340 610, 520 520 S 700 380, 840 430"
            stroke="#ff5233"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            style={{ strokeDasharray: 1400, ["--len" as string]: 1400, animation: "draw 2.4s var(--ease) both" }}
          />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12">
          <Wordmark className="text-[#ece9e2]" />
          <div className="max-w-md">
            <p className="serif text-[56px] leading-[0.95]">Pick up the thread.</p>
            <p className="mt-5 text-[15px] leading-relaxed text-[#a3a097]">
              Every story, task, commit and decision in your project, tied to the people behind it. Know who did what, and why, before anyone has to ask.
            </p>
          </div>
          <p className="text-xs text-[#6d6a63]">Built for student software teams and their mentors.</p>
        </div>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold">Welcome to Trace</h1>
          <p className="mt-1.5 text-fg-2">Sign in, or look around a live demo team first.</p>

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
          <p className="mt-2 text-xs text-fg-3">Fictional teams. Anything you change resets every six hours.</p>

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
