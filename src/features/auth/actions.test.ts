import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, setPassword, signIn } from "@/features/auth/actions";

const verifyOtp = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const redirect = vi.fn();
const signInWithPassword = vi.fn();
const getUser = vi.fn();

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, updateUser, signOut, signInWithPassword, getUser } }),
}));

const LINK_ERROR = "This link has expired or was already used. Ask your admin for a new one.";
const SAVE_ERROR = "We could not save that password. Ask your admin for a new link, then choose a different one.";

function passwordForm(confirmPassword = "correct horse") {
  const form = new FormData();
  form.set("tokenHash", "token-hash");
  form.set("type", "invite");
  form.set("password", "correct horse");
  form.set("confirmPassword", confirmPassword);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { email: "a@certtracker.test" } } });
});

describe("setPassword", () => {
  it("rejects an expired or used link without saving a password or signing out", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    expect(await setPassword(null, passwordForm())).toEqual({ ok: false, error: LINK_ERROR });
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs the person out when saving the new password fails, so the link's session does not stay open", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    expect(await setPassword(null, passwordForm())).toEqual({ ok: false, error: SAVE_ERROR });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs out, then sends the person to sign in with the new password and prefilled email", async () => {
    await setPassword(null, passwordForm());
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/login?passwordSet=1&email=a%40certtracker.test");
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(redirect.mock.invocationCallOrder[0]!);
  });

  it("returns the form error for mismatched passwords and never touches the link", async () => {
    expect(await setPassword(null, passwordForm("something else"))).toEqual({
      ok: false,
      error: "The two passwords do not match",
    });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});

function loginForm(next?: string) {
  const form = new FormData();
  form.set("email", "a@certtracker.test");
  form.set("password", "secret");
  if (next !== undefined) form.set("next", next);
  return form;
}

describe("signIn destination", () => {
  it("goes to the dashboard without a next path", async () => {
    await signIn(null, loginForm());
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns to a safe next path", async () => {
    await signIn(null, loginForm("/records?search=Tran"));
    expect(redirect).toHaveBeenCalledWith("/records?search=Tran");
  });

  it.each(["//evil.com", "https://evil.com", "/login", "/\x5cevil.com"])("ignores the unsafe next path %s", async (next) => {
    await signIn(null, loginForm(next));
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});

describe("changePassword field errors", () => {
  function changeForm(over: Record<string, string> = {}) {
    const form = new FormData();
    const values = { currentPassword: "old-password", password: "long-enough", confirmPassword: "long-enough", ...over };
    for (const [k, v] of Object.entries(values)) form.set(k, v);
    return form;
  }

  it("blames only the new password when it is too short", async () => {
    expect(await changePassword(null, changeForm({ password: "short", confirmPassword: "short" }))).toMatchObject({ ok: false, field: "password" });
  });

  it("blames only the confirmation on a mismatch", async () => {
    expect(await changePassword(null, changeForm({ confirmPassword: "different-one" }))).toMatchObject({ ok: false, field: "confirmPassword" });
  });

  it("blames the current password when the server rejects it", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await changePassword(null, changeForm())).toEqual({ ok: false, error: "The current password is not correct.", field: "currentPassword" });
    expect(updateUser).not.toHaveBeenCalled();
  });
});
