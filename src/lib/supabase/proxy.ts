import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isCronPath } from "@/lib/cron-path";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  // Authenticated by CRON_SECRET inside the handler; no session, no login redirect (and no /dashboard bounce).
  if (isCronPath(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // Two ways to check the session:
  // - `getUser()` asks the Auth server and rejects a revoked/signed-out/deleted session. It is used
  //   wherever no page render follows to do that check: /login (a revoked session is served the
  //   login page instead of bouncing /dashboard <-> /login in a loop), Server Action POSTs and /api routes.
  // - `getClaims()` verifies the JWT signature and expiry locally against the cached JWKS (no Auth
  //   round trip) and refreshes an expiring session into the cookies. It is used for GET page
  //   navigations and prefetches, whose layout calls `getCurrentUser()` -> `getUser()` once, so a
  //   navigation still contacts the Auth server exactly once. A symmetric (HS256) project makes
  //   `getClaims()` fall back to `getUser()`.
  // Local failure falls through to the Auth server, so both checks agree and /login cannot bounce a valid
  // session back here in a loop. Any error (e.g. a crafted cookie) counts as signed out.
  const needsServerCheck = isPublic || request.method !== "GET" || pathname.startsWith("/api/");
  const checkLocally = async () => {
    try {
      const { data } = await supabase.auth.getClaims();
      return data?.claims?.sub ?? null;
    } catch {
      return null;
    }
  };
  const askAuthServer = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    } catch {
      return null;
    }
  };
  const user = needsServerCheck ? await askAuthServer() : ((await checkLocally()) ?? (await askAuthServer()));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
