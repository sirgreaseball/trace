import "server-only";

// One OpenAI-compatible call, tried against free providers in order. Every AI
// feature in Trace has a plain fallback, so with no keys the app still works.

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Tier = "fast" | "smart";

const providers = [
  {
    name: "Groq",
    key: () => process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: { fast: "llama-3.1-8b-instant", smart: "openai/gpt-oss-120b" },
    extra: (tier: Tier) => (tier === "smart" ? { reasoning_effort: "low" } : {}),
  },
  {
    name: "Gemini",
    key: () => process.env.GEMINI_API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: { fast: process.env.GEMINI_MODEL ?? "gemini-2.5-flash", smart: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" },
    extra: () => ({}),
  },
  {
    name: "OpenRouter",
    key: () => process.env.OPENROUTER_API_KEY,
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: {
      fast: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
      smart: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
    },
    extra: () => ({}),
  },
];

export const aiEnabled = () => providers.some((p) => p.key());

export async function complete(messages: Msg[], opts: { tier?: Tier; json?: boolean; maxTokens?: number } = {}) {
  const tier = opts.tier ?? "fast";
  for (const p of providers) {
    const key = p.key();
    if (!key) continue;
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: p.model[tier],
          messages,
          temperature: 0.2,
          max_tokens: opts.maxTokens ?? 900,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          ...p.extra(tier),
        }),
        signal: AbortSignal.timeout(25_000),
      });
      // Rate limited, overloaded or misconfigured: fall through to the next provider.
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return { text, provider: p.name };
    } catch {
      continue;
    }
  }
  return null;
}

/** Pulls the first JSON object out of a model reply, tolerating code fences. */
export function parseJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
