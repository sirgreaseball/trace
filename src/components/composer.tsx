"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { toast } from "./toast";
import { humanize } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Story } from "@/lib/types";

/**
 * Posts a message. "#LF-3" ties it to that story; "/decide Title. Why." also
 * logs a decision that points back at the message.
 */
export async function postMessage(opts: { workspaceId: string; userId: string; body: string; storyId?: string | null; stories: Pick<Story, "id" | "number">[]; keyPrefix: string }) {
  const sb = supabaseBrowser();
  const body = opts.body.trim();
  const mention = body.match(new RegExp(`#${opts.keyPrefix}-(\\d+)\\b`, "i"));
  const storyId = opts.storyId ?? (mention ? (opts.stories.find((s) => s.number === Number(mention[1]))?.id ?? null) : null);
  const { data, error } = await sb.from("messages").insert({ workspace_id: opts.workspaceId, user_id: opts.userId, body, story_id: storyId }).select("id").single();
  if (error) return { error };
  const decide = body.match(/^\/decide\s+(.+)$/is);
  if (decide) {
    const text = decide[1].trim();
    const cut = text.search(/(?:\.|—| - |;)\s/);
    const title = (cut > 0 ? text.slice(0, cut) : text).slice(0, 200);
    const rationale = cut > 0 ? text.slice(cut + 1).replace(/^[—\-;\s]+/, "").trim() : "";
    const r = await sb.from("decisions").insert({ workspace_id: opts.workspaceId, title, rationale, message_id: data.id, story_id: storyId }).select("number").single();
    if (r.error) return { error: r.error };
    return { error: null, decision: r.data.number as number };
  }
  return { error: null };
}

export function Composer({
  workspaceId,
  userId,
  storyId,
  stories,
  keyPrefix,
  onSent,
  placeholder = "Write a message…",
}: {
  workspaceId: string;
  userId: string;
  storyId?: string | null;
  stories: Pick<Story, "id" | "number">[];
  keyPrefix: string;
  onSent?: () => void;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!body.trim() || busy) return;
    setBusy(true);
    const r = await postMessage({ workspaceId, userId, body, storyId, stories, keyPrefix });
    setBusy(false);
    if (r.error) return toast(humanize(r.error.message), "error");
    if ("decision" in r && r.decision) toast(`Logged as decision D-${r.decision}`);
    setBody("");
    onSent?.();
  }
  return (
    <div className="flex items-end gap-2 rounded-xl border border-line-2 bg-bg-2 p-1.5 focus-within:border-thread focus-within:shadow-[0_0_0_3px_var(--thread-soft)]">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        rows={1}
        maxLength={4000}
        placeholder={placeholder}
        aria-label="Message"
        className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none placeholder:text-fg-3 [field-sizing:content]"
      />
      <button onClick={send} disabled={busy || !body.trim()} className="btn btn-thread btn-icon h-9 w-9" aria-label="Send">
        <Icon name="send" size={15} />
      </button>
    </div>
  );
}
