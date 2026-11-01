import { describe, expect, it } from "vitest";
import {
  careerStartToDate,
  careerRoleSchema,
  makeCareerStartSchema,
  moveCareerRoleSchema,
} from "@/features/career/schema";

// 1 November 2026 00:30 in Vietnam (UTC+7) while it is still 31 October in UTC.
const NOW = new Date("2026-10-31T17:30:00Z");
const schema = makeCareerStartSchema(NOW);

describe("makeCareerStartSchema", () => {
  it("accepts a year without a month", () => {
    expect(schema.safeParse({ year: 2020, month: null }).success).toBe(true);
  });
  it("accepts a past year and month", () => {
    expect(schema.safeParse({ year: 2020, month: 3 }).success).toBe(true);
  });
  it("coerces form strings", () => {
    const parsed = schema.safeParse({ year: "2020", month: "3" });
    expect(parsed.success && parsed.data).toEqual({ year: 2020, month: 3 });
  });
  it("rejects a year before 1970", () => {
    expect(schema.safeParse({ year: 1969, month: null }).success).toBe(false);
    expect(schema.safeParse({ year: 1970, month: null }).success).toBe(true);
  });
  it("rejects a month outside 1 to 12", () => {
    expect(schema.safeParse({ year: 2020, month: 0 }).success).toBe(false);
    expect(schema.safeParse({ year: 2020, month: 13 }).success).toBe(false);
  });
  it("uses the Vietnam month: 1 November is already November", () => {
    expect(schema.safeParse({ year: 2026, month: 11 }).success).toBe(true);
    const next = schema.safeParse({ year: 2026, month: 12 });
    expect(next.success).toBe(false);
    expect(!next.success && next.error.issues[0]?.message).toBe("Career start can't be in the future");
  });
  it("rejects a future year", () => {
    const result = schema.safeParse({ year: 2027, month: null });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe("Career start can't be in the future");
  });
  it("accepts the current year without a month (stored as January)", () => {
    expect(schema.safeParse({ year: 2026, month: null }).success).toBe(true);
  });
  it("uses the UTC month before Vietnam midnight", () => {
    const before = makeCareerStartSchema(new Date("2026-10-31T16:30:00Z"));
    expect(before.safeParse({ year: 2026, month: 11 }).success).toBe(false);
    expect(before.safeParse({ year: 2026, month: 10 }).success).toBe(true);
  });
});

describe("careerStartToDate", () => {
  it("is the first day of the month", () => {
    expect(careerStartToDate({ year: 2020, month: 3 })).toBe("2020-03-01");
  });
  it("is January when the month is missing", () => {
    expect(careerStartToDate({ year: 2020, month: null })).toBe("2020-01-01");
  });
});

describe("careerRoleSchema", () => {
  it("trims the name and requires it", () => {
    expect(careerRoleSchema.parse({ name: "  Architect " })).toEqual({ name: "Architect" });
    expect(careerRoleSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("moveCareerRoleSchema", () => {
  it("needs an id and a direction", () => {
    const id = "5eed0000-0000-0000-0000-00000000c001";
    expect(moveCareerRoleSchema.safeParse({ id, direction: "up" }).success).toBe(true);
    expect(moveCareerRoleSchema.safeParse({ id, direction: "left" }).success).toBe(false);
  });
});
