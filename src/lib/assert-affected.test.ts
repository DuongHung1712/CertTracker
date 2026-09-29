import { describe, expect, it } from "vitest";
import { assertAffected } from "@/lib/assert-affected";

describe("assertAffected", () => {
  it("returns null (no error) when at least one row was affected", () => {
    expect(assertAffected([{ id: "1" }])).toBeNull();
  });

  it("returns an error when RLS silently discarded the write (empty array)", () => {
    const result = assertAffected([]);
    expect(result?.ok).toBe(false);
    if (!result?.ok) expect(result?.error).toContain("không có quyền");
  });

  it("returns an error when data is null", () => {
    const result = assertAffected(null);
    expect(result?.ok).toBe(false);
  });
});
