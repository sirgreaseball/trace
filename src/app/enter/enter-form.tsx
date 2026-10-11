"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function friendly(message: string) {
  if (/invalid login/i.test(message)) return "That email and password don't match.";
  if (/already registered/i.test(message)) return "There's already an account with that email. Sign in instead.";
  if (/password should be/i.test(message)) return "Use at least 8 characters for your password.";
  if (/rate limit/i.test(message)) return "Too many tries. Wait a minute and try again.";
  if (/not confirmed/i.test(message)) return "Confirm your email first. Check your inbox for the link.";
  return message;
}

export function EnterForm({ next, github }: { next: string; github: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    const name = String(f.get("name") ?? "").trim();
    setBusy(true);
    setError(null);
    const sb = supabaseBrowser();
    if (mode === "in") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        return setError(friendly(error.message));
      }
    } else {
      if (password.length < 8) {
        setBusy(false);
        return setError("Use at least 8 characters for your password.");
      }
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setBusy(false);
        return setError(friendly(error.message));
      }
      if (!data.session) {
        setBusy(false);
        return setSent(true);
      }
    }
    router.replace(next);
    router.refresh();
  }

  async function withGithub() {
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      setError(friendly(error.message));
    }
  }

  if (sent) {
    return (
      <div className="panel p-5">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-fg-2">We sent a confirmation link. Open it on this device to finish signing up.</p>
      </div>
    );
  }

  return (
    <div>
      {github && (
        <>
          <button type="button" onClick={withGithub} disabled={busy} className="btn h-10 w-full">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continue with GitHub
          </button>
          <div className="h-3" />
        </>
      )}
      <form onSubmit={submit} className="space-y-3">
        {mode === "up" && (
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input id="name" name="name" required maxLength={80} autoComplete="name" className="field" placeholder="As your team knows you" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" placeholder="you@college.edu" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "up" ? 8 : undefined}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            className="field"
          />
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-warn">
            {error}
          </p>
        )}
        <button disabled={busy} className="btn btn-primary h-10 w-full">
          {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-[13px] text-fg-2">
        {mode === "in" ? "New here?" : "Have an account?"}{" "}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
        >
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
