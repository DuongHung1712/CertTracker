import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/schema";

describe("loginSchema", () => {
  it("accepts a valid email and password and trims the email", () => {
    const result = loginSchema.safeParse({ email: "  admin@certtracker.test ", password: "secret" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("admin@certtracker.test");
  });

  it("rejects an invalid email with a message", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid e-mail address");
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "admin@certtracker.test", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your password");
  });
});
