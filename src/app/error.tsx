"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-warn-soft text-[24px] font-[650] text-warn">!</span>
        <h1 className="mt-5 text-[28px] font-[650] tracking-[-0.035em]">This page didn&apos;t load</h1>
        <p className="mx-auto mt-2 max-w-sm text-ink-2">It&apos;s usually a dropped connection. Your work is safe.</p>
        <button onClick={reset} className="btn btn-primary btn-lg mt-7">
          Try again
        </button>
      </div>
    </main>
  );
}
