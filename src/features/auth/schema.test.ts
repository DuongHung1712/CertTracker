import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/schema";

describe("loginSchema", () => {
  it("accepts a valid email and password and trims the email", () => {
    const result = loginSchema.safeParse({ email: "  admin@certtracker.test ", password: "secret" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("admin@certtracker.test");
  });

  it("rejects an invalid email with a Vietnamese message", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email không hợp lệ");
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "admin@certtracker.test", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Vui lòng nhập mật khẩu");
  });
});
