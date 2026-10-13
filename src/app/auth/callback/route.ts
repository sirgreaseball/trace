import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

// Lands sign-ins that finish on Supabase's side: Google and GitHub, and the
// links in confirmation emails (either the ?code= kind or the ?token_hash= kind).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const enter = (kind: "error" | "notice", message: string) =>
    NextResponse.redirect(`${url.origin}/enter?${kind}=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);

  const sb = await supabaseServer();
  if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return enter("error", "That link has expired or was already used. Sign in, or sign up again for a fresh one.");
  } else if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    // Supabase has already confirmed the email before it hands back a code, so a
    // failed exchange (usually the link opened in a different browser) only means
    // this browser isn't signed in yet.
    if (error) {
      return url.searchParams.get("flow") === "signup"
        ? enter("notice", "Your email is confirmed. Sign in to continue.")
        : enter("error", "That sign-in didn't finish. Try again.");
    }
  } else {
    const why = url.searchParams.get("error_description");
    return enter("error", why || "That sign-in link didn't work. Try again.");
  }

  // Anyone a team lead added by email joins those teams now.
  await sb.rpc("claim_invites");
  return NextResponse.redirect(`${url.origin}${next}`);
}
