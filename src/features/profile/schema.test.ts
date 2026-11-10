import { describe, expect, it } from "vitest";
import { profileNameSchema } from "@/features/profile/schema";

describe("profileNameSchema", () => {
  it("trims the name", () => {
    expect(profileNameSchema.parse({ fullName: "  An Nguyen  " })).toEqual({ fullName: "An Nguyen" });
  });
  it("rejects an empty or blank name", () => {
    for (const fullName of ["", "   "]) {
      const r = profileNameSchema.safeParse({ fullName });
      expect(r.success ? null : r.error.issues[0]?.message).toBe("Enter your name");
    }
  });
  it("accepts 200 characters and rejects 201", () => {
    expect(profileNameSchema.safeParse({ fullName: "x".repeat(200) }).success).toBe(true);
    const r = profileNameSchema.safeParse({ fullName: "x".repeat(201) });
    expect(r.success ? null : r.error.issues[0]?.message).toBe("Name can have at most 200 characters");
  });
});
