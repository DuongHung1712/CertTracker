import { describe, expect, it } from "vitest";
import { dcSchema, programSchema, teamSchema } from "@/features/organizations/schema";

describe("dcSchema", () => {
  it("trims the name and rejects an empty one", () => {
    expect(dcSchema.safeParse({ name: "  DC34  " }).data).toEqual({ name: "DC34" });
    expect(dcSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("programSchema", () => {
  it("requires a name and a DC", () => {
    const result = programSchema.safeParse({ name: "Digital Delivery", dcId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid program", () => {
    const result = programSchema.safeParse({
      name: "Digital Delivery",
      dcId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(true);
  });
});

describe("teamSchema", () => {
  it("requires a name and a program", () => {
    expect(teamSchema.safeParse({ name: "", programId: "00000000-0000-0000-0000-000000000000" }).success).toBe(
      false,
    );
  });
});
