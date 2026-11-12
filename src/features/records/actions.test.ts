import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateRecord } from "@/features/records/actions";
import type { RecordInput } from "@/features/records/schema";

const RECORD_ID = "5eed0000-0000-0000-0000-00000000c001";
const update = vi.fn();
let updateError: { code: string; message: string } | null = null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq: () => ({ select: async () => ({ data: updateError ? null : [{ id: RECORD_ID }], error: updateError }) }) };
      },
    }),
  }),
}));

const memberEdit = {
  id: RECORD_ID,
  memberId: "5eed0000-0000-0000-0000-00000000b001",
  certificateId: "5eed0000-0000-0000-0000-00000000d001",
  courseId: null,
  status: "in_progress",
  progress: 40,
  plannedExamDate: null,
  issuedDate: null,
  certificateUrl: null,
};

beforeEach(() => {
  update.mockClear();
  updateError = null;
});

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

describe("updateRecord and the course studied", () => {
  const edit = memberEdit as RecordInput & { id: string };

  it("sends the certificate and the course studied, so a switched certificate can clear the old course", async () => {
    await updateRecord({ ...edit, courseId: null });
    expect(update.mock.calls[0][0]).toMatchObject({ certificate_id: edit.certificateId, course_id: null });
  });

  it("explains a duplicate record", async () => {
    updateError = { code: "23505", message: "duplicate key" };
    expect(await updateRecord(edit)).toEqual({
      ok: false,
      error: "This member already has this certificate. Edit the existing one instead of creating a new one.",
    });
  });

  it("explains a course that does not prepare for the certificate, apart from the status rule", async () => {
    updateError = { code: "23514", message: "course does not prepare for this certificate" };
    const mismatch = await updateRecord(edit);
    updateError = { code: "23514", message: 'new row violates check constraint "training_records_done_needs_issue"' };
    const status = await updateRecord(edit);
    expect(mismatch).toEqual({ ok: false, error: "That course does not prepare for this certificate. Choose another course or None (self-study)." });
    expect(status).toEqual({ ok: false, error: "Status, progress and issue date do not match." });
  });
});
