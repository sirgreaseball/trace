import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { JoinButton } from "@/components/join-button";
import { TeamLight } from "@/components/light";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Join a team" };

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const sb = await supabaseServer();
  const [{ data }, user] = await Promise.all([sb.rpc("invite_info", { p_token: token }), currentUser()]);
  const info = (data as { workspace_name: string; course: string; role: string; expired: boolean }[] | null)?.[0];

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <TeamLight
        sources={[
          { hue: 30, weight: 0.4 },
          { hue: 200, weight: 0.3 },
          { hue: 320, weight: 0.3 },
        ]}
        className="team-glow absolute inset-x-0 top-0 h-[520px]"
      />
      <div className="page relative flex h-[var(--bar-h)] items-center">
        <Wordmark />
      </div>
      <div className="relative mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 pb-24">
        <div className="glass-strong rise rounded-[32px] p-7 sm:p-9">
          {!info ? (
            <>
              <h1 className="text-[28px] font-[650] tracking-[-0.035em]">This invite doesn&apos;t exist</h1>
              <p className="mt-2 text-ink-2">It may have been revoked. Ask your team lead for a fresh link.</p>
            </>
          ) : info.expired ? (
            <>
              <h1 className="text-[28px] font-[650] tracking-[-0.035em]">This invite has expired</h1>
              <p className="mt-2 text-ink-2">Invites last 14 days. Ask your team lead for a fresh link to {info.workspace_name}.</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-[560] text-ink-3">You&apos;re invited</p>
              <h1 className="mt-2 text-[32px] leading-tight font-[650] tracking-[-0.04em]">Join {info.workspace_name}</h1>
              <p className="mt-3 text-[15px] text-ink-2">
                {info.course ? `${info.course}. ` : ""}You join as {info.role === "mentor" ? "a mentor: you can read everything, comment and raise disputes." : "a team member."}
              </p>
              <div className="mt-8">
                {user ? (
                  <JoinButton token={token} />
                ) : (
                  <Link href={`/enter?next=${encodeURIComponent(`/join/${token}`)}`} className="btn btn-primary btn-lg w-full">
                    Sign in or create an account to join
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
