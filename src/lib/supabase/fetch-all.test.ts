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

  it("throws instead of truncating when more rows exist than maxRows", async () => {
    // 750 is not a multiple of the page size: the second page is clamped from 500 rows to 250, then one probe row exists.
    await expect(fetchAllRows(page, 500, 750)).rejects.toThrow("more than 750 rows");
    await expect(fetchAllRows(page, 500, 1000)).rejects.toThrow("more than 1000 rows");
  });

  it("returns normally when the data ends exactly at maxRows", async () => {
    const exactly = (from: number, to: number) => Promise.resolve({ data: source.slice(0, 1000).slice(from, to + 1), error: null });
    expect(await fetchAllRows(exactly, 500, 1000)).toHaveLength(1000);
    expect(await fetchAllRows(page, 500, 1250)).toHaveLength(1250); // short last page
    expect(await fetchAllRows(page, 500, 5000)).toHaveLength(1250);
  });

  it("throws the query error from the probe request too", async () => {
    const failing = (from: number, to: number) =>
      from >= 1000 ? Promise.resolve({ data: null, error: { message: "probe failed" } }) : page(from, to);
    await expect(fetchAllRows(failing, 500, 1000)).rejects.toThrow("probe failed");
  });
});
