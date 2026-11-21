import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const update = vi.fn();
const from = vi.fn(() => ({
  insert: (row: unknown) => {
    insert(row);
    return { select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }) };
  },
  update: (row: unknown) => {
    update(row);
    return { eq: () => ({ select: async () => ({ data: [{ id: "x" }], error: null }) }) };
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createLearningItem, proposeCourse, updateLearningItem } = await import("@/features/learning/actions");

const M = "5eed0000-0000-0000-0000-00000000b001";
const C = "5eed0000-0000-0000-0000-00000000c001";
const valid = { memberId: M, courseId: C, targetCertificateId: null, status: "in_progress" as const, progress: 30, plannedDate: null, finishedDate: null, notes: null };

describe("learning actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses invalid input without touching the database", async () => {
    const result = await createLearningItem({ ...valid, courseId: null });
    expect(result).toEqual({ ok: false, error: "Choose a course or an exam" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts a valid item in database column names", async () => {
    const result = await createLearningItem(valid);
    expect(result).toEqual({ ok: true, data: { id: "new-id" } });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ member_id: M, course_id: C, target_certificate_id: null, status: "in_progress", progress: 30 }));
  });

  it("never moves an item to another member on update", async () => {
    await updateLearningItem({ ...valid, id: "5eed0000-0000-0000-0000-0000000000a1" });
    expect(update).toHaveBeenCalledWith(expect.not.objectContaining({ member_id: expect.anything() }));
  });

  it("proposes a pending course for the member", async () => {
    const result = await proposeCourse({ name: "  Coursera ML  ", proposedProvider: "Coursera", memberId: M });
    expect(result).toEqual({ ok: true, data: { id: "new-id" } });
    expect(insert).toHaveBeenCalledWith({ name: "Coursera ML", proposed_provider: "Coursera", catalogue_status: "pending", proposed_by: M });
  });
});
