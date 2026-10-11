import { NextResponse } from "next/server";
import { complete } from "@/lib/ai";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 30;

// One examiner-style follow-up for a viva practice question, grounded in the
// same evidence the card shows.
export async function POST(request: Request, ctx: RouteContext<"/api/w/[id]/viva">) {
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: member } = await sb.from("members").select("role").eq("workspace_id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Not your workspace." }, { status: 403 });

  const { prompt, answer } = (await request.json().catch(() => ({}))) as { prompt?: string; answer?: string[] };
  if (!prompt || !Array.isArray(answer)) return NextResponse.json({ error: "Missing question." }, { status: 400 });

  const ai = await complete(
    [
      {
        role: "system",
        content:
          "You are a fair university viva examiner for a student software project. Given a question and the facts from the team's record, ask ONE short follow-up question (max 25 words) that tests real understanding, such as a trade-off, an edge case or what would break. Use only the facts given. Reply with the question only.",
      },
      { role: "user", content: `Question: ${prompt.slice(0, 600)}\nFacts:\n${answer.join("\n").slice(0, 1500)}` },
    ],
    { tier: "fast", maxTokens: 120 },
  );
  if (!ai) return NextResponse.json({ error: "AI is busy. Try again in a minute." }, { status: 503 });
  return NextResponse.json({ followUp: ai.text.replace(/^["“]|["”]$/g, "") });
}
