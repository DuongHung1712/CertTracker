import { describe, expect, it } from "vitest";
import { certTypeSchema, courseSchema, providerSchema } from "@/features/courses/schema";

describe("certTypeSchema / providerSchema", () => {
  it("both require a non-empty trimmed name", () => {
    expect(certTypeSchema.safeParse({ name: "  Cloud  " }).data).toEqual({ name: "Cloud" });
    expect(providerSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("courseSchema", () => {
  const base = {
    name: "AWS Solutions Architect Associate",
    certTypeId: "00000000-0000-0000-0000-000000000000",
    providerId: "00000000-0000-0000-0000-000000000000",
    level: "Associate",
    validityMonths: 36,
    refundable: true,
    cost: 150,
    estHours: 40,
    url: "https://aws.amazon.com/certification/",
  };

  it("accepts a fully filled course", () => {
    expect(courseSchema.safeParse(base).success).toBe(true);
  });

  it("allows validityMonths, cost, estHours, url and level to be empty (No Expiry course, no known cost)", () => {
    const result = courseSchema.safeParse({
      ...base,
      level: "",
      validityMonths: null,
      cost: null,
      estHours: null,
      url: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive validityMonths", () => {
    expect(courseSchema.safeParse({ ...base, validityMonths: 0 }).success).toBe(false);
  });

  it("rejects an invalid url", () => {
    expect(courseSchema.safeParse({ ...base, url: "not a url" }).success).toBe(false);
  });
});
