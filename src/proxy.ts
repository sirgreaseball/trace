import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every app request and keeps signed-out
// visitors out of the workspace routes.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!data.user && (path.startsWith("/w/") || path === "/home")) {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/home", "/w/:path*", "/join/:path*", "/enter", "/api/:path*", "/auth/:path*"],
};
