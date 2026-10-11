"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "./toast";

export function humanize(message: string) {
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that here.";
  if (/needs at least one owner/i.test(message)) return "A workspace needs at least one team lead.";
  if (/duplicate key/i.test(message)) return "That already exists.";
  if (/outside this workspace/i.test(message)) return "That item belongs to another workspace.";
  if (/violates check constraint/i.test(message)) return "Some of those values aren't allowed. Check the fields and try again.";
  if (/failed to fetch|network/i.test(message)) return "You're offline or the server is unreachable.";
  return message;
}

type Result = { error: { message: string } | null } | void | undefined;

/** Runs a mutation, reports errors as a toast and refreshes server data on success. */
export function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => PromiseLike<Result>, ok?: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r && r.error) {
        toast(humanize(r.error.message), "error");
        return false;
      }
      if (ok) toast(ok);
      router.refresh();
      return true;
    } catch (e) {
      toast(humanize(e instanceof Error ? e.message : "Something went wrong."), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}
