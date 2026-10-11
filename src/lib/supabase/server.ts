import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server Components can't write cookies; the proxy refreshes the session instead.
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

/** The signed-in user (verified with the auth server), once per request. */
export const currentUser = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/enter");
  return user;
}
