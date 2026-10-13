"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Composer } from "./composer";
import { Icon } from "./icons";
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
  const [mounted] = useState(now);
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

  // Scroll the conversation, never the page around it.
  const first = useRef(true);
  useEffect(() => {
    const box = end.current?.parentElement;
    if (!box) return;
    const hash = location.hash.slice(1);
    const target = first.current && hash ? document.getElementById(hash) : null;
    const top = target ? target.offsetTop - box.clientHeight / 2 : box.scrollHeight;
    box.scrollTo({ top, behavior: first.current ? "instant" : "smooth" });
    first.current = false;
  }, [messages.length]);

  async function logDecision(m: Message) {
    const cut = m.body.search(/[.!?]\s/);
    const title = (cut > 0 ? m.body.slice(0, cut) : m.body).replace(/^\/decide\s+/i, "").slice(0, 200);
    const rationale = cut > 0 ? m.body.slice(cut + 1).trim() : "";
    await run(() => supabaseBrowser().from("decisions").insert({ workspace_id: workspaceId, title, rationale, message_id: m.id, story_id: m.story_id }), "Logged as a decision");
  }

  const days = messages.map((m) => day(m.created_at));
  return (
    <div className="flex h-[calc(100dvh-var(--bar-h)-var(--dock-room)-48px)] min-h-[420px] flex-col">
      <header className="flex items-end justify-between gap-3 pb-5">
        <h1 className="t-title">Chat</h1>
        <p className="mb-1 flex items-center gap-2 text-[13px] text-ink-3">
          <span className={`size-2 rounded-full ${live ? "bg-[var(--r3)] shadow-[0_0_10px_var(--r3)]" : "bg-ink-3"}`} style={live ? { animation: "breathe 2.6s ease-in-out infinite" } : undefined} />
          {live ? "Live" : "Connecting…"}
        </p>
      </header>
      <div className="pane flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center text-ink-2">
              <div>
                <Icon name="chat" size={34} className="mx-auto text-ink-3" />
                <p className="t-headline mt-3 text-ink">Start the conversation</p>
                <p className="mt-1 max-w-sm text-[14px]">
                  Mention a story with <span className="ref text-ink-2">#{keyPrefix}-1</span>. Start a message with <span className="ref text-ink-2">/decide</span> to log a decision.
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
            const fresh = Date.parse(m.created_at) > mounted;
            return (
              <motion.div
                key={m.id}
                id={`m-${m.id}`}
                className="scroll-mt-24 rounded-[20px] target:bg-accent-soft"
                initial={fresh ? { opacity: 0, y: 14, scale: 0.97, filter: "blur(4px)" } : false}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                transition={{ type: "spring", bounce: 0.24, duration: 0.55 }}
              >
                {showDay && (
                  <p className="my-6 text-center">
                    <span className="chip h-6 bg-surface-2 px-3 shadow-[0_0_0_1px_var(--line)]">{d}</span>
                  </p>
                )}
                <MessageRow
                  author={m.user_id ? (profile.get(m.user_id) ?? null) : null}
                  body={m.body}
                  time={ago(m.created_at, now)}
                  keyPrefix={keyPrefix}
                  base={base}
                  compact={compact}
                  decision={decided}
                  mine={m.user_id === me}
                  action={
                    canDecide && !decided ? (
                      <button disabled={busy} onClick={() => logDecision(m)} className={`btn btn-sm ${hint ? "btn-accent" : ""}`}>
                        Log as decision
                      </button>
                    ) : null
                  }
                />
              </motion.div>
            );
          })}
          <div ref={end} />
        </div>
        <div className="border-t border-line bg-[light-dark(rgb(246_246_249/0.7),rgb(255_255_255/0.02))] p-3">
          <Composer workspaceId={workspaceId} userId={me} stories={stories} keyPrefix={keyPrefix} onSent={() => router.refresh()} placeholder={`Message the team…  #${keyPrefix}-3 mentions a story, /decide logs a decision`} />
        </div>
      </div>
    </div>
  );
}
