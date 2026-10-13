"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";
import { island } from "./island";

export function SyncButton({ workspaceId, className = "" }: { workspaceId: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    island.busy("sync", "Syncing with GitHub…");
    try {
      const res = await fetch(`/api/w/${workspaceId}/sync`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return island.done("sync", body.error ?? "Sync failed.", "error");
      const parts = [
        body.added ? `${body.added} new commits` : "No new commits",
        body.linked ? `${body.linked} linked` : "",
        body.suggested ? `${body.suggested} suggested` : "",
      ].filter(Boolean);
      island.done("sync", parts.join(" · "));
      router.refresh();
    } catch {
      island.done("sync", "Couldn't reach the server.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={sync} disabled={busy} className={`btn ${className}`}>
      <Icon name="sync" size={15} className={busy ? "animate-spin" : ""} />
      {busy ? "Syncing…" : "Sync GitHub"}
    </button>
  );
}
