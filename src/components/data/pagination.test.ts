import { describe, expect, it } from "vitest";
import { pageRangeLabel } from "@/components/data/pagination";

describe("pageRangeLabel", () => {
  it("shows the visible range and total", () => {
    expect(pageRangeLabel(0, 25, 42)).toBe("1–25 / 42");
    expect(pageRangeLabel(1, 25, 42)).toBe("26–42 / 42");
  });

  it("handles an empty table", () => {
    expect(pageRangeLabel(0, 25, 0)).toBe("0 kết quả");
  });
});
