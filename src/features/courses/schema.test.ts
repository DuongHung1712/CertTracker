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
    costCurrency: "USD" as const,
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
      costCurrency: null,
      estHours: null,
      url: "",
    });
    expect(result.success).toBe(true);
  });

  it("treats an empty cost from the form as no cost", () => {
    const result = courseSchema.safeParse({ ...base, cost: "", costCurrency: null });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ cost: null, costCurrency: null });
  });

  it("asks for a currency when a cost is entered without one", () => {
    const result = courseSchema.safeParse({ ...base, cost: 150, costCurrency: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["costCurrency", "Choose a currency for the cost"],
    ]);
  });

  it("asks for a cost or no currency when a currency is chosen without a cost", () => {
    const result = courseSchema.safeParse({ ...base, cost: "", costCurrency: "VND" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["cost", "Enter a cost or clear the currency"],
    ]);
  });

  it("accepts a zero cost with a currency and rejects other currencies", () => {
    expect(courseSchema.safeParse({ ...base, cost: 0, costCurrency: "VND" }).success).toBe(true);
    expect(courseSchema.safeParse({ ...base, costCurrency: "EUR" }).success).toBe(false);
  });

  it("rejects a non-positive validityMonths", () => {
    expect(courseSchema.safeParse({ ...base, validityMonths: 0 }).success).toBe(false);
  });

  it("rejects an invalid url", () => {
    expect(courseSchema.safeParse({ ...base, url: "not a url" }).success).toBe(false);
  });
});
