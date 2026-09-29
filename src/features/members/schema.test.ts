import { describe, expect, it } from "vitest";
import { memberSchema } from "@/features/members/schema";

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

  it("defaults isActive to true when omitted", () => {
    const result = memberSchema.safeParse({
      fullName: "An",
      email: "an@certtracker.test",
      teamId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.data?.isActive).toBe(true);
  });
});
