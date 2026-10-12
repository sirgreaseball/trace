"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <h1 className="text-[24px] font-semibold">This page didn&apos;t load</h1>
        <p className="mt-2 max-w-sm text-fg-2">It&apos;s usually a dropped connection.</p>
        <button onClick={reset} className="btn btn-primary mt-6">
          Try again
        </button>
      </div>
    </main>
  );
}
