import { beforeEach, describe, expect, it, vi } from "vitest";
import { setPassword } from "@/features/auth/actions";

const verifyOtp = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const redirect = vi.fn();

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, updateUser, signOut } }),
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

  it("signs out, then sends the person to sign in with the new password", async () => {
    await setPassword(null, passwordForm());
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/login?passwordSet=1");
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
