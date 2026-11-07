import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isCronPath } from "@/lib/cron-path";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login"];
// Skipped by the session check: a "use server" module imported into the /set-password tree would bypass it (only signIn, signOut and setPassword are reachable there today).
const SET_PASSWORD_PATH = "/set-password";
const SESSION_MISSING = "AuthSessionMissingError";

// Name and message only: never the request, a cookie or a token.
function logAuthFailure(error: unknown) {
  const { name, message } = error instanceof Error ? error : { name: "UnknownError", message: "non-Error value thrown" };
  console.error(`[proxy] auth check failed: ${name}: ${message}`);
}

// auth-js mostly returns `{ error }` instead of throwing; a visitor with no session is normal, not a failure.
function logReturnedAuthError(error: Error | null) {
  if (error && error.name !== SESSION_MISSING) logAuthFailure(error);
}

export async function updateSession(request: NextRequest) {
  // Authenticated inside by CRON_SECRET or the link's one-time token; no session, no login redirect (and no /dashboard bounce).
  if (isCronPath(request.nextUrl.pathname) || request.nextUrl.pathname === SET_PASSWORD_PATH) {
    return NextResponse.next({ request });
  }

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
      const { data, error } = await supabase.auth.getClaims();
      logReturnedAuthError(error);
      return data?.claims?.sub ?? null;
    } catch (thrown) {
      logAuthFailure(thrown);
      return null;
    }
  };
  const askAuthServer = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      logReturnedAuthError(error);
      return data.user?.id ?? null;
    } catch (thrown) {
      logAuthFailure(thrown);
      return null;
    }
  };
  // A bare redirect would drop the cookies the client just refreshed, leaving the browser with a rotated-away token.
  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };
  const user = needsServerCheck ? await askAuthServer() : ((await checkLocally()) ?? (await askAuthServer()));

  if (!user && !isPublic) return redirectTo("/login");
  if (user && isPublic) return redirectTo("/dashboard");

  return response;
}
