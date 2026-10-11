import { NextResponse } from "next/server";
import { safeNext } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

// Lands sign-ins that finish on Supabase's side (GitHub, email links).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${url.origin}${next}`);
  }
  return NextResponse.redirect(`${url.origin}/enter?error=${encodeURIComponent("That sign-in link didn't work. Try again.")}`);
}

