import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { aiEnabled, complete } from "@/lib/ai";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 30;

type Hit = { kind: string; id: string; ref: string | null; title: string; snippet: string; rank: number; created_at: string };

// Answers "why" questions from the team's own record. Search always runs;
// when an AI key is set, a model writes a short answer that cites the hits.
export async function POST(request: Request, ctx: RouteContext<"/api/w/[id]/ask">) {
  const { id } = await ctx.params;
  const { q } = (await request.json().catch(() => ({}))) as { q?: string };
  const question = (q ?? "").trim().slice(0, 300);
  if (question.length < 3) return NextResponse.json({ error: "Ask a longer question." }, { status: 400 });

  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data, error } = await sb.rpc("search_evidence", { p_workspace: id, p_query: question, p_limit: 10 });
  if (error) return NextResponse.json({ error: "Search failed. Try again." }, { status: 500 });
  const hits = ((data ?? []) as Hit[]).map((h) => ({ ...h, snippet: h.snippet.replace(/\s+/g, " ").trim() }));
  if (hits.length === 0 || !aiEnabled()) return NextResponse.json({ answer: null, hits, ai: aiEnabled() });

  const key = `ask:${createHash("sha256").update(`${question.toLowerCase()}|${hits.map((h) => h.id).join(",")}`).digest("hex").slice(0, 32)}`;
  const cached = await sb.from("ai_cache").select("value").eq("workspace_id", id).eq("key", key).maybeSingle();
  if (cached.data) return NextResponse.json({ ...(cached.data.value as object), hits, ai: true, cached: true });

  const evidence = hits
    .slice(0, 8)
    .map((h, i) => `[${i + 1}] ${h.kind}${h.ref ? ` ${h.ref}` : ""} (${h.created_at.slice(0, 10)}): ${h.title}. ${h.snippet.replace(/<<|>>/g, "")}`)
    .join("\n");
  const ai = await complete(
    [
      {
        role: "system",
        content:
          "You answer a student software team's questions using only their own records below. Write 2 to 4 plain sentences. Cite every claim with [n] matching the evidence numbers. If the records don't answer the question, say so in one sentence and point to the closest evidence. Never invent facts, names or dates.",
      },
      { role: "user", content: `Question: ${question}\n\nEvidence:\n${evidence}` },
    ],
    { tier: "smart", maxTokens: 1200 },
  );
  if (!ai) return NextResponse.json({ answer: null, hits, ai: true, unavailable: true });
  const value = { answer: ai.text, provider: ai.provider };
  await sb.from("ai_cache").upsert({ workspace_id: id, key, value });
  return NextResponse.json({ ...value, hits, ai: true });
}
