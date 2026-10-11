import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const DEMO = {
  student: "isha.kulkarni@example.com",
  mentor: "meenakshi.nair@example.com",
} as const;

// Signs the visitor in as one of the fictional demo people. The password stays
// on the server; the demo data resets every six hours.
export async function POST(request: Request) {
  const form = await request.formData();
  const as = form.get("as") === "mentor" ? "mentor" : "student";
  const origin = new URL(request.url).origin;
  if (!process.env.DEMO_PASSWORD) {
    return NextResponse.redirect(`${origin}/enter?error=${encodeURIComponent("The demo isn't set up on this deployment.")}`, 303);
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email: DEMO[as], password: process.env.DEMO_PASSWORD });
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/enter?error=${encodeURIComponent("The demo is resetting. Try again in a minute.")}`, 303);
  }
  if (as === "mentor") return NextResponse.redirect(`${origin}/home`, 303);
  const { data: m } = await sb.from("members").select("workspace_id").eq("user_id", data.user.id).limit(1).maybeSingle();
  return NextResponse.redirect(`${origin}${m ? `/w/${m.workspace_id}` : "/home"}`, 303);
}
