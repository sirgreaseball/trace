"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icons";

// The theme lives on <html data-theme>. No attribute means "follow the system".
export type Theme = "light" | "dark" | "system";

export function subscribeTheme(cb: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("trace-theme", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("trace-theme", cb);
  };
}

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

export const currentTheme = (): Theme => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
};

/** Switches theme with a soft circular reveal from where you clicked. */
export function setTheme(next: Theme, from?: { x: number; y: number }) {
  const apply = () => {
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem("trace-theme");
      else localStorage.setItem("trace-theme", next);
    } catch {}
    window.dispatchEvent(new Event("trace-theme"));
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return apply();
  const x = from?.x ?? innerWidth - 40;
  const y = from?.y ?? 30;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(apply);
  vt.ready
    .then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 820, easing: "cubic-bezier(0.23, 1, 0.32, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
}

export function useTheme() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => null);
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "system" as Theme);
  return { dark, theme };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { dark } = useTheme();
  return (
    <button
      className={`btn btn-ghost btn-icon ${className}`}
      onClick={(e) => setTheme(isDark() ? "light" : "dark", { x: e.clientX, y: e.clientY })}
      aria-label={dark ? "Use the light theme" : "Use the dark theme"}
      title={dark ? "Light theme (best on a projector)" : "Dark theme"}
    >
      <Icon name={dark ? "sun" : "moon"} size={17} />
    </button>
  );
}
