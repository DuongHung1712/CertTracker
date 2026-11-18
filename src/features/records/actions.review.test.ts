import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewRecord } from "@/features/records/actions";

const ID = "5eed0000-0000-0000-0000-00000000c001";
const update = vi.fn();
const statusFilter = vi.fn();
let result: { data: unknown[] | null; error: { code: string; message: string } | null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq: () => ({ eq: (column: string, value: string) => { statusFilter(column, value); return { select: async () => result }; } }) };
      },
    }),
  }),
}));

beforeEach(() => {
  update.mockClear();
  statusFilter.mockClear();
  result = { data: [{ id: ID }], error: null };
});

describe("reviewRecord", () => {
  it("approve sets only the approval and ignores a note", async () => {
    expect(await reviewRecord({ id: ID, decision: "approve", note: "ignored" })).toEqual({ ok: true, data: null });
    expect(update).toHaveBeenCalledWith({ approval: "approved" });
  });

  it("return stores the trimmed note", async () => {
    expect((await reviewRecord({ id: ID, decision: "return", note: "  Wrong date  " })).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ approval: "returned", approval_note: "Wrong date" });
  });

  it("return without a note never reaches the database", async () => {
    for (const note of [undefined, "   "]) {
      const r = await reviewRecord({ id: ID, decision: "return", note });
      expect(r).toEqual({ ok: false, error: "Write what the member should fix." });
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("maps 42501 and 23514 to readable messages", async () => {
    result = { data: null, error: { code: "42501", message: "x" } };
    expect(await reviewRecord({ id: ID, decision: "approve" })).toEqual({ ok: false, error: "Only the member's manager or an admin can approve this." });
    result = { data: null, error: { code: "23514", message: "x" } };
    expect(await reviewRecord({ id: ID, decision: "return", note: "n" })).toEqual({ ok: false, error: "Write what the member should fix." });
  });

  it("only touches a Completed row, and says so when none matched", async () => {
    expect((await reviewRecord({ id: ID, decision: "approve" })).ok).toBe(true);
    expect(statusFilter).toHaveBeenCalledWith("status", "done");
    result = { data: [], error: null };
    expect(await reviewRecord({ id: ID, decision: "approve" })).toEqual({
      ok: false,
      error: "Only a Completed item can be approved or returned. Refresh and try again.",
    });
  });
});
