"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; tone: "info" | "error" };
let push: (t: Omit<Toast, "id">) => void = () => {};
let next = 1;

/** Show a short message at the bottom of the screen. Safe to call from anywhere on the client. */
export function toast(text: string, tone: Toast["tone"] = "info") {
  push({ text, tone });
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = next++;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === "error" ? 6000 : 3200);
    };
    return () => {
      push = () => {};
    };
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="anim-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line-2 bg-bg-2 px-3.5 py-2.5 text-[13px] shadow-[var(--shadow)]"
        >
          <span className={`size-1.5 shrink-0 rounded-full ${t.tone === "error" ? "bg-warn" : "bg-thread"}`} />
          {t.text}
        </div>
      ))}
    </div>
  );
}
