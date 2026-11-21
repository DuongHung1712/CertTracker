import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRecords } from "@/features/records/actions";

const ID_A = "5eed0000-0000-0000-0000-00000000c001";
const ID_B = "5eed0000-0000-0000-0000-00000000c002";
const inFilter = vi.fn();
const remove = vi.fn(async () => ({ error: null }));
let result: { data: unknown[] | null; error: { code: string; message: string } | null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      delete: () => ({
        in: (...args: unknown[]) => {
          inFilter(...args);
          return { select: async () => result };
        },
      }),
    }),
    storage: { from: () => ({ remove }) },
  }),
}));

beforeEach(() => {
  inFilter.mockClear();
  remove.mockClear();
  result = { data: [{ id: ID_A, evidence_path: "m/a.pdf" }, { id: ID_B, evidence_path: null }], error: null };
});

describe("deleteRecords", () => {
  it("deletes the ids, removes only existing evidence files and reports how many rows went", async () => {
    expect(await deleteRecords({ ids: [ID_A, ID_B] })).toEqual({ ok: true, data: { count: 2 } });
    expect(inFilter).toHaveBeenCalledWith("id", [ID_A, ID_B]);
    expect(remove).toHaveBeenCalledWith(["m/a.pdf"]);
  });

  it("rejects an empty list, a bad id, repeated ids and an oversized list before touching the database", async () => {
    const distinct = (n: number) => Array.from({ length: n }, (_, i) => `5eed0000-0000-0000-0000-${String(i).padStart(12, "0")}`);
    for (const ids of [[], ["nope"], [ID_A, ID_A], distinct(101)]) {
      expect(await deleteRecords({ ids })).toEqual({ ok: false, error: "Invalid data" });
    }
    expect(inFilter).not.toHaveBeenCalled();
  });

  it("accepts 100 distinct ids", async () => {
    expect((await deleteRecords({ ids: Array.from({ length: 100 }, (_, i) => `5eed0000-0000-0000-0000-${String(i).padStart(12, "0")}`) })).ok).toBe(true);
  });

  it("fails when RLS leaves nothing to delete", async () => {
    result = { data: [], error: null };
    expect((await deleteRecords({ ids: [ID_A] })).ok).toBe(false);
  });
});
