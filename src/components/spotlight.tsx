"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AskAnswer, useAsk } from "./ask";
import { Icon, type IconName } from "./icons";

export type SpotItem = { label: string; hint?: string; href: string; group: string; icon?: IconName };

const GROUP_ICON: Record<string, IconName> = { "Go to": "arrow", Story: "stories", Task: "check", Decision: "decisions", Receipt: "receipts", Person: "receipts" };

/**
 * Spotlight: jump anywhere, or ask the team's record a question without
 * leaving the page. Opens on Ctrl/Cmd+K.
 */
export function Spotlight({ open, onClose, items, workspaceId }: { open: boolean; onClose: () => void; items: SpotItem[]; workspaceId: string }) {
  return <AnimatePresence>{open && <Panel onClose={onClose} items={items} workspaceId={workspaceId} />}</AnimatePresence>;
}

function Panel({ onClose, items, workspaceId }: { onClose: () => void; items: SpotItem[]; workspaceId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const { ask, busy, res, error, reset } = useAsk(workspaceId);
  const listRef = useRef<HTMLUListElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const found = !s
      ? items.filter((it) => it.group === "Go to")
      : items
          .map((it) => {
            const label = it.label.toLowerCase();
            const hint = (it.hint ?? "").toLowerCase();
            const at = label.indexOf(s);
            const score = hint === s ? -2 : label.startsWith(s) ? -1 : at >= 0 ? at : hint.includes(s) ? 50 : label.split(/\s+/).some((w) => w.startsWith(s)) ? 60 : -99;
            return { it, score };
          })
          .filter((x) => x.score !== -99)
          .sort((a, b) => a.score - b.score)
          .map((x) => x.it)
          .slice(0, 30);
    const rows: (SpotItem | { ask: string })[] = [...found];
    if (s.length >= 3) rows.push({ ask: q.trim() });
    return rows;
  }, [items, q]);

  const choose = (row: (typeof list)[number] | undefined) => {
    if (!row) return;
    if ("ask" in row) return ask(row.ask);
    onClose();
    router.push(row.href);
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }, [i]);

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[max(9vh,56px)] sm:px-4" role="dialog" aria-modal="true" aria-label="Spotlight">
      <motion.button
        className="absolute inset-0 bg-[light-dark(rgb(20_20_30/0.18),rgb(0_0_0/0.45))] backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="glass-strong relative flex max-h-[min(78dvh,680px)] w-full max-w-[660px] flex-col overflow-hidden rounded-[26px]"
        initial={{ opacity: 0, scale: 0.975, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.12 } }}
        transition={{ type: "spring", bounce: 0.1, duration: 0.34 }}
      >
        <div className="flex items-center gap-3 px-5">
          <Icon name="search" size={21} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
              if (res) reset();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (res) return reset();
                onClose();
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((v) => Math.min(v + 1, list.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((v) => Math.max(v - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey && q.trim().length >= 3) return ask(q);
                choose(list[i]);
              }
            }}
            placeholder="Search, or ask why something happened…"
            className="h-[60px] min-w-0 flex-1 bg-transparent text-[18px] tracking-[-0.015em] outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="spot-list"
            aria-activedescendant={`spot-${i}`}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="h-px bg-line" />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {busy || res || error ? (
            <div className="p-4 sm:p-5">
              <p className="mb-3 flex items-center gap-2 text-[12.5px] font-medium text-ink-3">
                <Icon name="ask" size={14} /> {busy ? "Reading the record…" : `Asked: “${res?.q ?? q}”`}
              </p>
              {busy && (
                <div className="space-y-2.5" aria-hidden>
                  {[0.9, 0.7, 0.5].map((w, k) => (
                    <div key={k} className="skeleton h-3.5" style={{ width: `${w * 100}%` }} />
                  ))}
                </div>
              )}
              {error && <p className="text-danger">{error}</p>}
              {res && !busy && <AskAnswer res={res} base={`/w/${workspaceId}`} compact onPick={onClose} />}
            </div>
          ) : (
            <ul id="spot-list" ref={listRef} role="listbox" className="p-2">
              {list.length === 0 && <li className="px-3 py-8 text-center text-ink-3">Nothing matches “{q}”.</li>}
              {list.map((row, k) => {
                const isAsk = "ask" in row;
                const group = isAsk ? "Ask" : row.group;
                const head = group !== lastGroup;
                lastGroup = group;
                return (
                  <li key={isAsk ? "ask" : `${row.href}-${k}`} role="presentation">
                    {head && <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold text-ink-3">{group === "Go to" && q ? "Pages" : group}</p>}
                    <div
                      id={`spot-${k}`}
                      data-i={k}
                      role="option"
                      aria-selected={k === i}
                      onMouseMove={() => k !== i && setI(k)}
                      onClick={() => choose(row)}
                      className="relative flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14.5px]"
                    >
                      {k === i && <motion.span layoutId="spot-sel" className="absolute inset-0 rounded-[14px] bg-[light-dark(rgb(21_21_27/0.06),rgb(255_255_255/0.08))]" transition={{ type: "spring", bounce: 0, duration: 0.22 }} />}
                      <span className={`relative grid size-7 shrink-0 place-items-center rounded-[9px] ${isAsk ? "bg-accent text-white" : "bg-surface-3 text-ink-2"}`}>
                        <Icon name={isAsk ? "ask" : (row.icon ?? GROUP_ICON[row.group] ?? "arrow")} size={15} weight={isAsk ? "bold" : "regular"} />
                      </span>
                      <span className="relative min-w-0 flex-1 truncate">{isAsk ? <>Ask the record: <span className="font-semibold">“{row.ask}”</span></> : row.label}</span>
                      {!isAsk && row.hint && <span className="ref relative">{row.hint}</span>}
                      {k === i && <Icon name="arrow" size={14} className="relative text-ink-3" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-5 py-2.5 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="kbd">⇧</span>
            <span className="kbd">↵</span> ask
          </span>
        </div>
      </motion.div>
    </div>
  );
}
