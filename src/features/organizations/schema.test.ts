import { describe, expect, it } from "vitest";
import { dcSchema, programSchema, removeScopesSchema, scopeManagersSchema, teamSchema } from "@/features/organizations/schema";

describe("dcSchema", () => {
  it("trims the name and rejects an empty one", () => {
    expect(dcSchema.safeParse({ name: "  DC34  " }).data).toEqual({ name: "DC34" });
    expect(dcSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("programSchema", () => {
  it("requires a name and a DC", () => {
    // Not a malformed-uuid check: `dcId` only needs to be non-empty (a real DC was picked in the
    // <Select>) — Postgres's FK constraint is what enforces it's an actual DC id. See the comment
    // on `dcId` in schema.ts.
    const result = programSchema.safeParse({ name: "Digital Delivery", dcId: "" });
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

describe("scopeManagersSchema", () => {
  const id = "00000000-0000-0000-0000-000000000001";

  it("accepts a team or program scope, with or without managers", () => {
    expect(scopeManagersSchema.safeParse({ scope: { kind: "program", id }, userIds: [] }).success).toBe(true);
    expect(scopeManagersSchema.safeParse({ scope: { kind: "team", id }, userIds: [id] }).success).toBe(true);
  });

  it("rejects an unknown scope kind", () => {
    expect(scopeManagersSchema.safeParse({ scope: { kind: "dc", id }, userIds: [] }).success).toBe(false);
  });

  it("rejects a scope id or manager id that is not a guid", () => {
    expect(scopeManagersSchema.safeParse({ scope: { kind: "team", id: "nope" }, userIds: [] }).success).toBe(false);
    expect(scopeManagersSchema.safeParse({ scope: { kind: "team", id }, userIds: ["nope"] }).success).toBe(false);
  });
});

describe("removeScopesSchema", () => {
  it("accepts a user id and rejects anything else", () => {
    expect(removeScopesSchema.safeParse({ userId: "00000000-0000-0000-0000-000000000001" }).success).toBe(true);
    expect(removeScopesSchema.safeParse({ userId: "nope" }).success).toBe(false);
    expect(removeScopesSchema.safeParse({}).success).toBe(false);
  });
});
