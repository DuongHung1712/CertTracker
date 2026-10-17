import { describe, expect, it } from "vitest";
import { isoWeekKey, monthLabel, monthRange, previousMonthKey, weekLabel } from "@/features/notifications/period";

describe("isoWeekKey", () => {
  it.each([
    ["2026-10-05", "2026-W41"], // Monday
    ["2026-10-11", "2026-W41"], // Sunday of the same week
    ["2026-12-31", "2026-W53"], // 2026 starts on a Thursday: 53 weeks
    ["2027-01-01", "2026-W53"], // Friday still belongs to the old ISO year
    ["2024-12-30", "2025-W01"], // Monday of the week holding 2025's first Thursday
    ["2021-01-03", "2020-W53"],
    ["2026-01-01", "2026-W01"],
  ])("%s -> %s", (date, key) => {
    expect(isoWeekKey(date)).toBe(key);
  });

  it("rejects dates that do not exist or are malformed instead of rolling over", () => {
    expect(() => isoWeekKey("2026-02-30")).toThrow();
    expect(() => isoWeekKey("26-10-05")).toThrow();
    expect(() => isoWeekKey("")).toThrow();
  });
});

describe("previousMonthKey", () => {
  it.each([
    ["2026-10-01", "2026-09"],
    ["2026-01-01", "2025-12"],
    ["2026-03-31", "2026-02"],
  ])("%s -> %s", (today, key) => {
    expect(previousMonthKey(today)).toBe(key);
  });
});

describe("monthRange", () => {
  it("returns the first and last day, leap years included", () => {
    expect(monthRange("2026-09")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
  it("rejects a malformed or impossible month", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("2026-9")).toThrow();
    expect(() => monthRange("2026-00")).toThrow();
  });
});

describe("labels", () => {
  it("formats Vietnamese labels", () => {
    expect(weekLabel("2026-W41")).toBe("tuần 41/2026");
    expect(monthLabel("2026-09")).toBe("tháng 09/2026");
  });
  it("rejects malformed keys", () => {
    expect(() => weekLabel("2026-41")).toThrow();
    expect(() => monthLabel("2026-9")).toThrow();
  });
});
