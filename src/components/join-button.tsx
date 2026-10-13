"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { humanize } from "./use-run";
import { supabaseBrowser } from "@/lib/supabase/client";

export function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        disabled={busy}
        className="btn btn-primary btn-lg w-full"
        onClick={async () => {
          setBusy(true);
          const { data, error } = await supabaseBrowser().rpc("accept_invite", { p_token: token });
          if (error) {
            setBusy(false);
            return setError(humanize(error.message));
          }
          router.replace(`/w/${data}`);
        }}
      >
        {busy ? "Joining…" : "Join the team"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
