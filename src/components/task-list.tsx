"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "./ui";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Task, TaskStatus } from "@/lib/types";

const STATUS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

/** A round check that fills and draws its tick when a task is done. */
export function Check({ status, onClick, disabled, label }: { status: TaskStatus; onClick?: () => void; disabled?: boolean; label: string }) {
  const done = status === "done";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="press relative grid size-[22px] shrink-0 place-items-center rounded-full disabled:cursor-default"
    >
      <span
        className={`absolute inset-0 rounded-full transition-[background-color,box-shadow,transform] duration-300 ${
          done ? "scale-100 bg-ink shadow-none" : status === "doing" ? "bg-[conic-gradient(var(--ink)_0_50%,transparent_0)] shadow-[inset_0_0_0_1.6px_var(--ink)]" : "shadow-[inset_0_0_0_1.6px_var(--line-3)]"
        }`}
      />
      <svg viewBox="0 0 16 16" className="relative size-3 text-inv" aria-hidden>
        <path
          d="M3.5 8.5 6.6 11.4 12.5 4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ strokeDashoffset: done ? 0 : 1, transition: `stroke-dashoffset ${done ? 420 : 120}ms var(--ease-out) ${done ? 120 : 0}ms` }}
        />
      </svg>
    </button>
  );
}

export function TaskList({
  workspaceId,
  storyId,
  tasks,
  members,
  keyPrefix,
  canWrite,
}: {
  workspaceId: string;
  storyId: string;
  tasks: Task[];
  members: Member[];
  keyPrefix: string;
  canWrite: boolean;
}) {
  const { run, busy } = useRun();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState(tasks);
  const [seen, setSeen] = useState(tasks);
  if (seen !== tasks) {
    setSeen(tasks);
    setItems(tasks);
  }
  const builders = members.filter((m) => m.role !== "mentor");
  const sb = supabaseBrowser();

  // Optimistic: the row changes on press, the server catches up.
  async function patch(t: Task, change: Partial<Pick<Task, "status" | "assignee">>) {
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, ...change } : x)));
    const ok = await run(() => sb.from("tasks").update(change).eq("id", t.id));
    if (!ok) setItems(prev);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (await run(() => sb.from("tasks").insert({ workspace_id: workspaceId, story_id: storyId, title: t }))) setTitle("");
  }

  return (
    <div>
      <ul className="pane divide overflow-hidden">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const who = members.find((m) => m.user_id === t.assignee);
            return (
              <motion.li
                key={t.id}
                layout="position"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.45 }}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <Check status={t.status} disabled={!canWrite} onClick={() => patch(t, { status: t.status === "done" ? "todo" : "done" })} label={t.status === "done" ? `Reopen ${t.title}` : `Mark ${t.title} done`} />
                <span className="ref w-12">
                  {keyPrefix}-{t.number}
                </span>
                <span className={`min-w-0 flex-1 text-[14.5px] transition-colors duration-300 ${t.status === "done" ? "text-ink-3 line-through decoration-line-3" : ""}`}>{t.title}</span>
                {canWrite ? (
                  <span className="flex items-center gap-1.5 max-sm:w-full max-sm:pl-[38px]">
                    <select aria-label="Status" value={t.status} disabled={busy} onChange={(e) => patch(t, { status: e.target.value as TaskStatus })} className="field field-sm w-[96px]">
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <select aria-label="Assignee" value={t.assignee ?? ""} disabled={busy} onChange={(e) => patch(t, { assignee: e.target.value || null })} className="field field-sm w-[132px]">
                      <option value="">Unassigned</option>
                      {builders.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.profile.name}
                        </option>
                      ))}
                    </select>
                  </span>
                ) : (
                  who && <Avatar profile={who.profile} size={24} />
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && <li className="px-4 py-5 text-[14px] text-ink-3">No tasks yet. Break the story into pieces one person can finish in a day or two.</li>}
      </ul>
      {canWrite && (
        <form onSubmit={add} className="mt-2.5 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="field" placeholder="Add a task…" aria-label="New task" />
          <button disabled={busy || !title.trim()} className="btn h-[42px]">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
