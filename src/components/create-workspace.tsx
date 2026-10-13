"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";
import { Modal } from "./modal";
import { humanize } from "./use-run";
import { parseRepo } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";

const suggestKey = (name: string) =>
  (name.match(/[A-Za-z]+/g) ?? [])
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(2, "X");

export function CreateWorkspace() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rawRepo = String(f.get("repo")).trim();
    const repo = rawRepo ? parseRepo(rawRepo) : null;
    if (rawRepo && !repo) return setError("That doesn't look like a GitHub repository. Use owner/name or paste its URL.");
    const k = (touched ? key : suggestKey(name)).toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(k)) return setError("The key needs 2 to 5 letters, like LF.");
    setBusy(true);
    setError(null);
    const { data, error } = await supabaseBrowser().rpc("create_workspace", { p_name: name.trim(), p_key: k, p_course: String(f.get("course")).trim(), p_repo: repo });
    if (error) {
      setBusy(false);
      return setError(humanize(error.message));
    }
    router.push(`/w/${data}`);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> New workspace
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New workspace">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_96px]">
            <div>
              <label className="label" htmlFor="nw-name">
                Project name
              </label>
              <input id="nw-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Campus Lost & Found" autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="nw-key">
                Key
              </label>
              <input
                id="nw-key"
                maxLength={5}
                value={touched ? key : suggestKey(name)}
                onChange={(e) => {
                  setTouched(true);
                  setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
                }}
                className="field mono uppercase"
                aria-describedby="nw-key-help"
              />
            </div>
          </div>
          <p id="nw-key-help" className="-mt-2 text-[12px] text-ink-3">
            The key prefixes every story and task, like <span className="mono">{(touched ? key : suggestKey(name)) || "LF"}-12</span>. Put it in commit messages and they link themselves.
          </p>
          <div>
            <label className="label" htmlFor="nw-course">
              Course <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <input id="nw-course" name="course" maxLength={80} className="field" placeholder="SE Lab, Sem V" />
          </div>
          <div>
            <label className="label" htmlFor="nw-repo">
              Public GitHub repository <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <input id="nw-repo" name="repo" className="field mono" placeholder="owner/repo" />
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button disabled={busy || !name.trim()} className="btn btn-primary">
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
