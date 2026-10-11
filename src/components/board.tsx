"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Task, TaskStatus } from "@/lib/types";

const COLS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "doing", label: "Doing" },
  { status: "done", label: "Done" },
];

export function Board({
  workspaceId,
  keyPrefix,
  tasks: initial,
  stories,
  members,
  me,
  canWrite,
}: {
  workspaceId: string;
  keyPrefix: string;
  tasks: Task[];
  stories: { id: string; number: number; title: string }[];
  members: Member[];
  me: string;
  canWrite: boolean;
}) {
  const { run, busy } = useRun();
  const [tasks, setTasks] = useState(initial);
  const [who, setWho] = useState<"all" | "me">("all");
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [story, setStory] = useState("");
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setTasks(initial);
  }
  const sb = supabaseBrowser();
  const storyById = new Map(stories.map((s) => [s.id, s]));
  const builders = members.filter((m) => m.role !== "mentor");

  async function move(id: string, status: TaskStatus) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    const ok = await run(() => sb.from("tasks").update({ status }).eq("id", id));
    if (!ok) setTasks(prev);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!adding.trim()) return;
    if (await run(() => sb.from("tasks").insert({ workspace_id: workspaceId, title: adding.trim(), story_id: story || null, assignee: me }))) setAdding("");
  }

  const shown = tasks.filter((t) => who === "all" || t.assignee === me);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line-2 p-0.5">
          {(["all", "me"] as const).map((w) => (
            <button key={w} onClick={() => setWho(w)} aria-pressed={who === w} className={`btn btn-sm border-0 ${who === w ? "bg-bg-3" : "btn-ghost"}`}>
              {w === "all" ? "Everyone" : "Mine"}
            </button>
          ))}
        </div>
        {canWrite && (
          <form onSubmit={add} className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
            <input value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={200} placeholder="New task…" aria-label="New task" className="field h-8 min-h-0 flex-1 py-0 sm:w-56" />
            <select value={story} onChange={(e) => setStory(e.target.value)} aria-label="Story" className="field h-8 min-h-0 w-40 py-0 text-[12.5px]">
              <option value="">No story</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {keyPrefix}-{s.number} {s.title}
                </option>
              ))}
            </select>
            <button disabled={busy || !adding.trim()} className="btn btn-primary">
              <Icon name="plus" size={14} /> Add
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((col) => {
          const list = shown.filter((t) => t.status === col.status).sort((a, b) => b.number - a.number);
          return (
            <section
              key={col.status}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!canWrite || !drag) return;
                e.preventDefault();
                setOver(col.status);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const t = tasks.find((x) => x.id === drag);
                if (t && t.status !== col.status) move(t.id, col.status);
                setDrag(null);
              }}
              className={`min-h-40 rounded-2xl border p-2 transition-colors ${over === col.status ? "border-thread bg-thread-soft" : "border-line bg-bg-2"}`}
            >
              <h2 className="flex items-center gap-2 px-2 pt-1 pb-2.5 text-[12.5px] font-semibold text-fg-2">
                <span className={`size-2 rounded-full ${col.status === "done" ? "bg-thread" : col.status === "doing" ? "border border-thread bg-thread-soft" : "border border-fg-3"}`} />
                {col.label}
                <span className="font-normal text-fg-3 num">{list.length}</span>
              </h2>
              <ul className="space-y-1.5">
                {list.map((t) => {
                  const s = t.story_id ? storyById.get(t.story_id) : null;
                  const owner = builders.find((m) => m.user_id === t.assignee);
                  return (
                    <li
                      key={t.id}
                      draggable={canWrite}
                      onDragStart={() => setDrag(t.id)}
                      onDragEnd={() => setDrag(null)}
                      className={`group rounded-xl border border-line bg-bg p-3 transition-[opacity,transform] duration-150 ${canWrite ? "cursor-grab active:cursor-grabbing" : ""} ${drag === t.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <p className={`flex-1 text-[13.5px] leading-snug ${t.status === "done" ? "text-fg-2" : ""}`}>{t.title}</p>
                        {owner && <Avatar profile={owner.profile} size={20} />}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11.5px] text-fg-3">
                        <span className="mono">
                          {keyPrefix}-{t.number}
                        </span>
                        {s && (
                          <Link href={`/w/${workspaceId}/stories/${s.number}`} className="truncate hover:text-fg">
                            {keyPrefix}-{s.number} · {s.title}
                          </Link>
                        )}
                        {canWrite && (
                          <select
                            aria-label={`Move ${t.title}`}
                            value={t.status}
                            onChange={(e) => move(t.id, e.target.value as TaskStatus)}
                            className="ml-auto h-6 rounded-md border border-line bg-bg-2 px-1 text-[11px] transition-opacity focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          >
                            {COLS.map((c) => (
                              <option key={c.status} value={c.status}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="px-2 py-6 text-center text-[12.5px] text-fg-3">{col.status === "done" ? "Nothing finished yet." : "Empty."}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
