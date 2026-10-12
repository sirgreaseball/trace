"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Mark } from "./brand";
import { Icon, type IconName } from "./icons";
import { Avatar } from "./ui";
import type { Profile, Role } from "@/lib/types";

type Nav = { href: string; label: string; icon: IconName; key: string; badge?: number };
type WsLite = { id: string; name: string; key: string; role: Role };

export function Shell({
  ws,
  me,
  workspaces,
  badges,
  palette,
  children,
}: {
  ws: { id: string; name: string; key: string; course: string; demo: boolean };
  me: { role: Role; profile: Pick<Profile, "name" | "hue"> };
  workspaces: WsLite[];
  badges: { commits: number; receipts: number; decisions: number };
  palette: PaletteItem[];
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const base = `/w/${ws.id}`;

  const nav: Nav[][] = useMemo(
    () => [
      [
        { href: base, label: "Overview", icon: "overview", key: "o" },
        { href: `${base}/trace`, label: "Trace", icon: "trace", key: "t" },
        { href: `${base}/stories`, label: "Stories", icon: "stories", key: "s" },
        { href: `${base}/board`, label: "Board", icon: "board", key: "b" },
        { href: `${base}/commits`, label: "Commits", icon: "commits", key: "c", badge: badges.commits },
        { href: `${base}/decisions`, label: "Decisions", icon: "decisions", key: "d", badge: badges.decisions },
      ],
      [
        { href: `${base}/chat`, label: "Chat", icon: "chat", key: "m" },
        { href: `${base}/ask`, label: "Ask", icon: "ask", key: "a" },
        { href: `${base}/receipts`, label: "Receipts", icon: "receipts", key: "r", badge: badges.receipts },
        { href: `${base}/viva`, label: "Viva practice", icon: "viva", key: "v" },
      ],
      [{ href: `${base}/settings`, label: "Settings", icon: "settings", key: "," }],
    ],
    [base, badges],
  );

  // Keyboard: Ctrl/Cmd+K opens the palette; "g" then a letter jumps to a page.
  const pending = useRef(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g") {
        pending.current = true;
        setTimeout(() => (pending.current = false), 900);
        return;
      }
      if (pending.current) {
        const hit = nav.flat().find((n) => n.key === e.key);
        pending.current = false;
        if (hit) router.push(hit.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, router]);

  // Close the phone drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }

  const active = (href: string) => (href === base ? path === base : path === href || path.startsWith(`${href}/`));
  const current = nav.flat().find((n) => active(n.href));

  const sidebar = (
    <nav aria-label="Workspace" className="flex h-full flex-col gap-1 px-3 py-4">
      <WorkspaceSwitcher ws={ws} workspaces={workspaces} />
      <button
        onClick={() => setPaletteOpen(true)}
        className="row-hover mt-2 mb-3 flex h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-[13px] text-fg-3"
      >
        <Icon name="search" size={14} />
        <span className="flex-1 text-left">Jump to…</span>
        <ModKey />
      </button>
      {nav.map((group, i) => (
        <div key={i} className={i ? "mt-3 border-t border-line pt-3" : ""}>
          {group.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors duration-150 ${
                active(n.href) ? "bg-bg-3 font-medium text-fg" : "text-fg-2 hover:bg-bg-3 hover:text-fg"
              }`}
            >
              {active(n.href) && <span className="absolute top-1/2 -left-[13px] size-[5px] -translate-y-1/2 rounded-full bg-thread" />}
              <Icon name={n.icon} size={15} />
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="chip h-[18px] px-1.5 text-[10.5px] chip-thread num">{n.badge}</span>}
            </Link>
          ))}
        </div>
      ))}
      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
        <Avatar profile={me.profile} size={26} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{me.profile.name}</p>
          <p className="text-[11.5px] text-fg-3 capitalize">{me.role === "owner" ? "Team lead" : me.role}</p>
        </div>
        <ThemeToggle />
        <form action="/auth/signout" method="post">
          <button className="btn btn-ghost btn-icon" aria-label="Sign out" title="Sign out">
            <Icon name="logout" size={15} />
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <div className="thread-line fixed inset-x-0 top-0 z-50 print:hidden" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-line bg-bg lg:block print:hidden">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur lg:hidden print:hidden">
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <Mark size={18} className="text-thread" />
        <span className="display truncate text-[22px] leading-none">{current?.label ?? ws.name}</span>
        <button className="btn btn-ghost btn-icon ml-auto" onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Icon name="search" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="anim-fade absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] border-r border-line bg-bg shadow-[var(--shadow)]" style={{ animation: "drawer 260ms var(--ease) both" }}>
            {sidebar}
          </div>
        </div>
      )}

      <main className="lg:pl-[240px] print:pl-0">
        {ws.demo && (
          <div className="mono flex items-center gap-2.5 border-b border-line px-4 py-2 text-[10.5px] tracking-[0.08em] text-fg-3 uppercase sm:px-8 print:hidden">
            <span className="size-1.5 animate-pulse rounded-full bg-thread" />
            <span className="truncate">Demo team · edit freely · resets every 6 h</span>
            <Link href="/enter" className="ml-auto shrink-0 text-fg-2 transition-colors hover:text-thread">
              Start your own →
            </Link>
          </div>
        )}
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-24 sm:px-8 sm:pt-10">{children}</div>
      </main>

      {paletteOpen && <Palette items={[...nav.flat().map((n) => ({ label: n.label, hint: `G ${n.key.toUpperCase()}`, href: n.href, group: "Go to" })), ...palette]} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function WorkspaceSwitcher({ ws, workspaces }: { ws: { id: string; name: string; key: string; course: string }; workspaces: WsLite[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="row-hover flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left">
        <span className="mono grid size-7 shrink-0 place-items-center rounded-md bg-inv text-[10.5px] font-semibold text-bg">{ws.key}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{ws.name}</span>
          <span className="block truncate text-[11.5px] text-fg-3">{ws.course || "Workspace"}</span>
        </span>
        <Icon name="updown" size={13} className="text-fg-3" />
      </button>
      {open && (
        <div className="anim-rise absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-line-2 bg-bg-2 p-1 shadow-[var(--shadow)]">
          {workspaces.map((w) => (
            <Link key={w.id} href={`/w/${w.id}`} className="row-hover flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]" onClick={() => setOpen(false)}>
              <span className="mono w-9 text-[10.5px] text-fg-3">{w.key}</span>
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === ws.id && <Icon name="check" size={14} className="text-thread" />}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <Link href="/home" className="row-hover flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-fg-2">
            <Icon name="home" size={14} /> All workspaces
          </Link>
        </div>
      )}
    </div>
  );
}

const noop = () => () => {};

function ModKey() {
  const mac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  return <span className="kbd">{mac ? "⌘K" : "Ctrl K"}</span>;
}

// Theme lives on <html data-theme>; this store lets every toggle follow it.
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

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => null);
  function flip() {
    const next = !isDark();
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("trace-theme", next ? "dark" : "light");
    } catch {}
    window.dispatchEvent(new Event("trace-theme"));
  }
  return (
    <button className="btn btn-ghost btn-icon" onClick={flip} aria-label={dark ? "Use light theme" : "Use dark theme"} title={dark ? "Light theme (good for projectors)" : "Dark theme"}>
      <Icon name={dark ? "sun" : "moon"} size={15} />
    </button>
  );
}

export type PaletteItem = { label: string; hint?: string; href: string; group: string };

function Palette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 40);
    return items
      .map((it) => ({ it, at: `${it.label} ${it.hint ?? ""}`.toLowerCase().indexOf(s) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((x) => x.it)
      .slice(0, 40);
  }, [items, q]);
  const go = (it: PaletteItem | undefined) => {
    if (!it) return;
    onClose();
    router.push(it.href);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="anim-fade absolute inset-0 bg-black/30 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="anim-rise relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-2 bg-bg-2 shadow-[var(--shadow)]">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" className="text-fg-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((v) => Math.min(v + 1, list.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((v) => Math.max(v - 1, 0));
              }
              if (e.key === "Enter") go(list[i]);
            }}
            placeholder="Jump to a page, story, task or decision…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <span className="kbd">esc</span>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {list.length === 0 && <li className="px-3 py-6 text-center text-fg-3">Nothing matches “{q}”.</li>}
          {list.map((it, k) => (
            <li
              key={`${it.href}-${k}`}
              role="option"
              aria-selected={k === i}
              onMouseEnter={() => setI(k)}
              onClick={() => go(it)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] ${k === i ? "bg-bg-3" : ""}`}
            >
              <span className="w-16 shrink-0 text-[11px] text-fg-3">{it.group}</span>
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint && <span className="mono text-[11px] text-fg-3">{it.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
