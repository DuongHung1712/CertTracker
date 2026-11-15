import { describe, expect, it } from "vitest";
import { formatPreparedBy } from "@/features/certificates/schema";

describe("formatPreparedBy", () => {
  it("shows a dash when no course prepares for the exam", () => expect(formatPreparedBy([])).toBe("—"));
  it("lists up to two names", () => expect(formatPreparedBy(["A", "B"])).toBe("A, B"));
  it("collapses the rest into +N more", () => expect(formatPreparedBy(["A", "B", "C", "D"])).toBe("A, B +2 more"));
});
