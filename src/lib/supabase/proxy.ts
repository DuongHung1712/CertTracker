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

  // Verifies the JWT signature (and expiry) against the project's JWKS and refreshes an expiring
  // session into the cookies, without a round trip to the Auth server. The one authoritative
  // `auth.getUser()` per navigation is in `getCurrentUser()` (layout), so the server still
  // confirms the session before any data is read. Falls back to `getUser()` for a project
  // that signs with a symmetric (HS256) secret.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

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
