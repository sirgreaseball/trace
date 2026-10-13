import { connection } from "next/server";
import { Settings } from "@/components/settings";
import { PageTitle } from "@/components/ui";
import { requestTime } from "@/lib/format";
import { loadWorkspace, myProfile } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/w/[id]/settings">) {
  await connection();
  const { id } = await props.params;
  const [v, mine] = await Promise.all([loadWorkspace(id), myProfile()]);
  const sb = await supabaseServer();
  const [{ data: invites }, { data: sync }, { data: pending }] = await Promise.all([
    sb.from("invites").select("token, role, created_at, expires_at").eq("workspace_id", id).order("created_at", { ascending: false }),
    sb.from("sync_state").select("synced_at, last_error").eq("workspace_id", id).maybeSingle(),
    sb.from("email_invites").select("email, role").eq("workspace_id", id).order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageTitle title="Settings" sub={`${v.ws.name}${v.ws.course ? `, ${v.ws.course}` : ""}. Everyone on the team can see these.`} />
      <Settings
        ws={{ id: v.ws.id, name: v.ws.name, key: v.ws.key, course: v.ws.course, repo: v.ws.repo, demo: v.ws.demo }}
        me={{ id: v.me.id, role: v.me.role }}
        profile={{ name: mine.profile.name, github: mine.profile.github }}
        members={v.members}
        invites={invites ?? []}
        pending={pending ?? []}
        lastError={sync?.last_error ?? null}
        now={requestTime()}
      />
    </>
  );
}
