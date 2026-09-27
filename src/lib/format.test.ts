import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatPercent, formatVnd } from "@/lib/format";

describe("format", () => {
  it("formats ISO dates as dd/MM/yyyy", () => {
    expect(formatDate("2026-10-19")).toBe("19/10/2026");
  });

  it("rejects non-ISO dates", () => {
    expect(() => formatDate("19/10/2026")).toThrow("Expected YYYY-MM-DD");
  });

  it("formats VND with Vietnamese grouping", () => {
    expect(formatVnd(1250000)).toBe("1.250.000 ₫");
  });

  it("formats plain numbers and percents", () => {
    expect(formatNumber(1250000)).toBe("1.250.000");
    expect(formatPercent(74.6)).toBe("75%");
  });
});
