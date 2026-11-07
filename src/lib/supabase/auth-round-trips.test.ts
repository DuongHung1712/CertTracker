import { inspect } from "node:util";
import { AuthRetryableFetchError, AuthSessionMissingError, type AuthError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// One page navigation = the proxy (`updateSession`) + the layout and the page, both calling
// `getCurrentUser()`. Only calls that contact the Supabase Auth server are counted: `getUser()`
// always does; `getClaims()` verifies an ES256/RS256 JWT locally against the cached JWKS (the
// mock below models such a project, like the local stack).
const authServerCalls = vi.fn();
const claimsCalls = vi.fn();
let claimsError: Error | null = null;
let serverError: Error | null = null;
let claims: { sub: string } | null = null;
let serverUser: { id: string; email: string } | null = null;
// auth-js reports most failures by returning `{ error }` instead of throwing.
let claimsReturnedError: AuthError | null = null;
let serverReturnedError: AuthError | null = null;
// When set, each session check writes a refreshed session through `cookies.setAll`, as the real client does.
let rotatesSession = false;

const ROTATED_COOKIE_VALUE = "rotated-secret-value";
const ROTATED_COOKIE = {
  name: "sb-test-auth",
  value: ROTATED_COOKIE_VALUE,
  options: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 400 },
};
// Sent by the browser but never written by the client: it must not be echoed back on a redirect.
const INCOMING_COOKIE_VALUE = "incoming-value";

type CookieWriter = { cookies: { setAll: (cookies: (typeof ROTATED_COOKIE)[]) => void } };

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: CookieWriter) => ({
    auth: {
      getClaims: async () => {
        claimsCalls();
        if (rotatesSession) options.cookies.setAll([ROTATED_COOKIE]);
        if (claimsError) throw claimsError;
        return { data: claims ? { claims } : null, error: claimsReturnedError };
      },
      getUser: async () => {
        authServerCalls();
        if (rotatesSession) options.cookies.setAll([ROTATED_COOKIE]);
        if (serverError) throw serverError;
        return { data: { user: serverUser }, error: serverReturnedError };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { role: "manager", member_id: null }, error: null }) }),
      }),
    }),
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

// React's server build memoises `cache()` per request; plain Node has no request, so emulate it
// (one module registry per test = one request). This proves the proxy/`cache()` wiring, not a real page render.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
    let result: unknown;
    let called = false;
    return ((...args: never[]) => {
      if (!called) {
        called = true;
        result = fn(...args);
      }
      return result;
    }) as T;
  },
}));

function request(path: string, init?: { method?: string; headers?: Record<string, string> }) {
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

const redirectPath = (response: Response) => new URL(response.headers.get("location")!).pathname;

async function loadModules() {
  vi.resetModules();
  const { updateSession } = await import("@/lib/supabase/proxy");
  const { getCurrentUser } = await import("@/features/auth/queries");
  return { updateSession, getCurrentUser };
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  claimsReturnedError = null;
  serverReturnedError = null;
  rotatesSession = false;
  authServerCalls.mockClear();
  claimsCalls.mockClear();
  claimsError = null;
  serverError = null;
  claims = { sub: "user-1" };
  serverUser = { id: "user-1", email: "manager@certtracker.test" };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("auth round trips per navigation", () => {
  it("contacts the Supabase Auth server once for proxy + layout + page", async () => {
    const { updateSession, getCurrentUser } = await loadModules();

    const response = await updateSession(request("/members"));
    expect(response.headers.get("location")).toBeNull(); // let through
    const layoutUser = await getCurrentUser();
    const pageUser = await getCurrentUser();

    expect(layoutUser?.id).toBe("user-1");
    expect(pageUser).toBe(layoutUser);
    expect(authServerCalls).toHaveBeenCalledTimes(1);
  });

  it("keeps server-side verification: a session the Auth server rejects yields no user", async () => {
    serverUser = null; // e.g. signed out on another device; the JWT itself still verifies locally
    const { getCurrentUser } = await loadModules();

    expect(await getCurrentUser()).toBeNull();
    expect(authServerCalls).toHaveBeenCalledTimes(1);
  });
});

describe("proxy", () => {
  it("redirects a page request without a verifiable session to /login", async () => {
    claims = null;
    serverUser = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members"));

    expect(redirectPath(response)).toBe("/login");
  });

  it("treats a getClaims() that throws (crafted cookie) as signed out, not a 500", async () => {
    claimsError = new Error("malformed cookie");
    serverUser = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members"));

    expect(redirectPath(response)).toBe("/login");
  });

  it.each([
    ["throws", () => (claimsError = new Error("JWKS unreachable"))],
    ["finds no claims", () => (claims = null)],
  ])("lets a valid session through when getClaims() %s: no /login <-> /dashboard loop", async (_name, breakClaims) => {
    breakClaims();
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
    expect(authServerCalls).toHaveBeenCalledTimes(1);
  });

  it("treats a getUser() that throws as signed out, not a 500", async () => {
    serverError = new Error("network down");
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members", { method: "POST" }));

    expect(redirectPath(response)).toBe("/login");
  });

  it("sends a user the Auth server confirms away from /login", async () => {
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/login"));

    expect(redirectPath(response)).toBe("/dashboard");
    expect(authServerCalls).toHaveBeenCalledTimes(1);
  });

  it("serves /login when the JWT still verifies but the server revoked the session (no redirect loop)", async () => {
    serverUser = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/login"));

    expect(response.headers.get("location")).toBeNull();
    expect(authServerCalls).toHaveBeenCalledTimes(1);
  });

  it("checks a GET page navigation locally: the Auth server is left to the layout", async () => {
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
    expect(claimsCalls).toHaveBeenCalledTimes(1);
    expect(authServerCalls).not.toHaveBeenCalled();
  });

  it("keeps the authoritative check for a Server Action POST", async () => {
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members", { method: "POST", headers: { "next-action": "abc123" } }));

    expect(response.headers.get("location")).toBeNull();
    expect(authServerCalls).toHaveBeenCalledTimes(1);
    expect(claimsCalls).not.toHaveBeenCalled();
  });

  it("rejects a Server Action POST from a revoked session", async () => {
    serverUser = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members", { method: "POST", headers: { "next-action": "abc123" } }));

    expect(redirectPath(response)).toBe("/login");
  });

  it("keeps the authoritative check for API routes", async () => {
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/api/records/00000000-0000-0000-0000-000000000001/evidence"));

    expect(response.headers.get("location")).toBeNull();
    expect(authServerCalls).toHaveBeenCalledTimes(1);
    expect(claimsCalls).not.toHaveBeenCalled();
  });

  it("rejects an API request from a revoked session", async () => {
    serverUser = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/api/export/records"));

    expect(redirectPath(response)).toBe("/login");
  });

  it.each([["signed out", null], ["signed in", { sub: "user-1" }]])(
    "leaves /set-password alone for a %s visitor: the one-time token in the link authenticates it",
    async (_name, session) => {
      claims = session;
      serverUser = session && { id: "user-1", email: "manager@certtracker.test" };
      const { updateSession } = await loadModules();

      const response = await updateSession(request("/set-password?token_hash=abc&type=invite"));

      expect(response.headers.get("location")).toBeNull();
      expect(authServerCalls).not.toHaveBeenCalled();
      expect(claimsCalls).not.toHaveBeenCalled();
    },
  );

  it("skips auth entirely for cron routes", async () => {
    claims = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/api/cron/expiry-alerts"));

    expect(response.headers.get("location")).toBeNull();
    expect(authServerCalls).not.toHaveBeenCalled();
    expect(claimsCalls).not.toHaveBeenCalled();
  });
});

const signedOutVisit = () => {
  claims = null;
  serverUser = null;
  return "/dashboard";
};
const signedInLoginVisit = () => "/login";

describe("proxy redirects keep a refreshed session", () => {
  it.each([
    ["to /login", signedOutVisit, "/login"],
    ["away from /login", signedInLoginVisit, "/dashboard"],
  ])("carries the refreshed session cookie with its options on the redirect %s", async (_name, visit, target) => {
    rotatesSession = true;
    const path = visit();
    const { updateSession } = await loadModules();

    const response = await updateSession(request(path));
    const setCookie = response.headers.get("set-cookie");

    expect(redirectPath(response)).toBe(target);
    expect(setCookie).toContain(`sb-test-auth=${ROTATED_COOKIE_VALUE}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=400");
  });

  it.each([
    ["to /login", signedOutVisit],
    ["away from /login", signedInLoginVisit],
  ])("does not echo the request's own cookies on the redirect %s", async (_name, visit) => {
    rotatesSession = true;
    const path = visit();
    const { updateSession } = await loadModules();

    const response = await updateSession(request(path, { headers: { cookie: `sb-other=${INCOMING_COOKIE_VALUE}` } }));

    expect(response.headers.get("set-cookie")).not.toContain(INCOMING_COOKIE_VALUE);
  });
});

describe("proxy logs auth failures", () => {
  const ACCESS_TOKEN = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.c2lnbmF0dXJl";

  it.each([
    ["thrown", () => (serverError = new Error("network down"))],
    ["returned as a retryable fetch error", () => (serverReturnedError = new AuthRetryableFetchError("fetch failed", 0))],
  ])("logs an Auth server failure %s exactly once", async (_name, breakServer) => {
    claims = null;
    serverUser = null;
    breakServer();
    const { updateSession } = await loadModules();

    await updateSession(request("/members"));

    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["thrown", () => (serverError = new Error("network down"))],
    ["returned as a retryable fetch error", () => (serverReturnedError = new AuthRetryableFetchError("fetch failed", 0))],
  ])("still treats a page request as signed out when the Auth server failure is %s", async (_name, breakServer) => {
    claims = null;
    serverUser = null;
    breakServer();
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members"));

    expect(redirectPath(response)).toBe("/login");
  });

  it("does not log a visitor who simply has no session", async () => {
    claims = null;
    serverUser = null;
    claimsReturnedError = new AuthSessionMissingError();
    serverReturnedError = new AuthSessionMissingError();
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members"));

    expect(redirectPath(response)).toBe("/login");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("never logs a session cookie or a token", async () => {
    rotatesSession = true;
    claims = null;
    serverUser = null;
    serverError = new Error("network down");
    const { updateSession } = await loadModules();

    await updateSession(request("/members", { headers: { cookie: `sb-test-auth-token=${ACCESS_TOKEN}` } }));
    const logged = inspect(consoleError.mock.calls, { depth: Infinity });

    expect(consoleError).toHaveBeenCalled(); // otherwise the checks below pass vacuously
    expect(logged).not.toContain(ROTATED_COOKIE_VALUE);
    expect(logged).not.toContain(ACCESS_TOKEN);
  });

  it.each([
    ["thrown", () => (claimsError = new Error("JWKS unreachable"))],
    ["returned as a retryable fetch error", () => (claimsReturnedError = new AuthRetryableFetchError("JWKS unreachable", 0))],
  ])("logs a local session check failure %s exactly once, with its error", async (_name, breakClaims) => {
    claims = null;
    breakClaims();
    const { updateSession } = await loadModules();

    await updateSession(request("/dashboard"));

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(inspect(consoleError.mock.calls)).toContain("JWKS unreachable");
  });

  it("does not log a local session check that finds no session", async () => {
    claims = null;
    claimsReturnedError = new AuthSessionMissingError();
    const { updateSession } = await loadModules();

    await updateSession(request("/dashboard"));

    expect(consoleError).not.toHaveBeenCalled();
  });
});
