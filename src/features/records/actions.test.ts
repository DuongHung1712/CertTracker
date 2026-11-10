import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateRecord } from "@/features/records/actions";
import type { RecordInput } from "@/features/records/schema";

const RECORD_ID = "5eed0000-0000-0000-0000-00000000c001";
const update = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq: () => ({ select: async () => ({ data: [{ id: RECORD_ID }], error: null }) }) };
      },
    }),
  }),
}));

const memberEdit = {
  id: RECORD_ID,
  memberId: "5eed0000-0000-0000-0000-00000000b001",
  courseId: "5eed0000-0000-0000-0000-00000000d001",
  status: "in_progress",
  progress: 40,
  plannedExamDate: null,
  issuedDate: null,
  certificateUrl: null,
};

beforeEach(() => update.mockClear());

// R10: a member's form has no Notes field, so saving it must not wipe notes an admin or manager wrote.
describe("updateRecord and notes", () => {
  it("leaves the notes column alone when the input has no notes (member form)", async () => {
    expect(await updateRecord(memberEdit as RecordInput & { id: string })).toEqual({ ok: true, data: null });
    expect(update).toHaveBeenCalledTimes(1);
    // `undefined` is dropped from the JSON body, so the column is not sent.
    expect((update.mock.calls[0][0] as { notes?: unknown }).notes).toBeUndefined();
  });

  it("treats notes: undefined the same as no notes", async () => {
    await updateRecord({ ...memberEdit, notes: undefined } as unknown as RecordInput & { id: string });
    // `undefined` is dropped from the JSON body, so the column is not sent.
    expect((update.mock.calls[0][0] as { notes?: unknown }).notes).toBeUndefined();
  });

  it("still clears notes when the admin form sends them blank", async () => {
    expect(await updateRecord({ ...memberEdit, notes: null } as RecordInput & { id: string })).toEqual({ ok: true, data: null });
    expect(update.mock.calls[0][0]).toHaveProperty("notes", null);
  });

  it("writes notes the admin form sends", async () => {
    await updateRecord({ ...memberEdit, notes: "Booked for December" } as RecordInput & { id: string });
    expect(update.mock.calls[0][0]).toHaveProperty("notes", "Booked for December");
  });
});
