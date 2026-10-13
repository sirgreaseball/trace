"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Modal } from "./modal";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";

type Opt = { id: string; label: string };

export function DecisionForm({ workspaceId, stories, decisions, presetStory }: { workspaceId: string; stories: Opt[]; decisions: Opt[]; presetStory?: string }) {
  const [open, setOpen] = useState(!!presetStory);
  const { run, busy } = useRun();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      workspace_id: workspaceId,
      title: String(f.get("title")).trim(),
      rationale: String(f.get("rationale")).trim(),
      alternatives: String(f.get("alternatives")).trim(),
      story_id: String(f.get("story")) || null,
      supersedes: String(f.get("supersedes")) || null,
    };
    if (await run(() => supabaseBrowser().from("decisions").insert(row), "Decision logged")) setOpen(false);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Log a decision
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Log a decision" wide>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="d-title">
              What did you decide?
            </label>
            <input id="d-title" name="title" required maxLength={200} className="field" placeholder="Use Supabase instead of Firebase" autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="d-why">
              Why?
            </label>
            <textarea id="d-why" name="rationale" rows={3} maxLength={4000} className="field" placeholder="The reasons, in a sentence or two. This is what your viva will ask." />
          </div>
          <div>
            <label className="label" htmlFor="d-alt">
              What else did you consider?
            </label>
            <input id="d-alt" name="alternatives" maxLength={2000} className="field" placeholder="Firebase; Express + MySQL" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="d-story">
                Story
              </label>
              <select id="d-story" name="story" defaultValue={presetStory ?? ""} className="field">
                <option value="">Whole project</option>
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-sup">
                Replaces
              </label>
              <select id="d-sup" name="supersedes" defaultValue="" className="field">
                <option value="">Nothing</option>
                {decisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button disabled={busy} className="btn btn-primary">
              {busy ? "Saving…" : "Log decision"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ConflictActions({ workspaceId, earlier, later }: { workspaceId: string; earlier: { id: string; number: number }; later: { id: string; number: number } }) {
  const { run, busy } = useRun();
  const sb = supabaseBrowser();
  return (
    <span className="flex flex-wrap gap-1.5">
      <button disabled={busy} className="btn btn-primary btn-sm" onClick={() => run(() => sb.from("decisions").update({ supersedes: earlier.id }).eq("id", later.id), `D-${later.number} now replaces D-${earlier.number}`)}>
        D-{later.number} replaces D-{earlier.number}
      </button>
      <button
        disabled={busy}
        className="btn btn-sm btn-ghost"
        onClick={() => run(() => sb.from("ai_cache").upsert({ workspace_id: workspaceId, key: `conflict-ok:${earlier.id}:${later.id}`, value: true }), "Marked as not a conflict")}
      >
        Not a conflict
      </button>
    </span>
  );
}
