import { describe, expect, it } from "vitest";
import { formatDate, formatDateTimeVn, formatNumber, formatPercent, formatVnd } from "@/lib/format";

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

  it("formats a timestamp in Vietnam time", () => {
    expect(formatDateTimeVn("2026-09-30T17:05:00Z")).toBe("01/10/2026 00:05");
    expect(formatDateTimeVn("2026-10-01T04:30:00+00:00")).toBe("01/10/2026 11:30");
  });

  it("never renders midnight as 24:00", () => {
    expect(formatDateTimeVn("2026-09-30T17:00:00Z")).toBe("01/10/2026 00:00");
  });

  it("rejects an unparseable timestamp", () => {
    expect(() => formatDateTimeVn("not a date")).toThrow("Invalid timestamp");
  });
});
