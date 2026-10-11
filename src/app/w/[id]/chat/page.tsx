import { requestTime } from "@/lib/format";
import { connection } from "next/server";
import { Chat } from "@/components/chat";
import { loadMessages, loadWorkspace } from "@/lib/data";

export const metadata = { title: "Chat" };

export default async function ChatPage(props: PageProps<"/w/[id]/chat">) {
  await connection();
  const { id } = await props.params;
  const [v, messages] = await Promise.all([loadWorkspace(id), loadMessages(id)]);
  return (
    <Chat
      workspaceId={id}
      me={v.me.id}
      keyPrefix={v.key}
      initial={messages}
      members={v.members}
      stories={v.stories.map((s) => ({ id: s.id, number: s.number }))}
      decisionByMessage={Object.fromEntries(v.decisions.filter((x) => x.message_id).map((x) => [x.message_id!, x.number]))}
      canDecide={v.me.role !== "mentor"}
      now={requestTime()}
    />
  );
}
