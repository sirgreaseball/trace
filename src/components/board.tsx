"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { Segmented } from "./rings";
import { Avatar } from "./ui";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Task, TaskStatus } from "@/lib/types";

const COLS: { status: TaskStatus; label: string; mark: string }[] = [
  { status: "todo", label: "To do", mark: "mark-planned" },
  { status: "doing", label: "Doing", mark: "mark-building" },
  { status: "done", label: "Done", mark: "mark-traced" },
];

/** Which column sits under a point on screen. */
function columnAt(x: number, y: number): TaskStatus | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const col = (el as HTMLElement).closest?.("[data-col]") as HTMLElement | null;
    if (col) return col.dataset.col as TaskStatus;
  }
  return null;
}

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
  const [dragging, setDragging] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [story, setStory] = useState("");
  const [fine, setFine] = useState(false);
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setTasks(initial);
  }
  useEffect(() => {
    const mq = matchMedia("(pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          id="board-who"
          label="Whose tasks"
          value={who}
          onChange={(k) => setWho(k as "all" | "me")}
          items={[
            { key: "all", label: "Everyone", count: tasks.length },
            { key: "me", label: "Mine", count: tasks.filter((t) => t.assignee === me).length },
          ]}
        />
        {canWrite && (
          <form onSubmit={add} className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <input value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={200} placeholder="New task…" aria-label="New task" className="field field-sm h-9 min-w-0 flex-1 sm:w-60" />
            <select value={story} onChange={(e) => setStory(e.target.value)} aria-label="Story" className="field field-sm h-9 w-44">
              <option value="">No story</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {keyPrefix}-{s.number} {s.title}
                </option>
              ))}
            </select>
            <button disabled={busy || !adding.trim()} className="btn btn-primary h-9">
              <Icon name="plus" size={14} bold /> Add
            </button>
          </form>
        )}
      </div>

      <LayoutGroup>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLS.map((col) => {
            const list = shown.filter((t) => t.status === col.status).sort((a, b) => b.number - a.number);
            const hot = over === col.status && dragging !== null;
            return (
              <section
                key={col.status}
                data-col={col.status}
                aria-label={col.label}
                className={`relative min-h-48 rounded-[26px] p-2.5 transition-[background-color,box-shadow] duration-300 ${hot ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-[light-dark(rgb(21_21_27/0.035),rgb(255_255_255/0.035))] shadow-[inset_0_0_0_1px_var(--line)]"}`}
              >
                <h2 className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-3 text-[14px] font-[620]">
                  <span className={`mark ${col.mark}`} />
                  {col.label}
                  <span className="num font-normal text-ink-3">{list.length}</span>
                </h2>
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {list.map((t) => {
                      const s = t.story_id ? storyById.get(t.story_id) : null;
                      const owner = builders.find((m) => m.user_id === t.assignee);
                      const lifted = dragging === t.id;
                      return (
                        <motion.li
                          key={t.id}
                          layout
                          layoutId={`task-${t.id}`}
                          drag={canWrite && fine}
                          dragSnapToOrigin
                          dragElastic={0.9}
                          dragMomentum={false}
                          onDragStart={() => setDragging(t.id)}
                          onDrag={(_, i) => setOver(columnAt(i.point.x - window.scrollX, i.point.y - window.scrollY))}
                          onDragEnd={(_, i) => {
                            const to = columnAt(i.point.x - window.scrollX, i.point.y - window.scrollY);
                            setDragging(null);
                            setOver(null);
                            if (to && to !== t.status) move(t.id, to);
                          }}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          whileDrag={{ scale: 1.035, rotate: -1.2, boxShadow: "0 24px 48px -16px rgb(0 0 0 / 0.35)" }}
                          transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
                          style={{ zIndex: lifted ? 30 : 1, position: "relative" }}
                          className={`group rounded-[18px] bg-surface p-3.5 shadow-[var(--shadow-sm),0_0_0_1px_var(--line)] ${canWrite && fine ? "cursor-grab active:cursor-grabbing" : ""}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <p className={`flex-1 text-[14.5px] leading-snug font-[520] ${t.status === "done" ? "text-ink-3" : ""}`}>{t.title}</p>
                            {owner && <Avatar profile={owner.profile} size={24} />}
                          </div>
                          <div className="mt-2.5 flex items-center gap-2 text-[12px] text-ink-3">
                            <span className="ref">
                              {keyPrefix}-{t.number}
                            </span>
                            {s && (
                              <Link href={`/w/${workspaceId}/stories/${s.number}`} className="min-w-0 truncate transition-colors hover:text-ink" onPointerDown={(e) => e.stopPropagation()}>
                                {s.title}
                              </Link>
                            )}
                            {canWrite && (
                              <select
                                aria-label={`Move ${t.title}`}
                                value={t.status}
                                onChange={(e) => move(t.id, e.target.value as TaskStatus)}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="field field-sm ml-auto h-7 min-h-0 w-[88px] py-0 text-[12px] transition-opacity focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              >
                                {COLS.map((c) => (
                                  <option key={c.status} value={c.status}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                  {list.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-ink-3">{col.status === "done" ? "Nothing finished yet." : "Nothing here."}</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
