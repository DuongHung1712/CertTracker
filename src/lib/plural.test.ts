import { describe, expect, it } from "vitest";
import { pluralize } from "@/lib/plural";

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
