"use client";

import { useRouter } from "next/navigation";
import { Composer } from "./composer";
import type { Story } from "@/lib/types";

export function StoryDiscussion(props: { workspaceId: string; userId: string; storyId: string; stories: Pick<Story, "id" | "number">[]; keyPrefix: string }) {
  const router = useRouter();
  return <Composer {...props} onSent={() => router.refresh()} placeholder="Comment on this story… (/decide to log a decision)" />;
}
