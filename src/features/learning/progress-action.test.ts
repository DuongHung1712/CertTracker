import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const neq = vi.fn();
let reply: { data: { id: string }[] | null; error: { code?: string; message: string } | null } = { data: [{ id: "x" }], error: null };
const from = vi.fn(() => ({
  update: (row: unknown) => {
    update(row);
    return {
      eq: () => ({
        neq: (column: string, value: string) => {
          neq(column, value);
          return { select: async () => reply };
        },
      }),
    };
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { updateLearningProgress } = await import("@/features/learning/actions");
const ID = "5eed0000-0000-0000-0000-0000000000a1";

describe("updateLearningProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reply = { data: [{ id: "x" }], error: null };
  });

  it("moves an open item to In progress at the new value, and never touches a finished one", async () => {
    expect(await updateLearningProgress({ id: ID, progress: 40 })).toEqual({ ok: true, data: null });
    expect(update).toHaveBeenCalledWith({ status: "in_progress", progress: 40 });
    expect(neq).toHaveBeenCalledWith("status", "done");
  });

  it("refuses 100% and 0%: finishing needs a date and goes through the form", async () => {
    for (const progress of [100, 0, -5, 12.5]) {
      expect((await updateLearningProgress({ id: ID, progress })).ok).toBe(false);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("refuses a malformed id before calling the database", async () => {
    expect((await updateLearningProgress({ id: "nope", progress: 20 })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("says so when no row changed (a finished or deleted item, or one that is not yours)", async () => {
    reply = { data: [], error: null };
    expect((await updateLearningProgress({ id: ID, progress: 20 })).ok).toBe(false);
  });
});
