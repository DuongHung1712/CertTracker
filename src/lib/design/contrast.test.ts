import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "@/lib/design/contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("is 1 for identical colours and symmetric", () => {
    expect(contrastRatio("#0E5C58", "#0E5C58")).toBe(1);
    expect(contrastRatio("#15212B", "#F6F7F5")).toBeCloseTo(contrastRatio("#F6F7F5", "#15212B"), 10);
  });

  it("rejects values that are not #rrggbb", () => {
    expect(() => relativeLuminance("oklch(1 0 0)")).toThrow("Expected #rrggbb");
  });
});
