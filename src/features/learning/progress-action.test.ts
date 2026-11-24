import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const neq = vi.fn();
let eqs: [string, unknown][] = [];
let reply: { data: { id: string }[] | null; error: { code?: string; message: string } | null } = { data: [{ id: "x" }], error: null };
const from = vi.fn(() => ({
  update: (row: unknown) => {
    update(row);
    return {
      eq: (column: string, value: unknown) => {
        eqs.push([column, value]);
        return {
          eq: (column2: string, value2: unknown) => {
            eqs.push([column2, value2]);
            return {
              neq: (column3: string, value3: string) => {
                neq(column3, value3);
                return { select: async () => reply };
              },
            };
          },
        };
      },
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
    eqs = [];
    reply = { data: [{ id: "x" }], error: null };
  });

  it("moves an open item to In progress at the new value, only from the value the member saw, and never touches a finished one", async () => {
    expect(await updateLearningProgress({ id: ID, progress: 40, from: 30 })).toEqual({ ok: true, data: null });
    expect(update).toHaveBeenCalledWith({ status: "in_progress", progress: 40 });
    expect(eqs).toContainEqual(["progress", 30]);
    expect(neq).toHaveBeenCalledWith("status", "done");
  });

  it("puts a back-to-zero (Undo of a first step) back to Not started", async () => {
    await updateLearningProgress({ id: ID, progress: 0, from: 10 });
    expect(update).toHaveBeenCalledWith({ status: "not_started", progress: 0 });
  });

  it("refuses 100% and nonsense: finishing needs a date and goes through the form", async () => {
    for (const progress of [100, -5, 12.5]) {
      expect((await updateLearningProgress({ id: ID, progress, from: 10 })).ok).toBe(false);
    }
    expect((await updateLearningProgress({ id: ID, progress: 20, from: 100 })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("refuses a malformed id before calling the database", async () => {
    expect((await updateLearningProgress({ id: "nope", progress: 20, from: 10 })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("says so when no row changed (progress moved elsewhere, finished, deleted, or not yours)", async () => {
    reply = { data: [], error: null };
    const result = await updateLearningProgress({ id: ID, progress: 20, from: 10 });
    expect(result).toEqual({ ok: false, error: "This item changed or was removed. Reload the page and try again." });
  });
});
