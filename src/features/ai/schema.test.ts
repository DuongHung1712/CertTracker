import { describe, expect, it } from "vitest";
import { aiReaderSettingsSchema, MAX_DAILY_LIMIT } from "@/features/ai/schema";

describe("aiReaderSettingsSchema", () => {
  it("accepts the boundaries 1 and 200 and a numeric string from a form", () => {
    expect(aiReaderSettingsSchema.safeParse({ enabled: true, dailyLimit: 1 }).success).toBe(true);
    expect(aiReaderSettingsSchema.safeParse({ enabled: false, dailyLimit: MAX_DAILY_LIMIT }).success).toBe(true);
    expect(aiReaderSettingsSchema.parse({ enabled: true, dailyLimit: "20" }).dailyLimit).toBe(20);
  });
  it.each([0, 201, 2.5, -3, "abc", ""])("refuses a limit of %j", (dailyLimit) => {
    expect(aiReaderSettingsSchema.safeParse({ enabled: true, dailyLimit }).success).toBe(false);
  });
  it("refuses a missing or non-boolean switch", () => {
    expect(aiReaderSettingsSchema.safeParse({ dailyLimit: 10 }).success).toBe(false);
    expect(aiReaderSettingsSchema.safeParse({ enabled: "yes", dailyLimit: 10 }).success).toBe(false);
  });
});
