import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { TeamLight } from "@/components/light";
import { Rings } from "@/components/rings";
import { ThemeToggle } from "@/components/theme";
import { safeNext } from "@/lib/format";
import { currentUser } from "@/lib/supabase/server";
import { EnterForm } from "./enter-form";

export const metadata: Metadata = { title: "Sign in" };

// A made-up team's colours, for the light behind the sign-in.
const LIGHT = [
  { hue: 24, weight: 0.32 },
  { hue: 210, weight: 0.24 },
  { hue: 150, weight: 0.24 },
  { hue: 320, weight: 0.2 },
];

/** Which one-tap sign-ins are switched on in Supabase. A button shows up as soon as its provider is enabled. */
async function providers() {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 120 },
    });
    const j = (await r.json()) as { external?: Record<string, boolean> };
    return { google: !!j.external?.google, github: !!j.external?.github };
  } catch {
    return { google: false, github: false };
  }
}

export default async function EnterPage(props: PageProps<"/enter">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await currentUser()) redirect(next);
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const oauth = await providers();

  return (
    <main className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      <TeamLight sources={LIGHT} className="absolute inset-0 opacity-90 lg:right-[42%]" />
      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <Wordmark />
        <div className="max-w-xl">
          <Rings values={[0.82, 0.64, 0.9]} size={150} glow delay={500} className="rise mb-12" />
          <h1 className="t-display rise text-[clamp(56px,6vw,92px)]" style={{ "--i": 2 } as CSSProperties}>
            Every requirement, traced.
          </h1>
          <p className="rise mt-6 max-w-md text-[17px] leading-relaxed text-ink-2" style={{ "--i": 3 } as CSSProperties}>
            Stories, tasks, commits and decisions, tied to the people who did the work. For student software teams and their mentors.
          </p>
        </div>
        <p className="t-caption">© 2026 Dhruv Sonar. All rights reserved.</p>
      </section>

      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Wordmark />
          </span>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <div className="glass-strong rise rounded-[32px] p-6 sm:p-8" style={{ "--i": 1 } as CSSProperties}>
            <h2 className="text-[28px] font-[650] tracking-[-0.035em]">Sign in to Trace</h2>
            <p className="mt-1.5 text-[15px] text-ink-2">Or look around a demo team first. Nothing to set up.</p>

            <div className="mt-6 grid gap-2">
              <form action="/auth/demo" method="post">
                <input type="hidden" name="as" value="student" />
                <button className="btn btn-accent btn-lg w-full">Try the demo as a student</button>
              </form>
              <form action="/auth/demo" method="post">
                <input type="hidden" name="as" value="mentor" />
                <button className="btn btn-lg w-full">See the mentor view</button>
              </form>
            </div>
            <p className="t-caption mt-2.5 text-center">Fictional teams. Changes reset every six hours.</p>

            <div className="my-6 flex items-center gap-3 text-[12.5px] text-ink-3">
              <span className="h-px flex-1 bg-line-2" />
              or with your account
              <span className="h-px flex-1 bg-line-2" />
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="mb-4 rounded-[12px] bg-[light-dark(rgb(16_160_110/0.1),rgb(60_220_160/0.14))] px-3.5 py-2.5 text-[13.5px] font-[560] text-[light-dark(#0b7a52,#5fe3b0)]">
                {notice}
              </p>
            )}
            <EnterForm next={next} providers={oauth} />
          </div>
        </div>
      </section>
    </main>
  );
}
