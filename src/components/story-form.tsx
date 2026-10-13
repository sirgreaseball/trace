"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";
import { Modal } from "./modal";
import { useRun } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Priority, Story } from "@/lib/types";

// "As a student, I want X, so that Y." <-> its three parts.
function split(narrative: string) {
  const m = narrative.match(/^As an? (.+?), I want (.+?), so that (.+?)\.?$/i);
  return m ? { who: m[1], want: m[2], why: m[3] } : { who: "", want: narrative, why: "" };
}

export function StoryForm({ workspaceId, story, trigger }: { workspaceId: string; story?: Story; trigger?: "button" | "edit" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, busy } = useRun();
  const parts = split(story?.narrative ?? "");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const who = String(f.get("who")).trim();
    const want = String(f.get("want")).trim();
    const why = String(f.get("why")).trim();
    const narrative = who && want ? `As ${/^[aeiou]/i.test(who) ? "an" : "a"} ${who}, I want ${want}${why ? `, so that ${why}` : ""}.` : want;
    const row = {
      title: String(f.get("title")).trim(),
      narrative,
      acceptance: String(f.get("acceptance"))
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n"),
      priority: String(f.get("priority")) as Priority,
    };
    const sb = supabaseBrowser();
    if (story) {
      if (await run(() => sb.from("stories").update(row).eq("id", story.id), "Story saved")) setOpen(false);
    } else {
      let number: number | undefined;
      const ok = await run(async () => {
        const r = await sb.from("stories").insert({ ...row, workspace_id: workspaceId }).select("number").single();
        number = r.data?.number;
        return r;
      }, "Story added");
      if (ok) {
        setOpen(false);
        if (number) router.push(`/w/${workspaceId}/stories/${number}`);
      }
    }
  }

  return (
    <>
      {trigger === "edit" ? (
        <button className="btn btn-sm" onClick={() => setOpen(true)}>
          Edit
        </button>
      ) : (
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={14} /> New story
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={story ? "Edit story" : "New story"} wide>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input id="title" name="title" required maxLength={200} defaultValue={story?.title} className="field" placeholder="Report a lost item" autoFocus />
          </div>
          <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <legend className="label">The user story</legend>
            <label className="text-[12px] text-ink-3">
              As a…
              <input name="who" defaultValue={parts.who} className="field mt-1" placeholder="student" />
            </label>
            <label className="text-[12px] text-ink-3">
              I want…
              <input name="want" required defaultValue={parts.want} className="field mt-1" placeholder="to report what I lost" />
            </label>
            <label className="text-[12px] text-ink-3">
              So that…
              <input name="why" defaultValue={parts.why} className="field mt-1" placeholder="a finder can return it" />
            </label>
          </fieldset>
          <div>
            <label className="label" htmlFor="acceptance">
              Acceptance criteria <span className="font-normal text-ink-3">(one per line)</span>
            </label>
            <textarea
              id="acceptance"
              name="acceptance"
              rows={4}
              maxLength={4000}
              defaultValue={story?.acceptance}
              className="field"
              placeholder={"Given I'm signed in, when I submit the form, then the item shows under Lost.\nGiven a missing field, when I submit, then I see which one."}
            />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="label" htmlFor="priority">
                Priority
              </label>
              <select id="priority" name="priority" defaultValue={story?.priority ?? "should"} className="field w-40">
                <option value="must">Must have</option>
                <option value="should">Should have</option>
                <option value="could">Could have</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button disabled={busy} className="btn btn-primary">
                {busy ? "Saving…" : story ? "Save" : "Add story"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
