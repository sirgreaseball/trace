import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { JoinButton } from "@/components/join-button";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Join a team" };

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const sb = await supabaseServer();
  const [{ data }, user] = await Promise.all([sb.rpc("invite_info", { p_token: token }), currentUser()]);
  const info = (data as { workspace_name: string; course: string; role: string; expired: boolean }[] | null)?.[0];

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="thread-line" />
      <div className="px-5 py-5 sm:px-8">
        <Wordmark />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        {!info ? (
          <>
            <h1 className="text-[26px] font-semibold">This invite doesn&apos;t exist</h1>
            <p className="mt-2 text-fg-2">It may have been revoked. Ask your team lead for a fresh link.</p>
          </>
        ) : info.expired ? (
          <>
            <h1 className="text-[26px] font-semibold">This invite has expired</h1>
            <p className="mt-2 text-fg-2">Invites last 14 days. Ask your team lead for a fresh link to {info.workspace_name}.</p>
          </>
        ) : (
          <>
            <p className="label-sm mb-3">You&apos;re invited</p>
            <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Join {info.workspace_name}</h1>
            <p className="mt-2 text-fg-2">
              {info.course ? `${info.course}. ` : ""}You join as {info.role === "mentor" ? "a mentor: you can read everything, comment and raise disputes." : "a team member."}
            </p>
            <div className="mt-8">
              {user ? (
                <JoinButton token={token} />
              ) : (
                <Link href={`/enter?next=${encodeURIComponent(`/join/${token}`)}`} className="btn btn-primary h-10 w-full">
                  Sign in or create an account to join
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
