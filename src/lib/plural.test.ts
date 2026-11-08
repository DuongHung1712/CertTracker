import { describe, expect, it } from "vitest";
import { daysLeftLabel, pluralize } from "@/lib/plural";

describe("[copy] daysLeftLabel", () => {
  it("says today on the expiry day", () => {
    expect(daysLeftLabel(0)).toBe("Expires today");
  });

  it("uses the singular for one day and the plural above", () => {
    expect(daysLeftLabel(1)).toBe("1 day left");
    expect(daysLeftLabel(2)).toBe("2 days left");
    expect(daysLeftLabel(45)).toBe("45 days left");
  });

  it("counts days since expiry for a negative number", () => {
    expect(daysLeftLabel(-1)).toBe("Expired 1 day ago");
    expect(daysLeftLabel(-5)).toBe("Expired 5 days ago");
  });
});

describe("pluralize", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralize(1, "day")).toBe("1 day");
  });

  it("uses the plural for zero and for more than one", () => {
    expect(pluralize(0, "day")).toBe("0 days");
    expect(pluralize(2, "day")).toBe("2 days");
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(1, "box", "boxes")).toBe("1 box");
    expect(pluralize(3, "box", "boxes")).toBe("3 boxes");
  });

  it("keeps multi-word nouns intact", () => {
    expect(pluralize(2, "certificate type")).toBe("2 certificate types");
  });
});
