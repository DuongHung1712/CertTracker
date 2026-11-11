import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCertificate, updateCertificate } from "@/features/certificates/actions";
import { deleteCourse } from "@/features/courses/actions";

const ID = "00000000-0000-0000-0000-000000000001";
const COURSE = "00000000-0000-0000-0000-000000000009";
const OTHER_COURSE = "00000000-0000-0000-0000-000000000008";

type Reply = { data: unknown; error: { code?: string; message: string } | null };

/** Each awaited query on a table takes the next reply queued for it; every builder method returns the same chain. */
const replies: Record<string, Reply[]> = {};
const updateValues = vi.fn();

function chain(table: string) {
  const self: Record<string, unknown> = {};
  const next = () => Promise.resolve(replies[table]?.shift() ?? { data: null, error: null });
  for (const method of ["select", "eq", "in", "not", "delete"]) self[method] = () => self;
  self.update = (values: unknown) => {
    updateValues(table, values);
    return self;
  };
  self.maybeSingle = next;
  self.then = (resolve: (reply: Reply) => unknown) => next().then(resolve);
  return self;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: chain }) }));

const exam = {
  id: ID,
  kind: "exam" as const,
  name: "AWS Solutions Architect Associate",
  certTypeId: ID,
  providerId: ID,
  level: "",
  validityMonths: 36,
  url: null,
  courseId: null,
};
const completion = { ...exam, kind: "completion" as const, courseId: COURSE };

const fkViolation = { code: "23503", message: "violates foreign key" };

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key];
  updateValues.mockClear();
});

describe("deleteCertificate", () => {
  it("explains that records block the delete", async () => {
    replies.certificates = [{ data: null, error: fkViolation }];
    expect(await deleteCertificate({ id: ID })).toEqual({ ok: false, error: "This certificate has records. Delete them first." });
  });
});

describe("updateCertificate kind change (spec Q6)", () => {
  it("refuses exam to completion when a record studied another course", async () => {
    replies.certificates = [{ data: { kind: "exam" }, error: null }];
    replies.training_records = [{ data: [{ course_id: OTHER_COURSE }], error: null }];
    expect(await updateCertificate(completion)).toEqual({
      ok: false,
      error: "This certificate has records with another course. Change them first.",
    });
    expect(updateValues).not.toHaveBeenCalled();
  });

  it("allows exam to completion when the records are empty or use the granting course", async () => {
    replies.certificates = [{ data: { kind: "exam" }, error: null }, { data: [{ id: ID }], error: null }];
    replies.training_records = [{ data: [{ course_id: COURSE }], error: null }];
    expect(await updateCertificate(completion)).toEqual({ ok: true, data: null });
  });

  it("allows completion to exam without looking at the records", async () => {
    replies.certificates = [{ data: [{ id: ID }], error: null }];
    expect(await updateCertificate(exam)).toEqual({ ok: true, data: null });
    expect(updateValues).toHaveBeenCalledWith("certificates", expect.objectContaining({ kind: "exam", course_id: null }));
  });
});

describe("deleteCourse", () => {
  it("names the completion the course grants", async () => {
    replies.courses = [{ data: null, error: fkViolation }];
    replies.certificates = [{ data: { name: "Machine Learning Specialization" }, error: null }];
    expect(await deleteCourse({ id: ID })).toEqual({
      ok: false,
      error: "This course grants the completion Machine Learning Specialization. Delete or change that completion first.",
    });
  });

  it("does not look for a completion when the error is not a foreign-key refusal", async () => {
    replies.courses = [{ data: null, error: { code: "XX000", message: "boom" } }];
    replies.certificates = [{ data: { name: "Never shown" }, error: null }];
    expect(await deleteCourse({ id: ID })).toEqual({ ok: false, error: "Something went wrong. Try again." });
  });
});
