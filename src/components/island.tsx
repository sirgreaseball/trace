"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

/*
  The island: one black capsule at the top of the screen that grows to fit
  whatever is happening (a sync in progress, a saved change, a new message)
  and shrinks away when it's done. It replaces toasts.
*/

type Tone = "info" | "error" | "done";
type Item =
  | { id: number; kind: "note"; text: string; tone: Tone }
  | { id: number; kind: "busy"; key: string; text: string }
  | { id: number; kind: "message"; title: string; body: string; hue?: number; initials?: string; href?: string };
type Draft = Item extends infer T ? (T extends { id: number } ? Omit<T, "id"> : never) : never;

let show: (d: Draft) => void = () => {};
let settle: (key: string, text: string, tone: Tone) => void = () => {};
let seq = 1;

/** A short note in the island. Safe to call from anywhere on the client. */
export function toast(text: string, tone: "info" | "error" | "done" = "info") {
  show({ kind: "note", text, tone });
}

export const island = {
  /** Something slow has started; the island holds a spinner until done() with the same key. */
  busy: (key: string, text: string) => show({ kind: "busy", key, text }),
  done: (key: string, text: string, tone: Tone = "done") => settle(key, text, tone),
  message: (m: { title: string; body: string; hue?: number; initials?: string; href?: string }) => show({ kind: "message", ...m }),
};

const LIFE: Record<string, number> = { info: 3200, done: 3200, error: 6500, message: 5200 };

export function Island() {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expire = (id: number, ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(function tick() {
        // Don't let a note vanish while nobody is looking at the tab.
        if (document.hidden) return (timer = setTimeout(tick, 1000));
        setItem((cur) => (cur?.id === id ? null : cur));
      }, ms);
    };
    show = (d) => {
      const it = { ...d, id: seq++ } as Item;
      setItem(it);
      if (it.kind === "busy") clearTimeout(timer);
      else expire(it.id, it.kind === "message" ? LIFE.message : LIFE[it.tone]);
    };
    settle = (key, text, tone) => {
      const it: Item = { id: seq++, kind: "note", text, tone };
      setItem((cur) => (cur && cur.kind === "busy" && cur.key !== key ? cur : it));
      expire(it.id, LIFE[tone]);
    };
    return () => {
      clearTimeout(timer);
      show = () => {};
      settle = () => {};
    };
  }, []);

  const body = item && <Content item={item} />;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(10px,env(safe-area-inset-top))] z-[100] flex justify-center px-4 print-hide" aria-live="polite" role="status">
      <AnimatePresence>
        {item && (
          <motion.div
            key="island"
            layout
            initial={{ opacity: 0, scale: 0.55, y: -6, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.6, y: -6, filter: "blur(8px)" }}
            transition={{ type: "spring", bounce: 0.28, duration: 0.62 }}
            style={{ borderRadius: 26 }}
            className="pointer-events-auto max-w-[min(420px,100%)] overflow-hidden bg-[#0b0b0f] text-white shadow-[0_12px_40px_-12px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.08)]"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={item.id}
                layout="position"
                initial={{ opacity: 0, filter: "blur(6px)", scale: 0.96 }}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                exit={{ opacity: 0, filter: "blur(6px)", scale: 0.96 }}
                transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
              >
                {item.kind === "message" && item.href ? (
                  <Link href={item.href} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Content({ item }: { item: Item }) {
  if (item.kind === "message") {
    return (
      <div className="flex items-center gap-3 py-2.5 pr-5 pl-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
          style={{ background: `oklch(0.62 0.15 ${item.hue ?? 260})` }}
        >
          {item.initials ?? "·"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{item.title}</span>
          <span className="block truncate text-[13px] text-white/70">{item.body}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-10 items-center gap-2.5 pr-4.5 pl-3.5 text-[13.5px] font-medium whitespace-nowrap">
      {item.kind === "busy" ? (
        <span className="size-3.5 shrink-0 rounded-full border-[1.6px] border-white/25 border-t-white" style={{ animation: "spin 800ms linear infinite" }} />
      ) : item.tone === "error" ? (
        <span className="size-2 shrink-0 rounded-full bg-[#ff5d62] shadow-[0_0_10px_#ff5d62]" />
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-[#3fe39a] shadow-[0_0_10px_#3fe39a]" />
      )}
      <span className="truncate">{item.text}</span>
    </div>
  );
}
