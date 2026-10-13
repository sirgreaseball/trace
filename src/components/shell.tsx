"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, ViewTransition, type ReactNode } from "react";
import { Mark } from "./brand";
import { Dock, type DockItem } from "./dock";
import { Icon } from "./icons";
import { TeamLight, type LightSource } from "./light";
import { MenuItem, Popover } from "./popover";
import { Segmented } from "./rings";
import { Spotlight, type SpotItem } from "./spotlight";
import { setTheme, ThemeToggle, useTheme } from "./theme";
import { Avatar } from "./ui";
import type { Profile, Role } from "@/lib/types";

type WsLite = { id: string; name: string; key: string; role: Role };

const ROLE: Record<Role, string> = { owner: "Team lead", member: "Member", mentor: "Mentor" };

export function Shell({
  ws,
  me,
  workspaces,
  badges,
  spot,
  light,
  children,
}: {
  ws: { id: string; name: string; key: string; course: string; demo: boolean };
  me: { role: Role; profile: Pick<Profile, "name" | "hue"> };
  workspaces: WsLite[];
  badges: { commits: number; receipts: number; decisions: number };
  spot: SpotItem[];
  light: LightSource[];
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [spotOpen, setSpotOpen] = useState(false);
  const base = `/w/${ws.id}`;

  const nav: DockItem[] = useMemo(
    () => [
      { href: base, label: "Today", icon: "today", key: "t", phone: true },
      { href: `${base}/trace`, label: "Trace", icon: "trace", key: "r", phone: true },
      { href: `${base}/board`, label: "Board", icon: "board", key: "b", phone: true },
      { href: `${base}/commits`, label: "Commits", icon: "commits", key: "c", badge: badges.commits },
      { href: `${base}/decisions`, label: "Decisions", icon: "decisions", key: "d", badge: badges.decisions },
      { href: `${base}/chat`, label: "Chat", icon: "chat", key: "m", phone: true },
      { href: `${base}/receipts`, label: "Receipts", icon: "receipts", key: "p", badge: badges.receipts },
      { href: `${base}/viva`, label: "Viva", icon: "viva", key: "v" },
      { href: `${base}/ask`, label: "Ask", icon: "ask", key: "a" },
    ],
    [base, badges],
  );
  const tail: DockItem[] = useMemo(() => [{ href: `${base}/settings`, label: "Settings", icon: "settings", key: "," }], [base]);

  const isActive = (href: string) =>
    href === base ? path === base : path === href || path.startsWith(`${href}/`) || (href === `${base}/trace` && path.startsWith(`${base}/stories`)) || (href === `${base}/receipts` && path.startsWith(`${base}/receipts`));
  const current = [...nav, ...tail].find((n) => isActive(n.href));

  // Ctrl/Cmd+K opens Spotlight; "g" then a letter jumps to a page.
  const pending = useRef(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotOpen((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setSpotOpen(true);
        return;
      }
      if (e.key === "g") {
        pending.current = true;
        setTimeout(() => (pending.current = false), 900);
        return;
      }
      if (pending.current) {
        pending.current = false;
        const hit = [...nav, ...tail].find((n) => n.key === e.key);
        if (hit) router.push(hit.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, tail, router]);

  const scrolled = useScrolled(6);
  const deep = useScrolled(96);
  const spotItems: SpotItem[] = useMemo(() => [...[...nav, ...tail].map((n) => ({ label: n.label, hint: `G ${n.key.toUpperCase()}`, href: n.href, group: "Go to", icon: n.icon })), ...spot], [nav, tail, spot]);

  return (
    <div className="relative min-h-dvh">
      <TeamLight sources={light} className="team-glow absolute inset-x-0 top-0 h-[460px] print-hide" />

      <header className="print-hide fixed inset-x-0 top-0 z-40">
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: scrolled ? 1 : 0,
            background: "var(--glass)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
            boxShadow: "0 1px 0 var(--line), 0 8px 24px -16px rgb(0 0 0 / 0.18)",
          }}
          aria-hidden
        />
        <div className="page relative flex h-[var(--bar-h)] items-center gap-2">
          <WorkspaceMenu ws={ws} workspaces={workspaces} />
          <span
            className="hidden min-w-0 items-center gap-2 text-[14px] font-[560] text-ink-2 transition-[opacity,transform,filter] duration-500 md:flex"
            style={{ opacity: deep ? 1 : 0, transform: deep ? "none" : "translateY(6px)", filter: deep ? "none" : "blur(4px)" }}
            aria-hidden={!deep}
          >
            <span className="text-ink-3">/</span>
            <span className="truncate text-ink">{current?.label}</span>
          </span>
          {ws.demo && (
            <Link href="/enter" className="chip chip-accent ml-1 hidden h-6 gap-1.5 sm:inline-flex" title="A fictional team. Edit freely: it resets every six hours.">
              <span className="size-1.5 rounded-full bg-accent" style={{ animation: "breathe 2.4s ease-in-out infinite" }} />
              Demo team · start your own
            </Link>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setSpotOpen(true)}
              className="btn hidden h-9 w-[240px] justify-start gap-2.5 bg-[light-dark(rgb(255_255_255/0.7),rgb(255_255_255/0.06))] px-3.5 text-[13.5px] font-normal text-ink-3 lg:inline-flex"
            >
              <Icon name="search" size={16} />
              Search or ask
              <ModKey />
            </button>
            <button onClick={() => setSpotOpen(true)} className="btn btn-ghost btn-icon lg:hidden" aria-label="Search or ask">
              <Icon name="search" size={18} />
            </button>
            <ThemeToggle />
            <AccountMenu me={me} />
          </div>
        </div>
      </header>

      <main className="page relative z-10 pt-[calc(var(--bar-h)+28px)] pb-[calc(var(--dock-room)+env(safe-area-inset-bottom))] sm:pt-[calc(var(--bar-h)+40px)]">
        <ViewTransition key={path} enter="page-enter" exit="page-exit" default="none">
          <div>{children}</div>
        </ViewTransition>
      </main>

      <Dock items={nav} tail={tail} isActive={isActive} />
      <Spotlight open={spotOpen} onClose={() => setSpotOpen(false)} items={spotItems} workspaceId={ws.id} />
    </div>
  );
}

function useScrolled(px: number) {
  return useSyncExternalStore(
    (cb) => {
      let raf = 0;
      const on = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(cb);
      };
      window.addEventListener("scroll", on, { passive: true });
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("scroll", on);
      };
    },
    () => window.scrollY > px,
    () => false,
  );
}

const noop = () => () => {};
function ModKey() {
  const mac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  return <span className="kbd ml-auto">{mac ? "⌘K" : "Ctrl K"}</span>;
}

function WorkspaceMenu({ ws, workspaces }: { ws: { id: string; name: string; key: string; course: string }; workspaces: WsLite[] }) {
  return (
    <Popover
      label="Workspaces"
      width={300}
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-expanded={open} className="press flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-3 pl-1.5 transition-colors duration-200 hover:bg-[var(--hover)]">
          <span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-surface shadow-[var(--shadow-sm),0_0_0_1px_var(--line)]">
            <Mark size={19} />
          </span>
          <span className="max-w-[44vw] truncate text-[15px] font-[620] tracking-[-0.02em] sm:max-w-[260px]">{ws.name}</span>
          <Icon name="updown" size={13} className="shrink-0 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-3 pt-2 pb-1.5 text-[11.5px] font-semibold text-ink-3">Your workspaces</p>
          {workspaces.map((w) => (
            <MenuItem key={w.id} href={`/w/${w.id}`} onClick={close}>
              <span className="mono grid h-6 min-w-9 place-items-center rounded-[7px] bg-surface-3 px-1.5 text-[10.5px] font-semibold text-ink-2">{w.key}</span>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === ws.id && <Icon name="check" size={15} bold className="text-accent" />}
            </MenuItem>
          ))}
          <div className="mx-2 my-1.5 h-px bg-line" />
          <MenuItem href="/home" onClick={close}>
            <Icon name="workspaces" size={17} className="text-ink-2" /> All workspaces
          </MenuItem>
          <MenuItem href={`/w/${ws.id}/settings`} onClick={close}>
            <Icon name="settings" size={17} className="text-ink-2" /> Workspace settings
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

function AccountMenu({ me }: { me: { role: Role; profile: Pick<Profile, "name" | "hue"> } }) {
  const { theme } = useTheme();
  return (
    <Popover
      label="Account"
      align="right"
      width={290}
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-expanded={open} aria-label="Account" className="press ml-1 rounded-full">
          <Avatar profile={me.profile} size={32} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
            <Avatar profile={me.profile} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-semibold">{me.profile.name}</p>
              <p className="text-[12.5px] text-ink-3">{ROLE[me.role]}</p>
            </div>
          </div>
          <div className="px-2 pb-2">
            <Segmented
              id="theme"
              label="Theme"
              size="sm"
              value={theme}
              onChange={(k) => setTheme(k as "light" | "dark" | "system")}
              items={[
                { key: "light", label: "Light" },
                { key: "dark", label: "Dark" },
                { key: "system", label: "Auto" },
              ]}
            />
          </div>
          <div className="mx-2 my-1 h-px bg-line" />
          <MenuItem href="/home" onClick={close}>
            <Icon name="workspaces" size={17} className="text-ink-2" /> All workspaces
          </MenuItem>
          <form action="/auth/signout" method="post">
            <button className="row flex w-full items-center gap-2.5 rounded-[13px] px-3 py-2 text-left text-[14px]" role="menuitem">
              <Icon name="logout" size={17} className="text-ink-2" /> Sign out
            </button>
          </form>
        </>
      )}
    </Popover>
  );
}
