import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { changePasswordSchema, firstChangePasswordIssue, loginSchema, setPasswordSchema } from "@/features/auth/schema";

describe("loginSchema", () => {
  it("accepts a valid email and password and trims the email", () => {
    const result = loginSchema.safeParse({ email: "  admin@certtracker.test ", password: "secret" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("admin@certtracker.test");
  });

  it("rejects an invalid email with a message", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid email address");
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "admin@certtracker.test", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your password");
  });
});

describe("setPasswordSchema", () => {
  const valid = { tokenHash: "abc", type: "invite", password: "long-enough", confirmPassword: "long-enough" };

  it.each(["invite", "recovery"])("accepts a %s link", (type) => {
    expect(setPasswordSchema.safeParse({ ...valid, type }).success).toBe(true);
  });

  it("rejects any other link type", () => {
    expect(setPasswordSchema.safeParse({ ...valid, type: "magiclink" }).success).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(setPasswordSchema.safeParse({ ...valid, tokenHash: "" }).success).toBe(false);
  });

  it("rejects a short password with a message", () => {
    const result = setPasswordSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(result.error?.issues[0]?.message).toBe("Use at least 8 characters");
  });

  it("rejects two different passwords on the confirm field", () => {
    const result = setPasswordSchema.safeParse({ ...valid, confirmPassword: "something-else" });
    expect(result.error?.issues[0]?.message).toBe("The two passwords do not match");
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "old-secret", password: "long-enough", confirmPassword: "long-enough" };

  it("accepts a valid triple", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty current password", () => {
    const result = changePasswordSchema.safeParse({ ...valid, currentPassword: "" });
    expect(result.error?.issues[0]?.message).toBe("Enter your current password");
  });

  it("rejects a 7-character new password", () => {
    const result = changePasswordSchema.safeParse({ ...valid, password: "1234567", confirmPassword: "1234567" });
    expect(result.error?.issues[0]?.message).toBe("Use at least 8 characters");
  });

  it("rejects two different passwords on the confirm field", () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: "something-else" });
    expect(result.error?.issues[0]?.message).toBe("The two passwords do not match");
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("account e-mail templates", () => {
  // Paste these into Supabase Dashboard > Authentication > Email Templates; the page only accepts this link shape.
  it.each(["invite", "recovery"])("%s links to /set-password with the one-time token", (type) => {
    const html = readFileSync(`supabase/templates/${type}.html`, "utf8");
    expect(html).toContain(`{{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&amp;type=${type}`);
  });
});

describe("firstChangePasswordIssue", () => {
  const base = { currentPassword: "old-password", password: "long-enough", confirmPassword: "long-enough" };
  const issueFor = (input: Record<string, string>) => {
    const parsed = changePasswordSchema.safeParse(input);
    if (parsed.success) throw new Error("expected the form to be rejected");
    return firstChangePasswordIssue(parsed.error);
  };

  it("puts a too-short new password on the new password field only", () => {
    expect(issueFor({ ...base, password: "short", confirmPassword: "short" })).toEqual({ message: "Use at least 8 characters", field: "password" });
  });

  it("puts a mismatch on the confirmation field only", () => {
    expect(issueFor({ ...base, confirmPassword: "something-else" })).toEqual({ message: "The two passwords do not match", field: "confirmPassword" });
  });

  it("puts a missing current password on the current password field", () => {
    expect(issueFor({ ...base, currentPassword: "" }).field).toBe("currentPassword");
  });

  it("does not blame the current password when only the new one is wrong", () => {
    expect(issueFor({ ...base, password: "short" }).field).not.toBe("currentPassword");
  });
});
