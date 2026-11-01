import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// One page navigation = the proxy (`updateSession`) + the layout and the page, both calling
// `getCurrentUser()`. Only calls that contact the Supabase Auth server are counted: `getUser()`
// always does; `getClaims()` verifies an ES256/RS256 JWT locally against the cached JWKS (the
// mock below models such a project, like the local stack).
const authServerCalls = vi.fn();
let claims: { sub: string } | null = null;
let serverUser: { id: string; email: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: claims ? { claims } : null, error: null }),
      getUser: async () => {
        authServerCalls();
        return { data: { user: serverUser }, error: null };
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
// (one module registry per test = one request).
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

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

async function loadModules() {
  vi.resetModules();
  const { updateSession } = await import("@/lib/supabase/proxy");
  const { getCurrentUser } = await import("@/features/auth/queries");
  return { updateSession, getCurrentUser };
}

beforeEach(() => {
  authServerCalls.mockClear();
  claims = { sub: "user-1" };
  serverUser = { id: "user-1", email: "manager@certtracker.test" };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
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
  it("redirects a request without a verifiable session to /login", async () => {
    claims = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/members"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("sends a signed-in user away from /login", async () => {
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/login"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("does not contact the Auth server for a session check on its own", async () => {
    const { updateSession } = await loadModules();

    await updateSession(request("/records"));

    expect(authServerCalls).not.toHaveBeenCalled();
  });

  it("skips auth entirely for cron routes", async () => {
    claims = null;
    const { updateSession } = await loadModules();

    const response = await updateSession(request("/api/cron/expiry-alerts"));

    expect(response.headers.get("location")).toBeNull();
    expect(authServerCalls).not.toHaveBeenCalled();
  });
});
