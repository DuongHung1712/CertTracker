import { describe, expect, it } from "vitest";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

const source = Array.from({ length: 1250 }, (_, i) => i);
const page = (from: number, to: number) => Promise.resolve({ data: source.slice(from, to + 1), error: null });

describe("fetchAllRows", () => {
  it("keeps requesting pages until a short page arrives", async () => {
    expect(await fetchAllRows(page, 500)).toHaveLength(1250);
  });

  it("stops after an empty page when the total is an exact multiple of the page size", async () => {
    const calls: number[] = [];
    const exact = (from: number, to: number) => {
      calls.push(from);
      return Promise.resolve({ data: source.slice(0, 1000).slice(from, to + 1), error: null });
    };
    expect(await fetchAllRows(exact, 500)).toHaveLength(1000);
    expect(calls).toEqual([0, 500, 1000]);
  });

  it("throws the query error", async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });

  it("never exceeds maxRows", async () => {
    // 750 is not a multiple of the page size: the second page must be clamped from 500 rows to 250.
    expect(await fetchAllRows(page, 500, 750)).toHaveLength(750);
    expect(await fetchAllRows(page, 500, 1000)).toHaveLength(1000);
  });
});
