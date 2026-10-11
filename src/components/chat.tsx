"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Composer } from "./composer";
import { MessageRow } from "./message";
import { useRun } from "./use-run";
import { ago, day } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Message } from "@/lib/types";

const DECISION_HINT = /\b(let'?s go with|going with|we decided|decided to|final(?:ly)?:|we'?ll use|agreed)\b/i;

export function Chat({
  workspaceId,
  me,
  keyPrefix,
  initial,
  members,
  stories,
  decisionByMessage,
  canDecide,
  now,
}: {
  workspaceId: string;
  me: string;
  keyPrefix: string;
  initial: Message[];
  members: Member[];
  stories: { id: string; number: number }[];
  decisionByMessage: Record<string, number>;
  canDecide: boolean;
  now: number;
}) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [messages, setMessages] = useState(initial);
  const [live, setLive] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const profile = new Map(members.map((m) => [m.user_id, m.profile]));
  const base = `/w/${workspaceId}`;

  // Server refreshes bring new props; keep anything realtime already added.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    const ids = new Set(initial.map((m) => m.id));
    setMessages((cur) => [...initial, ...cur.filter((m) => !ids.has(m.id) && m.created_at > (initial.at(-1)?.created_at ?? ""))]);
  }

  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`chat:${workspaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` }, (p: { new: unknown }) => {
        const m = p.new as Message;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, { id: m.id, user_id: m.user_id, story_id: m.story_id, body: m.body, created_at: m.created_at }]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` }, (p: { old: unknown }) => {
        setMessages((cur) => cur.filter((x) => x.id !== (p.old as { id: string }).id));
      })
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    return () => {
      sb.removeChannel(channel);
    };
  }, [workspaceId]);

  useEffect(() => {
    const hash = location.hash.slice(1);
    const target = hash && document.getElementById(hash);
    if (target) target.scrollIntoView({ block: "center" });
    else end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function logDecision(m: Message) {
    const cut = m.body.search(/[.!?]\s/);
    const title = (cut > 0 ? m.body.slice(0, cut) : m.body).replace(/^\/decide\s+/i, "").slice(0, 200);
    const rationale = cut > 0 ? m.body.slice(cut + 1).trim() : "";
    await run(() => supabaseBrowser().from("decisions").insert({ workspace_id: workspaceId, title, rationale, message_id: m.id, story_id: m.story_id }), "Logged as a decision");
  }

  const days = messages.map((m) => day(m.created_at));
  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col sm:h-[calc(100dvh-8.5rem)]">
      <header className="flex items-end justify-between gap-3 pb-4">
        <div>
          <p className="eyebrow mb-2">Team</p>
          <h1 className="text-[26px] font-semibold sm:text-[30px]">Chat</h1>
        </div>
        <p className="flex items-center gap-2 text-[12px] text-fg-3">
          <span className={`size-1.5 rounded-full ${live ? "bg-thread" : "bg-fg-3"}`} />
          {live ? "Live" : "Connecting…"}
        </p>
      </header>
      <div className="panel flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center text-fg-2">
              <div>
                <p className="font-medium text-fg">Start the conversation</p>
                <p className="mt-1 max-w-sm text-[13px]">
                  Mention a story with <span className="mono">#{keyPrefix}-1</span>. Start a message with <span className="mono">/decide</span> to log a decision.
                </p>
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const d = days[i];
            const showDay = i === 0 || d !== days[i - 1];
            const prev = messages[i - 1];
            const compact = !showDay && !!prev && prev.user_id === m.user_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 600_000;
            const decided = decisionByMessage[m.id];
            const hint = canDecide && !decided && DECISION_HINT.test(m.body);
            return (
              <div key={m.id} id={`m-${m.id}`} className="scroll-mt-24 rounded-lg target:bg-thread-soft">
                {showDay && (
                  <div className="my-4 flex items-center gap-3 text-[11px] text-fg-3">
                    <span className="rule flex-1" />
                    {d}
                    <span className="rule flex-1" />
                  </div>
                )}
                <MessageRow
                  author={m.user_id ? (profile.get(m.user_id) ?? null) : null}
                  body={m.body}
                  time={ago(m.created_at, now)}
                  keyPrefix={keyPrefix}
                  base={base}
                  compact={compact}
                  decision={decided}
                  action={
                    canDecide && !decided ? (
                      <button disabled={busy} onClick={() => logDecision(m)} className={`btn btn-sm ${hint ? "btn-thread" : ""}`}>
                        Log as decision
                      </button>
                    ) : null
                  }
                />
              </div>
            );
          })}
          <div ref={end} />
        </div>
        <div className="border-t border-line p-3">
          <Composer workspaceId={workspaceId} userId={me} stories={stories} keyPrefix={keyPrefix} onSent={() => router.refresh()} placeholder={`Message the team…  #${keyPrefix}-3 to mention a story, /decide to log a decision`} />
        </div>
      </div>
    </div>
  );
}
