import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => ({ data: null, error: null as { code?: string; message: string } | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { approveCourse, rejectCourse } = await import("@/features/courses/actions");
const ID = "00000000-0000-0000-0000-000000000001";

describe("course proposals (decision #72)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves through approve_course, creating the completion certificate when asked", async () => {
    expect(await approveCourse({ id: ID, grantsCompletion: true })).toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledWith("approve_course", { p_id: ID, p_grants_completion: true });
  });

  it("rejects through reject_course", async () => {
    expect(await rejectCourse({ id: ID })).toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledWith("reject_course", { p_id: ID });
  });

  it("refuses a malformed id without calling the database", async () => {
    expect((await rejectCourse({ id: "nope" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("says plainly when the caller is not an admin", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "only admins can approve a course" } });
    expect(await approveCourse({ id: ID, grantsCompletion: false })).toEqual({ ok: false, error: "Only an admin can review a proposed course." });
  });
});
