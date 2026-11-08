import { describe, expect, it } from "vitest";
import { makeMemberSchema, memberSchema, memberAccessSchema } from "@/features/members/schema";

describe("memberSchema", () => {
  it("requires a name, a valid email and a team", () => {
    const result = memberSchema.safeParse({
      fullName: "Nguyễn Văn An",
      email: "an@certtracker.test",
      teamId: "00000000-0000-0000-0000-000000000000",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      memberSchema.safeParse({
        fullName: "An",
        email: "not-an-email",
        teamId: "00000000-0000-0000-0000-000000000000",
        isActive: true,
      }).success,
    ).toBe(false);
  });

  it("trims the e-mail so it can link to a login", () => {
    const result = memberSchema.parse({
      fullName: "Linh Tran",
      email: "  Linh.Tran@Example.com ",
      teamId: "00000000-0000-0000-0000-000000000000",
      isActive: true,
    });
    expect(result.email).toBe("Linh.Tran@Example.com");
  });

  it("defaults isActive to true when omitted", () => {
    const result = memberSchema.safeParse({
      fullName: "An",
      email: "an@certtracker.test",
      teamId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.data?.isActive).toBe(true);
  });
});

describe("makeMemberSchema", () => {
  const base = { fullName: "An", email: "an@certtracker.test", teamId: "00000000-0000-0000-0000-000000000000" };
  const schema = makeMemberSchema(new Date("2026-10-31T17:30:00Z")); // 1 November in Vietnam

  it("leaves the career fields undefined when the form does not send them (manager)", () => {
    const result = schema.safeParse(base);
    expect(result.success && result.data.careerRoleId).toBeUndefined();
    expect(result.success && result.data.careerStart).toBeUndefined();
  });

  it("accepts a role and a past career start, and null to clear them", () => {
    const roleId = "5eed0000-0000-0000-0000-00000000c001";
    expect(schema.safeParse({ ...base, careerRoleId: roleId, careerStart: { year: 2020, month: 3 } }).success).toBe(true);
    expect(schema.safeParse({ ...base, careerRoleId: null, careerStart: null }).success).toBe(true);
  });

  it("rejects a career start in the future", () => {
    const result = schema.safeParse({ ...base, careerStart: { year: 2026, month: 12 } });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe("Career start cannot be in the future");
  });
});

describe("memberAccessSchema", () => {
  const userId = "5eed0000-0000-0000-0000-00000000f00b";

  it.each(["admin", "manager", "member"])("accepts %s", (role) => {
    expect(memberAccessSchema.safeParse({ userId, role }).success).toBe(true);
  });

  it("rejects an unknown role and a bad id", () => {
    expect(memberAccessSchema.safeParse({ userId, role: "owner" }).success).toBe(false);
    expect(memberAccessSchema.safeParse({ userId: "x", role: "member" }).success).toBe(false);
  });
});
