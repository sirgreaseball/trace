"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Task, TaskStatus } from "@/lib/types";

const STATUS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

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
  const builders = members.filter((m) => m.role !== "mentor");
  const sb = supabaseBrowser();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (await run(() => sb.from("tasks").insert({ workspace_id: workspaceId, story_id: storyId, title: t }))) setTitle("");
  }

  return (
    <div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {tasks.map((t) => {
          const who = members.find((m) => m.user_id === t.assignee);
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <button
                disabled={!canWrite || busy}
                onClick={() => run(() => sb.from("tasks").update({ status: t.status === "done" ? "todo" : "done" }).eq("id", t.id))}
                className={`grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors ${t.status === "done" ? "border-thread bg-thread text-white" : t.status === "doing" ? "border-thread" : "border-fg-3"}`}
                aria-label={t.status === "done" ? `Reopen ${t.title}` : `Mark ${t.title} done`}
              >
                {t.status === "done" && <Icon name="check" size={11} strokeWidth={3} />}
                {t.status === "doing" && <span className="size-2 rounded-full bg-thread" />}
              </button>
              <span className="mono w-12 text-[11.5px] text-fg-3">
                {keyPrefix}-{t.number}
              </span>
              <span className={`min-w-0 flex-1 ${t.status === "done" ? "text-fg-2" : ""}`}>{t.title}</span>
              {canWrite ? (
                <>
                  <select
                    aria-label="Status"
                    value={t.status}
                    disabled={busy}
                    onChange={(e) => run(() => sb.from("tasks").update({ status: e.target.value }).eq("id", t.id))}
                    className="field h-7 min-h-0 w-[88px] py-0 text-[12px]"
                  >
                    {STATUS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Assignee"
                    value={t.assignee ?? ""}
                    disabled={busy}
                    onChange={(e) => run(() => sb.from("tasks").update({ assignee: e.target.value || null }).eq("id", t.id))}
                    className="field h-7 min-h-0 w-[120px] py-0 text-[12px]"
                  >
                    <option value="">Unassigned</option>
                    {builders.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profile.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                who && <Avatar profile={who.profile} size={20} />
              )}
            </li>
          );
        })}
        {tasks.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-fg-3">No tasks yet. Break the story into pieces one person can finish.</li>}
      </ul>
      {canWrite && (
        <form onSubmit={add} className="mt-2 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="field h-9" placeholder="Add a task…" aria-label="New task" />
          <button disabled={busy || !title.trim()} className="btn h-9">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
