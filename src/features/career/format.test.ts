import { describe, expect, it } from "vitest";
import { formatCareerStart, formatYoe } from "@/features/career/format";

describe("formatYoe", () => {
  it("writes half years with a decimal and the plural", () => {
    expect(formatYoe(3.5)).toBe("3.5 years");
    expect(formatYoe(0.5)).toBe("0.5 years");
  });
  it("uses the singular for exactly one year", () => {
    expect(formatYoe(1)).toBe("1 year");
  });
  it("writes whole years without a decimal", () => {
    expect(formatYoe(3)).toBe("3 years");
  });
  it("writes zero years", () => {
    expect(formatYoe(0)).toBe("0 years");
  });
  it("says Not set without a career start", () => {
    expect(formatYoe(null)).toBe("Not set");
  });
});

describe("formatCareerStart", () => {
  it("writes month and year", () => {
    expect(formatCareerStart("2020-03-01")).toBe("March 2020");
    expect(formatCareerStart("1999-12-01")).toBe("December 1999");
  });
  it("says Not set without a date", () => {
    expect(formatCareerStart(null)).toBe("Not set");
  });
});
